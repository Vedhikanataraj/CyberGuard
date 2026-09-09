import subprocess
import xml.etree.ElementTree as ET
import re


# ============================================================
# TARGET VALIDATION
# ============================================================

def validate_target(target: str) -> bool:
    """
    Basic validation for a host/IP target.

    Only intended for systems that you own
    or are explicitly authorized to test.
    """

    if not target or len(target) > 253:
        return False

    pattern = r"^[a-zA-Z0-9._:/-]+$"

    return bool(re.match(pattern, target))


# ============================================================
# PORT SCANNER
# ============================================================

def scan_ports(
    target: str,
    port_range: str = "1-1000"
):
    """
    CyberGuard network scanner.

    Current capabilities:
        1. Port scanning
        2. Service detection
        3. Product detection
        4. Version detection
        5. CPE detection
        6. OS detection
    """

    # --------------------------------------------------------
    # Validate target
    # --------------------------------------------------------

    if not validate_target(target):

        raise ValueError(
            "Invalid target."
        )

    # --------------------------------------------------------
    # Nmap command
    # --------------------------------------------------------

    command = [

        "nmap",

        # TCP connect scan
        "-sT",

        # Service and version detection
        "-sV",

        # OS detection
        "-O",

        # Try harder with OS detection
        "--osscan-guess",

        # Requested port range
        "-p",
        port_range,

        # XML output
        "-oX",
        "-",

        target
    ]

    # --------------------------------------------------------
    # Execute Nmap
    # --------------------------------------------------------

    try:

        result = subprocess.run(

            command,

            capture_output=True,

            text=True,

            timeout=240
        )

    except subprocess.TimeoutExpired:

        raise RuntimeError(
            "Nmap scan timed out."
        )

    except FileNotFoundError:

        raise RuntimeError(
            "Nmap is not installed or is not available in PATH."
        )

    # --------------------------------------------------------
    # Check Nmap result
    # --------------------------------------------------------

    if result.returncode != 0:

        error_message = (

            result.stderr.strip()

            or result.stdout.strip()

            or "Nmap scan failed."

        )

        raise RuntimeError(
            error_message
        )

    # --------------------------------------------------------
    # Parse XML
    # --------------------------------------------------------

    try:

        root = ET.fromstring(
            result.stdout
        )

    except ET.ParseError:

        raise RuntimeError(
            "Unable to parse Nmap XML output."
        )

    # ========================================================
    # HOST INFORMATION
    # ========================================================

    host = root.find(
        ".//host"
    )

    if host is None:

        return {

            "status": "completed",

            "target": target,

            "port_range": port_range,

            "open_ports": [],

            "total_open_ports": 0,

            "os_detection": {

                "name": "Unknown",

                "accuracy": None,

                "details": []

            }

        }

    # ========================================================
    # OPEN PORTS
    # SERVICE / PRODUCT / VERSION / CPE DETECTION
    # ========================================================

    open_ports = []

    for port in host.findall(
        "./ports/port"
    ):

        # ----------------------------------------------------
        # Port state
        # ----------------------------------------------------

        state_element = port.find(
            "state"
        )

        if state_element is None:
            continue

        state = state_element.get(
            "state"
        )

        # Only keep open ports
        if state != "open":
            continue

        # ----------------------------------------------------
        # Port number
        # ----------------------------------------------------

        port_number = port.get(
            "portid"
        )

        if not port_number:
            continue

        # ----------------------------------------------------
        # Protocol
        # ----------------------------------------------------

        protocol = port.get(
            "protocol",
            "tcp"
        )

        # ----------------------------------------------------
        # Service information
        # ----------------------------------------------------

        service_element = port.find(
            "service"
        )

        service = None

        product = None

        version = None

        extra_info = None

        cpe = None

        # ----------------------------------------------------
        # Extract service information
        # ----------------------------------------------------

        if service_element is not None:

            service = service_element.get(
                "name"
            )

            product = service_element.get(
                "product"
            )

            version = service_element.get(
                "version"
            )

            extra_info = service_element.get(
                "extrainfo"
            )

            # ------------------------------------------------
            # CPE DETECTION
            # ------------------------------------------------
            #
            # Nmap can provide one or more:
            #
            # <cpe>cpe:/a:...</cpe>
            #
            # or:
            #
            # <cpe>cpe:2.3:a:...</cpe>
            #
            # We take the first valid CPE.
            # ------------------------------------------------

            cpe_element = service_element.find(
                "cpe"
            )

            if cpe_element is not None:

                cpe_text = (
                    cpe_element.text
                )

                if cpe_text:

                    cpe = cpe_text.strip()

        # ----------------------------------------------------
        # Add open port
        # ----------------------------------------------------

        open_ports.append({

            "port": int(
                port_number
            ),

            "protocol": protocol,

            "state": state,

            "service": service,

            "product": product,

            "version": version,

            "extra_info": extra_info,

            "cpe": cpe

        })

    # ========================================================
    # OS DETECTION
    # ========================================================

    os_detection = {

        "name": "Unknown",

        "accuracy": None,

        "details": []

    }

    # --------------------------------------------------------
    # Find best OS match
    # --------------------------------------------------------

    os_match = host.find(
        "./os/osmatch"
    )

    if os_match is not None:

        os_name = os_match.get(
            "name"
        )

        accuracy = os_match.get(
            "accuracy"
        )

        # ----------------------------------------------------
        # OS name
        # ----------------------------------------------------

        if os_name:

            os_detection["name"] = os_name

        # ----------------------------------------------------
        # OS accuracy
        # ----------------------------------------------------

        if accuracy:

            try:

                os_detection["accuracy"] = int(
                    accuracy
                )

            except ValueError:

                os_detection["accuracy"] = None

        # ----------------------------------------------------
        # OS class details
        # ----------------------------------------------------

        os_classes = os_match.findall(
            "./osclass"
        )

        details = []

        for os_class in os_classes:

            vendor = os_class.get(
                "vendor"
            )

            os_family = os_class.get(
                "osfamily"
            )

            os_gen = os_class.get(
                "osgen"
            )

            accuracy_class = os_class.get(
                "accuracy"
            )

            parts = []

            if vendor:

                parts.append(
                    vendor
                )

            if os_family:

                parts.append(
                    os_family
                )

            if os_gen:

                parts.append(
                    os_gen
                )

            if accuracy_class:

                parts.append(
                    f"{accuracy_class}% accuracy"
                )

            if parts:

                details.append(
                    " ".join(parts)
                )

        if details:

            os_detection["details"] = details

    # ========================================================
    # RETURN RESULT
    # ========================================================

    return {

        "status": "completed",

        "target": target,

        "port_range": port_range,

        "open_ports": open_ports,

        "total_open_ports": len(
            open_ports
        ),

        "os_detection": os_detection

    }