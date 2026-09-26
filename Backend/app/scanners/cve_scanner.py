import os
import re
from functools import lru_cache

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

    api_key = os.getenv("NVD_API_KEY")

    if api_key:
        headers["apiKey"] = api_key

    return headers


# ============================================================
# TOKEN HELPERS
# ============================================================

def _tokens(value):
    return [
        token
        for token in re.split(
            r"[^a-z0-9]+",
            str(value or "").lower()
        )
        if token
    ]


# ============================================================
# CPE PARSER
# ============================================================

def _cpe_parts(cpe_name):
    """
    Extract important fields from a CPE 2.3 name.

    Example:
        cpe:2.3:a:apache:http_server:2.4.7:*:*:*:*:*:*:*

    Returns:
        {
            "part": "a",
            "vendor": "apache",
            "product": "http_server",
            "version": "2.4.7"
        }
    """

    if (
        not isinstance(cpe_name, str)
        or not cpe_name.startswith("cpe:2.3:")
    ):
        return None

    parts = cpe_name.split(":", 12)

    if len(parts) != 13:
        return None

    return {
        "part": parts[2],
        "vendor": parts[3],
        "product": parts[4],
        "version": parts[5],
    }


# ============================================================
# NORMALIZE CPE
# ============================================================

def normalize_cpe(cpe_name):
    """
    Normalize an Nmap/NVD CPE into CPE 2.3 format.

    Supported examples:

        cpe:2.3:a:apache:http_server:2.4.7:*:*:*:*:*:*:*

    and:

        cpe:/a:apache:http_server:2.4.7

    The second form is the legacy CPE URI format
    commonly returned by Nmap.
    """

    if not isinstance(cpe_name, str):
        return None

    cpe_name = cpe_name.strip()

    if not cpe_name:
        return None

    # --------------------------------------------------------
    # Already CPE 2.3
    # --------------------------------------------------------

    if cpe_name.startswith("cpe:2.3:"):
        return cpe_name

    # --------------------------------------------------------
    # Nmap legacy CPE URI format
    #
    # Example:
    # cpe:/a:apache:http_server:2.4.7
    # --------------------------------------------------------

    if cpe_name.startswith("cpe:/"):

        value = cpe_name[5:]

        parts = value.split(":")

        if not parts:
            return None

        # CPE 2.3 has:
        #
        # part
        # vendor
        # product
        # version
        # update
        # edition
        # language
        # sw_edition
        # target_sw
        # target_hw
        # other
        #
        # Fill unspecified fields with "*".

        while len(parts) < 11:
            parts.append("*")

        return (
            "cpe:2.3:"
            + ":".join(parts[:11])
        )

    return None


# ============================================================
# SEARCH NVD CPE DICTIONARY
# ============================================================

@lru_cache(maxsize=128)
def _search_cpe_dictionary(
    keyword,
    part=None
):
    params = {
        "keywordSearch": keyword,
        "resultsPerPage": 50,
    }

    if part:

        params["cpeMatchString"] = (
            f"cpe:2.3:{part}:*:*"
        )

    try:

        with httpx.Client(
            timeout=30.0,
            headers=get_nvd_headers()
        ) as client:

            response = client.get(
                NVD_CPE_API,
                params=params
            )

        response.raise_for_status()

        data = response.json()

    except httpx.TimeoutException as error:

        raise RuntimeError(
            "NVD CPE request timed out."
        ) from error

    except httpx.HTTPStatusError as error:

        raise RuntimeError(
            "NVD CPE API returned HTTP "
            f"{error.response.status_code}."
        ) from error

    except httpx.RequestError as error:

        raise RuntimeError(
            f"Unable to connect to NVD CPE API: {error}"
        ) from error

    names = []

    for item in data.get(
        "products",
        []
    ):

        cpe_data = (
            item.get("cpe", {})
            if isinstance(item, dict)
            else {}
        )

        if not isinstance(
            cpe_data,
            dict
        ):
            continue

        if cpe_data.get(
            "deprecated",
            False
        ):
            continue

        entries = cpe_data.get(
            "cpeName",
            []
        )

        if isinstance(
            entries,
            dict
        ):
            entries = [entries]

        for entry in entries:

            name = (
                entry
                if isinstance(entry, str)
                else entry.get("cpeName")
            )

            if (
                isinstance(name, str)
                and name.startswith("cpe:2.3:")
            ):
                names.append(name)

    return list(
        dict.fromkeys(names)
    )


# ============================================================
# CHOOSE BEST CPE
# ============================================================

def _choose_cpe(
    candidates,
    product=None,
    version=None,
    part=None
):
    query_product = _tokens(
        product
    )

    query_version = _tokens(
        version
    )

    best_name = None
    best_score = -1

    for candidate in candidates:

        parts = _cpe_parts(
            candidate
        )

        if not parts:
            continue

        if (
            part
            and parts["part"] != part
        ):
            continue

        score = 0

        candidate_product = _tokens(
            parts["product"]
        )

        candidate_text = " ".join(
            [
                parts["vendor"],
                parts["product"],
                parts["version"],
            ]
        )

        # ----------------------------------------------------
        # Product matching
        # ----------------------------------------------------

        for token in query_product:

            if token in candidate_product:
                score += 4

            elif token in candidate_text:
                score += 2

        # ----------------------------------------------------
        # Version matching
        # ----------------------------------------------------

        for token in query_version:

            if (
                token
                and token
                == parts["version"].lower()
            ):
                score += 8

            elif (
                token
                and token
                in parts["version"].lower()
            ):
                score += 3

        # ----------------------------------------------------
        # Keep best candidate
        # ----------------------------------------------------

        if score > best_score:

            best_score = score
            best_name = candidate

    return (
        best_name
        if best_score > 0
        else (
            candidates[0]
            if candidates
            else None
        )
    )


# ============================================================
# RESOLVE PRODUCT TO CPE
# ============================================================

def resolve_product_to_cpe(
    product: str,
    version: str = None,
    service: str = None,
    raw_cpe: str = None
):
    """
    Resolve detected service/product evidence
    to an official NVD CPE 2.3 name.
    """

    # ========================================================
    # 1. Use raw Nmap CPE when available
    # ========================================================

    if isinstance(
        raw_cpe,
        str
    ):

        normalized_raw_cpe = normalize_cpe(
            raw_cpe
        )

        if normalized_raw_cpe:

            return normalized_raw_cpe

    # ========================================================
    # 2. Build search terms
    # ========================================================

    search_terms = []

    if product:
        search_terms.append(
            product
        )

    if version:
        search_terms.append(
            version
        )

    if (
        not search_terms
        and service
    ):
        search_terms.append(
            service
        )

    keyword = " ".join(
        search_terms
    ).strip()

    if not keyword:
        return None

    # ========================================================
    # 3. Search NVD CPE dictionary
    # ========================================================

    candidates = _search_cpe_dictionary(
        keyword,
        part="a"
    )

    # ========================================================
    # 4. Select best CPE
    # ========================================================

    return _choose_cpe(
        candidates,
        product=product,
        version=version,
        part="a"
    )


# ============================================================
# RESOLVE OS TO CPE
# ============================================================

def resolve_os_to_cpe(
    os_name: str
):
    """
    Resolve an operating-system description
    to an official NVD CPE 2.3 name.
    """

    if (
        not os_name
        or str(os_name)
        .strip()
        .lower()
        == "unknown"
    ):
        return None

    candidates = _search_cpe_dictionary(
        str(os_name),
        part="o"
    )

    return _choose_cpe(
        candidates,
        product=os_name,
        part="o"
    )


# ============================================================
# CVE FIELD HELPERS
# ============================================================

def _get_cve_description(cve):
    descriptions = cve.get(
        "descriptions",
        []
    )

    for entry in descriptions:
        if not isinstance(entry, dict):
            continue

        if entry.get("lang") == "en":
            return entry.get(
                "value",
                ""
            )

    return ""


def _get_cvss_information(cve):
    metrics = (
        cve.get(
            "metrics",
            {}
        )
        or {}
    )

    # --------------------------------------------------------
    # Prefer CVSS 4.0, then 3.1, then 3.0
    # --------------------------------------------------------

    for metric_key in (
        "cvssMetricV40",
        "cvssMetricV31",
        "cvssMetricV30",
    ):

        metric_list = (
            metrics.get(
                metric_key,
                []
            )
            or []
        )

        if not metric_list:
            continue

        metric = (
            metric_list[0]
            if isinstance(
                metric_list[0],
                dict
            )
            else {}
        )

        cvss_data = (
            metric.get(
                "cvssData",
                {}
            )
            or {}
        )

        score = cvss_data.get(
            "baseScore"
        )

        if score is not None:
            return {
                "version": metric_key.replace(
                    "cvssMetricV",
                    ""
                ).replace(
                    "40",
                    "4.0"
                ).replace(
                    "31",
                    "3.1"
                ).replace(
                    "30",
                    "3.0"
                ),
                "score": score,
                "severity": cvss_data.get(
                    "baseSeverity"
                ),
                "vector": cvss_data.get(
                    "vectorString"
                )
            }

    # --------------------------------------------------------
    # CVSS 2.0 fallback
    # --------------------------------------------------------

    metric_list = (
        metrics.get(
            "cvssMetricV2",
            []
        )
        or []
    )

    if metric_list:

        metric = (
            metric_list[0]
            if isinstance(
                metric_list[0],
                dict
            )
            else {}
        )

        cvss_data = (
            metric.get(
                "cvssData",
                {}
            )
            or {}
        )

        score = cvss_data.get(
            "baseScore"
        )

        if score is not None:

            return {
                "version": "2.0",
                "score": score,
                "severity": metric.get(
                    "baseSeverity"
                ),
                "vector": cvss_data.get(
                    "vectorString"
                )
            }

    return {
        "version": None,
        "score": None,
        "severity": None,
        "vector": None
    }


def _get_cwe_ids(cve):
    cwe_ids = []

    for weakness in cve.get(
        "weaknesses",
        []
    ):

        if not isinstance(
            weakness,
            dict
        ):
            continue

        for entry in weakness.get(
            "description",
            []
        ):

            if not isinstance(
                entry,
                dict
            ):
                continue

            value = entry.get(
                "value"
            )

            if (
                value
                and value not in cwe_ids
            ):
                cwe_ids.append(
                    value
                )

    return cwe_ids


def _get_cve_references(cve):
    references = []

    for reference in cve.get(
        "references",
        []
    ):

        if not isinstance(
            reference,
            dict
        ):
            continue

        url = reference.get(
            "url"
        )

        if not url:
            continue

        references.append({
            "url": url,
            "source": reference.get(
                "source"
            ),
            "tags": reference.get(
                "tags",
                []
            )
        })

    return references


def _get_nvd_applicability(
    cve,
    requested_cpe
):
    """
    Extract version and applicability conditions published
    by NVD for the requested CPE.

    This only records NVD data. It does not invent
    additional applicability rules.
    """

    matches = []

    def walk_node(node):

        if not isinstance(
            node,
            dict
        ):
            return

        for cpe_match in node.get(
            "cpeMatch",
            []
        ):

            if not isinstance(
                cpe_match,
                dict
            ):
                continue

            criteria = cpe_match.get(
                "criteria"
            )

            if not criteria:
                continue

            # NVD configurations can represent a broader
            # CPE range. Record the match when the requested
            # CPE is exactly represented by the criteria.
            if criteria == requested_cpe:

                matches.append({

                    "criteria": criteria,

                    "vulnerable": cpe_match.get(
                        "vulnerable",
                        False
                    ),

                    "version_start_including":
                        cpe_match.get(
                            "versionStartIncluding"
                        ),

                    "version_start_excluding":
                        cpe_match.get(
                            "versionStartExcluding"
                        ),

                    "version_end_including":
                        cpe_match.get(
                            "versionEndIncluding"
                        ),

                    "version_end_excluding":
                        cpe_match.get(
                            "versionEndExcluding"
                        ),

                    "match_criteria_id":
                        cpe_match.get(
                            "matchCriteriaId"
                        )
                })

        for child in node.get(
            "children",
            []
        ):
            walk_node(child)

    for configuration in cve.get(
        "configurations",
        []
    ):

        if not isinstance(
            configuration,
            dict
        ):
            continue

        for node in configuration.get(
            "nodes",
            []
        ):
            walk_node(node)

    return matches


# ============================================================
# LOOKUP CVEs BY CPE
# ============================================================

def lookup_cves_by_cpe(
    cpe_name: str
):
    """
    Query NVD for vulnerabilities associated
    with a CPE.

    Accepts:

        CPE 2.3
        cpe:2.3:...

    and:

        Nmap legacy CPE
        cpe:/...

    Returns the same core fields used by the existing
    CyberGuard scan pipeline, plus additional CVE metadata.
    """

    if not cpe_name:
        return []

    # ========================================================
    # Normalize CPE
    # ========================================================

    normalized_cpe = normalize_cpe(
        cpe_name
    )

    if not normalized_cpe:

        raise RuntimeError(
            "Invalid CPE format."
        )

    cpe_name = normalized_cpe

    # ========================================================
    # NVD request
    #
    # Keep the same request structure as the supplied
    # reference file because this is the known working
    # CyberGuard CPE -> CVE pipeline.
    # ========================================================

    params = {
        "cpeName": cpe_name,
        "resultsPerPage": 50,
    }

    try:

        with httpx.Client(
            timeout=30.0,
            headers=get_nvd_headers()
        ) as client:

            response = client.get(
                NVD_CVE_API,
                params=params
            )

        response.raise_for_status()

        data = response.json()

    except httpx.TimeoutException as error:

        raise RuntimeError(
            "NVD CVE request timed out."
        ) from error

    except httpx.HTTPStatusError as error:

        raise RuntimeError(
            "NVD CVE API returned HTTP "
            f"{error.response.status_code}."
        ) from error

    except httpx.RequestError as error:

        raise RuntimeError(
            f"Unable to connect to NVD CVE API: {error}"
        ) from error

    # ========================================================
    # Parse CVEs
    # ========================================================

    vulnerabilities = []
    seen_cve_ids = set()

    for item in data.get(
        "vulnerabilities",
        []
    ):

        cve = (
            item.get("cve", {})
            if isinstance(item, dict)
            else {}
        )

        if not isinstance(
            cve,
            dict
        ):
            continue

        cve_id = cve.get(
            "id"
        )

        if not cve_id:
            continue

        # ----------------------------------------------------
        # Avoid duplicate CVE entries
        # ----------------------------------------------------

        if cve_id in seen_cve_ids:
            continue

        seen_cve_ids.add(
            cve_id
        )

        # ----------------------------------------------------
        # Description
        # ----------------------------------------------------

        description = _get_cve_description(
            cve
        )

        # ----------------------------------------------------
        # CVSS
        # ----------------------------------------------------

        cvss = _get_cvss_information(
            cve
        )

        # ----------------------------------------------------
        # CWE
        # ----------------------------------------------------

        cwe_ids = _get_cwe_ids(
            cve
        )

        # ----------------------------------------------------
        # References
        # ----------------------------------------------------

        references = _get_cve_references(
            cve
        )

        # ----------------------------------------------------
        # NVD applicability
        # ----------------------------------------------------

        applicability = _get_nvd_applicability(
            cve,
            cpe_name
        )

        # ----------------------------------------------------
        # Store vulnerability
        #
        # The original keys are preserved:
        # cve_id, description, severity,
        # cvss_score, cpe_name
        # ----------------------------------------------------

        vulnerabilities.append({

            "cve_id": cve_id,

            "description": description,

            "severity": cvss.get(
                "severity"
            ),

            "cvss_score": cvss.get(
                "score"
            ),

            "cpe_name": cpe_name,

            # ------------------------------------------------
            # Additional metadata
            # ------------------------------------------------

            "cvss_version": cvss.get(
                "version"
            ),

            "cvss_vector": cvss.get(
                "vector"
            ),

            "published_date": cve.get(
                "published"
            ),

            "last_modified_date": cve.get(
                "lastModified"
            ),

            "cwe_ids": cwe_ids,

            "references": references,

            "applicability": applicability,

            "nvd_vulnerable_match": any(
                match.get(
                    "vulnerable",
                    False
                )
                for match in applicability
            )
        })

    return vulnerabilities


# ============================================================
# OPTIONAL DIRECT TEST
# ============================================================

if __name__ == "__main__":

    import sys

    test_cpe = (
        sys.argv[1]
        if len(sys.argv) > 1
        else "cpe:2.3:a:openbsd:openssh:6.6.1p1:*:*:*:*:*:*:*"
    )

    print()
    print("=" * 80)
    print("CyberGuard CVE Scanner Test")
    print("=" * 80)
    print()
    print("CPE:")
    print(test_cpe)
    print()

    try:

        results = lookup_cves_by_cpe(
            test_cpe
        )

        print(
            f"CVEs returned: {len(results)}"
        )
        print()

        for index, vulnerability in enumerate(
            results,
            start=1
        ):

            print("-" * 80)
            print(
                f"[{index}] "
                f"{vulnerability.get('cve_id')}"
            )

            print(
                "Severity:",
                vulnerability.get(
                    "severity"
                )
            )

            print(
                "CVSS:",
                vulnerability.get(
                    "cvss_score"
                )
            )

            print(
                "Published:",
                vulnerability.get(
                    "published_date"
                )
            )

            print()
            print("Description:")
            print(
                vulnerability.get(
                    "description"
                ) or "No description returned."
            )

            print()

    except Exception as error:

        print()
        print("CVE SCANNER ERROR:")
        print(str(error))
        print()
