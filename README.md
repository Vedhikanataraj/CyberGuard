🛡️ CYBERGUARD

AI-ready Web & Network Security Assessment Platform

CyberGuard turns security reconnaissance into a structured, visual and report-ready workflow — from target validation → discovery → service identification → CPE mapping → CVE/CVSS analysis → risk assessment → professional reporting.

<p align="center">
  <strong>🔐 Secure by Design</strong> &nbsp;•&nbsp;
  <strong>🌐 Web Assessment</strong> &nbsp;•&nbsp;
  <strong>🛰️ Network Discovery</strong> &nbsp;•&nbsp;
  <strong>🧩 CPE/CVE Intelligence</strong> &nbsp;•&nbsp;
  <strong>📊 Risk Visualization</strong> &nbsp;•&nbsp;
  <strong>📄 PDF Reporting</strong>
</p>

🚨 Security Notice

CyberGuard is designed for authorized, non-destructive security assessment only.

Use it only against:

systems you own,

systems for which you have explicit permission,

local labs, staging environments, CTFs, or intentionally provided test targets.

Never scan third-party infrastructure without authorization.

⚡ What is CyberGuard?

CyberGuard is a full-stack cybersecurity assessment platform that brings multiple security-assessment tasks into one modern dashboard.

Instead of switching between separate tools, CyberGuard organizes the workflow in one place:

TARGET
  ↓
PUBLIC TARGET VALIDATION
  ↓
SCAN SELECTION
  ├── Full Security Scan
  ├── Web Security Scan
  └── Port Security Scan
  ↓
DISCOVERY
  ↓
SERVICE / VERSION IDENTIFICATION
  ↓
CPE RESOLUTION
  ↓
CVE + CVSS ANALYSIS
  ↓
SECURITY FINDINGS
  ↓
RISK ENGINE
  ↓
SCORE + GRADE + RISK LEVEL
  ↓
ASSET / VULNERABILITY STORAGE
  ↓
INTERACTIVE REPORT
  ↓
PROFESSIONAL PDF

🧠 Core Idea

CyberGuard combines:

Reconnaissance + Vulnerability Intelligence + Risk Assessment + Reporting

into a single user-centric application.

The platform is especially useful for:

cybersecurity learning,

authorized security assessments,

project demonstrations,

vulnerability-management workflows,

structured security reporting.

🚀 Key Features

🔎 1. Full Security Scan

Provides a broader assessment by combining network-oriented and web/security information.

Includes

Target validation

Network/service analysis

Web/security assessment

Open-port discovery

Service and product detection

OS information where supported

CPE resolution

CVE lookup

CVSS scoring

Severity classification

Risk calculation

Security score

Security grade

Risk level

Detailed report generation

🌐 2. Web Security Scan

Evaluates an authorized website or web application.

Checks can include

HTTP response behaviour

Security headers

Server information

Content type

Content length

Web-security findings

Severity classification

Recommendations

Security score

Risk level

Explicit http:// and https:// targets are supported.

🛰️ 3. Port Security Scan

Designed for authorized network reconnaissance.

Capabilities

TCP port discovery

Service detection

Product identification

Version identification

OS detection where supported

Port range selection

CPE identification

Vulnerability lookup

Asset creation

Vulnerability storage

🧩 CPE → CVE Intelligence Pipeline

One of CyberGuard's core security-analysis workflows is:

Nmap Service Information
        ↓
Product + Version
        ↓
CPE Resolution
        ↓
NVD Vulnerability Lookup
        ↓
CVE ID
        ↓
Severity + CVSS
        ↓
Risk Assessment

Example:

Apache HTTP Server 2.4.7
        ↓
cpe:2.3:a:apache:http_server:2.4.7:...
        ↓
Related CVE records
        ↓
CVSS + Severity
        ↓
CyberGuard vulnerability report

Important: CPE-based CVE matches are vulnerability-intelligence results, not proof that every returned CVE is exploitable on the target. Applicability may depend on modules, configuration, platform, package state and other conditions.

🎯 Public Target Protection

CyberGuard validates targets before scanning.

Private and local destinations are rejected, including common ranges such as:

10.0.0.0/8
172.16.0.0/12
192.168.0.0/16
127.0.0.0/8
169.254.0.0/16
localhost
*.localhost
*.local

The backend independently validates resolved hostnames/IP addresses before scanner execution.

This provides a second validation layer rather than relying only on frontend checks.

🔐 Authentication & User Isolation

CyberGuard uses session-based authentication with:

Argon2id password hashing

HTTP-only session cookies

Random session tokens

Hashed session-token storage

Session expiration

Login rate limiting

Protected API endpoints

User-specific scan ownership

User-specific assets and vulnerabilities

Logout and session invalidation

Production session model

For the deployed cross-origin frontend/backend architecture, the production session cookie uses:

HttpOnly
Secure
SameSite=None

Local development can use a local cookie configuration separately.

📊 Risk Assessment

CyberGuard transforms findings into a user-friendly security posture.

Findings
   ↓
Severity / CVSS
   ↓
Risk Engine
   ↓
Security Score
   ↓
Grade
   ↓
Risk Level

The platform can present:

Security score

Grade

Risk level

Critical findings

High findings

Medium findings

Low findings

Informational findings

Score explanation

The result is designed to make raw scanner information easier to understand and review.

📄 Professional Security Reports

CyberGuard provides both interactive reports and downloadable PDF reports.

A detailed report can contain:

Executive Summary
        ↓
Security Rating
        ↓
Target Information
        ↓
Assessment Scope
        ↓
Web Findings
        ↓
Network Assessment
        ↓
Open Ports
        ↓
Services / Products / Versions
        ↓
Operating System Information
        ↓
CPE Information
        ↓
CVE / Vulnerability Details
        ↓
CVSS / Severity
        ↓
Risk Summary
        ↓
Recommendations
        ↓
Conclusion

PDF reports are intended to make assessment results suitable for project demonstrations, documentation and authorized review.

🖥️ CyberGuard Dashboard

The application is organized as a security-focused dashboard with pages for:

🏠 Dashboard
🔍 New Scan
🗂️ Scan History
📋 Scan Reports
🛡️ Vulnerabilities
🖥️ Assets
⚙️ Settings

The interface follows a modern SOC-inspired visual style with:

dark cybersecurity theme,

emerald/cyan accents,

animated particles,

cards and severity badges,

scan progress states,

responsive layouts,

modal vulnerability details,

interactive reports.

🏗️ System Architecture

                     ┌─────────────────────────┐
                     │       CYBERGUARD        │
                     └────────────┬────────────┘
                                  │
                           React + Vite
                                  │
                           REST API Calls
                                  │
                                  ▼
                     ┌─────────────────────────┐
                     │      FastAPI Backend    │
                     ├─────────────────────────┤
                     │ Authentication          │
                     │ Scan Orchestration      │
                     │ Target Validation       │
                     │ Risk Engine             │
                     │ Reporting               │
                     └──────┬─────────┬────────┘
                            │         │
                  ┌─────────┘         └─────────┐
                  ▼                             ▼
          ┌───────────────┐             ┌───────────────┐
          │ Nmap / Scanner│             │ Web Scanner   │
          └──────┬────────┘             └──────┬────────┘
                 │                             │
                 ▼                             ▼
          Service / OS / CPE              HTTP / Headers /
          information                     Web findings
                 │                             │
                 └──────────────┬──────────────┘
                                ▼
                       CPE / CVE / CVSS
                                │
                                ▼
                         Risk Engine
                                │
                                ▼
                  ┌──────────────────────────┐
                  │ Database / Persistence   │
                  │ Users / Sessions         │
                  │ Targets / Scans          │
                  │ Assets / Findings        │
                  │ Vulnerabilities          │
                  └────────────┬─────────────┘
                               │
                               ▼
                     Reports + PDF Output

🧰 Technology Stack

Layer

Technology

Purpose

Frontend

React.js

Interactive UI

Frontend Build

Vite

Development and production bundling

Routing

React Router

Page navigation

Styling

Tailwind CSS / CSS

Cybersecurity-themed interface

Icons

Lucide React

UI icons

Backend

Python + FastAPI

REST API and orchestration

Validation

Pydantic

Request validation

ORM

SQLAlchemy

Database access

Database

SQLite

Local development

Production DB

PostgreSQL / Neon

Hosted persistence

Network Scanner

Nmap

Port, service and OS discovery

Web Scanner

Python web scanning layer

HTTP/security assessment

Vulnerability Intelligence

NVD / CPE / CVE

Vulnerability correlation

Authentication

Argon2id + session cookies

Account security

Reporting

ReportLab

PDF generation

Frontend Hosting

Vercel

Web deployment

Backend Hosting

Vercel

API deployment

📁 Project Structure

CyberGuard/
│
├── Backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── database.py
│   │   ├── models.py
│   │   │
│   │   ├── routes/
│   │   │   ├── auth.py
│   │   │   └── scans.py
│   │   │
│   │   ├── scanners/
│   │   │   ├── web_scanner.py
│   │   │   ├── port_scanner.py
│   │   │   └── cve_scanner.py
│   │   │
│   │   ├── services/
│   │   │   └── risk_engine.py
│   │   │
│   │   └── security/
│   │       ├── password.py
│   │       └── session.py
│   │
│   └── requirements.txt
│
└── Frontend/
    ├── src/
    │   ├── App.jsx
    │   ├── context/
    │   │   └── AuthContext.jsx
    │   │
    │   ├── pages/
    │   │   ├── Dashboard.jsx
    │   │   ├── NewScan.jsx
    │   │   ├── ScanHistory.jsx
    │   │   ├── ScanReport.jsx
    │   │   ├── Vulnerabilities.jsx
    │   │   ├── Assets.jsx
    │   │   └── Reports.jsx
    │   │
    │   └── ...
    │
    ├── package.json
    └── vite.config.js

🔌 Important API Endpoints

Authentication

POST /api/auth/register
POST /api/auth/login
GET  /api/auth/me
POST /api/auth/logout

Scanning

POST /api/scan
POST /api/web-scan
POST /api/scan/ports

Scan / Reporting

GET /api/scans
GET /api/scans/{scan_id}

The exact route set may evolve as the project grows.

💻 Local Development

Backend

cd Backend

python -m venv venv

Windows

venv\Scripts\activate

Install dependencies:

pip install -r requirements.txt

Run FastAPI:

uvicorn app.main:app --reload

Backend:

http://127.0.0.1:8000

Swagger:

http://127.0.0.1:8000/docs

Frontend

cd Frontend
npm install
npm run dev

Vite normally starts on a localhost development port such as:

http://localhost:5173

☁️ Deployment

CyberGuard can be deployed as separate frontend and backend services.

Frontend

React + Vite
        ↓
Vercel

Backend

FastAPI
        ↓
Vercel

Production database

FastAPI
   ↓
PostgreSQL
   ↓
Neon

For production, configure environment variables for secrets, database URLs, API credentials and deployment-specific settings.

🧪 Authorized Test Target

For Nmap learning and validation, Nmap provides a dedicated public test target:

scanme.nmap.org

Example:

nmap -p 80,443 -sT -sV scanme.nmap.org

Use only targets that are explicitly authorized for scanning.

🛡️ Security Design Principles

CyberGuard follows these principles:

Validate early
      ↓
Authenticate users
      ↓
Authorize resources
      ↓
Protect sessions
      ↓
Limit scan scope
      ↓
Store ownership information
      ↓
Separate user data
      ↓
Generate traceable reports

Security controls implemented

Target validation

Public-target restrictions

Password hashing

Secure session handling

Login rate limiting

Protected API routes

User-level data isolation

User-owned scan retrieval

User-owned asset/vulnerability access

Authorized/non-destructive scanning model

📈 Current Project Status

Area

Status

React frontend

✅

FastAPI backend

✅

Authentication

✅

Session management

✅

User isolation

✅

Full scan

✅

Web scan

✅

Port scan

✅

Nmap integration

✅

Service detection

✅

OS detection

✅ where supported

CPE resolution

✅

CVE lookup

✅

CVSS information

✅

Risk engine

✅

Asset management

✅

Vulnerability management

✅

Scan history

✅

Interactive reports

✅

PDF reports

✅

Vercel deployment

✅

Production PostgreSQL

✅

🧭 Roadmap

CyberGuard can be expanded with:

[ ] Background scan workers
[ ] Scan scheduling
[ ] Scan comparison / diffing
[ ] Remediation tracking
[ ] Compliance reporting
[ ] Email notifications
[ ] Advanced role-based access control
[ ] Docker deployment
[ ] SIEM integrations
[ ] Continuous authorized asset monitoring
[ ] Enhanced vulnerability applicability analysis

💡 Why CyberGuard?

CyberGuard is designed around a simple idea:

Security tools should not only discover technical data — they should help users understand, organize and act on that data.

The platform combines:

DISCOVER
   +
UNDERSTAND
   +
CORRELATE
   +
ASSESS
   +
REPORT

into one workflow.

👩‍💻 Project

CyberGuard — Web-Based Cybersecurity Vulnerability Assessment & Reporting Platform

Built using:

React • Vite • FastAPI • Python • SQLAlchemy
Nmap • CPE • CVE • CVSS • PostgreSQL • Neon • Vercel

⚠️ Responsible Use

CyberGuard is a security assessment project.

Use it responsibly and only on systems for which you have authorization.

Never use the platform to scan systems without permission.

<p align="center">
  <strong>🛡️ CYBERGUARD</strong><br>
  <sub>Discover • Analyze • Assess • Report</sub>
</p>