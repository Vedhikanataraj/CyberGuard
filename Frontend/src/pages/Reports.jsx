import { useEffect, useMemo, useRef, useState } from "react";
import {
  FileText,
  ShieldCheck,
  Globe,
  Server,
  RefreshCw,
  Search,
  CheckCircle2,
  XCircle,
  Eye,
} from "lucide-react";
import { Link } from "react-router-dom";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
// ============================================================
// MOVING PARTICLE BACKGROUND
// ============================================================

function ParticleField() {
  const canvasRef = useRef(null);

  useEffect(() => {
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
  500,
  Math.max(
    250,
    Math.floor((width * height) / 4000)
  )
);

      particles = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        r: Math.random() * 1.55 + 0.45,
        alpha: Math.random() * 0.42 + 0.20,
        vx: (Math.random() - 0.5) * 0.28,
        vy: (Math.random() - 0.5) * 0.20,
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
          0.10,
          Math.min(0.72, p.alpha + Math.sin(p.phase) * 0.12)
        );

        if (p.r > 1.15) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r * 3.2, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(52, 211, 153, ${alpha * 0.045})`;
          ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(94, 234, 212, ${alpha})`;
        ctx.fill();
      });

      animationFrame = requestAnimationFrame(animate);
    };

    resize();
    animate();

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    window.addEventListener("resize", resize);

    return () => {
      cancelAnimationFrame(animationFrame);
      observer.disconnect();
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  );
}

// ============================================================
// REPORTS PAGE
// ============================================================

export default function Reports() {
  const [reports, setReports] = useState({
    total: 0,
    scans: [],
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");

  // ==========================================================
  // LOAD ALL REPORTS
  // ==========================================================

  async function loadReports() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `${API_BASE_URL}/api/scans`,
        {
          method: "GET",
          credentials: "include",
          headers: {
            Accept: "application/json",
          },
        }
      );

      const contentType =
        response.headers.get("content-type") || "";

      const text = await response.text();

      if (!response.ok) {
        let message = `Backend returned HTTP ${response.status}`;

        if (contentType.includes("application/json") && text) {
          try {
            const body = JSON.parse(text);
            message = body?.detail || message;
          } catch {
            // Keep HTTP status message.
          }
        }

        throw new Error(message);
      }

      if (!text.trim()) {
        throw new Error("Backend returned an empty response.");
      }

      let data;

      try {
        data = JSON.parse(text);
      } catch {
        throw new Error("Backend returned invalid JSON.");
      }

      let scanList = [];

      if (Array.isArray(data)) {
        scanList = data;
      } else if (Array.isArray(data?.scans)) {
        scanList = data.scans;
      }

      setReports({
        total:
          typeof data?.total === "number"
            ? data.total
            : scanList.length,
        scans: scanList,
      });
    } catch (err) {
      console.error("Reports loading error:", err);

      setReports({
        total: 0,
        scans: [],
      });

      setError(
        err?.message || "Unable to load reports."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReports();
  }, []);

  // ==========================================================
  // FILTER
  // ==========================================================

  const filteredReports = useMemo(() => {
    const scans = reports?.scans || [];
    const searchText = search.trim().toLowerCase();

    return scans.filter((scan) => {
      const scanId = String(scan?.scan_id || "").toLowerCase();
      const target = String(scan?.target || "").toLowerCase();

      const matchesSearch =
        !searchText ||
        scanId.includes(searchText) ||
        target.includes(searchText);

      if (!matchesSearch) return false;

      if (filterType === "all") return true;

      const scanType = String(
        scan?.scan_type || "full"
      ).toLowerCase();

      return scanType === filterType;
    });
  }, [reports, search, filterType]);

  // ==========================================================
  // COUNTS
  // ==========================================================

  const scans = reports?.scans || [];

  const totalReports = scans.length;

  const fullSecurityCount = scans.filter(
    (scan) =>
      String(scan?.scan_type || "full").toLowerCase() ===
      "full"
  ).length;

  const webSecurityCount = scans.filter(
    (scan) =>
      String(scan?.scan_type || "").toLowerCase() ===
      "web"
  ).length;

  const portSecurityCount = scans.filter((scan) => {
    const type = String(
      scan?.scan_type || ""
    ).toLowerCase();

    return type === "ports" || type === "port";
  }).length;

  // ==========================================================
  // PAGE
  // ==========================================================

  return (
    <div className="relative min-h-[calc(100vh-76px)] overflow-hidden bg-transparent">
      <ParticleField />

      <div className="relative z-10 pb-10">
        {/* HEADER */}

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs text-[#5F8D80]">
              Security Operations /{" "}
              <span className="text-[#91B8AD]">
                Reports
              </span>
            </p>

            <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">
              Reports
            </h1>

            <p className="mt-1 text-sm text-[#6F9E91]">
              Generate and review completed security
              assessment reports.
            </p>
          </div>

          <button
            type="button"
            onClick={loadReports}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#0E4037] bg-[#031A13]/80 px-4 py-2.5 text-sm font-medium text-[#91B8AD] backdrop-blur-xl transition hover:border-[#00A889] hover:text-[#00E0A3] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw
              size={16}
              className={loading ? "animate-spin" : ""}
            />
            Refresh
          </button>
        </div>

        {/* ERROR */}

        {error && (
          <div className="mt-6 flex items-start gap-3 rounded-2xl border border-red-500/30 bg-red-950/30 p-5 backdrop-blur-xl">
            <XCircle
              size={21}
              className="mt-0.5 shrink-0 text-red-400"
            />

            <div>
              <p className="text-sm font-semibold text-red-300">
                Unable to load reports
              </p>

              <p className="mt-1 text-xs leading-5 text-red-400">
                {error}
              </p>
            </div>
          </div>
        )}

        {/* SUMMARY CARDS */}

        <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            icon={FileText}
            label="Total Reports"
            value={totalReports}
          />

          <SummaryCard
            icon={ShieldCheck}
            label="Full Security"
            value={fullSecurityCount}
          />

          <SummaryCard
            icon={Globe}
            label="Web Security"
            value={webSecurityCount}
          />

          <SummaryCard
            icon={Server}
            label="Port Security"
            value={portSecurityCount}
          />
        </div>

        {/* SEARCH + FILTER */}

        <div className="mt-5 rounded-2xl border border-[#0E4037] bg-[#00100C]/75 p-5 backdrop-blur-2xl">
          <div className="relative">
            <Search
              size={19}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-[#6F9E91]"
            />

            <input
              type="text"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search report ID or target..."
              className="w-full rounded-xl border border-[#0E4037] bg-[#000B08]/80 py-3 pl-11 pr-4 text-sm text-white outline-none placeholder:text-[#49636B] focus:border-[#00E0A3]"
            />
          </div>

          <div className="mt-3">
            <select
              value={filterType}
              onChange={(event) =>
                setFilterType(event.target.value)
              }
              className="w-full rounded-xl border border-[#0E4037] bg-[#000B08]/80 px-4 py-3 text-sm text-[#91B8AD] outline-none focus:border-[#00E0A3]"
            >
              <option value="all">
                All Report Types
              </option>
              <option value="full">
                Full Security
              </option>
              <option value="web">
                Web Security
              </option>
              <option value="ports">
                Port Security
              </option>
            </select>
          </div>
        </div>

        {/* LOADING */}

        {loading && (
          <div className="mt-5 rounded-2xl border border-[#0E4037] bg-[#00100C]/75 p-10 backdrop-blur-2xl">
            <div className="flex min-h-[200px] flex-col items-center justify-center">
              <RefreshCw
                size={30}
                className="animate-spin text-[#34D399]"
              />

              <p className="mt-4 text-sm text-[#6F9E91]">
                Loading security reports...
              </p>
            </div>
          </div>
        )}

        {/* NO REPORTS */}

        {!loading && filteredReports.length === 0 && (
          <div className="mt-5 rounded-2xl border border-[#0E4037] bg-[#00100C]/75 p-10 backdrop-blur-2xl">
            <div className="flex min-h-[200px] flex-col items-center justify-center text-center">
              <FileText
                size={36}
                className="text-[#6F9E91]"
              />

              <h2 className="mt-4 text-lg font-semibold text-white">
                No reports found
              </h2>

              <p className="mt-2 max-w-md text-sm text-[#6F9E91]">
                {search
                  ? "No reports match your search."
                  : "Complete a security scan to generate a report."}
              </p>
            </div>
          </div>
        )}

        {/* REPORT LIST */}

        {!loading && filteredReports.length > 0 && (
          <div className="mt-5 overflow-hidden rounded-2xl border border-[#0E4037] bg-[#00100C]/75 backdrop-blur-2xl">
            <div className="border-b border-[#0E4037] px-6 py-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-white">
                    Security Reports
                  </h2>

                  <p className="mt-1 text-xs text-[#6F9E91]">
                    {filteredReports.length} report
                    {filteredReports.length !== 1
                      ? "s"
                      : ""}{" "}
                    available
                  </p>
                </div>

                <FileText
                  size={20}
                  className="text-[#34D399]"
                />
              </div>
            </div>

            <div className="divide-y divide-[#082C25]">
              {filteredReports.map((scan) => (
                <ReportRow
                  key={scan.scan_id}
                  scan={scan}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// SUMMARY CARD
// ============================================================

function SummaryCard({
  icon: Icon,
  label,
  value,
}) {
  return (
    <div className="group rounded-2xl border border-[#0E4037] bg-[#00100C]/75 p-5 backdrop-blur-2xl transition hover:-translate-y-0.5 hover:border-[#00A889]/50">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-[#6F9E91]">
            {label}
          </p>

          <p className="mt-2 text-3xl font-bold text-white">
            {value}
          </p>
        </div>

        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#00A889]/10">
          <Icon
            size={22}
            className="text-[#34D399]"
          />
        </div>
      </div>
    </div>
  );
}

// ============================================================
// REPORT ROW
// ============================================================

function ReportRow({ scan }) {
  const scanType = String(
    scan?.scan_type || "full"
  ).toLowerCase();

  const typeLabel =
    scanType === "web"
      ? "Web Security"
      : scanType === "ports" || scanType === "port"
      ? "Port Security"
      : "Full Security";

  const TypeIcon =
    scanType === "web"
      ? Globe
      : scanType === "ports" || scanType === "port"
      ? Server
      : ShieldCheck;

  const status = String(
    scan?.status || "unknown"
  ).toLowerCase();

  const scanId = scan?.scan_id;

  return (
    <div className="px-6 py-5 transition hover:bg-emerald-400/[0.035]">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        {/* LEFT */}

        <div className="flex min-w-0 items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#00A889]/10">
            <TypeIcon
              size={20}
              className="text-[#34D399]"
            />
          </div>

          <div className="min-w-0">
            <p className="break-all font-mono text-sm font-semibold text-[#34D399]">
              {scanId || "Unknown Scan"}
            </p>

            <p className="mt-1 break-all text-sm text-white">
              {scan?.target || "Unknown target"}
            </p>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="rounded-md border border-[#0E4037] bg-[#000B08] px-2 py-1 text-[10px] text-[#91B8AD]">
                {typeLabel}
              </span>

              {status === "completed" ? (
                <span className="inline-flex items-center gap-1 rounded-md border border-green-500/20 bg-green-500/10 px-2 py-1 text-[10px] text-green-400">
                  <CheckCircle2 size={12} />
                  completed
                </span>
              ) : (
                <span className="rounded-md border border-yellow-500/20 bg-yellow-500/10 px-2 py-1 text-[10px] text-yellow-400">
                  {status}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT */}

        <div className="flex flex-wrap items-center gap-5 lg:justify-end">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-[#6F9E91]">
              Score
            </p>

            <p className="mt-1 text-lg font-bold text-white">
              {scan?.security_score ?? "—"}
            </p>
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-wider text-[#6F9E91]">
              Grade
            </p>

            <p className="mt-1 text-lg font-bold text-white">
              {scan?.grade || "—"}
            </p>
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-wider text-[#6F9E91]">
              Risk
            </p>

            <p className="mt-1 text-sm font-semibold text-white">
              {scan?.risk_level || "Unknown"}
            </p>
          </div>

          {scanId ? (
            <Link
              to={`/scans/${encodeURIComponent(scanId)}`}
              className="inline-flex items-center gap-2 rounded-xl border border-[#0E4037] bg-[#000B08]/80 px-4 py-2.5 text-xs font-semibold text-[#91B8AD] transition hover:border-[#00E0A3] hover:bg-[#00A889]/10 hover:text-[#34D399]"
            >
              <Eye size={15} />
              View Report
            </Link>
          ) : (
            <span className="inline-flex cursor-not-allowed items-center gap-2 rounded-xl border border-[#0E4037] bg-[#000B08]/50 px-4 py-2.5 text-xs font-semibold text-[#6F9E91]">
              <Eye size={15} />
              View Report
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
