import httpx


SECURITY_HEADERS = {
    "content-security-policy": {
        "title": "Missing Content-Security-Policy",
        "severity": "Medium",
        "recommendation": (
            "Configure an appropriate "
            "Content-Security-Policy header."
        )
    },

    "strict-transport-security": {
        "title": "Missing Strict-Transport-Security",
        "severity": "Medium",
        "recommendation": (
            "Enable HSTS when the application "
            "is fully HTTPS."
        )
    },

    "x-content-type-options": {
        "title": "Missing X-Content-Type-Options",
        "severity": "Low",
        "recommendation": (
            "Set X-Content-Type-Options to nosniff."
        )
    },

    "x-frame-options": {
        "title": "Missing X-Frame-Options",
        "severity": "Low",
        "recommendation": (
            "Configure clickjacking protection."
        )
    },

    "referrer-policy": {
        "title": "Missing Referrer-Policy",
        "severity": "Low",
        "recommendation": (
            "Configure an appropriate Referrer-Policy."
        )
    }
}


async def scan_web(target: str):

    findings = []

    try:

        async with httpx.AsyncClient(
            timeout=15,
            follow_redirects=True
        ) as client:

            response = await client.get(target)

        headers = {
            key.lower(): value
            for key, value in response.headers.items()
        }

        for header, information in SECURITY_HEADERS.items():

            # HSTS is relevant to HTTPS targets
            if (
                header == "strict-transport-security"
                and response.url.scheme != "https"
            ):
                continue

            if header not in headers:

                findings.append({
                    "title": information["title"],

                    "severity": information["severity"],

                    "category": "Security Misconfiguration",

                    "description": (
                        f"The {header} response "
                        "header is missing."
                    ),

                    "recommendation": (
                        information["recommendation"]
                    )
                })

        return {
            "status": "completed",

            "status_code": response.status_code,

            "final_url": str(response.url),

            "findings": findings,

            "headers_checked": [
                "Content-Security-Policy",
                "Strict-Transport-Security",
                "X-Content-Type-Options",
                "X-Frame-Options",
                "Referrer-Policy"
            ]
        }

    except httpx.TimeoutException:

        return {
            "status": "timeout",
            "status_code": None,
            "final_url": target,
            "findings": [],
            "headers_checked": [],
            "error": "Target request timed out."
        }

    except httpx.RequestError as error:

        return {
            "status": "failed",
            "status_code": None,
            "final_url": target,
            "findings": [],
            "headers_checked": [],
            "error": str(error)
        }