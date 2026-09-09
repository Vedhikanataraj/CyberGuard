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

  const summary = scan.summary || {};

  const totalFindings =
    summary.total ??
    (
      (summary.critical || 0) +
      (summary.high || 0) +
      (summary.medium || 0) +
      (summary.low || 0) +
      (summary.informational || 0)
    );

  const scanType =
    String(scan.scan_type || "full").toLowerCase();

  const score =
    scan.security_score ?? 0;

  const grade =
    scan.grade || "—";

  const risk =
    scan.risk_level || "Unknown";

  const findings =
    Array.isArray(scan.findings)
      ? scan.findings
      : [];

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
            value={summary.critical || 0}
            className="text-red-400"
          />

          <SeverityCard
            label="High"
            value={summary.high || 0}
            className="text-orange-400"
          />

          <SeverityCard
            label="Medium"
            value={summary.medium || 0}
            className="text-yellow-400"
          />

          <SeverityCard
            label="Low"
            value={summary.low || 0}
            className="text-blue-400"
          />

          <SeverityCard
            label="Informational"
            value={summary.informational || 0}
            className="text-[#34D399]"
          />

        </div>

      </div>


      {/* ======================================================
          FINDINGS
      ======================================================= */}

      <div className="mt-5 rounded-xl border border-[#12382D] bg-[#071A14]">

        <div className="border-b border-[#12382D] px-6 py-5">

          <h2 className="font-semibold text-white">
            Security Findings
          </h2>

          <p className="mt-1 text-xs text-[#557A6D]">
            Detailed findings discovered during the assessment.
          </p>

        </div>

        {findings.length === 0 ? (

          <div className="flex min-h-[180px] items-center justify-center px-6">

            <div className="text-center">

              <CheckCircle2
                size={28}
                className="mx-auto text-green-400"
              />

              <p className="mt-3 text-sm font-medium text-white">
                No security findings detected
              </p>

              <p className="mt-1 text-xs text-[#557A6D]">
                The scanner did not return any findings for this assessment.
              </p>

            </div>

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