import ipaddress
import socket
from urllib.parse import urljoin, urlparse

import httpx


SECURITY_HEADERS = {
    "content-security-policy": {
        "name": "Content-Security-Policy",
        "severity": "Medium",
        "description": "Controls which resources a browser is allowed to load and helps reduce script-injection risk.",
        "recommendation": "Configure a restrictive Content-Security-Policy appropriate for the application.",
    },
    "strict-transport-security": {
        "name": "Strict-Transport-Security",
        "severity": "Medium",
        "description": "Instructs browsers to use HTTPS for future connections.",
        "recommendation": "Enable HSTS after HTTPS is correctly configured across the application.",
    },
    "x-content-type-options": {
        "name": "X-Content-Type-Options",
        "severity": "Low",
        "description": "Prevents browsers from MIME-sniffing responses away from the declared Content-Type.",
        "recommendation": "Set X-Content-Type-Options to nosniff.",
    },
    "x-frame-options": {
        "name": "X-Frame-Options",
        "severity": "Low",
        "description": "Provides legacy clickjacking protection by controlling whether a page may be framed.",
        "recommendation": "Set X-Frame-Options to DENY or SAMEORIGIN, or use an appropriate CSP frame-ancestors policy.",
    },
    "referrer-policy": {
        "name": "Referrer-Policy",
        "severity": "Low",
        "description": "Controls how much referrer information is sent with requests.",
        "recommendation": "Configure a restrictive Referrer-Policy such as strict-origin-when-cross-origin.",
    },
    "permissions-policy": {
        "name": "Permissions-Policy",
        "severity": "Low",
        "description": "Controls access to selected browser features and capabilities.",
        "recommendation": "Define a Permissions-Policy that disables browser features the application does not need.",
    },
    "cross-origin-opener-policy": {
        "name": "Cross-Origin-Opener-Policy",
        "severity": "Low",
        "description": "Controls browsing-context isolation across origins.",
        "recommendation": "Consider an appropriate Cross-Origin-Opener-Policy such as same-origin where compatible.",
    },
    "cross-origin-resource-policy": {
        "name": "Cross-Origin-Resource-Policy",
        "severity": "Low",
        "description": "Controls which origins may load the resource.",
        "recommendation": "Consider an appropriate Cross-Origin-Resource-Policy for the application's resources.",
    },
}


def _is_public_host(hostname: str) -> bool:
    if not hostname:
        return False

    hostname = hostname.strip().lower().rstrip(".")

    if hostname == "localhost" or hostname.endswith(".localhost") or hostname.endswith(".local"):
        return False

    try:
        ip = ipaddress.ip_address(hostname)
        return ip.is_global
    except ValueError:
        pass

    try:
        addresses = socket.getaddrinfo(
            hostname,
            None,
            type=socket.SOCK_STREAM,
        )
    except socket.gaierror:
        return True

    for result in addresses:
        if not result or not result[4]:
            continue
        try:
            ip = ipaddress.ip_address(result[4][0])
        except ValueError:
            continue
        if not ip.is_global:
            return False

    return True


def _candidate_urls(target: str):
    parsed = urlparse(target)

    if parsed.scheme in {"http", "https"}:
        return [target]

    return [
        f"https://{target}",
        f"http://{target}",
    ]


def _header_results(headers: dict, scheme: str):
    results = []

    for key, info in SECURITY_HEADERS.items():
        if key == "strict-transport-security" and scheme != "https":
            results.append({
                "header": info["name"],
                "status": "Not assessed",
                "value": None,
                "severity": info["severity"],
                "description": "HSTS is only evaluated on an HTTPS response.",
                "recommendation": info["recommendation"],
            })
            continue

        value = headers.get(key)

        if value is None:
            results.append({
                "header": info["name"],
                "status": "Missing",
                "value": None,
                "severity": info["severity"],
                "description": info["description"],
                "recommendation": info["recommendation"],
            })
        else:
            results.append({
                "header": info["name"],
                "status": "Present",
                "value": value,
                "severity": "Informational",
                "description": f"The {info['name']} response header was detected.",
                "recommendation": "No change required based on presence alone; review the value for policy strength.",
            })

    return results


async def scan_web(target: str):
    """Perform a passive HTTP response/header assessment of an authorized public target."""

    last_error = None

    try:
        timeout = httpx.Timeout(15.0)
        limits = httpx.Limits(max_connections=10, max_keepalive_connections=5)

        async with httpx.AsyncClient(
            timeout=timeout,
            follow_redirects=False,
            limits=limits,
        ) as client:
            for candidate in _candidate_urls(target):
                current_url = candidate
                redirects = 0

                while True:
                    parsed = urlparse(current_url)
                    if not _is_public_host(parsed.hostname):
                        return {
                            "status": "blocked",
                            "status_code": None,
                            "final_url": current_url,
                            "request_url": candidate,
                            "findings": [],
                            "security_headers": [],
                            "headers_checked": [],
                            "error": "Redirected to a private or non-public target. Scan stopped.",
                        }

                    try:
                        response = await client.get(current_url)
                    except httpx.RequestError as error:
                        last_error = str(error)
                        break

                    location = response.headers.get("location")
                    if location and response.status_code in {301, 302, 303, 307, 308} and redirects < 5:
                        next_url = urljoin(str(response.url), location)
                        next_parsed = urlparse(next_url)
                        if next_parsed.scheme not in {"http", "https"}:
                            break
                        if not _is_public_host(next_parsed.hostname):
                            return {
                                "status": "blocked",
                                "status_code": response.status_code,
                                "final_url": next_url,
                                "request_url": candidate,
                                "findings": [],
                                "security_headers": [],
                                "headers_checked": [],
                                "error": "Redirected to a private or non-public target. Scan stopped.",
                            }
                        current_url = next_url
                        redirects += 1
                        continue

                    headers = {key.lower(): value for key, value in response.headers.items()}
                    security_headers = _header_results(headers, response.url.scheme)

                    findings = []
                    for item in security_headers:
                        if item["status"] != "Missing":
                            continue
                        findings.append({
                            "title": f"Missing {item['header']}",
                            "severity": item["severity"],
                            "category": "Security Misconfiguration",
                            "description": item["description"],
                            "recommendation": item["recommendation"],
                            "evidence": f"{item['header']} header was not present in the final HTTP response.",
                        })

                    header_summary = {
                        "checked": len(security_headers),
                        "present": sum(1 for item in security_headers if item["status"] == "Present"),
                        "missing": sum(1 for item in security_headers if item["status"] == "Missing"),
                        "not_assessed": sum(1 for item in security_headers if item["status"] == "Not assessed"),
                    }

                    return {
                        "status": "completed",
                        "status_code": response.status_code,
                        "request_url": candidate,
                        "final_url": str(response.url),
                        "findings": findings,
                        "security_headers": security_headers,
                        "headers_checked": [item["header"] for item in security_headers],
                        "header_summary": header_summary,
                        "server": headers.get("server"),
                        "content_type": headers.get("content-type"),
                        "content_length": headers.get("content-length"),
                    }

                # If HTTPS failed, the next candidate is HTTP.
                continue

    except httpx.TimeoutException:
        last_error = "Target request timed out."

    return {
        "status": "failed",
        "status_code": None,
        "request_url": target,
        "final_url": target,
        "findings": [],
        "security_headers": [],
        "headers_checked": [],
        "header_summary": {
            "checked": 0,
            "present": 0,
            "missing": 0,
            "not_assessed": 0,
        },
        "error": last_error or "Unable to connect to target.",
    }
