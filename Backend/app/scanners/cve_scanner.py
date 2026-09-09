import os
import httpx


# ============================================================
# NVD APIs
# ============================================================

NVD_CVE_API = (
    "https://services.nvd.nist.gov/rest/json/cves/2.0"
)

NVD_CPE_API = (
    "https://services.nvd.nist.gov/rest/json/cpes/2.0"
)


# ============================================================
# NVD HEADERS
# ============================================================

def get_nvd_headers():

    headers = {
        "User-Agent": "CyberGuard/1.0"
    }

    api_key = os.getenv(
        "NVD_API_KEY"
    )

    if api_key:
        headers["apiKey"] = api_key

    return headers


# ============================================================
# RESOLVE OS NAME USING NVD CPE API
# ============================================================

def resolve_os_to_cpe(os_name: str):
    """
    Resolve an OS name to an official NVD CPE name.

    Example:
        Microsoft Windows 11 24H2
        ->
        NVD CPE API
        ->
        official CPE name
    """

    if not os_name:
        return None

    os_name_lower = os_name.lower()

    # ========================================================
    # Determine CPE match string
    # ========================================================

    if "windows 11" in os_name_lower and "24h2" in os_name_lower:

        match_string = (
            "cpe:2.3:o:microsoft:windows_11_24h2"
        )

    elif (
        "windows 11" in os_name_lower
        and "25h2" in os_name_lower
    ):

        match_string = (
            "cpe:2.3:o:microsoft:windows_11_25h2"
        )

    elif "windows 11" in os_name_lower:

        match_string = (
            "cpe:2.3:o:microsoft:windows_11"
        )

    else:
        return None

    # ========================================================
    # Query NVD CPE API
    # ========================================================

    headers = get_nvd_headers()

    params = {
        "cpeMatchString": match_string,
        "resultsPerPage": 100
    }

    try:

        with httpx.Client(
            timeout=30.0,
            headers=headers
        ) as client:

            response = client.get(
                NVD_CPE_API,
                params=params
            )

        response.raise_for_status()

        data = response.json()

    except httpx.TimeoutException:

        raise RuntimeError(
            "NVD CPE request timed out."
        )

    except httpx.HTTPStatusError as error:

        raise RuntimeError(
            "NVD CPE API returned HTTP "
            f"{error.response.status_code}."
        )

    except httpx.RequestError as error:

        raise RuntimeError(
            f"Unable to connect to NVD CPE API: {error}"
        )

    # ========================================================
    # Extract products
    # ========================================================

    products = data.get("products", [])

    if not isinstance(products, list):
        return None

    # ========================================================
    # Extract CPE names safely
    # ========================================================

    cpe_names = []

    for product in products:

        # --------------------------------------------
        # Product must be a dictionary
        # --------------------------------------------

        if not isinstance(product, dict):
            continue

        cpe_data = product.get("cpe")

        if not isinstance(cpe_data, dict):
            continue

        cpe_entries = cpe_data.get("cpeName", [])

        # --------------------------------------------
        # cpeName may be a list
        # --------------------------------------------

        if isinstance(cpe_entries, list):

            for entry in cpe_entries:

                # NVD may return an object
                if isinstance(entry, dict):

                    name = entry.get("cpeName")

                    if isinstance(name, str):
                        cpe_names.append(name)

                # Or a direct string
                elif isinstance(entry, str):

                    cpe_names.append(entry)

        # --------------------------------------------
        # Or cpeName may directly be a string
        # --------------------------------------------

        elif isinstance(cpe_entries, str):

            cpe_names.append(cpe_entries)

        # --------------------------------------------
        # Or a single dictionary
        # --------------------------------------------

        elif isinstance(cpe_entries, dict):

            name = cpe_entries.get("cpeName")

            if isinstance(name, str):
                cpe_names.append(name)

    # ========================================================
    # Remove invalid / duplicate values
    # ========================================================

    valid_cpes = []

    for name in cpe_names:

        if not isinstance(name, str):
            continue

        if not name.startswith("cpe:2.3:"):
            continue

        if name not in valid_cpes:
            valid_cpes.append(name)

    # ========================================================
    # No CPE found
    # ========================================================

    if not valid_cpes:
        return None

    # ========================================================
    # Return first official CPE
    # ========================================================

    return valid_cpes[0]
    # --------------------------------------------------------
    # Query NVD CPE API
    # --------------------------------------------------------

    headers = get_nvd_headers()

    params = {
        "cpeMatchString": match_string,
        "resultsPerPage": 100
    }

    try:

        with httpx.Client(
            timeout=30.0,
            headers=headers
        ) as client:

            response = client.get(
                NVD_CPE_API,
                params=params
            )

        response.raise_for_status()

        data = response.json()

    except httpx.TimeoutException:

        raise RuntimeError(
            "NVD CPE request timed out."
        )

    except httpx.HTTPStatusError as error:

        raise RuntimeError(
            "NVD CPE API returned HTTP "
            f"{error.response.status_code}."
        )

    except httpx.RequestError as error:

        raise RuntimeError(
            f"Unable to connect to NVD CPE API: {error}"
        )

    # --------------------------------------------------------
    # Extract official CPE names
    # --------------------------------------------------------

    products = data.get(
        "products",
        []
    )

    if not products:
        return None

    cpe_names = []

    for product in products:

        cpe_data = product.get(
            "cpe",
            {}
        )

        cpe_entries = cpe_data.get(
            "cpeName",
            []
        )

        for cpe_entry in cpe_entries:

            # NVD may return the CPE entry as a string
            if isinstance(cpe_entry, str):

                cpe_name = cpe_entry

            # Some responses may return an object
            elif isinstance(cpe_entry, dict):

                cpe_name = cpe_entry.get(
                    "cpeName"
                )

            else:

                cpe_name = None

            if cpe_name:

                cpe_names.append(
                    cpe_name
                )

    if not cpe_names:
        return None

    # --------------------------------------------------------
    # Prefer the newest non-deprecated CPE
    # --------------------------------------------------------

    non_deprecated = []

    for product in products:

        cpe_data = product.get(
            "cpe",
            {}
        )

        if not cpe_data.get(
            "deprecated",
            False
        ):

            cpe_names_data = cpe_data.get(
                "cpeName",
                []
            )

            for cpe_entry in cpe_names_data:

                cpe_name = cpe_entry.get(
                    "cpeName"
                )

                if cpe_name:

                    non_deprecated.append(
                        cpe_name
                    )

    if non_deprecated:

        return non_deprecated[0]

    return cpe_names[0]


# ============================================================
# LOOKUP CVEs BY CPE
# ============================================================

def lookup_cves_by_cpe(cpe_name: str):

    """
    Query NVD for vulnerabilities associated with
    a specific CPE.

    The CPE must be a valid CPE 2.3 name.
    """

    if not cpe_name:

        return []

    # --------------------------------------------------------
    # Validate CPE format
    # --------------------------------------------------------

    if not cpe_name.startswith(
        "cpe:2.3:"
    ):

        raise RuntimeError(
            "Invalid CPE format. "
            "NVD CVE lookup requires a CPE 2.3 name."
        )

    headers = get_nvd_headers()

    params = {

        "cpeName": cpe_name,

        "isVulnerable": "",

        "noRejected": "",

        "resultsPerPage": 50
    }

    try:

        with httpx.Client(

            timeout=30.0,

            headers=headers

        ) as client:

            response = client.get(

                NVD_CVE_API,

                params=params

            )

        response.raise_for_status()

        data = response.json()

    except httpx.TimeoutException:

        raise RuntimeError(
            "NVD CVE request timed out."
        )

    except httpx.HTTPStatusError as error:

        raise RuntimeError(
            "NVD CVE API returned HTTP "
            f"{error.response.status_code}."
        )

    except httpx.RequestError as error:

        raise RuntimeError(
            f"Unable to connect to NVD CVE API: {error}"
        )

    # ========================================================
    # PARSE CVE RESULTS
    # ========================================================

    vulnerabilities = []

    for item in data.get(
        "vulnerabilities",
        []
    ):

        cve = item.get(
            "cve",
            {}
        )

        cve_id = cve.get(
            "id"
        )

        if not cve_id:
            continue

        # ----------------------------------------------------
        # Description
        # ----------------------------------------------------

        description = ""

        for entry in cve.get(
            "descriptions",
            []
        ):

            if entry.get(
                "lang"
            ) == "en":

                description = entry.get(
                    "value",
                    ""
                )

                break

        # ----------------------------------------------------
        # CVSS information
        # ----------------------------------------------------

        severity = None

        cvss_score = None

        metrics = cve.get(
            "metrics",
            {}
        )

        # ----------------------------------------------------
        # CVSS 4.0
        # ----------------------------------------------------

        cvss_v40 = metrics.get(
            "cvssMetricV40",
            []
        )

        if cvss_v40:

            metric = cvss_v40[0]

            cvss_data = metric.get(
                "cvssData",
                {}
            )

            severity = cvss_data.get(
                "baseSeverity"
            )

            cvss_score = cvss_data.get(
                "baseScore"
            )

        # ----------------------------------------------------
        # CVSS 3.1
        # ----------------------------------------------------

        if cvss_score is None:

            cvss_v31 = metrics.get(
                "cvssMetricV31",
                []
            )

            if cvss_v31:

                metric = cvss_v31[0]

                cvss_data = metric.get(
                    "cvssData",
                    {}
                )

                severity = cvss_data.get(
                    "baseSeverity"
                )

                cvss_score = cvss_data.get(
                    "baseScore"
                )

        # ----------------------------------------------------
        # CVSS 3.0
        # ----------------------------------------------------

        if cvss_score is None:

            cvss_v30 = metrics.get(
                "cvssMetricV30",
                []
            )

            if cvss_v30:

                metric = cvss_v30[0]

                cvss_data = metric.get(
                    "cvssData",
                    {}
                )

                severity = cvss_data.get(
                    "baseSeverity"
                )

                cvss_score = cvss_data.get(
                    "baseScore"
                )

        # ----------------------------------------------------
        # CVSS 2.0 fallback
        # ----------------------------------------------------

        if cvss_score is None:

            cvss_v2 = metrics.get(
                "cvssMetricV2",
                []
            )

            if cvss_v2:

                metric = cvss_v2[0]

                cvss_data = metric.get(
                    "cvssData",
                    {}
                )

                cvss_score = cvss_data.get(
                    "baseScore"
                )

                severity = metric.get(
                    "baseSeverity"
                )

        # ----------------------------------------------------
        # Store vulnerability
        # ----------------------------------------------------

        vulnerabilities.append({

            "cve_id": cve_id,

            "description": description,

            "severity": severity,

            "cvss_score": cvss_score,

            "cpe_name": cpe_name

        })

    return vulnerabilities