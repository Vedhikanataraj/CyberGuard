import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  Globe,
  Server,
  FileText,
  Download,
} from "lucide-react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// ============================================================
// EMERALD PARTICLE BACKGROUND — UI ONLY
// ============================================================
function ParticleField() {
  const canvasRef = React.useRef(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrame;
    let width = 0;
    let height = 0;
    let particles = [];

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = Math.min(
        150,
        Math.max(70, Math.floor((width * height) / 12000))
      );

      particles = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        r: Math.random() * 1.35 + 0.4,
        alpha: Math.random() * 0.35 + 0.18,
        vx: (Math.random() - 0.5) * 0.24,
        vy: (Math.random() - 0.5) * 0.18,
        phase: Math.random() * Math.PI * 2,
        pulse: Math.random() * 0.012 + 0.004,
      }));
    };

    const animate = () => {
      ctx.clearRect(0, 0, width, height);

      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.phase += p.pulse;

        if (p.x < -8) p.x = width + 8;
        if (p.x > width + 8) p.x = -8;
        if (p.y < -8) p.y = height + 8;
        if (p.y > height + 8) p.y = -8;

        const alpha = Math.max(
          0.08,
          Math.min(0.55, p.alpha + Math.sin(p.phase) * 0.10)
        );

        if (p.r > 1.05) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r * 3.1, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(52, 211, 153, ${alpha * 0.055})`;
          ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(52, 211, 153, ${alpha})`;
        ctx.fill();
      });

      animationFrame = requestAnimationFrame(animate);
    };

    resize();
    animate();
    window.addEventListener("resize", resize);

    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 h-full w-full"
    />
  );
}

export default function ScanReport() {
  const { scanId } = useParams();
  const navigate = useNavigate();

  const [scan, setScan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    loadScanReport();
  }, [scanId]);

  async function loadScanReport() {
    try {
      setLoading(true);
      setError("");

      console.log("=================================");
      console.log("CYBERGUARD SCAN REPORT");
      console.log("=================================");
      console.log("Scan ID:", scanId);

     const response = await fetch(
  `${API_BASE_URL}/api/scans/${encodeURIComponent(scanId)}`,
  {
    method: "GET",
    credentials: "include",
    headers: {
      Accept: "application/json",
    },
  }
);

      console.log("Report HTTP status:", response.status);

      const contentType =
        response.headers.get("content-type") || "";

      let data;

      if (contentType.includes("application/json")) {
        data = await response.json();
      } else {
        const text = await response.text();

        data = {
          detail: text,
        };
      }

      console.log("Report response:", data);

      if (!response.ok) {
        throw new Error(
          data?.detail ||
            `Backend returned HTTP ${response.status}`
        );
      }

      setScan(data);
    } catch (err) {
      console.error("Report loading error:", err);

      setError(
        err?.message ||
          "Unable to load scan report."
      );
    } finally {
      setLoading(false);
    }
  }
  // ============================================================
// DOWNLOAD PDF REPORT
// ============================================================

async function downloadReportPdf() {
  try {
    setDownloading(true);

    console.log("Downloading PDF for:", scanId);

    const response = await fetch(
      `${API_BASE_URL}/api/scans/${encodeURIComponent(
        scanId
      )}/report/pdf`,
      {
        method: "GET",
        credentials: "include",
        headers: {
          Accept: "application/pdf",
        },
      }
    );
   

    if (!response.ok) {
      const text = await response.text();

      throw new Error(
        text ||
          `PDF download failed with HTTP ${response.status}`
      );
    }

    const blob = await response.blob();

    const url = window.URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = url;

    link.download =
      `${scanId}-security-report.pdf`;

    document.body.appendChild(link);

    link.click();

    document.body.removeChild(link);

    window.URL.revokeObjectURL(url);

    console.log("PDF downloaded successfully");
  } catch (err) {
    console.error(
      "PDF download error:",
      err
    );

    alert(
      err?.message ||
        "Unable to download PDF report."
    );
  } finally {
    setDownloading(false);
  }
}

  // ============================================================
  // LOADING
  // ============================================================

  if (loading) {
    return (
      <div className="flex min-h-[500px] items-center justify-center">
        <div className="text-center">

          <Loader2
            size={32}
            className="mx-auto animate-spin text-[#34D399]"
          />

          <p className="mt-4 text-sm text-[#718F84]">
            Loading scan report...
          </p>

        </div>
      </div>
    );
  }

  // ============================================================
  // ERROR
  // ============================================================

  if (error) {
    return (
      <div>

        <div className="mb-6">

          <p className="text-xs text-[#5B7D70]">
            Security Operations / Scan Report
          </p>

          <h1 className="mt-2 text-3xl font-bold text-white">
            Scan Report
          </h1>

        </div>

        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-5">

          <div className="flex items-start gap-3">

            <XCircle
              size={22}
              className="mt-0.5 text-red-400"
            />

            <div>

              <p className="font-semibold text-red-300">
                Unable to load report
              </p>

              <p className="mt-1 text-sm text-red-400">
                {error}
              </p>

            </div>

          </div>

        </div>

        <button
        
  onClick={downloadReportPdf}
  disabled={downloading}
  className="
    inline-flex
    items-center
    justify-center
    gap-2
    rounded-lg
    border
    border-[#059669]/40
    bg-[#059669]/10
    px-4
    py-2.5
    text-sm
    font-semibold
    text-[#34D399]
    transition
    hover:border-[#10B981]
    hover:bg-[#059669]/20
    disabled:cursor-not-allowed
    disabled:opacity-50
  "
>
  {downloading ? (
    <Loader2
      size={16}
      className="animate-spin"
    />
  ) : (
    <Download size={16} />
  )}

  {downloading
    ? "Generating PDF..."
    : "Download PDF"}
          onClick={() => navigate("/scans")}
          className="mt-5 inline-flex items-center gap-2 rounded-lg border border-[#173F4A] bg-[#071A14] px-4 py-2.5 text-sm font-medium text-[#8DB6C0] hover:border-[#059669] hover:text-[#10B981]"
        
          <ArrowLeft size={16} />
          Back to Scan History
        </button>

      </div>
    );
  }

  if (!scan) {
    return null;
  }

  // ============================================================
  // VALUES
  // ============================================================

  const scanType =
    String(scan.scan_type || "full").toLowerCase();

  const score =
    scan.security_score ?? 0;

  const grade =
    scan.grade || "—";

  const risk =
    scan.risk_level || "Unknown";

  const network =
    scan.network_scan &&
    typeof scan.network_scan === "object"
      ? scan.network_scan
      : {};

  const webScan =
    scan.web_scan &&
    typeof scan.web_scan === "object"
      ? scan.web_scan
      : {};

  const networkVulnerabilities =
    Array.isArray(scan.vulnerabilities)
      ? scan.vulnerabilities
      : Array.isArray(network.vulnerabilities)
      ? network.vulnerabilities
      : [];

  const storedFindings =
    Array.isArray(scan.findings)
      ? scan.findings
      : [];

  const webFindings =
    Array.isArray(scan.web_findings)
      ? scan.web_findings
      : Array.isArray(webScan.findings)
      ? webScan.findings
      : [];

  const findings = [
    ...storedFindings,
    ...webFindings,
  ].filter((finding, index, array) => {
    const signature = [
      finding?.title || "",
      finding?.severity || "",
      finding?.category || "",
      finding?.description || "",
    ].join("|");

    return (
      index ===
      array.findIndex((item) => {
        const itemSignature = [
          item?.title || "",
          item?.severity || "",
          item?.category || "",
          item?.description || "",
        ].join("|");

        return itemSignature === signature;
      })
    );
  });

  const openPorts =
    Array.isArray(scan.open_ports)
      ? scan.open_ports
      : Array.isArray(network.open_ports)
      ? network.open_ports
      : [];

  const osDetection =
    scan.os_detection || network.os_detection || {};

  const cpeRecords =
    Array.isArray(scan.cpe_records)
      ? scan.cpe_records
      : Array.isArray(network.cpe_records)
      ? network.cpe_records
      : [];

  const addresses =
    Array.isArray(scan.addresses)
      ? scan.addresses
      : Array.isArray(scan.target_info?.addresses)
      ? scan.target_info.addresses
      : Array.isArray(network.addresses)
      ? network.addresses
      : [];

  const securityHeaders =
    Array.isArray(scan.security_headers)
      ? scan.security_headers
      : Array.isArray(webScan.security_headers)
      ? webScan.security_headers
      : Array.isArray(webScan.headers_checked)
      ? webScan.headers_checked
      : [];

  const headersChecked =
    Array.isArray(scan.headers_checked)
      ? scan.headers_checked
      : Array.isArray(webScan.headers_checked)
      ? webScan.headers_checked
      : securityHeaders;

  const headerFindings = webFindings.filter((finding) => {
    const category =
      String(finding?.category || "").toLowerCase();

    const title =
      String(finding?.title || "").toLowerCase();

    return (
      category.includes("security misconfiguration") ||
      title.includes("missing") &&
        (
          title.includes("header") ||
          title.includes("content-security") ||
          title.includes("strict-transport") ||
          title.includes("x-content") ||
          title.includes("x-frame") ||
          title.includes("referrer")
        )
    );
  });

  const missingHeaderFindings =
    headerFindings.filter((finding) =>
      String(finding?.title || "")
        .toLowerCase()
        .includes("missing")
    );

  const cveSummary = {
    critical: networkVulnerabilities.filter(
      (item) =>
        String(item?.severity || "").toUpperCase() ===
        "CRITICAL"
    ).length,
    high: networkVulnerabilities.filter(
      (item) =>
        String(item?.severity || "").toUpperCase() ===
        "HIGH"
    ).length,
    medium: networkVulnerabilities.filter(
      (item) =>
        String(item?.severity || "").toUpperCase() ===
        "MEDIUM"
    ).length,
    low: networkVulnerabilities.filter(
      (item) =>
        String(item?.severity || "").toUpperCase() ===
        "LOW"
    ).length,
    informational: networkVulnerabilities.filter(
      (item) =>
        String(item?.severity || "").toUpperCase() ===
        "INFORMATIONAL"
    ).length,
  };

  const webSummary = {
    critical: webFindings.filter(
      (item) =>
        String(item?.severity || "").toUpperCase() ===
        "CRITICAL"
    ).length,
    high: webFindings.filter(
      (item) =>
        String(item?.severity || "").toUpperCase() ===
        "HIGH"
    ).length,
    medium: webFindings.filter(
      (item) =>
        String(item?.severity || "").toUpperCase() ===
        "MEDIUM"
    ).length,
    low: webFindings.filter(
      (item) =>
        String(item?.severity || "").toUpperCase() ===
        "LOW"
    ).length,
    informational: webFindings.filter(
      (item) =>
        String(item?.severity || "").toUpperCase() ===
        "INFORMATIONAL"
    ).length,
  };

  const combinedSummary = {
    critical: cveSummary.critical + webSummary.critical,
    high: cveSummary.high + webSummary.high,
    medium: cveSummary.medium + webSummary.medium,
    low: cveSummary.low + webSummary.low,
    informational:
      cveSummary.informational +
      webSummary.informational,
  };

  const totalCves = networkVulnerabilities.length;

  const totalFindings =
    totalCves +
    findings.length;

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#020907] pb-10">
      <ParticleField />
      <div className="relative z-10">

      {/* ======================================================
          HEADER
      ======================================================= */}

      <div className="mb-7">

        <p className="text-xs text-[#5B7D70]">
          Security Operations /{" "}
          <span className="text-[#A6C4B8]">
            Scan Report
          </span>
        </p>

        <div className="mt-2 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">

          <div>

            <h1 className="text-3xl font-bold tracking-tight text-white">
              Scan Report
            </h1>

            <p className="mt-1 text-sm text-[#718F84]">
              Detailed results of the security assessment.
            </p>

          </div>

          <button
            onClick={() => navigate("/scans")}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#173F4A] bg-[#071A14] px-4 py-2.5 text-sm font-medium text-[#8DB6C0] hover:border-[#059669] hover:text-[#10B981]"
          >
            <ArrowLeft size={16} />
            Scan History
          </button>
          <button
  type="button"
  onClick={downloadReportPdf}
  disabled={downloading}
  className="
    inline-flex
    items-center
    justify-center
    gap-2
    rounded-xl
    border
    border-[#059669]
    bg-[#059669]/10
    px-5
    py-3
    text-sm
    font-semibold
    text-[#34D399]
    transition
    hover:bg-[#059669]/20
    hover:border-[#10B981]
    disabled:cursor-not-allowed
    disabled:opacity-50
  "
>
  {downloading ? (
    <Loader2 size={17} className="animate-spin" />
  ) : (
    <Download size={17} />
  )}

  {downloading
    ? "Generating PDF..."
    : "Download PDF"}
</button>

        </div>

      </div>


      {/* ======================================================
          STATUS
      ======================================================= */}

      <div className="rounded-xl border border-[#12382D] bg-[#071A14]">

        <div className="border-b border-[#12382D] px-6 py-5">

          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">

            <div className="flex items-center gap-3">

              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-green-500/10">
                <CheckCircle2
                  size={22}
                  className="text-green-400"
                />
              </div>

              <div>

                <h2 className="font-semibold text-white">
                  Scan Completed
                </h2>

                <p className="mt-1 text-xs text-[#557A6D]">
                  {scan.scan_id}
                </p>

              </div>

            </div>

            <span className="rounded-full border border-green-500/20 bg-green-500/10 px-3 py-1 text-xs font-medium text-green-400">
              {scan.status || "completed"}
            </span>

          </div>

        </div>


        {/* ====================================================
            BASIC INFORMATION
        ===================================================== */}

        <div className="grid gap-5 border-b border-[#12382D] p-6 sm:grid-cols-2 lg:grid-cols-4">

          <InfoItem
            label="Target"
            value={scan.target || "Unknown"}
          />

          <InfoItem
            label="Scan Type"
            value={formatScanType(scanType)}
          />

          <InfoItem
            label="Started At"
            value={formatDate(scan.started_at)}
          />

          <InfoItem
            label="Completed At"
            value={formatDate(scan.completed_at)}
          />

        </div>


        {/* ====================================================
            SCORE
        ===================================================== */}

        <div className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-4">

          <ReportCard
            icon={ShieldCheck}
            label="Security Score"
            value={`${score}/100`}
          />

          <ReportCard
            icon={FileText}
            label="Grade"
            value={grade}
          />

          <ReportCard
            icon={AlertTriangle}
            label="Risk Level"
            value={risk}
          />

          <ReportCard
            icon={AlertTriangle}
            label="Total Findings"
            value={totalFindings}
          />

        </div>

      </div>


      {/* ======================================================
          SEVERITY SUMMARY
      ======================================================= */}

      <div className="mt-5 rounded-xl border border-[#12382D] bg-[#071A14] p-6">

        <div className="flex items-center gap-3">

          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10">
            <AlertTriangle
              size={19}
              className="text-red-400"
            />
          </div>

          <div>

            <h2 className="font-semibold text-white">
              Vulnerability Summary
            </h2>

            <p className="mt-1 text-xs text-[#557A6D]">
              Findings grouped by severity.
            </p>

          </div>

        </div>


        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-5">

          <SeverityCard
            label="Critical"
            value={combinedSummary.critical}
            className="text-red-400"
          />

          <SeverityCard
            label="High"
            value={combinedSummary.high}
            className="text-orange-400"
          />

          <SeverityCard
            label="Medium"
            value={combinedSummary.medium}
            className="text-yellow-400"
          />

          <SeverityCard
            label="Low"
            value={combinedSummary.low}
            className="text-blue-400"
          />

          <SeverityCard
            label="Informational"
            value={combinedSummary.informational}
            className="text-[#34D399]"
          />

        </div>

      </div>


      {/* ======================================================
          ASSET / NETWORK DETAILS
      ======================================================= */}

      <div className="mt-5 rounded-xl border border-[#12382D] bg-[#071A14]">

        <div className="border-b border-[#12382D] px-6 py-5">
          <h2 className="font-semibold text-white">
            Asset & Network Discovery
          </h2>

          <p className="mt-1 text-xs text-[#557A6D]">
            Complete host, operating-system, address, CPE and port information.
          </p>
        </div>

        <div className="p-6">

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">

            <InfoItem
              label="Hostname"
              value={
                scan.hostname ||
                network.hostname ||
                "—"
              }
            />

            <InfoItem
              label="IP Address"
              value={
                scan.ip_address ||
                network.ip_address ||
                scan.target_info?.ip_address ||
                "—"
              }
            />

            <InfoItem
              label="Port Range"
              value={
                scan.port_range ||
                network.scan_scope ||
                "—"
              }
            />

            <InfoItem
              label="Scan Technique"
              value={
                scan.scan_technique ||
                network.scan_technique ||
                "—"
              }
            />

          </div>

          {addresses.length > 0 && (
            <div className="mt-5 rounded-lg border border-[#12382D] bg-[#04130F] p-4">
              <p className="text-[10px] uppercase tracking-wider text-[#557A6D]">
                Resolved Addresses
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                {addresses.map((address, index) => (
                  <span
                    key={`${String(address)}-${index}`}
                    className="rounded-md border border-[#0E4037] bg-[#000B08] px-3 py-1.5 font-mono text-xs text-[#39F0A8]"
                  >
                    {typeof address === "string"
                      ? address
                      : JSON.stringify(address)}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="mt-5 rounded-lg border border-[#12382D] bg-[#04130F] p-4">
            <p className="text-[10px] uppercase tracking-wider text-[#557A6D]">
              Operating System
            </p>

            <p className="mt-2 text-sm font-medium text-white">
              {osDetection?.name || "Unknown"}
            </p>

            {osDetection &&
              typeof osDetection === "object" &&
              Object.entries(osDetection).length > 0 && (
                <pre className="mt-3 overflow-x-auto rounded-lg bg-[#000B08] p-3 font-mono text-xs leading-5 text-[#91B8AD]">
                  {JSON.stringify(osDetection, null, 2)}
                </pre>
              )}
          </div>

          {cpeRecords.length > 0 && (
            <div className="mt-5">
              <p className="text-sm font-semibold text-white">
                Detected CPEs
              </p>

              <div className="mt-3 space-y-3">
                {cpeRecords.map((record, index) => (
                  <div
                    key={`${record?.cpe || "cpe"}-${index}`}
                    className="rounded-lg border border-[#12382D] bg-[#04130F] p-4"
                  >
                    <div className="flex flex-wrap gap-2">
                      {record?.port != null && (
                        <span className="rounded-md border border-[#0E4037] bg-[#000B08] px-2.5 py-1 font-mono text-xs text-[#39F0A8]">
                          Port {record.port}
                        </span>
                      )}

                      {record?.service && (
                        <span className="rounded-md border border-[#0E4037] bg-[#000B08] px-2.5 py-1 text-xs text-[#91B8AD]">
                          {record.service}
                        </span>
                      )}

                      {record?.product && (
                        <span className="rounded-md border border-[#0E4037] bg-[#000B08] px-2.5 py-1 text-xs text-[#91B8AD]">
                          {record.product}
                        </span>
                      )}

                      {record?.version && (
                        <span className="rounded-md border border-[#0E4037] bg-[#000B08] px-2.5 py-1 font-mono text-xs text-[#91B8AD]">
                          {record.version}
                        </span>
                      )}
                    </div>

                    <p className="mt-3 break-all font-mono text-xs leading-6 text-[#39F0A8]">
                      {record?.cpe || "—"}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ======================================================
          OPEN PORTS
      ======================================================= */}

      <div className="mt-5 rounded-xl border border-[#12382D] bg-[#071A14]">

        <div className="border-b border-[#12382D] px-6 py-5">
          <h2 className="font-semibold text-white">
            Open Ports & Services
          </h2>

          <p className="mt-1 text-xs text-[#557A6D]">
            All TCP services returned by the network scanner.
          </p>
        </div>

        {openPorts.length === 0 ? (
          <div className="flex min-h-[140px] items-center justify-center px-6">
            <p className="text-sm text-[#557A6D]">
              No open ports were returned.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#0E2C23]">
            {openPorts.map((port, index) => (
              <div
                key={`${port?.port || "port"}-${index}`}
                className="px-6 py-5"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">

                  <div className="flex items-center gap-4">
                    <span className="flex h-10 min-w-10 items-center justify-center rounded-lg bg-[#000B08] px-3 font-mono font-semibold text-[#39F0A8]">
                      {port?.port ?? "—"}
                    </span>

                    <div>
                      <p className="text-sm font-semibold text-white">
                        {port?.service || "Unknown service"}
                      </p>

                      <p className="mt-1 text-xs text-[#718F84]">
                        {port?.product || "Unknown product"}
                        {port?.version
                          ? ` • ${port.version}`
                          : ""}
                        {port?.protocol
                          ? ` • ${port.protocol}`
                          : ""}
                      </p>
                    </div>
                  </div>

                  <span className="rounded-md border border-green-500/20 bg-green-500/10 px-2.5 py-1 text-xs font-medium text-green-400">
                    {port?.state || "open"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>

      {/* ======================================================
          CVE VULNERABILITY ASSESSMENT
      ======================================================= */}

      <div className="mt-5 rounded-xl border border-[#12382D] bg-[#071A14]">

        <div className="border-b border-[#12382D] px-6 py-5">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h2 className="font-semibold text-white">
                CVE Vulnerability Assessment
              </h2>

              <p className="mt-1 text-xs text-[#557A6D]">
                All CVE records returned by the CPE-to-NVD assessment.
              </p>
            </div>

            <span className="rounded-full border border-[#0E4037] bg-[#000B08] px-3 py-1 font-mono text-xs text-[#39F0A8]">
              {totalCves} CVEs
            </span>
          </div>
        </div>

        <div className="divide-y divide-[#0E2C23]">

          {networkVulnerabilities.length === 0 ? (
            <div className="flex min-h-[160px] items-center justify-center px-6">
              <p className="text-sm text-[#557A6D]">
                No CVE vulnerabilities were returned for this assessment.
              </p>
            </div>
          ) : (
            networkVulnerabilities.map((vulnerability, index) => (
              <div
                key={
                  vulnerability?.cve_id ||
                  vulnerability?.id ||
                  index
                }
                className="px-6 py-6"
              >

                <div className="flex flex-col justify-between gap-4 lg:flex-row">

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-mono text-sm font-bold text-[#39F0A8]">
                        {vulnerability?.cve_id ||
                          vulnerability?.id ||
                          "Unknown CVE"}
                      </p>

                      <SeverityBadge
                        severity={
                          vulnerability?.severity
                        }
                      />
                    </div>

                    <p className="mt-3 text-sm font-semibold text-white">
                      {vulnerability?.title ||
                        vulnerability?.cve_id ||
                        "Vulnerability"}
                    </p>
                  </div>

                  <div className="shrink-0 text-left lg:text-right">
                    <p className="text-[10px] uppercase tracking-wider text-[#557A6D]">
                      CVSS
                    </p>

                    <p className="mt-1 font-mono text-xl font-bold text-white">
                      {vulnerability?.cvss_score ?? "—"}
                    </p>
                  </div>

                </div>

                <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

                  <InfoItem
                    label="Affected Product / CPE"
                    value={
                      vulnerability?.affected_product ||
                      vulnerability?.cpe_name ||
                      "—"
                    }
                  />

                  <InfoItem
                    label="Detected Port"
                    value={
                      vulnerability?.port != null
                        ? vulnerability.port
                        : "—"
                    }
                  />

                  <InfoItem
                    label="Service / Product"
                    value={[
                      vulnerability?.service,
                      vulnerability?.product,
                      vulnerability?.version,
                    ]
                      .filter(Boolean)
                      .join(" • ") || "—"}
                  />

                  <InfoItem
                    label="CVSS Version"
                    value={
                      vulnerability?.cvss_version ||
                      "—"
                    }
                  />

                </div>

                {vulnerability?.cvss_vector && (
                  <div className="mt-4">
                    <p className="text-xs text-[#557A6D]">
                      CVSS Vector
                    </p>

                    <p className="mt-2 break-all rounded-lg border border-[#12382D] bg-[#000B08] p-3 font-mono text-xs leading-5 text-[#91B8AD]">
                      {vulnerability.cvss_vector}
                    </p>
                  </div>
                )}

                <div className="mt-5 rounded-lg border border-[#12382D] bg-[#04130F] p-5">
                  <p className="text-[10px] uppercase tracking-wider text-[#557A6D]">
                    Description
                  </p>

                  <p className="mt-3 whitespace-pre-line text-sm leading-7 text-[#C7DAD4]">
                    {vulnerability?.description ||
                      "No CVE description was returned."}
                  </p>
                </div>

                <div className="mt-5 grid gap-4 sm:grid-cols-2">

                  <InfoItem
                    label="Published"
                    value={
                      vulnerability?.published_date ||
                      "—"
                    }
                  />

                  <InfoItem
                    label="Last Modified"
                    value={
                      vulnerability?.last_modified_date ||
                      "—"
                    }
                  />

                </div>

                {Array.isArray(vulnerability?.cwe_ids) &&
                  vulnerability.cwe_ids.length > 0 && (
                    <div className="mt-4">
                      <p className="text-xs text-[#557A6D]">
                        CWE
                      </p>

                      <div className="mt-2 flex flex-wrap gap-2">
                        {vulnerability.cwe_ids.map(
                          (cwe, cweIndex) => (
                            <span
                              key={`${cwe}-${cweIndex}`}
                              className="rounded-md border border-[#0E4037] bg-[#000B08] px-2.5 py-1 font-mono text-xs text-[#91B8AD]"
                            >
                              {cwe}
                            </span>
                          )
                        )}
                      </div>
                    </div>
                  )}

                {Array.isArray(vulnerability?.references) &&
                  vulnerability.references.length > 0 && (
                    <div className="mt-5">
                      <p className="text-xs text-[#557A6D]">
                        References
                      </p>

                      <div className="mt-2 space-y-2">
                        {vulnerability.references.map(
                          (reference, refIndex) => (
                            <a
                              key={`${reference?.url || "reference"}-${refIndex}`}
                              href={reference?.url}
                              target="_blank"
                              rel="noreferrer"
                              className="block break-all rounded-lg border border-[#0E4037] bg-[#000B08] p-3 font-mono text-xs text-[#39F0A8] transition hover:border-[#00A889]"
                            >
                              {reference?.url ||
                                "Reference"}
                            </a>
                          )
                        )}
                      </div>
                    </div>
                  )}

                {(Array.isArray(
                  vulnerability?.version_conditions
                ) &&
                  vulnerability.version_conditions.length > 0) ||
                  (Array.isArray(
                    vulnerability?.applicability
                  ) &&
                    vulnerability.applicability.length > 0) && (
                  <details className="mt-5 rounded-lg border border-[#12382D] bg-[#000B08] p-4">
                    <summary className="cursor-pointer text-xs font-semibold text-[#91B8AD]">
                      NVD Applicability & Version Conditions
                    </summary>

                    <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words font-mono text-xs leading-5 text-[#718F84]">
                      {JSON.stringify(
                        {
                          nvd_exact_cpe_match:
                            vulnerability?.nvd_exact_cpe_match,
                          nvd_vulnerable_match:
                            vulnerability?.nvd_vulnerable_match,
                          version_conditions:
                            vulnerability?.version_conditions,
                          applicability:
                            vulnerability?.applicability,
                        },
                        null,
                        2
                      )}
                    </pre>
                  </details>
                )}

              </div>
            ))
          )}

        </div>
      </div>

      {/* ======================================================
          WEB SECURITY / MISSING HEADERS
      ======================================================= */}

      <div className="mt-5 rounded-xl border border-[#12382D] bg-[#071A14]">

        <div className="border-b border-[#12382D] px-6 py-5">
          <h2 className="font-semibold text-white">
            Web Security & HTTP Headers
          </h2>

          <p className="mt-1 text-xs text-[#557A6D]">
            Complete web findings and all security headers checked by the scanner.
          </p>
        </div>

        <div className="p-6">

          {headersChecked.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-white">
                Security Headers Checked
              </p>

              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {headersChecked.map((header, index) => {
                  const headerName =
                    typeof header === "string"
                      ? header
                      : header?.name ||
                        header?.header ||
                        JSON.stringify(header);

                  const normalized =
                    String(headerName).toLowerCase();

                  const missing = missingHeaderFindings.some(
                    (finding) => {
                      const title =
                        String(
                          finding?.title || ""
                        ).toLowerCase();

                      return (
                        title.includes(
                          normalized.replaceAll(
                            "-",
                            "-"
                          )
                        ) ||
                        title.includes(
                          normalized
                            .split("-")
                            .filter(Boolean)
                            .join(" ")
                        ) ||
                        title.includes(
                          normalized
                            .replaceAll("-", "")
                        )
                        );
                      
                    }
                  );

                  return (
                    <div
                      key={`${headerName}-${index}`}
                      className="flex items-center justify-between gap-3 rounded-lg border border-[#12382D] bg-[#04130F] p-3"
                    >
                      <span className="break-all font-mono text-xs text-[#91B8AD]">
                        {headerName}
                      </span>

                      <span
                        className={
                          missing
                            ? "shrink-0 rounded-md border border-red-500/30 bg-red-500/10 px-2 py-1 text-[10px] font-semibold text-red-400"
                            : "shrink-0 rounded-md border border-green-500/20 bg-green-500/10 px-2 py-1 text-[10px] font-semibold text-green-400"
                        }
                      >
                        {missing ? "Missing" : "No Finding"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {missingHeaderFindings.length > 0 && (
            <div className="mt-6">
              <p className="text-sm font-semibold text-white">
                Missing Security Headers
              </p>

              <div className="mt-3 divide-y divide-[#0E2C23] rounded-xl border border-[#12382D] bg-[#04130F]">
                {missingHeaderFindings.map(
                  (finding, index) => (
                    <div
                      key={`${finding?.title || "missing-header"}-${index}`}
                      className="p-4"
                    >
                      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                        <div>
                          <p className="text-sm font-semibold text-white">
                            {finding?.title ||
                              "Missing Security Header"}
                          </p>

                          <p className="mt-1 text-xs text-[#557A6D]">
                            {finding?.category ||
                              "Security Misconfiguration"}
                          </p>
                        </div>

                        <SeverityBadge
                          severity={finding?.severity}
                        />
                      </div>

                      {finding?.description && (
                        <p className="mt-3 text-sm leading-6 text-[#718F84]">
                          {finding.description}
                        </p>
                      )}

                      {finding?.recommendation && (
                        <div className="mt-3 rounded-lg border border-[#12382D] bg-[#000B08] p-3">
                          <p className="text-[10px] uppercase tracking-wider text-[#557A6D]">
                            Recommendation
                          </p>

                          <p className="mt-1 text-sm leading-6 text-[#A6C4B8]">
                            {finding.recommendation}
                          </p>
                        </div>
                      )}
                    </div>
                  )
                )}
              </div>
            </div>
          )}

          {webFindings.length > 0 && (
            <div className="mt-6">
              <p className="text-sm font-semibold text-white">
                Web Security Findings
              </p>

              <div className="mt-3 divide-y divide-[#0E2C23] rounded-xl border border-[#12382D] bg-[#04130F]">
                {webFindings.map(
                  (finding, index) => (
                    <div
                      key={`${finding?.title || "web-finding"}-${index}`}
                      className="p-4"
                    >
                      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                        <div>
                          <p className="text-sm font-semibold text-white">
                            {finding?.title ||
                              `Finding ${index + 1}`}
                          </p>

                          {finding?.category && (
                            <p className="mt-1 text-xs text-[#557A6D]">
                              {finding.category}
                            </p>
                          )}
                        </div>

                        <SeverityBadge
                          severity={finding?.severity}
                        />
                      </div>

                      {finding?.description && (
                        <p className="mt-3 text-sm leading-6 text-[#718F84]">
                          {finding.description}
                        </p>
                      )}

                      {finding?.recommendation && (
                        <div className="mt-3 rounded-lg border border-[#12382D] bg-[#000B08] p-3">
                          <p className="text-[10px] uppercase tracking-wider text-[#557A6D]">
                            Recommendation
                          </p>

                          <p className="mt-1 text-sm leading-6 text-[#A6C4B8]">
                            {finding.recommendation}
                          </p>
                        </div>
                      )}
                    </div>
                  )
                )}
              </div>
            </div>
          )}

          {webScan?.error && (
            <div className="mt-5 rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-4">
              <p className="text-xs font-semibold text-yellow-300">
                Web Scan Notice
              </p>

              <p className="mt-1 text-xs leading-5 text-yellow-200/70">
                {webScan.error}
              </p>
            </div>
          )}

          {headersChecked.length === 0 &&
            webFindings.length === 0 &&
            !webScan?.error && (
              <p className="text-sm text-[#557A6D]">
                No web security/header data was returned for this assessment type.
              </p>
            )}

        </div>
      </div>

      {/* ======================================================
          SECURITY FINDINGS
      ======================================================= */}

      <div className="mt-5 rounded-xl border border-[#12382D] bg-[#071A14]">

        <div className="border-b border-[#12382D] px-6 py-5">
          <h2 className="font-semibold text-white">
            Security Findings
          </h2>

          <p className="mt-1 text-xs text-[#557A6D]">
            Non-CVE findings discovered during the assessment.
          </p>
        </div>

        {findings.length === 0 ? (
          <div className="flex min-h-[140px] items-center justify-center px-6">
            <p className="text-sm text-[#557A6D]">
              No additional non-CVE findings were returned.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#0E2C23]">
            {findings.map((finding, index) => (
              <div
                key={finding.id || index}
                className="px-6 py-5"
              >
                <div className="flex flex-col justify-between gap-3 lg:flex-row">
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {finding.title ||
                        `Finding ${index + 1}`}
                    </p>

                    {finding.category && (
                      <p className="mt-1 text-xs text-[#557A6D]">
                        {finding.category}
                      </p>
                    )}
                  </div>

                  <SeverityBadge
                    severity={finding.severity}
                  />
                </div>

                {finding.description && (
                  <p className="mt-4 text-sm leading-6 text-[#718F84]">
                    {finding.description}
                  </p>
                )}

                {finding.recommendation && (
                  <div className="mt-4 rounded-lg border border-[#12382D] bg-[#04130F] p-4">
                    <p className="text-[10px] uppercase tracking-wider text-[#557A6D]">
                      Recommendation
                    </p>

                    <p className="mt-1 text-sm leading-6 text-[#A6C4B8]">
                      {finding.recommendation}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

      </div>


      {/* ======================================================
          FOOTER
      ======================================================= */}

      <div className="mt-5 flex justify-end">

        <button
          onClick={() => navigate("/scans")}
          className="inline-flex items-center gap-2 rounded-lg bg-[#059669] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#10B981]"
        >
          <ArrowLeft size={16} />
          Back to Scan History
        </button>

      </div>

      </div>
    </div>
  );
}


// ============================================================
// INFO ITEM
// ============================================================

function InfoItem({ label, value }) {
  return (
    <div>

      <p className="text-xs text-[#557A6D]">
        {label}
      </p>

      <p className="mt-2 break-words text-sm text-white">
        {value}
      </p>

    </div>
  );
}


// ============================================================
// REPORT CARD
// ============================================================

function ReportCard({
  icon: Icon,
  label,
  value,
}) {
  return (
    <div className="rounded-xl border border-[#12382D] bg-[#04130F] p-4">

      <div className="flex items-center justify-between">

        <div>

          <p className="text-xs text-[#557A6D]">
            {label}
          </p>

          <p className="mt-2 text-2xl font-bold capitalize text-white">
            {value}
          </p>

        </div>

        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#059669]/10">

          <Icon
            size={19}
            className="text-[#34D399]"
          />

        </div>

      </div>

    </div>
  );
}


// ============================================================
// SEVERITY CARD
// ============================================================

function SeverityCard({
  label,
  value,
  className,
}) {
  return (
    <div className="rounded-lg border border-[#12382D] bg-[#04130F] p-4">

      <p className="text-[10px] uppercase tracking-wider text-[#557A6D]">
        {label}
      </p>

      <p
        className={`mt-1 text-xl font-bold ${className}`}
      >
        {value}
      </p>

    </div>
  );
}


// ============================================================
// SEVERITY BADGE
// ============================================================

function SeverityBadge({ severity }) {
  const normalized =
    String(severity || "UNKNOWN").toUpperCase();

  let className =
    "border-[#12382D] bg-[#04130F] text-[#718F84]";

  if (normalized === "CRITICAL") {
    className =
      "border-red-500/30 bg-red-500/10 text-red-400";
  } else if (normalized === "HIGH") {
    className =
      "border-orange-500/30 bg-orange-500/10 text-orange-400";
  } else if (normalized === "MEDIUM") {
    className =
      "border-yellow-500/30 bg-yellow-500/10 text-yellow-400";
  } else if (normalized === "LOW") {
    className =
      "border-blue-500/30 bg-blue-500/10 text-blue-400";
  }

  return (
    <span
      className={`rounded-md border px-2 py-1 text-[10px] font-semibold ${className}`}
    >
      {normalized}
    </span>
  );
}


// ============================================================
// HELPERS
// ============================================================

function formatScanType(type) {
  if (type === "full") {
    return "Full Security";
  }

  if (type === "web") {
    return "Web Security";
  }

  if (type === "ports") {
    return "Port Security";
  }

  return type || "Unknown";
}


function formatDate(value) {
  if (!value) {
    return "—";
  }

  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}