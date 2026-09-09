import re
import ipaddress
import json
from io import BytesIO
from datetime import datetime
from uuid import uuid4
from urllib.parse import urlparse
from fastapi.responses import StreamingResponse
from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
)

from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from app.database import get_db
from app.routes.auth import get_current_user

from app.models import (
    Target,
    Scan,
    Finding,
    Asset,
    Vulnerability,
    User,
)

from app.scanners.web_scanner import scan_web
from app.scanners.port_scanner import scan_ports

from app.scanners.cve_scanner import (
    resolve_os_to_cpe,
    lookup_cves_by_cpe,
)

from app.services.risk_engine import calculate_risk
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    PageBreak,
)

# ============================================================
# ROUTER
# ============================================================

router = APIRouter(
    prefix="/api",
    tags=["Scans"],
)


# ============================================================
# REQUEST MODELS
# ============================================================

class ScanRequest(BaseModel):
    """
    Used by:
        POST /api/scan
        POST /api/web-scan
    """

    target: str = Field(
        min_length=1,
        max_length=2048,
    )

    port_range: str = Field(
        default="1-1000",
        min_length=1,
        max_length=100,
    )

    @field_validator("target")
    @classmethod
    def validate_target(cls, value):
        return validate_target_input(value)

    @field_validator("port_range")
    @classmethod
    def validate_ports(cls, value):
        return validate_port_range(value)

    
class PortScanRequest(BaseModel):
    """
    Used by:
        POST /api/scan/ports
    """

    target: str = Field(
        min_length=1,
        max_length=253,
    )

    port_range: str = Field(
        default="1-1000",
        min_length=1,
        max_length=100,
    )

    @field_validator("target")
    @classmethod
    def validate_target(cls, value):
        return validate_target_input(value)

    @field_validator("port_range")
    @classmethod
    def validate_ports(cls, value):
        return validate_port_range(value)

# ============================================================
# INPUT VALIDATION
# ============================================================

def validate_port_range(port_range: str) -> str:
    """
    Validate Nmap-compatible TCP port ranges.

    Accepted examples:
        80
        80,443
        1-1000
        22,80,443
        1-1000,8080
    """

    port_range = port_range.strip()

    if not port_range:
        raise ValueError(
            "Port range cannot be empty."
        )

    if len(port_range) > 100:
        raise ValueError(
            "Port range is too long."
        )

    parts = port_range.split(",")

    for part in parts:

        part = part.strip()

        if not part:
            raise ValueError(
                "Invalid port range."
            )

        # Single port
        if part.isdigit():

            port = int(part)

            if not 1 <= port <= 65535:
                raise ValueError(
                    "Port numbers must be between 1 and 65535."
                )

            continue

        # Port range
        match = re.fullmatch(
            r"(\d+)\s*-\s*(\d+)",
            part
        )

        if not match:
            raise ValueError(
                "Invalid port range. Use formats such as 80, 443, or 1-1000."
            )

        start = int(match.group(1))
        end = int(match.group(2))

        if not 1 <= start <= 65535:
            raise ValueError(
                "Starting port must be between 1 and 65535."
            )

        if not 1 <= end <= 65535:
            raise ValueError(
                "Ending port must be between 1 and 65535."
            )

        if start > end:
            raise ValueError(
                "Starting port cannot be greater than ending port."
            )

    return port_range
def validate_target_input(target: str) -> str:
    """
    Validate a scan target before it reaches the scanner.

    Supports:
        IPv4
        IPv6
        Hostnames
        HTTP URLs
        HTTPS URLs
    """

    target = target.strip()

    if not target:
        raise ValueError(
            "Target cannot be empty."
        )

    if len(target) > 2048:
        raise ValueError(
            "Target is too long."
        )

    # Reject control characters and whitespace
    if any(
        ord(character) < 32
        for character in target
    ):
        raise ValueError(
            "Target contains invalid characters."
        )

    # --------------------------------------------------------
    # URL target
    # --------------------------------------------------------

    if target.startswith(
        ("http://", "https://")
    ):

        parsed = urlparse(target)

        if parsed.scheme not in (
            "http",
            "https",
        ):
            raise ValueError(
                "Only HTTP and HTTPS URLs are supported."
            )

        if not parsed.hostname:
            raise ValueError(
                "Invalid URL. Please provide a valid hostname."
            )

        # Reject username/password in URLs
        if parsed.username or parsed.password:
            raise ValueError(
                "URLs containing usernames or passwords are not allowed."
            )

        # Validate explicit URL port
        try:
            if parsed.port is not None:
                if not 1 <= parsed.port <= 65535:
                    raise ValueError(
                        "URL port must be between 1 and 65535."
                    )
        except ValueError:
            raise ValueError(
                "Invalid URL port."
            )

        hostname = parsed.hostname

    else:

        # ----------------------------------------------------
        # IP / hostname without protocol
        # ----------------------------------------------------

        parsed = urlparse(
            f"//{target}"
        )

        hostname = parsed.hostname

        if not hostname:
            raise ValueError(
                "Invalid target. Enter an IP address or hostname."
            )

        # Validate explicit port if supplied
        try:
            if parsed.port is not None:
                if not 1 <= parsed.port <= 65535:
                    raise ValueError(
                        "Target port must be between 1 and 65535."
                    )
        except ValueError:
            raise ValueError(
                "Invalid target port."
            )

    # --------------------------------------------------------
    # Validate hostname / IP
    # --------------------------------------------------------

    try:

        ipaddress.ip_address(
            hostname
        )

    except ValueError:

        hostname_pattern = re.compile(
            r"^(?=.{1,253}$)"
            r"(?:[A-Za-z0-9]"
            r"(?:[A-Za-z0-9-]{0,61}"
            r"[A-Za-z0-9])?"
            r"\.)*"
            r"[A-Za-z0-9]"
            r"(?:[A-Za-z0-9-]{0,61}"
            r"[A-Za-z0-9])?$"
        )

        if not hostname_pattern.fullmatch(
            hostname
        ):
            raise ValueError(
                "Invalid hostname."
            )

    return target
# ============================================================
# TARGET NORMALIZATION
# ============================================================

def normalize_target(target: str):
    """
    Accepts:

        127.0.0.1
        192.168.1.10
        example.com
        http://example.com
        https://example.com
        http://example.com:8080
        https://example.com/login

    Returns:

        hostname
        web_url
    """

    target = target.strip()

    if not target:
        raise ValueError(
            "Target cannot be empty."
        )

    # --------------------------------------------------------
    # Already a URL
    # --------------------------------------------------------

    if target.startswith(("http://", "https://")):

        parsed = urlparse(target)

        if not parsed.hostname:
            raise ValueError(
                "Invalid URL. Please enter a valid URL."
            )

        hostname = parsed.hostname

        return hostname, target

    # --------------------------------------------------------
    # IP / hostname without protocol
    # --------------------------------------------------------

    parsed = urlparse(
        f"//{target}"
    )

    hostname = parsed.hostname

    if not hostname:
        raise ValueError(
            "Invalid target. Enter an IP address, hostname, or URL."
        )

    # --------------------------------------------------------
    # Default HTTP URL
    # --------------------------------------------------------

    web_url = f"http://{target}"

    return hostname, web_url


# ============================================================
# GENERATE SCAN ID
# ============================================================

def generate_scan_id():

    timestamp = datetime.utcnow().strftime(
        "%Y%m%d%H%M%S"
    )

    random_part = uuid4().hex[:6].upper()

    return f"CG-{timestamp}-{random_part}"


# ============================================================
# ASSET RISK
# ============================================================

def calculate_asset_risk(vulnerabilities):

    if not vulnerabilities:
        return "Low"

    highest_score = 0
    highest_severity = ""

    severity_order = {
        "CRITICAL": 4,
        "HIGH": 3,
        "MEDIUM": 2,
        "LOW": 1,
    }

    for vulnerability in vulnerabilities:

        severity = (
            vulnerability.get("severity") or ""
        ).upper()

        cvss = vulnerability.get(
            "cvss_score"
        )

        try:
            cvss = float(cvss)
        except (
            TypeError,
            ValueError,
        ):
            cvss = 0

        if cvss > highest_score:

            highest_score = cvss
            highest_severity = severity

        elif (
            cvss == highest_score
            and severity_order.get(
                severity,
                0,
            )
            >
            severity_order.get(
                highest_severity,
                0,
            )
        ):

            highest_severity = severity

    if (
        highest_severity == "CRITICAL"
        or highest_score >= 9.0
    ):
        return "Critical"

    if (
        highest_severity == "HIGH"
        or highest_score >= 7.0
    ):
        return "High"

    if (
        highest_severity == "MEDIUM"
        or highest_score >= 4.0
    ):
        return "Moderate"

    return "Low"


# ============================================================
# CVE SUMMARY
# ============================================================

def build_cve_summary(vulnerabilities):

    return {

        "total": len(vulnerabilities),

        "critical": sum(
            1
            for item in vulnerabilities
            if (
                item.get("severity") or ""
            ).upper()
            == "CRITICAL"
        ),

        "high": sum(
            1
            for item in vulnerabilities
            if (
                item.get("severity") or ""
            ).upper()
            == "HIGH"
        ),

        "medium": sum(
            1
            for item in vulnerabilities
            if (
                item.get("severity") or ""
            ).upper()
            == "MEDIUM"
        ),

        "low": sum(
            1
            for item in vulnerabilities
            if (
                item.get("severity") or ""
            ).upper()
            == "LOW"
        ),
    }


# ============================================================
# NETWORK SCAN HELPER
# ============================================================

def perform_network_scan(
    target,
    port_range,
    db,
    current_user,
):
    """
    Performs:

        Nmap
        Ports
        Services
        OS
        CPE
        CVEs
        Asset storage
    """

    # ========================================================
    # 1. RUN PORT SCANNER
    # ========================================================

    result = scan_ports(
        target=target,
        port_range=port_range,
    )

    # ========================================================
    # 2. HOSTNAME
    # ========================================================

    hostname = result.get(
        "hostname"
    )

    # ========================================================
    # 3. OS
    # ========================================================

    os_detection = result.get(
        "os_detection",
        {},
    )

    operating_system = os_detection.get(
        "name"
    )

    # ========================================================
    # 4. PORTS
    # ========================================================

    open_ports = result.get(
        "open_ports",
        [],
    )

    # ========================================================
    # 5. SERVICES
    # ========================================================

    services = []

    for port in open_ports:

        service = port.get(
            "service"
        )

        if (
            service
            and service not in services
        ):
            services.append(
                service
            )

    # ========================================================
    # 6. SERIALIZE
    # ========================================================

    ports_json = json.dumps(
        open_ports
    )

    services_json = json.dumps(
        services
    )

    # ========================================================
    # 7. FIND EXISTING ASSET
    # ========================================================

    asset = (
        db.query(Asset)
        .filter(
            Asset.ip_address == target,
            Asset.user_id == current_user.id,
        )
        .first()
    )

    # ========================================================
    # 8. CREATE ASSET
    # ========================================================

    if asset is None:

        asset = Asset(

            ip_address=target,

            user_id=current_user.id,

            hostname=hostname,

            operating_system=operating_system,

            open_ports=ports_json,

            services=services_json,

            risk_level="Unknown",

            last_scanned=datetime.utcnow(),
        )

        db.add(asset)

        db.flush()

    # ========================================================
    # 9. UPDATE ASSET
    # ========================================================

    else:

        asset.hostname = hostname

        asset.operating_system = (
            operating_system
        )

        asset.open_ports = ports_json

        asset.services = services_json

        asset.last_scanned = (
            datetime.utcnow()
        )

    db.commit()

    db.refresh(asset)

    # ========================================================
    # 10. CPE
    # ========================================================

    cpe_name = None

    if operating_system:

        try:

            cpe_name = resolve_os_to_cpe(
                operating_system
            )

        except RuntimeError:

            cpe_name = None

    # ========================================================
    # 11. CVE LOOKUP
    # ========================================================

    cve_results = []

    cve_error = None

    if cpe_name:

        try:

            cve_results = lookup_cves_by_cpe(
                cpe_name
            )

        except RuntimeError as error:

            cve_error = str(error)

    # ========================================================
    # 12. SAVE CVEs
    # ========================================================

    saved_vulnerabilities = []

    for cve_data in cve_results:

        cve_id = cve_data.get(
            "cve_id"
        )

        if not cve_id:
            continue

        vulnerability = (
            db.query(Vulnerability)
            .filter(
                Vulnerability.asset_id
                == asset.id,

                Vulnerability.cve_id
                == cve_id,
            )
            .first()
        )

        # ----------------------------------------------------
        # CREATE
        # ----------------------------------------------------

        if vulnerability is None:

            vulnerability = Vulnerability(

                asset_id=asset.id,

                cve_id=cve_id,

                title=cve_id,

                description=cve_data.get(
                    "description"
                ),

                severity=cve_data.get(
                    "severity"
                ),

                cvss_score=(
                    str(
                        cve_data.get(
                            "cvss_score"
                        )
                    )
                    if cve_data.get(
                        "cvss_score"
                    ) is not None
                    else None
                ),

                affected_product=cve_data.get(
                    "cpe_name"
                ),

                detected_at=datetime.utcnow(),
            )

            db.add(
                vulnerability
            )

        # ----------------------------------------------------
        # UPDATE
        # ----------------------------------------------------

        else:

            vulnerability.title = cve_id

            vulnerability.description = (
                cve_data.get(
                    "description"
                )
            )

            vulnerability.severity = (
                cve_data.get(
                    "severity"
                )
            )

            vulnerability.cvss_score = (

                str(
                    cve_data.get(
                        "cvss_score"
                    )
                )

                if cve_data.get(
                    "cvss_score"
                ) is not None

                else None
            )

            vulnerability.affected_product = (
                cve_data.get(
                    "cpe_name"
                )
            )

            vulnerability.detected_at = (
                datetime.utcnow()
            )

        saved_vulnerabilities.append({

            "cve_id": cve_id,

            "severity": cve_data.get(
                "severity"
            ),

            "cvss_score": cve_data.get(
                "cvss_score"
            ),

            "description": cve_data.get(
                "description"
            ),

            "affected_product": cve_data.get(
                "cpe_name"
            ),
        })

    # ========================================================
    # 13. ASSET RISK
    # ========================================================

    asset.risk_level = calculate_asset_risk(
        cve_results
    )

    db.commit()

    db.refresh(asset)

    # ========================================================
    # 14. RESPONSE
    # ========================================================

    response = {

        "target": result.get(
            "target",
            target,
        ),

        "port_range": result.get(
            "port_range",
            port_range,
        ),

        "open_ports": open_ports,

        "total_open_ports": result.get(
            "total_open_ports",
            len(open_ports),
        ),

        "os_detection": os_detection,

        "cpe": cpe_name,

        "cve_summary": build_cve_summary(
            saved_vulnerabilities
        ),

        "vulnerabilities":
            saved_vulnerabilities,

        "asset": {

            "id": asset.id,

            "ip_address": asset.ip_address,

            "hostname": asset.hostname,

            "operating_system":
                asset.operating_system,

            "open_ports": open_ports,

            "services": services,

            "risk_level":
                asset.risk_level,

            "last_scanned":
                asset.last_scanned,
        },
    }

    if cve_error:

        response["cve_error"] = cve_error

    return response


# ============================================================
# WEB SCAN HELPER
# ============================================================

async def perform_web_scan(
    web_url,
):
    """
    Runs the existing web scanner.
    """

    result = await scan_web(
        web_url
    )

    if result.get("status") != "completed":

        raise HTTPException(

            status_code=502,

            detail=result.get(
                "error",
                "Web scan failed.",
            ),
        )

    findings = result.get(
        "findings",
        [],
    )

    risk = calculate_risk(
        findings
    )

    return {

        "status": "completed",

        "status_code":
            result.get(
                "status_code"
            ),

        "final_url":
            result.get(
                "final_url"
            ),

        "findings":
            findings,

        "headers_checked":
            result.get(
                "headers_checked",
                [],
            ),

        "security_score":
            risk.get(
                "score"
            ),

        "grade":
            risk.get(
                "grade"
            ),

        "risk_level":
            risk.get(
                "risk_level"
            ),
    }


# ============================================================
# POST /api/scan
#
# FULL SECURITY SCAN
#
# NETWORK + WEB
# ============================================================

@router.post("/scan")
async def start_full_scan(
    request: ScanRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    try:

        # ====================================================
        # NORMALIZE TARGET
        # ====================================================

        hostname, web_url = normalize_target(
            request.target
        )

        print(
            "FULL SCAN TARGET:",
            request.target,
        )

        print(
            "HOSTNAME:",
            hostname,
        )

        print(
            "WEB URL:",
            web_url,
        )

        # ====================================================
        # NETWORK SCAN
        # ====================================================

        network_result = perform_network_scan(

            target=hostname,

            port_range=request.port_range,

            db=db,

            current_user=current_user,
        )

        # ====================================================
        # WEB SCAN
        # ====================================================

        web_result = None

        web_error = None

        try:

            web_result = await perform_web_scan(
                web_url
            )

        except Exception as error:

            web_error = str(error)

            print(
                "WEB SCAN ERROR:",
                error,
            )

        # ====================================================
        # SECURITY SCORE
        # ====================================================

        network_risk = (
            network_result["asset"]
            .get(
                "risk_level",
                "Low",
            )
        )

        network_score_map = {

            "Critical": 10,

            "High": 35,

            "Moderate": 65,

            "Low": 100,

            "Unknown": 100,
        }

        network_score = (
            network_score_map.get(
                network_risk,
                100,
            )
        )

        if web_result:

            web_score = (
                web_result.get(
                    "security_score"
                )
            )

            if web_score is not None:

                security_score = round(
                    (
                        float(web_score)
                        + network_score
                    )
                    / 2
                )

            else:

                security_score = network_score

        else:

            security_score = network_score

        # ====================================================
        # GRADE
        # ====================================================

        if security_score >= 90:

            grade = "A"

        elif security_score >= 80:

            grade = "B"

        elif security_score >= 70:

            grade = "C"

        elif security_score >= 60:

            grade = "D"

        else:

            grade = "F"

        # ====================================================
        # COMBINED RISK
        # ====================================================

        if (
            network_risk
            == "Critical"
        ):

            risk_level = "Critical"

        elif (
            network_risk
            == "High"
        ):

            risk_level = "High"

        elif web_result and (
            web_result.get(
                "risk_level"
            )
            == "High"
        ):

            risk_level = "High"

        elif (
            network_risk
            == "Moderate"
        ):

            risk_level = "Moderate"

        else:

            risk_level = (
                web_result.get(
                    "risk_level",
                    "Low",
                )
                if web_result
                else network_risk
            )

        # ====================================================
        # CREATE TARGET
        # ====================================================

        target_record = (
            db.query(Target)
            .filter(
                Target.url == web_url,
                Target.user_id == current_user.id,
            )
            .first()
        )

        if target_record is None:

            target_record = Target(
                url=web_url,
                user_id=current_user.id,
            )

            db.add(
                target_record
            )

            db.commit()

            db.refresh(
                target_record
            )

        # ====================================================
        # CREATE SCAN RECORD
        # ====================================================

        scan = Scan(

            scan_id=generate_scan_id(),

            user_id=current_user.id,

            target_id=target_record.id,

            status="completed",

            scan_type="full",

            started_at=datetime.utcnow(),

            completed_at=datetime.utcnow(),

            security_score=security_score,

            grade=grade,

            risk_level=risk_level,
        )

        db.add(
            scan
        )

        db.commit()

        db.refresh(
            scan
        )

        # ====================================================
        # SAVE WEB FINDINGS
        # ====================================================

        if web_result:

            for finding_data in web_result.get(
                "findings",
                [],
            ):

                finding = Finding(

                    scan_id=scan.id,

                    title=finding_data.get(
                        "title"
                    ),

                    severity=finding_data.get(
                        "severity"
                    ),

                    category=finding_data.get(
                        "category"
                    ),

                    description=finding_data.get(
                        "description"
                    ),

                    recommendation=finding_data.get(
                        "recommendation"
                    ),
                )

                db.add(
                    finding
                )

            db.commit()

        # ====================================================
        # COMBINED SUMMARY
        # ====================================================

        cve_summary = (
            network_result[
                "cve_summary"
            ]
        )

        web_findings = (
            web_result.get(
                "findings",
                [],
            )
            if web_result
            else []
        )

        # ====================================================
        # RETURN FULL RESULT
        # ====================================================

        response = {

            "scan_id":
                scan.scan_id,

            "status":
                "completed",

            "scan_type":
                "full",

            "target":
                request.target,

            "hostname":
                hostname,

            "web_url":
                web_url,

            "port_range":
                request.port_range,

            "security_score":
                security_score,

            "grade":
                grade,

            "risk_level":
                risk_level,

            "started_at":
                scan.started_at,

            "completed_at":
                scan.completed_at,

            # ------------------------------------------------
            # NETWORK
            # ------------------------------------------------

            "network_scan": {

                "open_ports":
                    network_result[
                        "open_ports"
                    ],

                "total_open_ports":
                    network_result[
                        "total_open_ports"
                    ],

                "os_detection":
                    network_result[
                        "os_detection"
                    ],

                "cpe":
                    network_result[
                        "cpe"
                    ],

                "cve_summary":
                    cve_summary,

                "vulnerabilities":
                    network_result[
                        "vulnerabilities"
                    ],

                "asset":
                    network_result[
                        "asset"
                    ],
            },

            # ------------------------------------------------
            # TOP LEVEL FIELDS
            #
            # These are included so your existing frontend
            # can use them without major changes.
            # ------------------------------------------------

            "open_ports":
                network_result[
                    "open_ports"
                ],

            "total_open_ports":
                network_result[
                    "total_open_ports"
                ],

            "os_detection":
                network_result[
                    "os_detection"
                ],

            "cpe":
                network_result[
                    "cpe"
                ],

            "cve_summary":
                cve_summary,

            "vulnerabilities":
                network_result[
                    "vulnerabilities"
                ],

            "asset":
                network_result[
                    "asset"
                ],

            # ------------------------------------------------
            # WEB
            # ------------------------------------------------

            "web_scan":
                web_result,

            "web_findings":
                web_findings,
        }

        if web_error:

            response[
                "web_scan_error"
            ] = web_error

                # ====================================================
        # SAVE FINAL SCAN METADATA
        # ====================================================

        scan.status_code = (
            web_result.get("status_code")
            if web_result
            else None
        )

        scan.final_url = (
            web_result.get("final_url")
            if web_result
            else None
        )

        # ====================================================
        # SAVE COMPLETE REPORT SNAPSHOT
        # ====================================================

        scan.report_data = json.dumps(
            response,
            default=str
        )

        db.commit()
        db.refresh(scan)

        return response

    except ValueError as error:

        db.rollback()

        raise HTTPException(

            status_code=400,

            detail=str(error),
        )

    except HTTPException:

        db.rollback()

        raise

    except Exception as error:

        db.rollback()

        print(
            "FULL SCAN ERROR:",
            error,
        )

        raise HTTPException(

            status_code=500,

            detail=(
                f"Full scan failed: {str(error)}"
            ),
        )


# ============================================================
# POST /api/web-scan
#
# WEB SECURITY SCAN ONLY
# ============================================================

@router.post("/web-scan")
async def start_web_scan(
    request: ScanRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    try:

        _, web_url = normalize_target(
            request.target
        )

        result = await perform_web_scan(
            web_url
        )

        # ----------------------------------------------------
        # CREATE TARGET
        # ----------------------------------------------------

        target_record = (
            db.query(Target)
            .filter(
                Target.url == web_url,
                Target.user_id == current_user.id,
            )
            .first()
        )

        if target_record is None:

            target_record = Target(
                url=web_url,
                user_id=current_user.id,
            )

            db.add(
                target_record
            )

            db.commit()

            db.refresh(
                target_record
            )

        # ----------------------------------------------------
        # RISK
        # ----------------------------------------------------

        security_score = result.get(
            "security_score"
        )

        grade = result.get(
            "grade"
        )

        risk_level = result.get(
            "risk_level"
        )

        # ----------------------------------------------------
        # SCAN
        # ----------------------------------------------------

        scan = Scan(

            scan_id=generate_scan_id(),

            user_id=current_user.id,

            target_id=target_record.id,

            status="completed",

            scan_type="web",

            started_at=datetime.utcnow(),

            completed_at=datetime.utcnow(),

            security_score=security_score,

            grade=grade,

            risk_level=risk_level,
        )

        db.add(
            scan
        )

        db.commit()

        db.refresh(
            scan
        )

        # ----------------------------------------------------
        # FINDINGS
        # ----------------------------------------------------

        findings = result.get(
            "findings",
            [],
        )

        for finding_data in findings:

            finding = Finding(

                scan_id=scan.id,

                title=finding_data.get(
                    "title"
                ),

                severity=finding_data.get(
                    "severity"
                ),

                category=finding_data.get(
                    "category"
                ),

                description=finding_data.get(
                    "description"
                ),

                recommendation=finding_data.get(
                    "recommendation"
                ),
            )

            db.add(
                finding
            )

        db.commit()

        # ----------------------------------------------------
        # SUMMARY
        # ----------------------------------------------------

        summary = {

            "critical": 0,

            "high": 0,

            "medium": 0,

            "low": 0,

            "informational": 0,

            "total": len(findings),
        }

        for finding in findings:

            severity = (
                finding.get(
                    "severity",
                    "",
                )
                .lower()
            )

            if severity in summary:

                summary[
                    severity
                ] += 1

        # ========================================================
        # COMPLETE WEB REPORT
        # ========================================================

        response = {

            "scan_id":
                scan.scan_id,

            "status":
                "completed",

            "scan_type":
                "web",

            "target":
                web_url,

            "security_score":
                security_score,

            "grade":
                grade,

            "risk_level":
                risk_level,

            "started_at":
                scan.started_at,

            "completed_at":
                scan.completed_at,

            "status_code":
                result.get("status_code"),

            "final_url":
                result.get("final_url"),

            "summary":
                summary,

            "web_scan":
                result,

            "web_findings":
                findings,
        }
        scan.report_data = json.dumps(
            response,
            default=str
        )

        db.commit()
        db.refresh(scan)

        return response

        # ========================================================
        # SAVE COMPLETE REPORT SNAPSHOT
        # ========================================================

        scan.status_code = result.get(
            "status_code"
        )

        scan.final_url = result.get(
            "final_url"
        )

        
        db.commit()

        return response
    except ValueError as error:

        db.rollback()

        raise HTTPException(

            status_code=400,

            detail=str(error),
        )

    except HTTPException:

        db.rollback()

        raise

    except Exception as error:

        db.rollback()

        raise HTTPException(

            status_code=500,

            detail=(
                f"Web scan failed: {str(error)}"
            ),
        )


# ============================================================
# POST /api/scan/ports
#
# PORT SCAN ONLY
# ============================================================

@router.post("/scan/ports")
def start_port_scan(
    request: PortScanRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Port Security Scan.

    Performs:
        - Port discovery
        - Service detection
        - OS detection
        - CPE resolution
        - CVE lookup
        - Asset storage
        - Scan-history storage
    """

    started_at = datetime.utcnow()

    try:
        # --------------------------------------------------------
        # 1. NORMALIZE TARGET
        # --------------------------------------------------------
        hostname, web_url = normalize_target(request.target)

        # --------------------------------------------------------
        # 2. RUN NETWORK SCAN
        # --------------------------------------------------------
        network_result = perform_network_scan(
            target=hostname,
            port_range=request.port_range,
            db=db,
            current_user=current_user,
        )

        # --------------------------------------------------------
        # 3. CREATE / FIND TARGET RECORD
        # --------------------------------------------------------
        target_record = (
            db.query(Target)
            .filter(
                Target.url == web_url,
                Target.user_id == current_user.id,
            )
            .first()
        )

        if target_record is None:
            target_record = Target(
                url=web_url,
                user_id=current_user.id,
            )
            db.add(target_record)
            db.commit()
            db.refresh(target_record)

        # --------------------------------------------------------
        # 4. CALCULATE SCORE / GRADE FOR PORT SCAN
        # --------------------------------------------------------
        risk_level = network_result.get("asset", {}).get(
            "risk_level", "Low"
        )

        score_map = {
            "Critical": 10,
            "High": 35,
            "Moderate": 65,
            "Low": 100,
            "Unknown": 100,
        }

        security_score = score_map.get(risk_level, 100)

        if security_score >= 90:
            grade = "A"
        elif security_score >= 80:
            grade = "B"
        elif security_score >= 70:
            grade = "C"
        elif security_score >= 60:
            grade = "D"
        else:
            grade = "F"

        # --------------------------------------------------------
        # 5. CREATE SCAN HISTORY RECORD
        # --------------------------------------------------------
        scan = Scan(
            scan_id=generate_scan_id(),
            user_id=current_user.id,
            target_id=target_record.id,
            scan_type="ports",
            status="completed",
            started_at=started_at,
            completed_at=datetime.utcnow(),
            security_score=security_score,
            grade=grade,
            risk_level=risk_level,
        )

        db.add(scan)
        db.commit()
        db.refresh(scan)

        # --------------------------------------------------------
        # 6. BUILD COMPLETE PORT REPORT
        # --------------------------------------------------------

        response = {
            "scan_id": scan.scan_id,
            "status": "completed",
            "scan_type": "ports",
            "target": request.target,
            "hostname": hostname,
            "port_range": request.port_range,
            "security_score": security_score,
            "grade": grade,
            "risk_level": risk_level,
            "started_at": scan.started_at,
            "completed_at": scan.completed_at,

            # Complete network information
            **network_result,
        }
        scan.report_data = json.dumps(
            response,
            default=str
        )

        db.commit()
        db.refresh(scan)

        return response

        # --------------------------------------------------------
        # 7. SAVE COMPLETE REPORT SNAPSHOT
        # --------------------------------------------------------

        

        db.commit()

        return response

    except ValueError as error:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail=str(error),
        )

    except HTTPException:
        db.rollback()
        raise

    except Exception as error:
        db.rollback()
        print("PORT SCAN ERROR:", error)
        raise HTTPException(
            status_code=500,
            detail=f"Port scan failed: {str(error)}",
        )


# ============================================================
# GET /api/vulnerabilities/cve
# ============================================================

@router.get("/vulnerabilities/cve")
def lookup_cve(
    cpe: str,
):

    if not cpe:

        raise HTTPException(

            status_code=400,

            detail="CPE is required.",
        )

    try:

        vulnerabilities = (
            lookup_cves_by_cpe(
                cpe
            )
        )

        return {

            "cpe":
                cpe,

            "total":
                len(vulnerabilities),

            "vulnerabilities":
                vulnerabilities,
        }

    except RuntimeError as error:

        raise HTTPException(

            status_code=502,

            detail=str(error),
        )


# ============================================================
# GET /api/dashboard/summary
# ============================================================

@router.get("/dashboard/summary")
def dashboard_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    scans = (
        db.query(Scan)
        .filter(Scan.user_id == current_user.id)
        .all()
    )

    total_scans = len(scans)

    critical = 0
    high = 0
    medium = 0
    low = 0
    informational = 0

    total_findings = 0

    scores = []

    full_scans = 0
    web_scans = 0
    port_scans = 0

    for scan in scans:

        scan_type = getattr(scan, "scan_type", "full")

        if scan_type == "full":
            full_scans += 1
        elif scan_type == "web":
            web_scans += 1
        elif scan_type == "ports":
            port_scans += 1

        for finding in scan.findings:

            total_findings += 1

            severity = (
                finding.severity or ""
            ).lower()

            if severity == "critical":

                critical += 1

            elif severity == "high":

                high += 1

            elif severity == "medium":

                medium += 1

            elif severity == "low":

                low += 1

            elif severity == "informational":

                informational += 1

        if scan.security_score is not None:

            scores.append(
                scan.security_score
            )

    average_score = (

        round(
            sum(scores)
            / len(scores)
        )

        if scores

        else 100
    )

    return {

        "total_scans":
            total_scans,

        "scan_types": {
            "full": full_scans,
            "web": web_scans,
            "ports": port_scans,
        },

        "critical":
            critical,

        "high":
            high,

        "medium":
            medium,

        "low":
            low,

        "informational":
            informational,

        "total_findings":
            total_findings,

        "security_score":
            average_score,
    }


# ============================================================
# GET /api/scans
# GET ALL SCANS
# ============================================================

@router.get("/scans")
def get_scans(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    print("====================================")
    print("GET /api/scans CALLED")
    print("====================================")

    try:
        scans = (
            db.query(Scan)
            .filter(Scan.user_id == current_user.id)
            .order_by(
                Scan.started_at.desc()
            )
            .all()
        )

        print("Number of scans:", len(scans))

        results = []

        for scan in scans:

            scan_data = {
                "scan_id": scan.scan_id,

                "scan_type": (
                    getattr(
                        scan,
                        "scan_type",
                        None
                    )
                    or "full"
                ),

                "target": (
                    scan.target.url
                    if scan.target
                    else None
                ),

                "status": scan.status,

                "security_score": (
                    scan.security_score
                ),

                "grade": scan.grade,

                "risk_level": scan.risk_level,

                "started_at": (
                    scan.started_at
                ),

                "completed_at": (
                    scan.completed_at
                ),

                "findings_count": (
                    len(scan.findings)
                    if scan.findings
                    else 0
                )
            }

            results.append(scan_data)

        response = {
            "total": len(results),
            "scans": results
        }

        print("Returning response:")
        print(response)

        return response

    except Exception as error:

        print("====================================")
        print("GET /api/scans ERROR")
        print("====================================")
        print(str(error))

        db.rollback()

        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve scans: {str(error)}"
        )
# ============================================================
# GET /api/scans/{scan_id}
# ============================================================

# ============================================================
# GET /api/scans/{scan_id}
# COMPLETE INDIVIDUAL SCAN REPORT
# ============================================================

@router.get("/scans/{scan_id}")
def get_scan(
    scan_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    scan = (
        db.query(Scan)
        .filter(
            Scan.scan_id == scan_id,
            Scan.user_id == current_user.id,
        )
        .first()
    )

    if not scan:

        raise HTTPException(
            status_code=404,
            detail="Scan not found."
        )
    # ========================================================
    # LOAD COMPLETE STORED REPORT
    # ========================================================

    if scan.report_data:

        try:
            stored_report = json.loads(
                scan.report_data
            )

            stored_report["report_data_available"] = True

            return stored_report

        except (
            json.JSONDecodeError,
            TypeError
        ):

            print(
                "WARNING: Invalid stored report data for",
                scan.scan_id
            )


    

    findings = []

    for finding in scan.findings:

        findings.append({

            "id":
                finding.id,

            "title":
                finding.title,

            "severity":
                finding.severity,

            "category":
                finding.category,

            "description":
                finding.description,

            "recommendation":
                finding.recommendation,
        })

    # ========================================================
    # SEVERITY COUNTS
    # ========================================================

    severity_counts = {

        "critical": 0,

        "high": 0,

        "medium": 0,

        "low": 0,

        "informational": 0,
    }

    for finding in findings:

        severity = (
            finding["severity"] or ""
        ).lower()

        if severity in severity_counts:

            severity_counts[
                severity
            ] += 1

    # ========================================================
    # OLD-SCAN FALLBACK RESPONSE
    # ========================================================

    return {

        "scan_id":
            scan.scan_id,

        "status":
            scan.status,

        "scan_type":
            getattr(
                scan,
                "scan_type",
                "full"
            ),

        "target":
            (
                scan.target.url
                if scan.target
                else None
            ),

        "security_score":
            scan.security_score,

        "grade":
            scan.grade,

        "risk_level":
            scan.risk_level,

        "started_at":
            scan.started_at,

        "completed_at":
            scan.completed_at,

        "status_code":
            scan.status_code,

        "final_url":
            scan.final_url,

        "summary": {

            **severity_counts,

            "total":
                len(findings),
        },

        "findings":
            findings,

        "report_data_available":
            False,
    }


# ============================================================
# GET /api/assets
# ============================================================

@router.get("/assets")
def get_assets(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    assets = (
        db.query(Asset)
        .filter(Asset.user_id == current_user.id)
        .order_by(
            Asset.last_scanned.desc()
        )
        .all()
    )

    results = []

    for asset in assets:

        # ----------------------------------------------------
        # PORTS
        # ----------------------------------------------------

        try:

            open_ports = (

                json.loads(
                    asset.open_ports
                )

                if asset.open_ports

                else []
            )

        except (
            json.JSONDecodeError,
            TypeError,
        ):

            open_ports = []

        # ----------------------------------------------------
        # SERVICES
        # ----------------------------------------------------

        try:

            services = (

                json.loads(
                    asset.services
                )

                if asset.services

                else []
            )

        except (
            json.JSONDecodeError,
            TypeError,
        ):

            services = []

        # ----------------------------------------------------
        # VULNERABILITIES
        # ----------------------------------------------------

        vulnerabilities = []

        for vulnerability in asset.vulnerabilities:

            vulnerabilities.append({

                "id":
                    vulnerability.id,

                "cve_id":
                    vulnerability.cve_id,

                "title":
                    vulnerability.title,

                "severity":
                    vulnerability.severity,

                "cvss_score":
                    vulnerability.cvss_score,

                "description":
                    vulnerability.description,

                "affected_product":
                    vulnerability.affected_product,

                "detected_at":
                    vulnerability.detected_at,
            })

        # ----------------------------------------------------
        # RESULT
        # ----------------------------------------------------

        results.append({

            "id":
                asset.id,

            "ip_address":
                asset.ip_address,

            "hostname":
                asset.hostname,

            "operating_system":
                asset.operating_system,

            "open_ports":
                open_ports,

            "services":
                services,

            "risk_level":
                asset.risk_level,

            "last_scanned":
                asset.last_scanned,

            "vulnerabilities_count":
                len(vulnerabilities),

            "vulnerabilities":
                vulnerabilities,
        })

    return {

        "total":
            len(results),

        "assets":
            results,
    }


# ============================================================
# GET /api/vulnerabilities
# ============================================================

@router.get("/vulnerabilities")
def get_vulnerabilities(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    vulnerabilities = (
        db.query(Vulnerability)
        .join(Asset, Vulnerability.asset_id == Asset.id)
        .filter(Asset.user_id == current_user.id)
        .order_by(
            Vulnerability.detected_at.desc()
        )
        .all()
    )

    results = []

    for vulnerability in vulnerabilities:

        results.append({

            "id":
                vulnerability.id,

            "cve_id":
                vulnerability.cve_id,

            "title":
                vulnerability.title,

            "severity":
                vulnerability.severity,

            "cvss_score":
                vulnerability.cvss_score,

            "description":
                vulnerability.description,

            "affected_product":
                vulnerability.affected_product,

            "asset_id":
                vulnerability.asset_id,

            "detected_at":
                vulnerability.detected_at,
        })

    return {

        "total":
            len(results),

        "vulnerabilities":
            results,
    }
# ============================================================
# DOWNLOAD SCAN REPORT AS PDF
# ============================================================

@router.get("/scans/{scan_id}/report/pdf")
def download_scan_report_pdf(
    scan_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Generate and download a detailed CyberGuard security report.

    Supports:
        - Full Security Scan
        - Web Security Scan
        - Port Security Scan

    Uses the stored report_data snapshot when available. Older scans
    without report_data are rebuilt from the Scan and Finding records.
    """

    # ========================================================
    # 1. FIND SCAN
    # ========================================================

    scan = (
        db.query(Scan)
        .filter(
            Scan.scan_id == scan_id,
            Scan.user_id == current_user.id,
        )
        .first()
    )

    if not scan:
        raise HTTPException(
            status_code=404,
            detail="Scan not found."
        )

    # ========================================================
    # 2. LOAD STORED REPORT OR BUILD FALLBACK REPORT
    # ========================================================

    stored_report_data = getattr(
        scan,
        "report_data",
        None
    )

    report = None

    if stored_report_data:
        try:
            if isinstance(stored_report_data, str):
                report = json.loads(stored_report_data)
            elif isinstance(stored_report_data, dict):
                report = stored_report_data
            else:
                raise ValueError(
                    "Unsupported report data format."
                )
        except (
            json.JSONDecodeError,
            TypeError,
            ValueError,
        ) as error:
            raise HTTPException(
                status_code=500,
                detail=f"Stored report data is invalid: {error}"
            )

    # ========================================================
    # 3. FALLBACK FOR OLDER SCANS
    # ========================================================

    if not isinstance(report, dict):

        fallback_findings = []
        severity_counts = {
            "critical": 0,
            "high": 0,
            "medium": 0,
            "low": 0,
            "informational": 0,
        }

        for finding in (scan.findings or []):

            severity = str(
                finding.severity or "informational"
            ).lower()

            if severity not in severity_counts:
                severity = "informational"

            severity_counts[severity] += 1

            fallback_findings.append({
                "id": finding.id,
                "title": finding.title,
                "severity": finding.severity,
                "category": finding.category,
                "description": finding.description,
                "recommendation": finding.recommendation,
            })

        target_url = (
            scan.target.url
            if scan.target
            else "N/A"
        )

        report = {
            "scan_id": scan.scan_id,
            "status": scan.status,
            "scan_type": getattr(
                scan,
                "scan_type",
                "full"
            ),
            "target": target_url,
            "security_score": scan.security_score,
            "grade": scan.grade,
            "risk_level": scan.risk_level,
            "started_at": scan.started_at,
            "completed_at": scan.completed_at,
            "status_code": getattr(scan, "status_code", None),
            "final_url": getattr(scan, "final_url", None),
            "summary": {
                **severity_counts,
                "total": len(fallback_findings),
            },
            "findings": fallback_findings,
            "web_findings": [],
            "web_scan": {},
            "network_scan": {},
            "open_ports": [],
            "total_open_ports": 0,
            "network_vulnerabilities": [],
            "vulnerabilities": [],
            "cve_summary": {},
        }

    # ========================================================
    # 4. SAFE TEXT HELPER
    # ========================================================

    def safe(value):
        """
        Safely convert arbitrary values to ReportLab text.
        """

        if value is None:
            return "N/A"

        text = str(value)

        text = text.replace(
            "&",
            "&amp;"
        )

        text = text.replace(
            "<",
            "&lt;"
        )

        text = text.replace(
            ">",
            "&gt;"
        )

        return text

    # ========================================================
    # 5. BASIC INFORMATION
    # ========================================================

    scan_id_value = report.get(
        "scan_id",
        scan.scan_id
    )

    scan_type = str(
        report.get(
            "scan_type",
            getattr(
                scan,
                "scan_type",
                "full"
            )
        )
    ).upper()

    target = report.get(
        "target"
    )

    if not target:
        target = (
            scan.target.url
            if scan.target
            else "N/A"
        )

    status = report.get(
        "status",
        scan.status
    )

    score = report.get(
        "security_score",
        scan.security_score
    )

    grade = report.get(
        "grade",
        scan.grade
    )

    risk = report.get(
        "risk_level",
        scan.risk_level
    )

    started_at = report.get(
        "started_at",
        scan.started_at
    )

    completed_at = report.get(
        "completed_at",
        scan.completed_at
    )

    status_code = report.get(
        "status_code"
    )

    final_url = report.get(
        "final_url"
    )

    # ========================================================
    # 6. SUMMARY
    # ========================================================

    summary = report.get(
        "summary",
        {}
    )

    if not isinstance(
        summary,
        dict
    ):
        summary = {}

    # ========================================================
    # 7. FINDINGS
    # ========================================================

    findings = report.get(
        "findings",
        []
    )

    if not isinstance(
        findings,
        list
    ):
        findings = []

    # Some reports may store web findings separately.
    web_findings = report.get(
        "web_findings",
        []
    )

    if not isinstance(
        web_findings,
        list
    ):
        web_findings = []

    # Combine without duplicating identical findings.
    all_findings = []

    for item in findings + web_findings:

        if not isinstance(
            item,
            dict
        ):
            continue

        signature = (
            item.get("title"),
            item.get("severity"),
            item.get("category"),
        )

        already_exists = any(
            (
                existing.get("title"),
                existing.get("severity"),
                existing.get("category"),
            )
            == signature
            for existing in all_findings
        )

        if not already_exists:
            all_findings.append(item)

    # ========================================================
    # 8. WEB DATA
    # ========================================================

    web_scan = report.get(
        "web_scan"
    )

    if not isinstance(
        web_scan,
        dict
    ):
        web_scan = {}

    # ========================================================
    # 9. NETWORK DATA
    # ========================================================

    network = report.get(
        "network_scan"
    )

    if network is None:
        network = report.get(
            "network_result"
        )

    if network is None:
        network = report.get(
            "network"
        )

    if not isinstance(
        network,
        dict
    ):
        network = {}

    # ========================================================
    # 10. PORT / OS / CPE DATA
    # ========================================================

    open_ports = report.get(
        "open_ports",
        network.get(
            "open_ports",
            []
        )
    )

    if not isinstance(
        open_ports,
        list
    ):
        open_ports = []

    total_open_ports = report.get(
        "total_open_ports",
        network.get(
            "total_open_ports",
            len(open_ports)
        )
    )

    os_detection = report.get(
        "os_detection",
        network.get(
            "os_detection"
        )
    )

    cpe = report.get(
        "cpe",
        network.get(
            "cpe"
        )
    )

    hostname = report.get(
        "hostname"
    )

    port_range = report.get(
        "port_range"
    )

    # ========================================================
    # 11. CVE / NETWORK VULNERABILITIES
    # ========================================================

    network_vulnerabilities = network.get(
        "vulnerabilities",
        report.get(
            "vulnerabilities",
            []
        )
    )

    if not isinstance(
        network_vulnerabilities,
        list
    ):
        network_vulnerabilities = []

    cve_summary = network.get(
        "cve_summary",
        report.get(
            "cve_summary",
            {}
        )
    )

    if not isinstance(
        cve_summary,
        dict
    ):
        cve_summary = {}

    # ========================================================
    # 12. PDF BUFFER
    # ========================================================

    buffer = BytesIO()

    # ========================================================
    # 13. PAGE FOOTER
    # ========================================================

    def add_page_number(
        canvas,
        doc
    ):

        canvas.saveState()

        width, height = A4

        canvas.setStrokeColor(
            colors.HexColor(
                "#1D3F47"
            )
        )

        canvas.line(
            15 * mm,
            12 * mm,
            width - 15 * mm,
            12 * mm
        )

        canvas.setFont(
            "Helvetica",
            7
        )

        canvas.setFillColor(
            colors.HexColor(
                "#607D84"
            )
        )

        canvas.drawString(
            15 * mm,
            7 * mm,
            "CyberGuard Security Assessment"
        )

        canvas.drawRightString(
            width - 15 * mm,
            7 * mm,
            f"Page {doc.page}"
        )

        canvas.restoreState()

    # ========================================================
    # 14. DOCUMENT
    # ========================================================

    document = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=15 * mm,
        leftMargin=15 * mm,
        topMargin=18 * mm,
        bottomMargin=18 * mm,
        title=(
            f"CyberGuard Security Report - "
            f"{scan_id_value}"
        ),
        author="CyberGuard",
    )

    # ========================================================
    # 15. STYLES
    # ========================================================

    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        "CyberGuardTitle",
        parent=styles["Title"],
        fontName="Helvetica-Bold",
        fontSize=24,
        leading=28,
        alignment=TA_CENTER,
        textColor=colors.HexColor(
            "#063D35"
        ),
        spaceAfter=8 * mm,
    )

    subtitle_style = ParagraphStyle(
        "CyberGuardSubtitle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=10,
        leading=14,
        alignment=TA_CENTER,
        textColor=colors.HexColor(
            "#52786D"
        ),
        spaceAfter=10 * mm,
    )

    heading_style = ParagraphStyle(
        "CyberGuardHeading",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=16,
        leading=20,
        textColor=colors.HexColor(
            "#063D35"
        ),
        spaceBefore=4 * mm,
        spaceAfter=5 * mm,
    )

    subheading_style = ParagraphStyle(
        "CyberGuardSubheading",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=11,
        leading=14,
        textColor=colors.HexColor(
            "#087F6A"
        ),
        spaceBefore=3 * mm,
        spaceAfter=3 * mm,
    )

    normal_style = ParagraphStyle(
        "CyberGuardNormal",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9,
        leading=13,
        textColor=colors.HexColor(
            "#263F3B"
        ),
        spaceAfter=2 * mm,
    )

    small_style = ParagraphStyle(
        "CyberGuardSmall",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=7.5,
        leading=10,
        textColor=colors.HexColor(
            "#607D84"
        ),
    )

    score_style = ParagraphStyle(
        "CyberGuardScore",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=25,
        leading=28,
        alignment=TA_CENTER,
        textColor=colors.HexColor(
            "#087F6A"
        ),
    )

    # ========================================================
    # 16. STORY
    # ========================================================

    story = []

    # ========================================================
    # COVER / HEADER
    # ========================================================

    story.append(
        Spacer(
            1,
            12 * mm
        )
    )

    story.append(
        Paragraph(
            "CYBERGUARD",
            title_style
        )
    )

    story.append(
        Paragraph(
            "SECURITY ASSESSMENT REPORT",
            subtitle_style
        )
    )

    story.append(
        Paragraph(
            safe(target),
            ParagraphStyle(
                "Target",
                parent=subtitle_style,
                fontSize=12,
                textColor=colors.HexColor(
                    "#087F6A"
                ),
            )
        )
    )

    story.append(
        Spacer(
            1,
            6 * mm
        )
    )

    # ========================================================
    # REPORT OVERVIEW TABLE
    # ========================================================

    overview_rows = [
        [
            Paragraph(
                "<b>Scan ID</b>",
                normal_style
            ),
            Paragraph(
                safe(scan_id_value),
                normal_style
            ),
        ],
        [
            Paragraph(
                "<b>Scan Type</b>",
                normal_style
            ),
            Paragraph(
                safe(scan_type),
                normal_style
            ),
        ],
        [
            Paragraph(
                "<b>Status</b>",
                normal_style
            ),
            Paragraph(
                safe(status),
                normal_style
            ),
        ],
        [
            Paragraph(
                "<b>Target</b>",
                normal_style
            ),
            Paragraph(
                safe(target),
                normal_style
            ),
        ],
        [
            Paragraph(
                "<b>Started</b>",
                normal_style
            ),
            Paragraph(
                safe(started_at),
                normal_style
            ),
        ],
        [
            Paragraph(
                "<b>Completed</b>",
                normal_style
            ),
            Paragraph(
                safe(completed_at),
                normal_style
            ),
        ],
        [
            Paragraph(
                "<b>HTTP Status</b>",
                normal_style
            ),
            Paragraph(
                safe(status_code),
                normal_style
            ),
        ],
        [
            Paragraph(
                "<b>Final URL</b>",
                normal_style
            ),
            Paragraph(
                safe(final_url),
                normal_style
            ),
        ],
    ]

    overview_table = Table(
        overview_rows,
        colWidths=[
            45 * mm,
            125 * mm,
        ],
    )

    overview_table.setStyle(
        TableStyle(
            [
                (
                    "BACKGROUND",
                    (0, 0),
                    (0, -1),
                    colors.HexColor(
                        "#E8F3F0"
                    ),
                ),
                (
                    "GRID",
                    (0, 0),
                    (-1, -1),
                    0.4,
                    colors.HexColor(
                        "#A5C8BE"
                    ),
                ),
                (
                    "VALIGN",
                    (0, 0),
                    (-1, -1),
                    "TOP",
                ),
                (
                    "LEFTPADDING",
                    (0, 0),
                    (-1, -1),
                    7,
                ),
                (
                    "RIGHTPADDING",
                    (0, 0),
                    (-1, -1),
                    7,
                ),
                (
                    "TOPPADDING",
                    (0, 0),
                    (-1, -1),
                    6,
                ),
                (
                    "BOTTOMPADDING",
                    (0, 0),
                    (-1, -1),
                    6,
                ),
            ]
        )
    )

    story.append(
        overview_table
    )

    story.append(
        Spacer(
            1,
            8 * mm
        )
    )

    # ========================================================
    # SECURITY RATING
    # ========================================================

    story.append(
        Paragraph(
            "1. Security Rating",
            heading_style
        )
    )

    rating_rows = [
        [
            Paragraph(
                "<b>SECURITY SCORE</b>",
                normal_style
            ),
            Paragraph(
                "<b>GRADE</b>",
                normal_style
            ),
            Paragraph(
                "<b>RISK LEVEL</b>",
                normal_style
            ),
        ],
        [
            Paragraph(
                safe(
                    f"{score}/100"
                    if score is not None
                    else "N/A"
                ),
                score_style
            ),
            Paragraph(
                safe(
                    grade
                    if grade is not None
                    else "N/A"
                ),
                score_style
            ),
            Paragraph(
                safe(
                    risk
                    if risk is not None
                    else "N/A"
                ),
                ParagraphStyle(
                    "Risk",
                    parent=score_style,
                    textColor=(
                        colors.HexColor(
                            "#B45309"
                        )
                    ),
                )
            ),
        ],
    ]

    rating_table = Table(
        rating_rows,
        colWidths=[
            56 * mm,
            56 * mm,
            58 * mm,
        ],
    )

    rating_table.setStyle(
        TableStyle(
            [
                (
                    "BACKGROUND",
                    (0, 0),
                    (-1, 0),
                    colors.HexColor(
                        "#0B8F72"
                    ),
                ),
                (
                    "TEXTCOLOR",
                    (0, 0),
                    (-1, 0),
                    colors.white,
                ),
                (
                    "BACKGROUND",
                    (0, 1),
                    (-1, 1),
                    colors.HexColor(
                        "#F2F8F6"
                    ),
                ),
                (
                    "GRID",
                    (0, 0),
                    (-1, -1),
                    0.5,
                    colors.HexColor(
                        "#A5C8BE"
                    ),
                ),
                (
                    "VALIGN",
                    (0, 0),
                    (-1, -1),
                    "MIDDLE",
                ),
                (
                    "ALIGN",
                    (0, 0),
                    (-1, -1),
                    "CENTER",
                ),
                (
                    "TOPPADDING",
                    (0, 0),
                    (-1, -1),
                    8,
                ),
                (
                    "BOTTOMPADDING",
                    (0, 0),
                    (-1, -1),
                    8,
                ),
            ]
        )
    )

    story.append(
        rating_table
    )

    # ========================================================
    # 2. FINDING SUMMARY
    # ========================================================

    story.append(
        Paragraph(
            "2. Vulnerability Summary",
            heading_style
        )
    )

    severity_order = [
        "critical",
        "high",
        "medium",
        "low",
        "informational",
    ]

    summary_rows = [
        [
            Paragraph(
                "<b>Severity</b>",
                normal_style
            ),
            Paragraph(
                "<b>Count</b>",
                normal_style
            ),
        ]
    ]

    calculated_total = 0

    for severity in severity_order:

        count = summary.get(
            severity,
            0
        )

        try:
            count = int(
                count or 0
            )
        except (
            ValueError,
            TypeError,
        ):
            count = 0

        calculated_total += count

        summary_rows.append(
            [
                Paragraph(
                    severity.title(),
                    normal_style
                ),
                Paragraph(
                    str(count),
                    normal_style
                ),
            ]
        )

    total = summary.get(
        "total",
        calculated_total
    )

    try:
        total = int(
            total or 0
        )
    except (
        ValueError,
        TypeError,
    ):
        total = calculated_total

    summary_rows.append(
        [
            Paragraph(
                "<b>Total</b>",
                normal_style
            ),
            Paragraph(
                f"<b>{total}</b>",
                normal_style
            ),
        ]
    )

    summary_table = Table(
        summary_rows,
        colWidths=[
            130 * mm,
            40 * mm,
        ],
        repeatRows=1,
    )

    summary_table.setStyle(
        TableStyle(
            [
                (
                    "BACKGROUND",
                    (0, 0),
                    (-1, 0),
                    colors.HexColor(
                        "#0B8F72"
                    ),
                ),
                (
                    "TEXTCOLOR",
                    (0, 0),
                    (-1, 0),
                    colors.white,
                ),
                (
                    "BACKGROUND",
                    (0, 1),
                    (-1, -1),
                    colors.HexColor(
                        "#F6FAF8"
                    ),
                ),
                (
                    "GRID",
                    (0, 0),
                    (-1, -1),
                    0.4,
                    colors.HexColor(
                        "#A5C8BE"
                    ),
                ),
                (
                    "ALIGN",
                    (1, 0),
                    (1, -1),
                    "CENTER",
                ),
                (
                    "VALIGN",
                    (0, 0),
                    (-1, -1),
                    "MIDDLE",
                ),
                (
                    "TOPPADDING",
                    (0, 0),
                    (-1, -1),
                    6,
                ),
                (
                    "BOTTOMPADDING",
                    (0, 0),
                    (-1, -1),
                    6,
                ),
            ]
        )
    )

    story.append(
        summary_table
    )

    # ========================================================
    # 3. DETAILED FINDINGS
    # ========================================================

    story.append(
        PageBreak()
    )

    story.append(
        Paragraph(
            "3. Detailed Security Findings",
            heading_style
        )
    )

    if all_findings:

        for index, finding in enumerate(
            all_findings,
            start=1
        ):

            title = finding.get(
                "title",
                "Unnamed Finding"
            )

            severity = finding.get(
                "severity",
                "Unknown"
            )

            category = finding.get(
                "category",
                "Uncategorized"
            )

            description = finding.get(
                "description",
                "No description provided."
            )

            recommendation = finding.get(
                "recommendation",
                "No recommendation provided."
            )

            finding_data = [
                [
                    Paragraph(
                        "<b>Finding</b>",
                        normal_style
                    ),
                    Paragraph(
                        safe(
                            f"#{index} - {title}"
                        ),
                        normal_style
                    ),
                ],
                [
                    Paragraph(
                        "<b>Severity</b>",
                        normal_style
                    ),
                    Paragraph(
                        safe(severity),
                        normal_style
                    ),
                ],
                [
                    Paragraph(
                        "<b>Category</b>",
                        normal_style
                    ),
                    Paragraph(
                        safe(category),
                        normal_style
                    ),
                ],
                [
                    Paragraph(
                        "<b>Description</b>",
                        normal_style
                    ),
                    Paragraph(
                        safe(description),
                        normal_style
                    ),
                ],
                [
                    Paragraph(
                        "<b>Recommendation</b>",
                        normal_style
                    ),
                    Paragraph(
                        safe(recommendation),
                        normal_style
                    ),
                ],
            ]

            finding_table = Table(
                finding_data,
                colWidths=[
                    35 * mm,
                    135 * mm,
                ],
            )

            finding_table.setStyle(
                TableStyle(
                    [
                        (
                            "BACKGROUND",
                            (0, 0),
                            (0, -1),
                            colors.HexColor(
                                "#E8F3F0"
                            ),
                        ),
                        (
                            "GRID",
                            (0, 0),
                            (-1, -1),
                            0.4,
                            colors.HexColor(
                                "#A5C8BE"
                            ),
                        ),
                        (
                            "VALIGN",
                            (0, 0),
                            (-1, -1),
                            "TOP",
                        ),
                        (
                            "LEFTPADDING",
                            (0, 0),
                            (-1, -1),
                            7,
                        ),
                        (
                            "RIGHTPADDING",
                            (0, 0),
                            (-1, -1),
                            7,
                        ),
                        (
                            "TOPPADDING",
                            (0, 0),
                            (-1, -1),
                            6,
                        ),
                        (
                            "BOTTOMPADDING",
                            (0, 0),
                            (-1, -1),
                            6,
                        ),
                    ]
                )
            )

            story.append(
                finding_table
            )

            story.append(
                Spacer(
                    1,
                    6 * mm
                )
            )

    else:

        story.append(
            Paragraph(
                "No security findings were returned by this scan.",
                normal_style
            )
        )

    # ========================================================
    # 4. WEB SECURITY ASSESSMENT
    # ========================================================

    if web_scan:

        story.append(
            PageBreak()
        )

        story.append(
            Paragraph(
                "4. Web Security Assessment",
                heading_style
            )
        )

        # ----------------------------------------------------
        # WEB SCAN BASIC RESULTS
        # ----------------------------------------------------

        web_rows = [
            [
                Paragraph(
                    "<b>Check</b>",
                    normal_style
                ),
                Paragraph(
                    "<b>Result</b>",
                    normal_style
                ),
            ]
        ]

        for key, value in web_scan.items():

            if isinstance(
                value,
                (
                    dict,
                    list
                )
            ):
                continue

            web_rows.append(
                [
                    Paragraph(
                        safe(
                            str(key)
                            .replace(
                                "_",
                                " "
                            )
                            .title()
                        ),
                        normal_style
                    ),
                    Paragraph(
                        safe(value),
                        normal_style
                    ),
                ]
            )

        if len(web_rows) > 1:

            web_table = Table(
                web_rows,
                colWidths=[
                    65 * mm,
                    105 * mm,
                ],
                repeatRows=1,
            )

            web_table.setStyle(
                TableStyle(
                    [
                        (
                            "BACKGROUND",
                            (0, 0),
                            (-1, 0),
                            colors.HexColor(
                                "#0B8F72"
                            ),
                        ),
                        (
                            "TEXTCOLOR",
                            (0, 0),
                            (-1, 0),
                            colors.white,
                        ),
                        (
                            "GRID",
                            (0, 0),
                            (-1, -1),
                            0.4,
                            colors.HexColor(
                                "#A5C8BE"
                            ),
                        ),
                        (
                            "VALIGN",
                            (0, 0),
                            (-1, -1),
                            "TOP",
                        ),
                        (
                            "TOPPADDING",
                            (0, 0),
                            (-1, -1),
                            6,
                        ),
                        (
                            "BOTTOMPADDING",
                            (0, 0),
                            (-1, -1),
                            6,
                        ),
                    ]
                )
            )

            story.append(
                web_table
            )

        # ----------------------------------------------------
        # HEADER CHECKS
        # ----------------------------------------------------

        headers_checked = web_scan.get(
            "headers_checked"
        )

        if isinstance(
            headers_checked,
            dict
        ):

            story.append(
                Paragraph(
                    "HTTP Security Header Checks",
                    subheading_style
                )
            )

            header_rows = [
                [
                    Paragraph(
                        "<b>Header</b>",
                        normal_style
                    ),
                    Paragraph(
                        "<b>Status</b>",
                        normal_style
                    ),
                ]
            ]

            for header_name, header_value in (
                headers_checked.items()
            ):

                header_rows.append(
                    [
                        Paragraph(
                            safe(header_name),
                            normal_style
                        ),
                        Paragraph(
                            safe(header_value),
                            normal_style
                        ),
                    ]
                )

            header_table = Table(
                header_rows,
                colWidths=[
                    85 * mm,
                    85 * mm,
                ],
                repeatRows=1,
            )

            header_table.setStyle(
                TableStyle(
                    [
                        (
                            "BACKGROUND",
                            (0, 0),
                            (-1, 0),
                            colors.HexColor(
                                "#0B8F72"
                            ),
                        ),
                        (
                            "TEXTCOLOR",
                            (0, 0),
                            (-1, 0),
                            colors.white,
                        ),
                        (
                            "GRID",
                            (0, 0),
                            (-1, -1),
                            0.4,
                            colors.HexColor(
                                "#A5C8BE"
                            ),
                        ),
                        (
                            "VALIGN",
                            (0, 0),
                            (-1, -1),
                            "TOP",
                        ),
                    ]
                )
            )

            story.append(
                header_table
            )

    # ========================================================
    # 5. NETWORK ASSESSMENT
    # ========================================================

    if (
        network
        or open_ports
        or os_detection
        or cpe
    ):

        story.append(
            PageBreak()
        )

        story.append(
            Paragraph(
                "5. Network Assessment",
                heading_style
            )
        )

        network_rows = [
            [
                Paragraph(
                    "<b>Property</b>",
                    normal_style
                ),
                Paragraph(
                    "<b>Value</b>",
                    normal_style
                ),
            ]
        ]

        network_properties = {
            "Hostname": hostname,
            "Port Range": port_range,
            "Total Open Ports": total_open_ports,
            "Operating System": (
                os_detection.get("name")
                if isinstance(
                    os_detection,
                    dict
                )
                else os_detection
            ),
            "CPE": cpe,
        }

        for property_name, value in (
            network_properties.items()
        ):

            if value is None:
                continue

            network_rows.append(
                [
                    Paragraph(
                        safe(property_name),
                        normal_style
                    ),
                    Paragraph(
                        safe(value),
                        normal_style
                    ),
                ]
            )

        if len(network_rows) > 1:

            network_table = Table(
                network_rows,
                colWidths=[
                    65 * mm,
                    105 * mm,
                ],
                repeatRows=1,
            )

            network_table.setStyle(
                TableStyle(
                    [
                        (
                            "BACKGROUND",
                            (0, 0),
                            (-1, 0),
                            colors.HexColor(
                                "#0B8F72"
                            ),
                        ),
                        (
                            "TEXTCOLOR",
                            (0, 0),
                            (-1, 0),
                            colors.white,
                        ),
                        (
                            "GRID",
                            (0, 0),
                            (-1, -1),
                            0.4,
                            colors.HexColor(
                                "#A5C8BE"
                            ),
                        ),
                        (
                            "VALIGN",
                            (0, 0),
                            (-1, -1),
                            "TOP",
                        ),
                    ]
                )
            )

            story.append(
                network_table
            )

        # ----------------------------------------------------
        # OPEN PORTS
        # ----------------------------------------------------

        if open_ports:

            story.append(
                Paragraph(
                    "Open Ports and Services",
                    subheading_style
                )
            )

            port_rows = [
                [
                    Paragraph(
                        "<b>Port</b>",
                        normal_style
                    ),
                    Paragraph(
                        "<b>Protocol</b>",
                        normal_style
                    ),
                    Paragraph(
                        "<b>Service</b>",
                        normal_style
                    ),
                    Paragraph(
                        "<b>Version</b>",
                        normal_style
                    ),
                ]
            ]

            for port in open_ports:

                if not isinstance(
                    port,
                    dict
                ):
                    continue

                port_rows.append(
                    [
                        Paragraph(
                            safe(
                                port.get(
                                    "port",
                                    "N/A"
                                )
                            ),
                            normal_style
                        ),
                        Paragraph(
                            safe(
                                port.get(
                                    "protocol",
                                    "N/A"
                                )
                            ),
                            normal_style
                        ),
                        Paragraph(
                            safe(
                                port.get(
                                    "service",
                                    "N/A"
                                )
                            ),
                            normal_style
                        ),
                        Paragraph(
                            safe(
                                port.get(
                                    "version",
                                    "N/A"
                                )
                            ),
                            normal_style
                        ),
                    ]
                )

            if len(port_rows) > 1:

                port_table = Table(
                    port_rows,
                    colWidths=[
                        25 * mm,
                        30 * mm,
                        50 * mm,
                        65 * mm,
                    ],
                    repeatRows=1,
                )

                port_table.setStyle(
                    TableStyle(
                        [
                            (
                                "BACKGROUND",
                                (0, 0),
                                (-1, 0),
                                colors.HexColor(
                                    "#0B8F72"
                                ),
                            ),
                            (
                                "TEXTCOLOR",
                                (0, 0),
                                (-1, 0),
                                colors.white,
                            ),
                            (
                                "GRID",
                                (0, 0),
                                (-1, -1),
                                0.4,
                                colors.HexColor(
                                    "#A5C8BE"
                                ),
                            ),
                            (
                                "VALIGN",
                                (0, 0),
                                (-1, -1),
                                "TOP",
                            ),
                        ]
                    )
                )

                story.append(
                    port_table
                )

    # ========================================================
    # 6. CVE / VULNERABILITY ASSESSMENT
    # ========================================================

    if (
        network_vulnerabilities
        or cve_summary
    ):

        story.append(
            PageBreak()
        )

        story.append(
            Paragraph(
                "6. CVE and Vulnerability Assessment",
                heading_style
            )
        )

        if cve_summary:

            cve_summary_rows = [
                [
                    Paragraph(
                        "<b>Severity</b>",
                        normal_style
                    ),
                    Paragraph(
                        "<b>Count</b>",
                        normal_style
                    ),
                ]
            ]

            for key, value in (
                cve_summary.items()
            ):

                cve_summary_rows.append(
                    [
                        Paragraph(
                            safe(
                                str(key)
                                .replace(
                                    "_",
                                    " "
                                )
                                .title()
                            ),
                            normal_style
                        ),
                        Paragraph(
                            safe(value),
                            normal_style
                        ),
                    ]
                )

            cve_summary_table = Table(
                cve_summary_rows,
                colWidths=[
                    130 * mm,
                    40 * mm,
                ],
                repeatRows=1,
            )

            cve_summary_table.setStyle(
                TableStyle(
                    [
                        (
                            "BACKGROUND",
                            (0, 0),
                            (-1, 0),
                            colors.HexColor(
                                "#0B8F72"
                            ),
                        ),
                        (
                            "TEXTCOLOR",
                            (0, 0),
                            (-1, 0),
                            colors.white,
                        ),
                        (
                            "GRID",
                            (0, 0),
                            (-1, -1),
                            0.4,
                            colors.HexColor(
                                "#A5C8BE"
                            ),
                        ),
                        (
                            "ALIGN",
                            (1, 0),
                            (1, -1),
                            "CENTER",
                        ),
                    ]
                )
            )

            story.append(
                cve_summary_table
            )

        if network_vulnerabilities:

            story.append(
                Paragraph(
                    "Detected Vulnerabilities",
                    subheading_style
                )
            )

            for index, vulnerability in enumerate(
                network_vulnerabilities,
                start=1
            ):

                if not isinstance(
                    vulnerability,
                    dict
                ):
                    continue

                vulnerability_rows = [
                    [
                        Paragraph(
                            "<b>CVE ID</b>",
                            normal_style
                        ),
                        Paragraph(
                            safe(
                                vulnerability.get(
                                    "cve_id",
                                    vulnerability.get(
                                        "id",
                                        "N/A"
                                    )
                                )
                            ),
                            normal_style
                        ),
                    ],
                    [
                        Paragraph(
                            "<b>Title</b>",
                            normal_style
                        ),
                        Paragraph(
                            safe(
                                vulnerability.get(
                                    "title",
                                    "N/A"
                                )
                            ),
                            normal_style
                        ),
                    ],
                    [
                        Paragraph(
                            "<b>Severity</b>",
                            normal_style
                        ),
                        Paragraph(
                            safe(
                                vulnerability.get(
                                    "severity",
                                    "N/A"
                                )
                            ),
                            normal_style
                        ),
                    ],
                    [
                        Paragraph(
                            "<b>CVSS Score</b>",
                            normal_style
                        ),
                        Paragraph(
                            safe(
                                vulnerability.get(
                                    "cvss_score",
                                    "N/A"
                                )
                            ),
                            normal_style
                        ),
                    ],
                    [
                        Paragraph(
                            "<b>Affected Product</b>",
                            normal_style
                        ),
                        Paragraph(
                            safe(
                                vulnerability.get(
                                    "affected_product",
                                    vulnerability.get(
                                        "cpe_name",
                                        "N/A"
                                    )
                                )
                            ),
                            normal_style
                        ),
                    ],
                    [
                        Paragraph(
                            "<b>Description</b>",
                            normal_style
                        ),
                        Paragraph(
                            safe(
                                vulnerability.get(
                                    "description",
                                    "N/A"
                                )
                            ),
                            normal_style
                        ),
                    ],
                ]

                vulnerability_table = Table(
                    vulnerability_rows,
                    colWidths=[
                        40 * mm,
                        130 * mm,
                    ],
                )

                vulnerability_table.setStyle(
                    TableStyle(
                        [
                            (
                                "BACKGROUND",
                                (0, 0),
                                (0, -1),
                                colors.HexColor(
                                    "#E8F3F0"
                                ),
                            ),
                            (
                                "GRID",
                                (0, 0),
                                (-1, -1),
                                0.4,
                                colors.HexColor(
                                    "#A5C8BE"
                                ),
                            ),
                            (
                                "VALIGN",
                                (0, 0),
                                (-1, -1),
                                "TOP",
                            ),
                        ]
                    )
                )

                story.append(
                    vulnerability_table
                )

                story.append(
                    Spacer(
                        1,
                        5 * mm
                    )
                )

    # ========================================================
    # 7. OVERALL ASSESSMENT
    # ========================================================

    story.append(
        PageBreak()
    )

    story.append(
        Paragraph(
            "7. Overall Security Assessment",
            heading_style
        )
    )

    assessment_text = (
        f"The assessment of "
        f"<b>{safe(target)}</b> "
        f"resulted in a security score of "
        f"<b>{safe(score)}/100</b>, "
        f"grade <b>{safe(grade)}</b>, "
        f"and risk classification "
        f"<b>{safe(risk)}</b>. "
        f"A total of "
        f"<b>{safe(total)}</b> "
        f"finding(s) were identified."
    )

    story.append(
        Paragraph(
            assessment_text,
            normal_style
        )
    )

    story.append(
        Spacer(
            1,
            5 * mm
        )
    )

    story.append(
        Paragraph(
            "Recommended Actions",
            subheading_style
        )
    )

    recommendations = []

    for finding in all_findings:

        recommendation = finding.get(
            "recommendation"
        )

        if recommendation:

            recommendation_text = str(
                recommendation
            )

            if recommendation_text not in recommendations:
                recommendations.append(
                    recommendation_text
                )

    if recommendations:

        for index, recommendation in enumerate(
            recommendations,
            start=1
        ):

            story.append(
                Paragraph(
                    f"{index}. "
                    f"{safe(recommendation)}",
                    normal_style
                )
            )

    else:

        story.append(
            Paragraph(
                "No remediation actions are required "
                "based on the findings returned by this scan.",
                normal_style
            )
        )

    # ========================================================
    # 8. REPORT CONCLUSION
    # ========================================================

    story.append(
        Spacer(
            1,
            8 * mm
        )
    )

    story.append(
        Paragraph(
            "Conclusion",
            subheading_style
        )
    )

    if total == 0:

        conclusion = (
            "No security findings were returned by "
            "the assessment. The target should still "
            "be periodically reassessed because the "
            "security posture can change over time."
        )

    elif str(risk).lower() in (
        "critical",
        "high"
    ):

        conclusion = (
            "The assessment identified significant "
            "security weaknesses that should be "
            "prioritized for remediation. The most "
            "severe findings should be addressed first, "
            "followed by validation scans to confirm "
            "that the identified issues have been resolved."
        )

    elif str(risk).lower() in (
        "moderate",
        "medium"
    ):

        conclusion = (
            "The assessment identified security "
            "weaknesses requiring remediation. "
            "The recommended actions should be "
            "implemented and the target reassessed "
            "after remediation."
        )

    else:

        conclusion = (
            "The assessment identified relatively "
            "limited security exposure based on the "
            "checks performed. Continued monitoring "
            "and periodic security assessments are "
            "recommended."
        )

    story.append(
        Paragraph(
            conclusion,
            normal_style
        )
    )

    # ========================================================
    # 9. REPORT FOOTER INFORMATION
    # ========================================================

    story.append(
        Spacer(
            1,
            15 * mm
        )
    )

    generated_at = datetime.utcnow().isoformat()

    story.append(
        Paragraph(
            f"Report generated by CyberGuard on "
            f"{safe(generated_at)} UTC.",
            small_style
        )
    )

    story.append(
        Paragraph(
            "This report is intended for authorized "
            "security assessment and remediation purposes.",
            small_style
        )
    )

    # ========================================================
    # 10. BUILD PDF
    # ========================================================

    document.build(
        story,
        onFirstPage=add_page_number,
        onLaterPages=add_page_number,
    )

    buffer.seek(0)

    # ========================================================
    # 11. RETURN PDF
    # ========================================================

    filename = (
        f"{scan_id_value}-CyberGuard-Report.pdf"
    )

    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={
            "Content-Disposition": (
                f'attachment; filename="{filename}"'
            )
        },
    )
