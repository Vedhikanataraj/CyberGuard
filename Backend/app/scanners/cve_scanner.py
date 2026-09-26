import os
import re
from functools import lru_cache

import httpx

NVD_CVE_API = "https://services.nvd.nist.gov/rest/json/cves/2.0"
NVD_CPE_API = "https://services.nvd.nist.gov/rest/json/cpes/2.0"


def get_nvd_headers():
    headers = {"User-Agent": "CyberGuard/1.0"}
    api_key = os.getenv("NVD_API_KEY")
    if api_key:
        headers["apiKey"] = api_key
    return headers


def _tokens(value):
    return [token for token in re.split(r"[^a-z0-9]+", str(value or "").lower()) if token]


def _cpe_parts(cpe_name):
    if not isinstance(cpe_name, str) or not cpe_name.startswith("cpe:2.3:"):
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


@lru_cache(maxsize=128)
def _search_cpe_dictionary(keyword, part=None):
    params = {
        "keywordSearch": keyword,
        "resultsPerPage": 50,
    }
    if part:
        params["cpeMatchString"] = f"cpe:2.3:{part}:*:*"

    try:
        with httpx.Client(timeout=30.0, headers=get_nvd_headers()) as client:
            response = client.get(NVD_CPE_API, params=params)
        response.raise_for_status()
        data = response.json()
    except httpx.TimeoutException as error:
        raise RuntimeError("NVD CPE request timed out.") from error
    except httpx.HTTPStatusError as error:
        raise RuntimeError(f"NVD CPE API returned HTTP {error.response.status_code}.") from error
    except httpx.RequestError as error:
        raise RuntimeError(f"Unable to connect to NVD CPE API: {error}") from error

    names = []
    for item in data.get("products", []):
        cpe_data = item.get("cpe", {}) if isinstance(item, dict) else {}
        if not isinstance(cpe_data, dict):
            continue
        if cpe_data.get("deprecated", False):
            continue
        entries = cpe_data.get("cpeName", [])
        if isinstance(entries, dict):
            entries = [entries]
        for entry in entries:
            name = entry if isinstance(entry, str) else entry.get("cpeName")
            if isinstance(name, str) and name.startswith("cpe:2.3:"):
                names.append(name)

    return list(dict.fromkeys(names))


def _choose_cpe(candidates, product=None, version=None, part=None):
    query_product = _tokens(product)
    query_version = _tokens(version)
    best_name = None
    best_score = -1

    for candidate in candidates:
        parts = _cpe_parts(candidate)
        if not parts:
            continue
        if part and parts["part"] != part:
            continue

        score = 0
        candidate_product = _tokens(parts["product"])
        candidate_text = " ".join([
            parts["vendor"],
            parts["product"],
            parts["version"],
        ])

        for token in query_product:
            if token in candidate_product:
                score += 4
            elif token in candidate_text:
                score += 2

        for token in query_version:
            if token and token == parts["version"].lower():
                score += 8
            elif token and token in parts["version"].lower():
                score += 3

        if score > best_score:
            best_score = score
            best_name = candidate

    return best_name if best_score > 0 else (candidates[0] if candidates else None)


def resolve_product_to_cpe(product: str, version: str = None, service: str = None, raw_cpe: str = None):
    """Resolve detected service/product evidence to an official NVD CPE 2.3 name."""
    if isinstance(raw_cpe, str) and raw_cpe.startswith("cpe:2.3:"):
        return raw_cpe

    search_terms = []
    if product:
        search_terms.append(product)
    if version:
        search_terms.append(version)
    if not search_terms and service:
        search_terms.append(service)
    keyword = " ".join(search_terms).strip()

    if not keyword:
        return None

    candidates = _search_cpe_dictionary(keyword, part="a")
    return _choose_cpe(candidates, product=product, version=version, part="a")


def resolve_os_to_cpe(os_name: str):
    if not os_name or str(os_name).strip().lower() == "unknown":
        return None

    candidates = _search_cpe_dictionary(str(os_name), part="o")
    return _choose_cpe(candidates, product=os_name, part="o")


def lookup_cves_by_cpe(cpe_name: str):
    if not cpe_name:
        return []
    if not cpe_name.startswith("cpe:2.3:"):
        raise RuntimeError("Invalid CPE format. NVD CVE lookup requires a CPE 2.3 name.")

    params = {
        "cpeName": cpe_name,
        "resultsPerPage": 50,
    }

    try:
        with httpx.Client(timeout=30.0, headers=get_nvd_headers()) as client:
            response = client.get(NVD_CVE_API, params=params)
        response.raise_for_status()
        data = response.json()
    except httpx.TimeoutException as error:
        raise RuntimeError("NVD CVE request timed out.") from error
    except httpx.HTTPStatusError as error:
        raise RuntimeError(f"NVD CVE API returned HTTP {error.response.status_code}.") from error
    except httpx.RequestError as error:
        raise RuntimeError(f"Unable to connect to NVD CVE API: {error}") from error

    vulnerabilities = []
    for item in data.get("vulnerabilities", []):
        cve = item.get("cve", {}) if isinstance(item, dict) else {}
        cve_id = cve.get("id")
        if not cve_id:
            continue

        description = ""
        for entry in cve.get("descriptions", []):
            if entry.get("lang") == "en":
                description = entry.get("value", "")
                break

        severity = None
        cvss_score = None
        metrics = cve.get("metrics", {}) or {}

        for metric_key in ("cvssMetricV40", "cvssMetricV31", "cvssMetricV30"):
            metrics_list = metrics.get(metric_key, []) or []
            if not metrics_list:
                continue
            cvss_data = metrics_list[0].get("cvssData", {}) or {}
            severity = cvss_data.get("baseSeverity")
            cvss_score = cvss_data.get("baseScore")
            if cvss_score is not None:
                break

        if cvss_score is None:
            metrics_v2 = metrics.get("cvssMetricV2", []) or []
            if metrics_v2:
                metric = metrics_v2[0]
                cvss_data = metric.get("cvssData", {}) or {}
                cvss_score = cvss_data.get("baseScore")
                severity = metric.get("baseSeverity")

        vulnerabilities.append({
            "cve_id": cve_id,
            "description": description,
            "severity": severity,
            "cvss_score": cvss_score,
            "cpe_name": cpe_name,
        })

    return vulnerabilities
