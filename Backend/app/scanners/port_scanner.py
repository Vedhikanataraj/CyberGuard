import ipaddress
import re
import socket
import subprocess
import xml.etree.ElementTree as ET


def validate_target(target: str) -> bool:
    if not target or len(target) > 253:
        return False
    return bool(re.match(r"^[a-zA-Z0-9._:-]+$", target))


def _resolve_addresses(target):
    addresses = []
    try:
        infos = socket.getaddrinfo(target, None, type=socket.SOCK_STREAM)
        for result in infos:
            if not result or not result[4]:
                continue
            address = result[4][0]
            if address not in addresses:
                addresses.append(address)
    except socket.gaierror:
        pass
    return addresses


def _host_details(host, target):
    addresses = []
    for address in host.findall("./address") if host is not None else []:
        value = address.get("addr")
        if value and value not in addresses:
            addresses.append(value)

    if not addresses:
        addresses = _resolve_addresses(target)

    primary_ip = None
    for address in addresses:
        try:
            ip = ipaddress.ip_address(address)
        except ValueError:
            continue
        if ip.version == 4:
            primary_ip = address
            break
        if primary_ip is None:
            primary_ip = address

    hostname = None
    if host is not None:
        host_name = host.find("./hostnames/hostname")
        if host_name is not None:
            hostname = host_name.get("name")

    if not hostname:
        try:
            hostname = socket.getfqdn(target)
        except OSError:
            hostname = target

    return primary_ip or target, hostname, addresses


def _run_nmap(command):
    return subprocess.run(command, capture_output=True, text=True, timeout=300)


def scan_ports(target: str, port_range: str = "top-1000"):
    if not validate_target(target):
        raise ValueError("Invalid target.")

    normalized_scope = str(port_range or "top-1000").strip().lower()
    command = [
    "nmap",
    "-T4",
    "-sT",
    "-sV",
    "--version-light",
    "-O",
]

    if normalized_scope.startswith("top-"):
        count = int(normalized_scope.split("-", 1)[1])
        if not 1 <= count <= 10000:
            raise ValueError("Top-port count must be between 1 and 10000.")
        command.extend(["--top-ports", str(count)])
        scan_scope = f"Top {count} common TCP ports"
    else:
        command.extend(["-p", normalized_scope])
        scan_scope = normalized_scope

    command.extend(["-oX", "-", target])

    try:
        result = _run_nmap(command)

        # On Windows/Linux development machines, SYN scans may fail when
        # raw-packet privileges are unavailable. Fall back to TCP connect.
        if result.returncode != 0 and any(
            token in (result.stderr or "").lower()
            for token in ("requires root", "requires privileged", "raw socket", "permission denied")
        ):
            command = [item if item != "-sS" else "-sT" for item in command]
            result = _run_nmap(command)
            scan_technique = "TCP Connect (-sT) fallback"
        else:
            scan_technique = "TCP SYN (-sS)"

    except subprocess.TimeoutExpired as error:
        raise RuntimeError("Nmap scan timed out.") from error
    except FileNotFoundError as error:
        raise RuntimeError("Nmap is not installed or is not available in PATH.") from error

    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or result.stdout.strip() or "Nmap scan failed.")

    try:
        root = ET.fromstring(result.stdout)
    except ET.ParseError as error:
        raise RuntimeError("Unable to parse Nmap XML output.") from error

    host = root.find(".//host")
    if host is None:
        ip_address, hostname, addresses = _host_details(None, target)
        return {
            "status": "completed",
            "target": target,
            "hostname": hostname,
            "ip_address": ip_address,
            "addresses": addresses,
            "port_range": port_range,
            "scan_scope": scan_scope,
            "scan_technique": scan_technique,
            "open_ports": [],
            "total_open_ports": 0,
            "os_detection": {"name": "Unknown", "accuracy": None, "details": []},
        }

    ip_address, hostname, addresses = _host_details(host, target)
    open_ports = []

    for port in host.findall("./ports/port"):
        state_element = port.find("state")
        if state_element is None or state_element.get("state") != "open":
            continue

        port_number = port.get("portid")
        if not port_number:
            continue

        protocol = port.get("protocol", "tcp")
        service_element = port.find("service")

        service = product = version = extra_info = cpe = None
        if service_element is not None:
            service = service_element.get("name")
            product = service_element.get("product")
            version = service_element.get("version")
            extra_info = service_element.get("extrainfo")
            cpe_element = service_element.find("cpe")
            if cpe_element is not None and cpe_element.text:
                cpe = cpe_element.text.strip()

        open_ports.append({
            "port": int(port_number),
            "protocol": protocol,
            "state": "open",
            "service": service,
            "product": product,
            "version": version,
            "extra_info": extra_info,
            "cpe": cpe,
        })

    open_ports.sort(key=lambda item: (item["protocol"], item["port"]))

    os_detection = {"name": "Unknown", "accuracy": None, "details": []}
    os_matches = host.findall("./os/osmatch")
    if os_matches:
        best = max(os_matches, key=lambda item: int(item.get("accuracy") or 0))
        os_detection["name"] = best.get("name") or "Unknown"
        try:
            os_detection["accuracy"] = int(best.get("accuracy"))
        except (TypeError, ValueError):
            os_detection["accuracy"] = None

        details = []
        for os_class in best.findall("./osclass"):
            parts = [
                os_class.get("vendor"),
                os_class.get("osfamily"),
                os_class.get("osgen"),
            ]
            label = " ".join(part for part in parts if part)
            accuracy = os_class.get("accuracy")
            if accuracy:
                label = f"{label} ({accuracy}% accuracy)" if label else f"{accuracy}% accuracy"
            if label:
                details.append(label)
        os_detection["details"] = details

    return {
        "status": "completed",
        "target": target,
        "hostname": hostname,
        "ip_address": ip_address,
        "addresses": addresses,
        "port_range": port_range,
        "scan_scope": scan_scope,
        "scan_technique": scan_technique,
        "open_ports": open_ports,
        "total_open_ports": len(open_ports),
        "os_detection": os_detection,
    }
