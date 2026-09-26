import json
import ipaddress
import socket
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

from pydantic import BaseModel, Field

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
    normalize_cpe,
    resolve_os_to_cpe,
    resolve_product_to_cpe,
    lookup_cves_by_cpe,
)

from app.services.risk_engine import calculate_risk, build_score_explanation
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

    Accepts:
        127.0.0.1
        192.168.1.10
        example.com
        http://example.com
        https://example.com
    """

    target: str = Field(
        min_length=1,
        max_length=2048,
    )

    port_range: str = Field(
        default="top-1000",
        min_length=1,
        max_length=100,
    )


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
        default="top-1000",
        min_length=1,
        max_length=100,
    )


# ============================================================
# PUBLIC TARGET VALIDATION
# ============================================================

def validate_public_target(target: str):
    """Reject private/local targets before any scanner executes."""
    target = target.strip()
    if not target:
        raise ValueError("Target cannot be empty.")

    try:
        parsed = urlparse(target) if target.startswith(("http://", "https://")) else urlparse(f"//{target}")
        hostname = parsed.hostname
    except Exception as error:
        raise ValueError("Invalid target.") from error

    if not hostname:
        raise ValueError("Invalid target.")

    hostname = hostname.strip().lower()

    if hostname == "localhost" or hostname.endswith(".localhost") or hostname.endswith(".local"):
        raise ValueError("Private/local hostname cannot be scanned.")

    try:
        ip = ipaddress.ip_address(hostname)
    except ValueError:
        ip = None

    if ip is not None:
        if not ip.is_global:
            raise ValueError("Private IP cannot be scanned.")
        return hostname

    try:
        addresses = socket.getaddrinfo(hostname, None, type=socket.SOCK_STREAM)
        for result in addresses:
            if not result or not result[4]:
                continue
            try:
                resolved_ip = ipaddress.ip_address(result[4][0])
            except ValueError:
                continue
            if not resolved_ip.is_global:
                raise ValueError(
                    "Target resolves to a private or non-public IP and cannot be scanned."
                )
    except socket.gaierror:
        # Let the scanner report DNS/connectivity errors later.
        pass

    return hostname


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

    validate_public_target(target)

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

    # A bare hostname defaults to HTTP because web scans may target port 80.
    # Explicit http:// or https:// URLs above are preserved unchanged.
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
    Run Nmap, collect host/service/CPE data and query NVD for CVEs.

    CPE/CVE flow:

        Nmap service data
            |
            +--> raw Nmap CPE (legacy or CPE 2.3)
            |
            +--> product/version/service fallback
            |
            v
        normalized CPE 2.3
            |
            v
        NVD CVE lookup
    """

    # ========================================================
    # 1. RUN NMAP
    # ========================================================

    result = scan_ports(
        target=target,
        port_range=port_range,
    )

    # ========================================================
    # 2. HOST INFORMATION
    # ========================================================

    hostname = (
        result.get("hostname")
        or target
    )

    primary_ip = (
        result.get("ip_address")
        or target
    )

    addresses = (
        result.get("addresses", [])
        or []
    )

    open_ports = (
        result.get("open_ports", [])
        or []
    )

    os_detection = (
        result.get("os_detection", {})
        or {}
    )

    operating_system = (
        os_detection.get("name")
    )

    # ========================================================
    # 3. UNIQUE SERVICES
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
    # 4. RESOLVE SERVICE CPEs
    # ========================================================

    cpe_records = []
    seen_cpes = set()
    cpe_errors = []

    def add_cpe(
        cpe_name,
        source,
        port=None,
        service=None,
        product=None,
        version=None,
        raw_cpe=None,
    ):
        """
        Add a unique normalized CPE record.
        """

        if not cpe_name:
            return

        normalized = normalize_cpe(
            cpe_name
        )

        if not normalized:
            return

        if normalized in seen_cpes:
            return

        seen_cpes.add(
            normalized
        )

        cpe_records.append({
            "cpe": normalized,
            "source": source,
            "port": port,
            "service": service,
            "product": product,
            "version": version,
            "raw_cpe": raw_cpe,
        })

    # --------------------------------------------------------
    # SERVICE CPE RESOLUTION
    # --------------------------------------------------------

    for port in open_ports:

        raw_cpe = port.get(
            "cpe"
        )

        product = port.get(
            "product"
        )

        version = port.get(
            "version"
        )

        service = port.get(
            "service"
        )

        resolved_cpe = None

        try:

            resolved_cpe = (
                resolve_product_to_cpe(

                    product=product,

                    version=version,

                    service=service,

                    raw_cpe=raw_cpe,
                )
            )

        except RuntimeError as error:

            cpe_errors.append(
                (
                    f"Port {port.get('port')}: "
                    f"{error}"
                )
            )

        # ----------------------------------------------------
        # Direct normalization fallback
        # ----------------------------------------------------

        if not resolved_cpe and raw_cpe:

            resolved_cpe = normalize_cpe(
                raw_cpe
            )

        # ----------------------------------------------------
        # Save normalized CPE
        # ----------------------------------------------------

        if resolved_cpe:

            normalized_cpe = normalize_cpe(
                resolved_cpe
            )

            if normalized_cpe:

                port["cpe"] = (
                    normalized_cpe
                )

                add_cpe(

                    normalized_cpe,

                    "service",

                    port=port.get(
                        "port"
                    ),

                    service=service,

                    product=product,

                    version=version,

                    raw_cpe=raw_cpe,
                )

    # ========================================================
    # 5. OS CPE FALLBACK
    # ========================================================

    os_cpe = None

    if (
        operating_system
        and operating_system.lower()
        != "unknown"
    ):

        try:

            os_cpe = resolve_os_to_cpe(
                operating_system
            )

        except RuntimeError as error:

            cpe_errors.append(
                f"OS CPE lookup: {error}"
            )

            os_cpe = None

        if os_cpe:

            add_cpe(

                os_cpe,

                "os",

                product=operating_system,
            )

    # ========================================================
    # 6. CVE LOOKUP
    # ========================================================

    saved_vulnerabilities = []

    cve_errors = []

    # Keep the scan bounded when a target exposes
    # many independently identified products.
    unique_cpes = cpe_records[:12]

    for record in unique_cpes:

        try:

            cves = lookup_cves_by_cpe(
                record["cpe"]
            )

        except RuntimeError as error:

            cve_errors.append(
                (
                    f"{record['cpe']}: "
                    f"{error}"
                )
            )

            continue

        for cve_data in cves:

            cve_id = (
                cve_data.get(
                    "cve_id"
                )
            )

            if not cve_id:
                continue

            item = {

                "cve_id": cve_id,

                "severity": (
                    cve_data.get(
                        "severity"
                    )
                ),

                "cvss_score": (
                    cve_data.get(
                        "cvss_score"
                    )
                ),

                "description": (
                    cve_data.get(
                        "description"
                    )
                ),

                "affected_product": (
                    cve_data.get(
                        "cpe_name"
                    )
                ),

                "cpe_name": (
                    record["cpe"]
                ),

                "source": (
                    record.get(
                        "source"
                    )
                ),

                "port": (
                    record.get(
                        "port"
                    )
                ),

                "service": (
                    record.get(
                        "service"
                    )
                ),

                "product": (
                    record.get(
                        "product"
                    )
                ),

                "version": (
                    record.get(
                        "version"
                    )
                ),

                # ------------------------------------------------
                # Extended NVD metadata
                # ------------------------------------------------
                "cvss_version": (
                    cve_data.get(
                        "cvss_version"
                    )
                ),

                "cvss_vector": (
                    cve_data.get(
                        "cvss_vector"
                    )
                ),

                "published_date": (
                    cve_data.get(
                        "published_date"
                    )
                ),

                "last_modified_date": (
                    cve_data.get(
                        "last_modified_date"
                    )
                ),

                "cwe_ids": (
                    cve_data.get(
                        "cwe_ids",
                        []
                    )
                ),

                "references": (
                    cve_data.get(
                        "references",
                        []
                    )
                ),

                "nvd_exact_cpe_match": (
                    cve_data.get(
                        "nvd_exact_cpe_match"
                    )
                ),

                "nvd_vulnerable_match": (
                    cve_data.get(
                        "nvd_vulnerable_match"
                    )
                ),

                "applicability": (
                    cve_data.get(
                        "applicability",
                        []
                    )
                ),

                "version_conditions": (
                    cve_data.get(
                        "version_conditions",
                        []
                    )
                ),
            }

            # ------------------------------------------------
            # Deduplicate by CVE + CPE.
            # ------------------------------------------------

            duplicate = any(

                existing.get(
                    "cve_id"
                ) == cve_id

                and existing.get(
                    "cpe_name"
                ) == item.get(
                    "cpe_name"
                )

                for existing
                in saved_vulnerabilities
            )

            if not duplicate:

                saved_vulnerabilities.append(
                    item
                )

    # ========================================================
    # 7. PERSIST ASSET
    # ========================================================

    ports_json = json.dumps(
        open_ports
    )

    services_json = json.dumps(
        services
    )

    asset = (
        db.query(Asset)
        .filter(
            Asset.ip_address
            == primary_ip,

            Asset.user_id
            == current_user.id,
        )
        .first()
    )

    if asset is None:

        asset = Asset(

            ip_address=primary_ip,

            user_id=current_user.id,

            hostname=hostname,

            operating_system=(
                operating_system
            ),

            open_ports=ports_json,

            services=services_json,

            risk_level="Unknown",

            last_scanned=datetime.utcnow(),
        )

        db.add(
            asset
        )

        db.flush()

    else:

        asset.hostname = (
            hostname
        )

        asset.operating_system = (
            operating_system
        )

        asset.open_ports = (
            ports_json
        )

        asset.services = (
            services_json
        )

        asset.last_scanned = (
            datetime.utcnow()
        )

    # ========================================================
    # 8. ASSET RISK
    # ========================================================

    asset.risk_level = (
        calculate_asset_risk(
            saved_vulnerabilities
        )
    )

    db.commit()
    db.refresh(asset)

    # ========================================================
    # 9. SAVE CVEs
    # ========================================================

    for cve_data in saved_vulnerabilities:

        cve_id = cve_data.get(
            "cve_id"
        )

        if not cve_id:
            continue

        vulnerability = (
            db.query(
                Vulnerability
            )
            .filter(

                Vulnerability.asset_id
                == asset.id,

                Vulnerability.cve_id
                == cve_id,
            )
            .first()
        )

        values = {

            "description": (
                cve_data.get(
                    "description"
                )
            ),

            "severity": (
                cve_data.get(
                    "severity"
                )
            ),

            "cvss_score": (

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

            "affected_product": (
                cve_data.get(
                    "cpe_name"
                )
            ),

            "detected_at": (
                datetime.utcnow()
            ),
        }

        if vulnerability is None:

            vulnerability = (
                Vulnerability(

                    asset_id=asset.id,

                    cve_id=cve_id,

                    title=cve_id,

                    **values,
                )
            )

            db.add(
                vulnerability
            )

        else:

            vulnerability.title = (
                cve_id
            )

            for key, value in (
                values.items()
            ):

                setattr(
                    vulnerability,
                    key,
                    value
                )

    db.commit()
    db.refresh(asset)

    # ========================================================
    # 10. BUILD RESPONSE
    # ========================================================

    response = {

        "target": (
            result.get(
                "target",
                target
            )
        ),

        "hostname": hostname,

        "ip_address": primary_ip,

        "addresses": addresses,

        "port_range": (
            result.get(
                "port_range",
                port_range
            )
        ),

        "scan_scope": (
            result.get(
                "scan_scope",
                port_range
            )
        ),

        "scan_technique": (
            result.get(
                "scan_technique"
            )
        ),

        "open_ports": open_ports,

        "total_open_ports": len(
            open_ports
        ),

        "os_detection": (
            os_detection
        ),

        "cpe": (
            cpe_records[0]["cpe"]
            if cpe_records
            else None
        ),

        "cpe_records": cpe_records,

        "cve_summary": (
            build_cve_summary(
                saved_vulnerabilities
            )
        ),

        "vulnerabilities": (
            saved_vulnerabilities
        ),

        "asset": {

            "id": asset.id,

            "ip_address": (
                asset.ip_address
            ),

            "hostname": (
                asset.hostname
            ),

            "operating_system": (
                asset.operating_system
            ),

            "addresses": addresses,

            "open_ports": open_ports,

            "services": services,

            "risk_level": (
                asset.risk_level
            ),

            "last_scanned": (
                asset.last_scanned
            ),

            "cpe_records": cpe_records,
        },
    }

    # --------------------------------------------------------
    # Report CPE/NVD errors without failing the full scan.
    # --------------------------------------------------------

    if cpe_errors:

        response["cpe_error"] = (
            "; ".join(
                cpe_errors
            )
        )

    if cve_errors:

        response["cve_error"] = (
            "; ".join(
                cve_errors
            )
        )

    return response


# ============================================================
# WEB SCAN HELPER
# ============================================================

async def perform_web_scan(web_url):
    """Run the passive web/security-header scanner and attach score details."""
    result = await scan_web(web_url)

    if result.get("status") not in {"completed", "blocked"}:
        raise HTTPException(
            status_code=502,
            detail=result.get("error", "Web scan failed."),
        )

    findings = result.get("findings", []) or []
    risk = calculate_risk(findings)

    return {
        "status": result.get("status"),
        "status_code": result.get("status_code"),
        "request_url": result.get("request_url"),
        "final_url": result.get("final_url"),
        "findings": findings,
        "security_headers": result.get("security_headers", []),
        "headers_checked": result.get("headers_checked", []),
        "header_summary": result.get("header_summary", {}),
        "server": result.get("server"),
        "content_type": result.get("content_type"),
        "content_length": result.get("content_length"),
        "security_score": risk.get("score"),
        "grade": risk.get("grade"),
        "risk_level": risk.get("risk_level"),
        "score_explanation": build_score_explanation(
            findings,
            risk.get("score"),
            risk.get("grade"),
            risk.get("risk_level"),
        ),
        "error": result.get("error"),
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

        validate_public_target(request.target)

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

        risk_level = (
            "Low"
            if security_score >= 90
            else "Moderate"
            if security_score >= 75
            else "High"
            if security_score >= 60
            else "Critical"
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
        # SCORE EXPLANATION
        # ====================================================

        web_score = (
            web_result.get("security_score")
            if web_result
            else None
        )

        score_breakdown = {
            "network_score": network_score,
            "network_reason": (
                "Based on the highest CVSS/CVE risk identified from service/OS CPE evidence."
                if network_result.get("vulnerabilities")
                else "No CVE matches were identified from the CPE/product evidence collected."
            ),
            "web_score": web_score,
            "web_reason": (
                "Based on weighted web security-header findings."
                if web_findings
                else "No web security finding deductions were returned."
            ),
            "combined_method": (
                "Final score is the average of network and web scores when both are available."
                if web_result and web_score is not None
                else "Final score uses the available assessment score."
            ),
            "network_score": network_score,
            "web_score": web_score,
            "final_score": security_score,
            "grade_thresholds": {
                "A": "90-100",
                "B": "75-89",
                "C": "60-74",
                "D": "40-59",
                "F": "0-39",
            },
            "risk_thresholds": {
                "Low": "90-100",
                "Moderate": "75-89",
                "High": "60-74",
                "Critical": "0-59",
            },
            "cve_count": cve_summary.get("total", 0),
            "web_finding_count": len(web_findings),
        }

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

            "total_findings":
                len(web_findings) + len(network_result.get("vulnerabilities", [])),

            "score_breakdown":
                score_breakdown,

            "target_info": {
                "domain": hostname,
                "ip_address": network_result.get("ip_address"),
                "addresses": network_result.get("addresses", []),
                "web_url": web_url,
                "port_range": request.port_range,
            },

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

                "hostname":
                    network_result.get("hostname"),

                "ip_address":
                    network_result.get("ip_address"),

                "addresses":
                    network_result.get("addresses", []),

                "scan_scope":
                    network_result.get("scan_scope"),

                "scan_technique":
                    network_result.get("scan_technique"),

                "os_detection":
                    network_result[
                        "os_detection"
                    ],

                "cpe":
                    network_result[
                        "cpe"
                    ],

                "cpe_records":
                    network_result.get("cpe_records", []),

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

            "cpe_records":
                network_result.get("cpe_records", []),

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

            "security_headers":
                web_result.get("security_headers", [])
                if web_result
                else [],
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

        validate_public_target(request.target)

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
        validate_public_target(request.target)
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
            "total_findings": len(network_result.get("vulnerabilities", [])),
            "score_breakdown": {
                "network_score": security_score,
                "network_reason": (
                    "Based on the highest CVSS/CVE risk identified from collected CPE evidence."
                    if network_result.get("vulnerabilities")
                    else "No CVE matches were identified from the collected CPE/product evidence."
                ),
                "grade_thresholds": {"A": "90-100", "B": "75-89", "C": "60-74", "D": "40-59", "F": "0-39"},
                "risk_thresholds": {"Low": "90-100", "Moderate": "75-89", "High": "60-74", "Critical": "0-59"},
            },
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
    """
    Return the complete scan snapshot.

    The report intentionally keeps network CVEs separate from
    normal web findings so the frontend/PDF can display every
    CVE without treating CVEs as ordinary web findings.
    """

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
            detail="Scan not found.",
        )

    # ========================================================
    # LOAD STORED REPORT
    # ========================================================

    report = {}

    stored_report_data = getattr(
        scan,
        "report_data",
        None,
    )

    if stored_report_data:

        try:
            if isinstance(
                stored_report_data,
                str,
            ):
                report = json.loads(
                    stored_report_data
                )

            elif isinstance(
                stored_report_data,
                dict,
            ):
                report = stored_report_data

        except (
            json.JSONDecodeError,
            TypeError,
            ValueError,
        ):

            print(
                "WARNING: Invalid stored report data for",
                scan.scan_id,
            )

            report = {}

    if not isinstance(
        report,
        dict,
    ):
        report = {}

    # ========================================================
    # BASIC SCAN FIELDS
    # ========================================================

    report["scan_id"] = report.get(
        "scan_id",
        scan.scan_id,
    )

    report["status"] = report.get(
        "status",
        scan.status,
    )

    report["scan_type"] = report.get(
        "scan_type",
        getattr(
            scan,
            "scan_type",
            "full",
        ),
    )

    report["target"] = report.get(
        "target",
        (
            scan.target.url
            if scan.target
            else None
        ),
    )

    report["security_score"] = report.get(
        "security_score",
        scan.security_score,
    )

    report["grade"] = report.get(
        "grade",
        scan.grade,
    )

    report["risk_level"] = report.get(
        "risk_level",
        scan.risk_level,
    )

    report["started_at"] = report.get(
        "started_at",
        scan.started_at,
    )

    report["completed_at"] = report.get(
        "completed_at",
        scan.completed_at,
    )

    report["status_code"] = report.get(
        "status_code",
        getattr(
            scan,
            "status_code",
            None,
        ),
    )

    report["final_url"] = report.get(
        "final_url",
        getattr(
            scan,
            "final_url",
            None,
        ),
    )

    # ========================================================
    # FIND WEB / GENERAL FINDINGS
    # ========================================================

    stored_findings = report.get(
        "findings",
        [],
    )

    if not isinstance(
        stored_findings,
        list,
    ):
        stored_findings = []

    web_findings = report.get(
        "web_findings",
        [],
    )

    if not isinstance(
        web_findings,
        list,
    ):
        web_findings = []

    # Some older reports only have findings in one location.
    if not web_findings and stored_findings:
        web_findings = stored_findings[:]

    # ========================================================
    # NETWORK / CVE DATA
    # ========================================================

    network = report.get(
        "network_scan",
        {},
    )

    if not isinstance(
        network,
        dict,
    ):
        network = {}

    vulnerabilities = report.get(
        "vulnerabilities",
        network.get(
            "vulnerabilities",
            [],
        ),
    )

    if not isinstance(
        vulnerabilities,
        list,
    ):
        vulnerabilities = []

    # ========================================================
    # DATABASE CVE FALLBACK
    # ========================================================

    asset_ids = []

    asset_data = report.get(
        "asset",
        {},
    )

    if isinstance(
        asset_data,
        dict,
    ) and asset_data.get("id") is not None:

        asset_ids.append(
            asset_data.get("id")
        )

    network_asset = network.get(
        "asset",
        {},
    )

    if isinstance(
        network_asset,
        dict,
    ) and network_asset.get("id") is not None:

        asset_ids.append(
            network_asset.get("id")
        )

    asset_ids = list(
        dict.fromkeys(asset_ids)
    )

    db_vulnerabilities = []

    if asset_ids:

        db_rows = (
            db.query(Vulnerability)
            .join(
                Asset,
                Vulnerability.asset_id
                == Asset.id,
            )
            .filter(
                Vulnerability.asset_id.in_(
                    asset_ids
                ),
                Asset.user_id
                == current_user.id,
            )
            .order_by(
                Vulnerability.detected_at.asc()
            )
            .all()
        )

        for row in db_rows:

            db_vulnerabilities.append({
                "id": row.id,
                "cve_id": row.cve_id,
                "title": row.title,
                "severity": row.severity,
                "cvss_score": row.cvss_score,
                "description": row.description,
                "affected_product": (
                    row.affected_product
                ),
                "asset_id": row.asset_id,
                "detected_at": row.detected_at,
            })

    # If the snapshot is missing CVEs but DB has them, use DB.
    if not vulnerabilities and db_vulnerabilities:
        vulnerabilities = db_vulnerabilities

    # ========================================================
    # NORMALIZE CVE RECORDS
    # ========================================================

    normalized_vulnerabilities = []

    seen_cves = set()

    for item in vulnerabilities:

        if not isinstance(
            item,
            dict,
        ):
            continue

        cve_id = item.get(
            "cve_id",
            item.get("id"),
        )

        if not cve_id:
            continue

        signature = (
            str(cve_id),
            str(
                item.get(
                    "cpe_name",
                    item.get(
                        "affected_product",
                        "",
                    ),
                )
            ),
        )

        if signature in seen_cves:
            continue

        seen_cves.add(
            signature
        )

        normalized = {
            **item,
            "cve_id": cve_id,
        }

        normalized_vulnerabilities.append(
            normalized
        )

    vulnerabilities = normalized_vulnerabilities

    # Keep network object synchronized with the top-level data.
    network["vulnerabilities"] = vulnerabilities

    # ========================================================
    # NETWORK FIELDS
    # ========================================================

    for key in (
        "hostname",
        "ip_address",
        "addresses",
        "port_range",
        "scan_scope",
        "scan_technique",
        "open_ports",
        "total_open_ports",
        "os_detection",
        "cpe",
        "cpe_records",
        "asset",
        "cve_summary",
    ):

        if key not in network and key in report:
            network[key] = report.get(
                key
            )

    report["network_scan"] = network

    # Mirror important network data at the top level
    # for frontend compatibility.
    report["vulnerabilities"] = vulnerabilities

    report["cve_summary"] = (
        report.get(
            "cve_summary"
        )
        or network.get(
            "cve_summary",
            {},
        )
        or build_cve_summary(
            vulnerabilities
        )
    )

    report["open_ports"] = report.get(
        "open_ports",
        network.get(
            "open_ports",
            [],
        ),
    )

    report["total_open_ports"] = report.get(
        "total_open_ports",
        len(
            report["open_ports"]
            if isinstance(
                report["open_ports"],
                list,
            )
            else []
        ),
    )

    report["os_detection"] = report.get(
        "os_detection",
        network.get(
            "os_detection",
        ),
    )

    report["cpe_records"] = report.get(
        "cpe_records",
        network.get(
            "cpe_records",
            [],
        ),
    )

    # ========================================================
    # WEB DATA / SECURITY HEADERS
    # ========================================================

    web_scan = report.get(
        "web_scan",
        {},
    )

    if not isinstance(
        web_scan,
        dict,
    ):
        web_scan = {}

    report["web_scan"] = web_scan

    report["web_findings"] = web_findings

    report["security_headers"] = report.get(
        "security_headers",
        web_scan.get(
            "security_headers",
            [],
        ),
    )

    report["headers_checked"] = report.get(
        "headers_checked",
        web_scan.get(
            "headers_checked",
            [],
        ),
    )

    report["header_summary"] = report.get(
        "header_summary",
        web_scan.get(
            "header_summary",
            {},
        ),
    )

    # ========================================================
    # COMBINED FINDINGS FOR LEGACY CLIENTS
    # ========================================================

    combined_findings = []

    signatures = set()

    for finding in web_findings:

        if not isinstance(
            finding,
            dict,
        ):
            continue

        signature = (
            "finding",
            finding.get("title"),
            finding.get("severity"),
            finding.get("category"),
            finding.get("description"),
        )

        if signature in signatures:
            continue

        signatures.add(
            signature
        )

        combined_findings.append(
            finding
        )

    for vulnerability in vulnerabilities:

        signature = (
            "cve",
            vulnerability.get(
                "cve_id"
            ),
        )

        if signature in signatures:
            continue

        signatures.add(
            signature
        )

        combined_findings.append({
            "id": vulnerability.get(
                "id"
            ),
            "cve_id": vulnerability.get(
                "cve_id"
            ),
            "title": vulnerability.get(
                "title"
            )
            or vulnerability.get(
                "cve_id"
            ),
            "severity": vulnerability.get(
                "severity"
            ),
            "description": vulnerability.get(
                "description"
            ),
            "category": "CVE Vulnerability",
            "recommendation": vulnerability.get(
                "recommendation"
            ),
            "cvss_score": vulnerability.get(
                "cvss_score"
            ),
            "affected_product": vulnerability.get(
                "affected_product"
            ),
        })

    report["findings"] = combined_findings

    # ========================================================
    # SUMMARY
    # ========================================================

    summary = {
        "critical": 0,
        "high": 0,
        "medium": 0,
        "low": 0,
        "informational": 0,
    }

    for item in combined_findings:

        severity = str(
            item.get(
                "severity",
                "informational",
            )
            or "informational"
        ).lower()

        if severity not in summary:
            severity = "informational"

        summary[severity] += 1

    summary["total"] = len(
        combined_findings
    )

    report["summary"] = summary

    report["total_findings"] = (
        len(combined_findings)
    )

    report["report_data_available"] = True

    return report


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
# COMPLETE A-Z REPORT
# ============================================================

@router.get("/scans/{scan_id}/report/pdf")
def download_scan_report_pdf(
    scan_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Generate a complete CyberGuard PDF containing:

        - Scan metadata
        - Security score / grade / risk
        - Severity summary
        - Target information
        - IP addresses
        - OS detection
        - All CPE records
        - All open ports/services
        - All CVEs
        - Full CVE descriptions
        - CVSS data
        - CWE IDs
        - Published / modified dates
        - CVE references
        - NVD applicability/version conditions
        - Web scan results
        - Security headers checked
        - Missing-header findings
        - Web security findings
        - Score explanation
        - Recommendations
    """

    # ========================================================
    # 1. FIND USER-OWNED SCAN
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
            detail="Scan not found.",
        )

    # ========================================================
    # 2. LOAD REPORT SNAPSHOT
    # ========================================================

    report = {}

    stored_report_data = getattr(
        scan,
        "report_data",
        None,
    )

    if stored_report_data:

        try:

            if isinstance(
                stored_report_data,
                str,
            ):
                report = json.loads(
                    stored_report_data
                )

            elif isinstance(
                stored_report_data,
                dict,
            ):
                report = stored_report_data

        except (
            json.JSONDecodeError,
            TypeError,
            ValueError,
        ):

            report = {}

    if not isinstance(
        report,
        dict,
    ):
        report = {}

    # ========================================================
    # 3. BASIC FIELDS
    # ========================================================

    scan_id_value = report.get(
        "scan_id",
        scan.scan_id,
    )

    scan_type = str(
        report.get(
            "scan_type",
            getattr(
                scan,
                "scan_type",
                "full",
            ),
        )
    ).upper()

    target = report.get(
        "target",
        (
            scan.target.url
            if scan.target
            else "N/A"
        ),
    )

    status = report.get(
        "status",
        scan.status,
    )

    score = report.get(
        "security_score",
        scan.security_score,
    )

    grade = report.get(
        "grade",
        scan.grade,
    )

    risk = report.get(
        "risk_level",
        scan.risk_level,
    )

    started_at = report.get(
        "started_at",
        scan.started_at,
    )

    completed_at = report.get(
        "completed_at",
        scan.completed_at,
    )

    status_code = report.get(
        "status_code",
        getattr(
            scan,
            "status_code",
            None,
        ),
    )

    final_url = report.get(
        "final_url",
        getattr(
            scan,
            "final_url",
            None,
        ),
    )

    # ========================================================
    # 4. WEB DATA
    # ========================================================

    web_scan = report.get(
        "web_scan",
        {},
    )

    if not isinstance(
        web_scan,
        dict,
    ):
        web_scan = {}

    web_findings = report.get(
        "web_findings",
        web_scan.get(
            "findings",
            [],
        ),
    )

    if not isinstance(
        web_findings,
        list,
    ):
        web_findings = []

    headers_checked = report.get(
        "headers_checked",
        web_scan.get(
            "headers_checked",
            [],
        ),
    )

    if not isinstance(
        headers_checked,
        (
            list,
            dict,
        ),
    ):
        headers_checked = []

    security_headers = report.get(
        "security_headers",
        web_scan.get(
            "security_headers",
            [],
        ),
    )

    if not isinstance(
        security_headers,
        (
            list,
            dict,
        ),
    ):
        security_headers = []

    header_summary = report.get(
        "header_summary",
        web_scan.get(
            "header_summary",
            {},
        ),
    )

    if not isinstance(
        header_summary,
        dict,
    ):
        header_summary = {}

    # ========================================================
    # 5. NETWORK DATA
    # ========================================================

    network = report.get(
        "network_scan",
        {},
    )

    if not isinstance(
        network,
        dict,
    ):
        network = {}

    open_ports = report.get(
        "open_ports",
        network.get(
            "open_ports",
            [],
        ),
    )

    if not isinstance(
        open_ports,
        list,
    ):
        open_ports = []

    addresses = report.get(
        "addresses",
        network.get(
            "addresses",
            [],
        ),
    )

    if not isinstance(
        addresses,
        list,
    ):
        addresses = []

    hostname = report.get(
        "hostname",
        network.get(
            "hostname",
        ),
    )

    ip_address = report.get(
        "ip_address",
        network.get(
            "ip_address",
        ),
    )

    port_range = report.get(
        "port_range",
        network.get(
            "port_range",
            network.get(
                "scan_scope",
            ),
        ),
    )

    scan_scope = report.get(
        "scan_scope",
        network.get(
            "scan_scope",
            port_range,
        ),
    )

    scan_technique = report.get(
        "scan_technique",
        network.get(
            "scan_technique",
        ),
    )

    os_detection = report.get(
        "os_detection",
        network.get(
            "os_detection",
        ),
    )

    if os_detection is None:
        os_detection = {}

    cpe = report.get(
        "cpe",
        network.get(
            "cpe",
        ),
    )

    cpe_records = report.get(
        "cpe_records",
        network.get(
            "cpe_records",
            [],
        ),
    )

    if not isinstance(
        cpe_records,
        list,
    ):
        cpe_records = []

    vulnerabilities = report.get(
        "vulnerabilities",
        network.get(
            "vulnerabilities",
            [],
        ),
    )

    if not isinstance(
        vulnerabilities,
        list,
    ):
        vulnerabilities = []

    # ========================================================
    # 6. DATABASE FALLBACK FOR CVES
    # ========================================================

    asset_ids = []

    for candidate in (
        report.get("asset"),
        network.get("asset"),
    ):

        if isinstance(
            candidate,
            dict,
        ) and candidate.get("id") is not None:

            asset_ids.append(
                candidate.get("id")
            )

    asset_ids = list(
        dict.fromkeys(
            asset_ids
        )
    )

    if not vulnerabilities and asset_ids:

        db_rows = (
            db.query(Vulnerability)
            .join(
                Asset,
                Vulnerability.asset_id
                == Asset.id,
            )
            .filter(
                Vulnerability.asset_id.in_(
                    asset_ids
                ),
                Asset.user_id
                == current_user.id,
            )
            .order_by(
                Vulnerability.detected_at.asc()
            )
            .all()
        )

        vulnerabilities = []

        for row in db_rows:

            vulnerabilities.append({
                "id": row.id,
                "cve_id": row.cve_id,
                "title": row.title,
                "severity": row.severity,
                "cvss_score": row.cvss_score,
                "description": row.description,
                "affected_product": (
                    row.affected_product
                ),
                "asset_id": row.asset_id,
                "detected_at": row.detected_at,
            })

    # ========================================================
    # 7. DATABASE CVE FALLBACK BY SCAN ASSET ID / IP / HOSTNAME
    # ========================================================

    # The CVEs are stored under Asset -> Vulnerability, while
    # the Scan record itself does not have a vulnerability
    # relationship. Older/newer report snapshots can therefore
    # contain the correct score but omit the CVE array.
    #
    # Recover the CVEs for this exact user's scanned asset.
    # Prefer the stored asset ID, then the resolved IP, then the
    # hostname. This prevents mixing another user's records.

    if not vulnerabilities:

        candidate_asset_ids = []

        for candidate in (
            report.get("asset"),
            network.get("asset"),
        ):

            if (
                isinstance(candidate, dict)
                and candidate.get("id") is not None
            ):
                candidate_asset_ids.append(
                    candidate.get("id")
                )

        candidate_asset_ids = list(
            dict.fromkeys(candidate_asset_ids)
        )

        matched_assets = []

        # ----------------------------------------------------
        # Exact stored asset ID
        # ----------------------------------------------------

        if candidate_asset_ids:

            matched_assets = (
                db.query(Asset)
                .filter(
                    Asset.user_id == current_user.id,
                    Asset.id.in_(candidate_asset_ids),
                )
                .all()
            )

        # ----------------------------------------------------
        # Exact resolved IP fallback
        # ----------------------------------------------------

        if not matched_assets and ip_address:

            matched_assets = (
                db.query(Asset)
                .filter(
                    Asset.user_id == current_user.id,
                    Asset.ip_address == str(ip_address),
                )
                .order_by(
                    Asset.last_scanned.desc()
                )
                .all()
            )

        # ----------------------------------------------------
        # Exact hostname fallback
        # ----------------------------------------------------

        if not matched_assets and hostname:

            matched_assets = (
                db.query(Asset)
                .filter(
                    Asset.user_id == current_user.id,
                    Asset.hostname == str(hostname),
                )
                .order_by(
                    Asset.last_scanned.desc()
                )
                .all()
            )

        # ----------------------------------------------------
        # Load vulnerabilities from the matched asset
        # ----------------------------------------------------

        if matched_assets:

            matched_asset = matched_assets[0]

            db_rows = (
                db.query(Vulnerability)
                .filter(
                    Vulnerability.asset_id
                    == matched_asset.id
                )
                .order_by(
                    Vulnerability.detected_at.asc()
                )
                .all()
            )

            for row in db_rows:

                vulnerabilities.append({
                    "id": row.id,
                    "cve_id": row.cve_id,
                    "title": row.title,
                    "severity": row.severity,
                    "cvss_score": row.cvss_score,
                    "description": row.description,
                    "affected_product": (
                        row.affected_product
                    ),
                    "asset_id": row.asset_id,
                    "detected_at": row.detected_at,
                })

    # ========================================================
    # 8. DEDUPLICATE CVES
    # ========================================================

    unique_vulnerabilities = []
    seen_cves = set()

    for vulnerability in vulnerabilities:

        if not isinstance(
            vulnerability,
            dict,
        ):
            continue

        cve_id = vulnerability.get(
            "cve_id",
            vulnerability.get("id"),
        )

        if not cve_id:
            continue

        cpe_key = vulnerability.get(
            "cpe_name",
            vulnerability.get(
                "affected_product",
                "",
            ),
        )

        signature = (
            str(cve_id),
            str(cpe_key),
        )

        if signature in seen_cves:
            continue

        seen_cves.add(
            signature
        )

        unique_vulnerabilities.append(
            vulnerability
        )

    vulnerabilities = (
        unique_vulnerabilities
    )

    # ========================================================
    # 8. SUMMARY — INCLUDE CVEs + WEB FINDINGS
    # ========================================================

    summary = {
        "critical": 0,
        "high": 0,
        "medium": 0,
        "low": 0,
        "informational": 0,
    }

    summary_items = []

    for item in web_findings:
        if isinstance(
            item,
            dict,
        ):
            summary_items.append(
                item
            )

    for item in vulnerabilities:
        if isinstance(
            item,
            dict,
        ):
            summary_items.append(
                item
            )

    for item in summary_items:

        severity = str(
            item.get(
                "severity",
                "informational",
            )
            or "informational"
        ).lower()

        if severity not in summary:
            severity = "informational"

        summary[severity] += 1

    summary["total"] = len(
        summary_items
    )

    cve_summary = (
        report.get(
            "cve_summary",
            network.get(
                "cve_summary",
                {},
            ),
        )
    )

    if not isinstance(
        cve_summary,
        dict,
    ):
        cve_summary = {}

    # Always rebuild the CVE summary when the stored summary is
    # missing or disagrees with the actual CVE records recovered
    # for this report.
    if (
        cve_summary.get("total")
        != len(vulnerabilities)
    ):
        cve_summary = build_cve_summary(
            vulnerabilities
        )

    # Keep the report's combined finding count synchronized.
    report["total_findings"] = (
        len(web_findings)
        + len(vulnerabilities)
    )

    # ========================================================
    # 9. SAFE REPORTLAB TEXT
    # ========================================================

    def safe(value):
        if value is None:
            return "N/A"

        text = str(value)

        return (
            text
            .replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
            .replace("\r\n", "<br/>")
            .replace("\n", "<br/>")
        )

    # ========================================================
    # 10. PDF
    # ========================================================

    buffer = BytesIO()

    def add_page_number(
        canvas,
        doc,
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
            12 * mm,
        )

        canvas.setFont(
            "Helvetica",
            7,
        )

        canvas.setFillColor(
            colors.HexColor(
                "#607D84"
            )
        )

        canvas.drawString(
            15 * mm,
            7 * mm,
            "CyberGuard Security Assessment",
        )

        canvas.drawRightString(
            width - 15 * mm,
            7 * mm,
            f"Page {doc.page}",
        )

        canvas.restoreState()

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

    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        "CyberGuardTitleAtoZ",
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

    heading_style = ParagraphStyle(
        "CyberGuardHeadingAtoZ",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=16,
        leading=20,
        textColor=colors.HexColor(
            "#063D35"
        ),
        spaceBefore=5 * mm,
        spaceAfter=5 * mm,
    )

    subheading_style = ParagraphStyle(
        "CyberGuardSubheadingAtoZ",
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
        "CyberGuardNormalAtoZ",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8.5,
        leading=12,
        textColor=colors.HexColor(
            "#263F3B"
        ),
        spaceAfter=1.8 * mm,
    )

    small_style = ParagraphStyle(
        "CyberGuardSmallAtoZ",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=7,
        leading=9.5,
        textColor=colors.HexColor(
            "#607D84"
        ),
    )

    story = []

    # ========================================================
    # 11. COVER
    # ========================================================

    story.append(
        Spacer(
            1,
            10 * mm,
        )
    )

    story.append(
        Paragraph(
            "CYBERGUARD",
            title_style,
        )
    )

    story.append(
        Paragraph(
            "SECURITY ASSESSMENT REPORT",
            ParagraphStyle(
                "CoverSubtitle",
                parent=normal_style,
                alignment=TA_CENTER,
                fontSize=10,
                textColor=colors.HexColor(
                    "#52786D"
                ),
                spaceAfter=4 * mm,
            ),
        )
    )

    story.append(
        Paragraph(
            safe(target),
            ParagraphStyle(
                "CoverTarget",
                parent=normal_style,
                alignment=TA_CENTER,
                fontSize=12,
                textColor=colors.HexColor(
                    "#087F6A"
                ),
                spaceAfter=8 * mm,
            ),
        )
    )

    # ========================================================
    # 12. EXECUTIVE OVERVIEW
    # ========================================================

    story.append(
        Paragraph(
            "1. Executive Overview",
            heading_style,
        )
    )

    overview = [
        ["Scan ID", scan_id_value],
        ["Scan Type", scan_type],
        ["Status", status],
        ["Target", target],
        ["Started At", started_at],
        ["Completed At", completed_at],
        ["HTTP Status", status_code],
        ["Final URL", final_url],
        ["Security Score", score],
        ["Grade", grade],
        ["Risk Level", risk],
        ["Total Findings", summary["total"]],
        ["Total CVEs", len(vulnerabilities)],
    ]

    overview_rows = [
        [
            Paragraph("<b>Property</b>", normal_style),
            Paragraph("<b>Value</b>", normal_style),
        ]
    ]

    for key, value in overview:
        overview_rows.append([
            Paragraph(
                safe(key),
                normal_style,
            ),
            Paragraph(
                safe(value),
                normal_style,
            ),
        ])

    table = Table(
        overview_rows,
        colWidths=[
            55 * mm,
            115 * mm,
        ],
        repeatRows=1,
    )

    table.setStyle(
        TableStyle([
            (
                "BACKGROUND",
                (0, 0),
                (-1, 0),
                colors.HexColor("#0B8F72"),
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
                (0, -1),
                colors.HexColor("#E8F3F0"),
            ),
            (
                "GRID",
                (0, 0),
                (-1, -1),
                0.4,
                colors.HexColor("#A5C8BE"),
            ),
            (
                "VALIGN",
                (0, 0),
                (-1, -1),
                "TOP",
            ),
        ])
    )

    story.append(table)

    # ========================================================
    # 13. SEVERITY SUMMARY
    # ========================================================

    story.append(
        Paragraph(
            "2. Severity Summary",
            heading_style,
        )
    )

    severity_rows = [
        [
            Paragraph("<b>Severity</b>", normal_style),
            Paragraph("<b>Count</b>", normal_style),
        ]
    ]

    for key in (
        "critical",
        "high",
        "medium",
        "low",
        "informational",
    ):
        severity_rows.append([
            Paragraph(
                key.title(),
                normal_style,
            ),
            Paragraph(
                safe(
                    summary.get(
                        key,
                        0,
                    )
                ),
                normal_style,
            ),
        ])

    severity_rows.append([
        Paragraph("<b>Total</b>", normal_style),
        Paragraph(
            f"<b>{safe(summary['total'])}</b>",
            normal_style,
        ),
    ])

    severity_table = Table(
        severity_rows,
        colWidths=[
            130 * mm,
            40 * mm,
        ],
        repeatRows=1,
    )

    severity_table.setStyle(
        TableStyle([
            (
                "BACKGROUND",
                (0, 0),
                (-1, 0),
                colors.HexColor("#0B8F72"),
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
                colors.HexColor("#A5C8BE"),
            ),
            (
                "ALIGN",
                (1, 1),
                (1, -1),
                "CENTER",
            ),
        ])
    )

    story.append(severity_table)

    # ========================================================
    # 14. TARGET / NETWORK DETAILS
    # ========================================================

    story.append(
        PageBreak()
    )

    story.append(
        Paragraph(
            "3. Target and Network Discovery",
            heading_style,
        )
    )

    network_rows = [
        [
            Paragraph("<b>Property</b>", normal_style),
            Paragraph("<b>Value</b>", normal_style),
        ]
    ]

    network_properties = [
        ("Target", target),
        ("Hostname", hostname),
        ("IP Address", ip_address),
        ("Port Range", port_range),
        ("Scan Scope", scan_scope),
        ("Scan Technique", scan_technique),
        (
            "Operating System",
            (
                os_detection.get("name")
                if isinstance(
                    os_detection,
                    dict,
                )
                else os_detection
            ),
        ),
        ("Primary CPE", cpe),
        ("Open Port Count", len(open_ports)),
    ]

    for key, value in network_properties:

        network_rows.append([
            Paragraph(
                safe(key),
                normal_style,
            ),
            Paragraph(
                safe(value),
                normal_style,
            ),
        ])

    network_table = Table(
        network_rows,
        colWidths=[
            55 * mm,
            115 * mm,
        ],
        repeatRows=1,
    )

    network_table.setStyle(
        TableStyle([
            (
                "BACKGROUND",
                (0, 0),
                (-1, 0),
                colors.HexColor("#0B8F72"),
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
                colors.HexColor("#A5C8BE"),
            ),
            (
                "VALIGN",
                (0, 0),
                (-1, -1),
                "TOP",
            ),
        ])
    )

    story.append(network_table)

    # ========================================================
    # 15. RESOLVED ADDRESSES
    # ========================================================

    if addresses:

        story.append(
            Paragraph(
                "Resolved Addresses",
                subheading_style,
            )
        )

        address_rows = [
            [
                Paragraph(
                    "<b>#</b>",
                    normal_style,
                ),
                Paragraph(
                    "<b>Address</b>",
                    normal_style,
                ),
            ]
        ]

        for index, address in enumerate(
            addresses,
            start=1,
        ):
            address_rows.append([
                Paragraph(
                    str(index),
                    normal_style,
                ),
                Paragraph(
                    safe(address),
                    normal_style,
                ),
            ])

        address_table = Table(
            address_rows,
            colWidths=[
                20 * mm,
                150 * mm,
            ],
            repeatRows=1,
        )

        address_table.setStyle(
            TableStyle([
                (
                    "BACKGROUND",
                    (0, 0),
                    (-1, 0),
                    colors.HexColor("#0B8F72"),
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
                    colors.HexColor("#A5C8BE"),
                ),
            ])
        )

        story.append(address_table)

    # ========================================================
    # 16. OPERATING SYSTEM DETAILS
    # ========================================================

    if isinstance(
        os_detection,
        dict,
    ) and os_detection:

        story.append(
            Paragraph(
                "Operating System Detection Details",
                subheading_style,
            )
        )

        os_rows = [
            [
                Paragraph("<b>Field</b>", normal_style),
                Paragraph("<b>Value</b>", normal_style),
            ]
        ]

        for key, value in os_detection.items():

            if isinstance(
                value,
                (
                    dict,
                    list,
                ),
            ):
                value = json.dumps(
                    value,
                    default=str,
                )

            os_rows.append([
                Paragraph(
                    safe(key),
                    normal_style,
                ),
                Paragraph(
                    safe(value),
                    normal_style,
                ),
            ])

        os_table = Table(
            os_rows,
            colWidths=[
                55 * mm,
                115 * mm,
            ],
            repeatRows=1,
        )

        os_table.setStyle(
            TableStyle([
                (
                    "BACKGROUND",
                    (0, 0),
                    (-1, 0),
                    colors.HexColor("#0B8F72"),
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
                    colors.HexColor("#A5C8BE"),
                ),
                (
                    "VALIGN",
                    (0, 0),
                    (-1, -1),
                    "TOP",
                ),
            ])
        )

        story.append(os_table)

    # ========================================================
    # 17. CPE INVENTORY
    # ========================================================

    if cpe_records:

        story.append(
            Paragraph(
                "Detected CPE Inventory",
                subheading_style,
            )
        )

        cpe_rows = [
            [
                Paragraph("<b>Port</b>", normal_style),
                Paragraph("<b>Service</b>", normal_style),
                Paragraph("<b>Product</b>", normal_style),
                Paragraph("<b>Version</b>", normal_style),
                Paragraph("<b>CPE</b>", normal_style),
            ]
        ]

        for record in cpe_records:

            if not isinstance(
                record,
                dict,
            ):
                continue

            cpe_rows.append([
                Paragraph(
                    safe(record.get("port")),
                    normal_style,
                ),
                Paragraph(
                    safe(record.get("service")),
                    normal_style,
                ),
                Paragraph(
                    safe(record.get("product")),
                    normal_style,
                ),
                Paragraph(
                    safe(record.get("version")),
                    normal_style,
                ),
                Paragraph(
                    safe(record.get("cpe")),
                    small_style,
                ),
            ])

        if len(cpe_rows) > 1:

            cpe_table = Table(
                cpe_rows,
                colWidths=[
                    18 * mm,
                    27 * mm,
                    35 * mm,
                    30 * mm,
                    60 * mm,
                ],
                repeatRows=1,
            )

            cpe_table.setStyle(
                TableStyle([
                    (
                        "BACKGROUND",
                        (0, 0),
                        (-1, 0),
                        colors.HexColor("#0B8F72"),
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
                        colors.HexColor("#A5C8BE"),
                    ),
                    (
                        "VALIGN",
                        (0, 0),
                        (-1, -1),
                        "TOP",
                    ),
                    (
                        "FONTSIZE",
                        (0, 0),
                        (-1, -1),
                        7,
                    ),
                ])
            )

            story.append(cpe_table)

    # ========================================================
    # 18. OPEN PORTS
    # ========================================================

    story.append(
        Paragraph(
            "Open Ports and Services",
            subheading_style,
        )
    )

    if open_ports:

        port_rows = [
            [
                Paragraph("<b>Port</b>", normal_style),
                Paragraph("<b>Protocol</b>", normal_style),
                Paragraph("<b>State</b>", normal_style),
                Paragraph("<b>Service</b>", normal_style),
                Paragraph("<b>Product</b>", normal_style),
                Paragraph("<b>Version</b>", normal_style),
            ]
        ]

        for port in open_ports:

            if not isinstance(
                port,
                dict,
            ):
                continue

            port_rows.append([
                Paragraph(
                    safe(port.get("port")),
                    normal_style,
                ),
                Paragraph(
                    safe(port.get("protocol")),
                    normal_style,
                ),
                Paragraph(
                    safe(
                        port.get(
                            "state",
                            "open",
                        )
                    ),
                    normal_style,
                ),
                Paragraph(
                    safe(port.get("service")),
                    normal_style,
                ),
                Paragraph(
                    safe(port.get("product")),
                    normal_style,
                ),
                Paragraph(
                    safe(port.get("version")),
                    normal_style,
                ),
            ])

        port_table = Table(
            port_rows,
            colWidths=[
                17 * mm,
                23 * mm,
                23 * mm,
                32 * mm,
                38 * mm,
                37 * mm,
            ],
            repeatRows=1,
        )

        port_table.setStyle(
            TableStyle([
                (
                    "BACKGROUND",
                    (0, 0),
                    (-1, 0),
                    colors.HexColor("#0B8F72"),
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
                    colors.HexColor("#A5C8BE"),
                ),
                (
                    "VALIGN",
                    (0, 0),
                    (-1, -1),
                    "TOP",
                ),
                (
                    "FONTSIZE",
                    (0, 0),
                    (-1, -1),
                    7,
                ),
            ])
        )

        story.append(port_table)

    else:

        story.append(
            Paragraph(
                "No open ports were returned.",
                normal_style,
            )
        )

    # ========================================================
    # 19. CVE ASSESSMENT
    # ========================================================

    story.append(
        PageBreak()
    )

    story.append(
        Paragraph(
            "4. CVE Vulnerability Assessment",
            heading_style,
        )
    )

    # CVE summary
    if cve_summary:

        cve_summary_rows = [
            [
                Paragraph("<b>Severity</b>", normal_style),
                Paragraph("<b>Count</b>", normal_style),
            ]
        ]

        for key, value in cve_summary.items():

            cve_summary_rows.append([
                Paragraph(
                    safe(
                        str(key)
                        .replace("_", " ")
                        .title()
                    ),
                    normal_style,
                ),
                Paragraph(
                    safe(value),
                    normal_style,
                ),
            ])

        cve_table = Table(
            cve_summary_rows,
            colWidths=[
                130 * mm,
                40 * mm,
            ],
            repeatRows=1,
        )

        cve_table.setStyle(
            TableStyle([
                (
                    "BACKGROUND",
                    (0, 0),
                    (-1, 0),
                    colors.HexColor("#0B8F72"),
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
                    colors.HexColor("#A5C8BE"),
                ),
            ])
        )

        story.append(cve_table)

    story.append(
        Paragraph(
            f"All detected CVE records: <b>{safe(len(vulnerabilities))}</b>",
            normal_style,
        )
    )

    # Every CVE
    for index, vulnerability in enumerate(
        vulnerabilities,
        start=1,
    ):

        if not isinstance(
            vulnerability,
            dict,
        ):
            continue

        cve_id = vulnerability.get(
            "cve_id",
            vulnerability.get(
                "id",
                "N/A",
            ),
        )

        story.append(
            Paragraph(
                f"{index}. {safe(cve_id)}",
                subheading_style,
            )
        )

        cve_rows = [
            ["Severity", vulnerability.get("severity")],
            ["CVSS Score", vulnerability.get("cvss_score")],
            ["CVSS Version", vulnerability.get("cvss_version")],
            ["CVSS Vector", vulnerability.get("cvss_vector")],
            ["Affected Product", vulnerability.get("affected_product") or vulnerability.get("cpe_name")],
            ["CPE", vulnerability.get("cpe_name")],
            ["Detected Port", vulnerability.get("port")],
            ["Service", vulnerability.get("service")],
            ["Product", vulnerability.get("product")],
            ["Version", vulnerability.get("version")],
            ["Published Date", vulnerability.get("published_date")],
            ["Last Modified", vulnerability.get("last_modified_date")],
            ["NVD Exact CPE Match", vulnerability.get("nvd_exact_cpe_match")],
            ["NVD Vulnerable Match", vulnerability.get("nvd_vulnerable_match")],
        ]

        if vulnerability.get("cwe_ids"):
            cve_rows.append([
                "CWE IDs",
                ", ".join(
                    str(value)
                    for value in vulnerability.get(
                        "cwe_ids",
                        [],
                    )
                ),
            ])

        for key, value in cve_rows:

            if value is None:
                value = "N/A"

            cve_row = Table(
                [[
                    Paragraph(
                        safe(key),
                        normal_style,
                    ),
                    Paragraph(
                        safe(value),
                        normal_style,
                    ),
                ]],
                colWidths=[
                    45 * mm,
                    125 * mm,
                ],
            )

            cve_row.setStyle(
                TableStyle([
                    (
                        "BACKGROUND",
                        (0, 0),
                        (0, 0),
                        colors.HexColor("#E8F3F0"),
                    ),
                    (
                        "GRID",
                        (0, 0),
                        (-1, -1),
                        0.35,
                        colors.HexColor("#A5C8BE"),
                    ),
                    (
                        "VALIGN",
                        (0, 0),
                        (-1, -1),
                        "TOP",
                    ),
                ])
            )

            story.append(cve_row)

        story.append(
            Paragraph(
                "<b>Description</b>",
                normal_style,
            )
        )

        story.append(
            Paragraph(
                safe(
                    vulnerability.get(
                        "description",
                        "No description available.",
                    )
                ),
                normal_style,
            )
        )

        applicability = vulnerability.get(
            "applicability",
            [],
        )

        version_conditions = vulnerability.get(
            "version_conditions",
            [],
        )

        if applicability or version_conditions:

            story.append(
                Paragraph(
                    "<b>NVD Applicability / Version Conditions</b>",
                    normal_style,
                )
            )

            applicability_text = json.dumps(
                {
                    "applicability": applicability,
                    "version_conditions": version_conditions,
                },
                default=str,
                indent=2,
            )

            story.append(
                Paragraph(
                    safe(applicability_text),
                    small_style,
                )
            )

        references = vulnerability.get(
            "references",
            [],
        )

        if references:

            story.append(
                Paragraph(
                    "<b>References</b>",
                    normal_style,
                )
            )

            for reference in references:

                if isinstance(
                    reference,
                    dict,
                ):
                    reference_url = reference.get(
                        "url"
                    )

                    reference_source = reference.get(
                        "source"
                    )

                    reference_tags = reference.get(
                        "tags",
                        [],
                    )

                    text_parts = [
                        reference_url,
                        reference_source,
                        (
                            ", ".join(
                                str(tag)
                                for tag in reference_tags
                            )
                            if reference_tags
                            else None
                        ),
                    ]

                    reference_text = " | ".join(
                        str(value)
                        for value in text_parts
                        if value
                    )

                else:
                    reference_text = str(
                        reference
                    )

                story.append(
                    Paragraph(
                        safe(reference_text),
                        small_style,
                    )
                )

        story.append(
            Spacer(
                1,
                4 * mm,
            )
        )

    # ========================================================
    # 20. WEB SECURITY
    # ========================================================

    story.append(
        PageBreak()
    )

    story.append(
        Paragraph(
            "5. Web Security and HTTP Headers",
            heading_style,
        )
    )

    web_basic_rows = [
        [
            Paragraph("<b>Property</b>", normal_style),
            Paragraph("<b>Value</b>", normal_style),
        ]
    ]

    for key, value in web_scan.items():

        if isinstance(
            value,
            (
                dict,
                list,
            ),
        ):
            continue

        web_basic_rows.append([
            Paragraph(
                safe(
                    str(key)
                    .replace("_", " ")
                    .title()
                ),
                normal_style,
            ),
            Paragraph(
                safe(value),
                normal_style,
            ),
        ])

    if len(web_basic_rows) > 1:

        web_basic_table = Table(
            web_basic_rows,
            colWidths=[
                65 * mm,
                105 * mm,
            ],
            repeatRows=1,
        )

        web_basic_table.setStyle(
            TableStyle([
                (
                    "BACKGROUND",
                    (0, 0),
                    (-1, 0),
                    colors.HexColor("#0B8F72"),
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
                    colors.HexColor("#A5C8BE"),
                ),
                (
                    "VALIGN",
                    (0, 0),
                    (-1, -1),
                    "TOP",
                ),
            ])
        )

        story.append(web_basic_table)

    # All headers checked
    story.append(
        Paragraph(
            "All Security Headers Checked",
            subheading_style,
        )
    )

    header_names = []

    if isinstance(
        headers_checked,
        list,
    ):
        header_names = headers_checked[:]

    elif isinstance(
        headers_checked,
        dict,
    ):
        header_names = list(
            headers_checked.keys()
        )

    if header_names:

        for header_name in header_names:

            story.append(
                Paragraph(
                    f"• {safe(header_name)}",
                    normal_style,
                )
            )

    else:

        story.append(
            Paragraph(
                "No security-header checklist was returned.",
                normal_style,
            )
        )

    # Header values/status if present
    if security_headers:

        story.append(
            Paragraph(
                "Security Header Results",
                subheading_style,
            )
        )

        header_rows = [
            [
                Paragraph("<b>Header</b>", normal_style),
                Paragraph("<b>Result</b>", normal_style),
            ]
        ]

        if isinstance(
            security_headers,
            dict,
        ):

            for key, value in (
                security_headers.items()
            ):

                header_rows.append([
                    Paragraph(
                        safe(key),
                        normal_style,
                    ),
                    Paragraph(
                        safe(value),
                        normal_style,
                    ),
                ])

        elif isinstance(
            security_headers,
            list,
        ):

            for item in security_headers:

                if isinstance(
                    item,
                    dict,
                ):
                    name = (
                        item.get("name")
                        or item.get("header")
                        or item.get("key")
                        or "Header"
                    )

                    value = (
                        item.get("status")
                        or item.get("value")
                        or item.get("result")
                        or json.dumps(
                            item,
                            default=str,
                        )
                    )

                else:
                    name = str(item)
                    value = "Checked"

                header_rows.append([
                    Paragraph(
                        safe(name),
                        normal_style,
                    ),
                    Paragraph(
                        safe(value),
                        normal_style,
                    ),
                ])

        if len(header_rows) > 1:

            header_table = Table(
                header_rows,
                colWidths=[
                    80 * mm,
                    90 * mm,
                ],
                repeatRows=1,
            )

            header_table.setStyle(
                TableStyle([
                    (
                        "BACKGROUND",
                        (0, 0),
                        (-1, 0),
                        colors.HexColor("#0B8F72"),
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
                        colors.HexColor("#A5C8BE"),
                    ),
                    (
                        "VALIGN",
                        (0, 0),
                        (-1, -1),
                        "TOP",
                    ),
                ])
            )

            story.append(header_table)

    if header_summary:

        story.append(
            Paragraph(
                "Security Header Summary",
                subheading_style,
            )
        )

        story.append(
            Paragraph(
                safe(
                    json.dumps(
                        header_summary,
                        default=str,
                        indent=2,
                    )
                ),
                small_style,
            )
        )

    # Missing-header findings
    missing_headers = []

    for finding in web_findings:

        if not isinstance(
            finding,
            dict,
        ):
            continue

        title = str(
            finding.get(
                "title",
                "",
            )
        )

        category = str(
            finding.get(
                "category",
                "",
            )
        )

        if (
            "missing" in title.lower()
            and (
                "header" in title.lower()
                or "security misconfiguration"
                in category.lower()
            )
        ):
            missing_headers.append(
                finding
            )

    story.append(
        Paragraph(
            "Missing Security Headers",
            subheading_style,
        )
    )

    if missing_headers:

        for finding in missing_headers:

            story.append(
                Paragraph(
                    f"<b>{safe(finding.get('title'))}</b>",
                    normal_style,
                )
            )

            story.append(
                Paragraph(
                    safe(
                        finding.get(
                            "description",
                            "",
                        )
                    ),
                    normal_style,
                )
            )

            if finding.get(
                "recommendation"
            ):
                story.append(
                    Paragraph(
                        f"<b>Recommendation:</b> "
                        f"{safe(finding.get('recommendation'))}",
                        normal_style,
                    )
                )

    else:

        story.append(
            Paragraph(
                "No missing security-header findings were returned.",
                normal_style,
            )
        )

    # ========================================================
    # 21. OTHER WEB FINDINGS
    # ========================================================

    non_header_findings = [
        finding
        for finding in web_findings
        if finding not in missing_headers
    ]

    if non_header_findings:

        story.append(
            Paragraph(
                "Other Web Security Findings",
                subheading_style,
            )
        )

        for index, finding in enumerate(
            non_header_findings,
            start=1,
        ):

            story.append(
                Paragraph(
                    f"{index}. "
                    f"<b>{safe(finding.get('title', 'Finding'))}</b>",
                    normal_style,
                )
            )

            if finding.get(
                "severity"
            ):
                story.append(
                    Paragraph(
                        f"Severity: "
                        f"{safe(finding.get('severity'))}",
                        normal_style,
                    )
                )

            if finding.get(
                "category"
            ):
                story.append(
                    Paragraph(
                        f"Category: "
                        f"{safe(finding.get('category'))}",
                        normal_style,
                    )
                )

            if finding.get(
                "description"
            ):
                story.append(
                    Paragraph(
                        safe(
                            finding.get(
                                "description"
                            )
                        ),
                        normal_style,
                    )
                )

            if finding.get(
                "recommendation"
            ):
                story.append(
                    Paragraph(
                        f"<b>Recommendation:</b> "
                        f"{safe(finding.get('recommendation'))}",
                        normal_style,
                    )
                )

    # ========================================================
    # 22. SCORE BREAKDOWN
    # ========================================================

    score_breakdown = report.get(
        "score_breakdown",
        {},
    )

    if isinstance(
        score_breakdown,
        dict,
    ) and score_breakdown:

        story.append(
            Paragraph(
                "6. Score Breakdown",
                heading_style,
            )
        )

        for key, value in score_breakdown.items():

            if isinstance(
                value,
                (
                    dict,
                    list,
                ),
            ):
                value = json.dumps(
                    value,
                    default=str,
                    indent=2,
                )

            story.append(
                Paragraph(
                    f"<b>{safe(key)}</b>: "
                    f"{safe(value)}",
                    normal_style,
                )
            )

    # ========================================================
    # 23. RECOMMENDED ACTIONS
    # ========================================================

    story.append(
        Paragraph(
            "7. Recommended Actions",
            heading_style,
        )
    )

    recommendations = []

    for finding in web_findings:

        if not isinstance(
            finding,
            dict,
        ):
            continue

        recommendation = finding.get(
            "recommendation"
        )

        if recommendation and (
            recommendation
            not in recommendations
        ):
            recommendations.append(
                recommendation
            )

    for vulnerability in vulnerabilities:

        if not isinstance(
            vulnerability,
            dict,
        ):
            continue

        recommendation = vulnerability.get(
            "recommendation"
        )

        if recommendation and (
            recommendation
            not in recommendations
        ):
            recommendations.append(
                recommendation
            )

    if recommendations:

        for index, recommendation in enumerate(
            recommendations,
            start=1,
        ):
            story.append(
                Paragraph(
                    f"{index}. "
                    f"{safe(recommendation)}",
                    normal_style,
                )
            )

    else:

        if vulnerabilities:

            story.append(
                Paragraph(
                    "No per-CVE remediation text was stored with "
                    "the scan. Review each affected software "
                    "version against the corresponding vendor "
                    "security advisory and the NVD references "
                    "listed in the CVE section.",
                    normal_style,
                )
            )

        else:

            story.append(
                Paragraph(
                    "No explicit remediation recommendations were returned by the scanners.",
                    normal_style,
                )
            )

    # ========================================================
    # 24. REPORT CONCLUSION
    # ========================================================

    story.append(
        PageBreak()
    )

    story.append(
        Paragraph(
            "8. Assessment Conclusion",
            heading_style,
        )
    )

    story.append(
        Paragraph(
            f"The CyberGuard assessment for "
            f"<b>{safe(target)}</b> completed with a "
            f"security score of <b>{safe(score)}/100</b>, "
            f"grade <b>{safe(grade)}</b>, and risk level "
            f"<b>{safe(risk)}</b>. The report contains "
            f"<b>{safe(len(vulnerabilities))}</b> CVE record(s) "
            f"and <b>{safe(len(web_findings))}</b> web finding(s), "
            f"for <b>{safe(len(vulnerabilities) + len(web_findings))}</b> "
            f"combined finding(s).",
            normal_style,
        )
    )

    story.append(
        Paragraph(
            "This PDF contains the scan information returned by CyberGuard, including the network discovery, CPE inventory, CVE records, web checks, security-header results, and remediation information available at the time of assessment.",
            normal_style,
        )
    )

    # ========================================================
    # 25. FOOTER INFO
    # ========================================================

    story.append(
        Spacer(
            1,
            12 * mm,
        )
    )

    story.append(
        Paragraph(
            f"Report generated by CyberGuard on "
            f"{safe(datetime.utcnow().isoformat())} UTC.",
            small_style,
        )
    )

    story.append(
        Paragraph(
            "For authorized security assessment and remediation purposes only.",
            small_style,
        )
    )

    # ========================================================
    # 26. BUILD
    # ========================================================

    document.build(
        story,
        onFirstPage=add_page_number,
        onLaterPages=add_page_number,
    )

    buffer.seek(0)

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
