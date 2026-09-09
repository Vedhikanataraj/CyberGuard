# 🛡️ CyberGuard - Phase 1

### Web & Network Security Assessment Platform

CyberGuard is a web-based cybersecurity assessment platform that integrates
web security scanning, network discovery, service detection, vulnerability
analysis, risk assessment, asset management, scan history, and security
reporting into a centralized interface.

The platform uses a React frontend and FastAPI backend to provide an
interactive security assessment workflow.

> ⚠️ **Security Notice**
>
> CyberGuard is intended only for authorized security testing.
> Do not scan websites, IP addresses, hosts, or networks without explicit
> permission from the owner.

---

## 📌 Overview

Cybersecurity assessment often requires multiple tools to identify:

- Open ports
- Running services
- Operating systems
- Software/platform information
- CPE identifiers
- CVEs
- CVSS scores
- Web security weaknesses
- Security risks

CyberGuard brings these capabilities together into one platform.

The user selects a scan type, provides an authorized target, and starts the
assessment from the frontend. The request is sent to the FastAPI backend,
where the appropriate scanner processes the target.

The results are then stored in the database and displayed through the
CyberGuard dashboard and reporting interface.

---

# 🎯 Objectives

The main objectives of CyberGuard are:

- Provide a centralized security assessment platform.
- Perform authorized web security assessments.
- Discover open TCP ports.
- Detect running services.
- Detect operating-system information where supported.
- Resolve platform information to CPE.
- Identify related CVEs.
- Display CVSS and vulnerability severity.
- Calculate security risk.
- Store scan results.
- Maintain scan history.
- Manage discovered assets.
- Display security reports.

---

# 🚀 Features

## 🔍 1. Full Security Scan

The Full Security Scan provides a broader security assessment.

### Includes

- Target validation
- Network/service analysis
- Web/security analysis
- Operating-system information
- CPE identification
- CVE analysis
- CVSS information
- Vulnerability severity
- Risk assessment
- Security score
- Security grade

---

## 🌐 2. Web Security Scan

The Web Security Scan evaluates an authorized website or web application.

### Example targets

```text
https://example.com/
http://127.0.0.1:8000/
https://authorized-domain.com/