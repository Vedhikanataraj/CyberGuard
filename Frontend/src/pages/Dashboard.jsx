import { useEffect, useMemo, useRef, useState } from "react";

import {
  ShieldCheck,
  Activity,
  ScanLine,
  AlertTriangle,
  Server,
  ShieldAlert,
  RefreshCw,
  Clock3,
} from "lucide-react";

import {
  getVulnerabilities,
  getAssets,
} from "../api/cyberguardApi";


// ============================================================
// API CONFIGURATION
// ============================================================

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
// ============================================================
// GET SCANS
// ============================================================

async function getScans() {
  const response = await fetch(
    `${API_BASE_URL}/api/scans`,
    {
      credentials: "include",
      headers: {
        Accept: "application/json",
      },
    }
  );

  if (!response.ok) {
    throw new Error(
      `Failed to fetch scans: ${response.status}`
    );
  }

  return await response.json();
}

// ============================================================
// PROFESSIONAL PARTICLE BACKGROUND
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

      // Dense enough to be clearly visible, but still professional.
      const count = Math.min(
        190,
        Math.max(90, Math.floor((width * height) / 9000))
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

        // Soft halo like the reference particle animation.
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
// DASHBOARD
// ============================================================

function Dashboard() {
  const [vulnerabilities, setVulnerabilities] = useState([]);
  const [assets, setAssets] = useState([]);
  const [scans, setScans] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // ==========================================================
  // LOAD DASHBOARD DATA
  // ==========================================================

  async function loadDashboard() {
    try {
      setLoading(true);
      setError("");

      const [
        vulnerabilityData,
        assetData,
        scanData,
      ] = await Promise.allSettled([
        getVulnerabilities(),
        getAssets(),
        getScans(),
      ]);

      // ======================================================
      // VULNERABILITIES
      // ======================================================

      if (
        vulnerabilityData.status === "fulfilled"
      ) {
        const data =
          vulnerabilityData.value;

        setVulnerabilities(
          Array.isArray(data)
            ? data
            : data?.vulnerabilities || []
        );
      } else {
        setVulnerabilities([]);
      }

      // ======================================================
      // ASSETS
      // ======================================================

      if (
        assetData.status === "fulfilled"
      ) {
        const data =
          assetData.value;

        setAssets(
          Array.isArray(data)
            ? data
            : data?.assets || []
        );
      } else {
        setAssets([]);
      }

      // ======================================================
      // SCANS
      // ======================================================

      if (
        scanData.status === "fulfilled"
      ) {
        const data =
          scanData.value;

        setScans(
          Array.isArray(data)
            ? data
            : data?.scans || []
        );
      } else {
        setScans([]);
      }

      // ======================================================
      // SHOW ERROR ONLY IF ALL REQUESTS FAILED
      // ======================================================

      if (
        vulnerabilityData.status === "rejected" &&
        assetData.status === "rejected" &&
        scanData.status === "rejected"
      ) {
        throw new Error(
          "Unable to connect to CyberGuard APIs."
        );
      }
    } catch (err) {
      console.error(err);

      setError(
        "Unable to load live dashboard data."
      );
    } finally {
      setLoading(false);
    }
  }

  // ==========================================================
  // INITIAL LOAD
  // ==========================================================

  useEffect(() => {
    loadDashboard();
  }, []);

  // ==========================================================
  // VULNERABILITY STATISTICS
  // ==========================================================

  const vulnerabilityStats = useMemo(() => {
    return {
      total: vulnerabilities.length,

      critical: vulnerabilities.filter(
        (v) =>
          v.severity?.toUpperCase() ===
          "CRITICAL"
      ).length,

      high: vulnerabilities.filter(
        (v) =>
          v.severity?.toUpperCase() ===
          "HIGH"
      ).length,

      medium: vulnerabilities.filter(
        (v) =>
          v.severity?.toUpperCase() ===
          "MEDIUM"
      ).length,

      low: vulnerabilities.filter(
        (v) =>
          v.severity?.toUpperCase() ===
          "LOW"
      ).length,
    };
  }, [vulnerabilities]);

  // ==========================================================
  // ASSET STATISTICS
  // ==========================================================

  const assetStats = useMemo(() => {
    return {
      total: assets.length,

      high: assets.filter(
        (asset) =>
          asset.risk_level?.toUpperCase() ===
          "HIGH"
      ).length,

      medium: assets.filter(
        (asset) =>
          asset.risk_level?.toUpperCase() ===
          "MEDIUM"
      ).length,

      low: assets.filter(
        (asset) =>
          asset.risk_level?.toUpperCase() ===
          "LOW"
      ).length,
    };
  }, [assets]);

  // ==========================================================
  // SECURITY SCORE
  // ==========================================================

  const securityScore = useMemo(() => {
    const scoredScans = scans
      .filter(
        (scan) =>
          scan.security_score !== null &&
          scan.security_score !== undefined
      )
      .sort((a, b) => {
        const dateA = new Date(
          a.completed_at ||
          a.started_at ||
          a.created_at ||
          0
        ).getTime();

        const dateB = new Date(
          b.completed_at ||
          b.started_at ||
          b.created_at ||
          0
        ).getTime();

        return dateB - dateA;
      });

    if (scoredScans.length === 0) {
      return null;
    }

    return Number(
      scoredScans[0].security_score
    );
  }, [scans]);

  // ==========================================================
  // SECURITY SCORE LABEL
  // ==========================================================

  const scoreLabel = useMemo(() => {
    if (securityScore === null) {
      return "No security score available";
    }

    if (securityScore >= 80) {
      return "Good";
    }

    if (securityScore >= 60) {
      return "Moderate";
    }

    if (securityScore >= 40) {
      return "At Risk";
    }

    return "Critical";
  }, [securityScore]);

  // ==========================================================
  // RECENT SCANS
  // ==========================================================

  const recentScans = useMemo(() => {
    return [...scans]
      .sort((a, b) => {
        const dateA = new Date(
          a.completed_at ||
          a.started_at ||
          a.created_at ||
          0
        ).getTime();

        const dateB = new Date(
          b.completed_at ||
          b.started_at ||
          b.created_at ||
          0
        ).getTime();

        return dateB - dateA;
      })
      .slice(0, 5);
  }, [scans]);

  // ==========================================================
  // PAGE
  // ==========================================================

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#061412] text-white">

      {/* ======================================================
          EMERALD BACKGROUND
      ======================================================= */}

      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-[#020908]">

        {/* Deep emerald atmosphere */}
        <div className="absolute inset-0 bg-[#020908]" />

        <div
          className="absolute left-1/2 top-[-280px] h-[620px] w-[900px] -translate-x-1/2 rounded-full bg-emerald-500/[0.035] blur-[160px]"
        />

        {/* Visible professional particle field */}
        <div className="absolute inset-0 z-[1] opacity-90">
          <ParticleField />
        </div>

        {/* Subtle depth vignette */}
        <div
          className="absolute inset-0 z-[2] bg-[radial-gradient(circle_at_50%_25%,transparent_0%,rgba(2,9,8,0.18)_48%,rgba(2,9,8,0.82)_100%)]"
        />

        {/* Very subtle technical grid — no rolling objects */}
        <div
          className="absolute inset-0 z-[2] opacity-[0.10]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(52,211,153,0.16) 1px, transparent 1px), linear-gradient(90deg, rgba(52,211,153,0.16) 1px, transparent 1px)",
            backgroundSize: "72px 72px",
          }}
        />

      </div>

      {/* ======================================================
          DASHBOARD CONTENT
      ======================================================= */}

      <div className="relative z-10">

        {/* ======================================================
            PAGE HEADER
        ======================================================= */}

        <div className="mb-7">

          <div className="flex items-center gap-2 text-xs text-emerald-500/60">

            <span>
              Security Operations
            </span>

            <span className="text-emerald-500/30">
              /
            </span>

            <span className="text-emerald-300/80">
              Dashboard
            </span>

          </div>

          <div className="mt-2 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">

            <div>

              <h1
                className="
                  text-2xl
                  font-bold
                  tracking-tight
                  text-white
                  sm:text-3xl
                "
              >
                Dashboard
              </h1>

              <p className="mt-1 text-sm text-emerald-100/40">
                Monitor your security posture and vulnerability assessments.
              </p>

            </div>

            {/* Scanner Status */}

            <div
              className="
                flex
                items-center
                gap-2
                rounded-xl
                border
                border-emerald-400/15
                bg-emerald-400/[0.045]
                px-3
                py-2
                backdrop-blur-xl
                shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)]
              "
            >

              <span className="relative flex h-2 w-2">

                <span
                  className="
                    absolute
                    inline-flex
                    h-full
                    w-full
                    animate-ping
                    rounded-full
                    bg-emerald-400
                    opacity-40
                  "
                />

                <span
                  className="
                    relative
                    inline-flex
                    h-2
                    w-2
                    rounded-full
                    bg-emerald-400
                    shadow-[0_0_10px_rgba(52,211,153,0.7)]
                  "
                />

              </span>

              <span className="text-xs font-medium text-emerald-100/60">

                {loading
                  ? "Loading..."
                  : "Scanner operational"}

              </span>

            </div>

          </div>

        </div>

        {/* ======================================================
            ERROR
        ======================================================= */}

        {error && (
          <div
            className="
              mb-5
              flex
              items-center
              gap-3
              rounded-xl
              border
              border-red-500/30
              bg-red-500/10
              p-4
              backdrop-blur-xl
            "
          >

            <AlertTriangle
              size={18}
              className="text-red-400"
            />

            <p className="text-sm text-red-300">
              {error}
            </p>

          </div>
        )}

        {/* ======================================================
            TOP STATISTICS
        ======================================================= */}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

          {/* Total Scans */}

          <PreviewCard
            icon={ScanLine}
            label="Total Scans"

            value={
              loading
                ? "—"
                : scans.length
            }

            description={
              scans.length === 1
                ? "1 security assessment"
                : `${scans.length} security assessments`
            }
          />

          {/* Critical Vulnerabilities */}

          <PreviewCard
            icon={AlertTriangle}
            label="Critical Vulnerabilities"

            value={
              loading
                ? "—"
                : vulnerabilityStats.critical
            }

            description={
              vulnerabilityStats.critical > 0
                ? "Immediate attention required"
                : "No critical vulnerabilities detected"
            }

            iconClass="text-red-400"
            iconBg="bg-red-500/10"
          />

          {/* Security Activity */}

          <PreviewCard
            icon={Activity}
            label="Security Activity"

            value={
              loading
                ? "—"
                : vulnerabilityStats.total
            }

            description={
              loading
                ? "Loading security activity"
                : `${vulnerabilityStats.total} vulnerabilities identified`
            }

            iconClass="text-emerald-400"
            iconBg="bg-emerald-400/10"
          />

          {/* Security Score */}

          <PreviewCard
            icon={ShieldCheck}
            label="Security Score"

            value={
              loading
                ? "—"
                : securityScore !== null
                  ? `${securityScore}/100`
                  : "—"
            }

            description={
              loading
                ? "Loading security posture"
                : scoreLabel
            }

            iconClass="text-emerald-400"
            iconBg="bg-emerald-400/10"
          />

        </div>

        {/* ======================================================
            ASSET + VULNERABILITY OVERVIEW
        ======================================================= */}

        <div className="mt-5 grid gap-5 lg:grid-cols-2">

          {/* ====================================================
              ASSETS
          ===================================================== */}

          <div
            className="
              rounded-2xl
              border
              border-emerald-400/10
              bg-emerald-950/25
              p-6
              backdrop-blur-2xl
              shadow-[inset_0_1px_1px_rgba(255,255,255,0.04),0_18px_50px_rgba(0,0,0,0.22)]
              transition-all
              duration-300
              hover:border-emerald-400/20
              hover:bg-emerald-900/25
            "
          >

            <div className="flex items-center justify-between">

              <div className="flex items-center gap-3">

                <div
                  className="
                    flex
                    h-10
                    w-10
                    items-center
                    justify-center
                    rounded-xl
                    border
                    border-emerald-400/10
                    bg-emerald-400/[0.07]
                    shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)]
                  "
                >

                  <Server
                    size={20}
                    className="text-emerald-400"
                  />

                </div>

                <div>

                  <h2 className="font-semibold text-white">
                    Asset Overview
                  </h2>

                  <p className="text-xs text-emerald-100/35">
                    Discovered infrastructure
                  </p>

                </div>

              </div>

              <span className="text-2xl font-bold text-white">

                {loading
                  ? "—"
                  : assetStats.total}

              </span>

            </div>

            <div className="mt-6 grid grid-cols-3 gap-3">

              <MiniStat
                label="High"
                value={assetStats.high}
                className="text-red-400"
              />

              <MiniStat
                label="Medium"
                value={assetStats.medium}
                className="text-yellow-400"
              />

              <MiniStat
                label="Low"
                value={assetStats.low}
                className="text-emerald-400"
              />

            </div>

          </div>

          {/* ====================================================
              VULNERABILITIES
          ===================================================== */}

          <div
            className="
              rounded-2xl
              border
              border-emerald-400/10
              bg-emerald-950/25
              p-6
              backdrop-blur-2xl
              shadow-[inset_0_1px_1px_rgba(255,255,255,0.04),0_18px_50px_rgba(0,0,0,0.22)]
              transition-all
              duration-300
              hover:border-emerald-400/20
              hover:bg-emerald-900/25
            "
          >

            <div className="flex items-center justify-between">

              <div className="flex items-center gap-3">

                <div
                  className="
                    flex
                    h-10
                    w-10
                    items-center
                    justify-center
                    rounded-xl
                    border
                    border-red-400/10
                    bg-red-500/[0.07]
                  "
                >

                  <ShieldAlert
                    size={20}
                    className="text-red-400"
                  />

                </div>

                <div>

                  <h2 className="font-semibold text-white">
                    Vulnerability Overview
                  </h2>

                  <p className="text-xs text-emerald-100/35">
                    Current security findings
                  </p>

                </div>

              </div>

              <span className="text-2xl font-bold text-white">

                {loading
                  ? "—"
                  : vulnerabilityStats.total}

              </span>

            </div>

            <div className="mt-6 grid grid-cols-4 gap-2">

              <MiniStat
                label="Critical"
                value={vulnerabilityStats.critical}
                className="text-red-400"
              />

              <MiniStat
                label="High"
                value={vulnerabilityStats.high}
                className="text-orange-400"
              />

              <MiniStat
                label="Medium"
                value={vulnerabilityStats.medium}
                className="text-yellow-400"
              />

              <MiniStat
                label="Low"
                value={vulnerabilityStats.low}
                className="text-emerald-400"
              />

            </div>

          </div>

        </div>

        {/* ======================================================
            RECENT SCANS
        ======================================================= */}

        <div
          className="
            mt-5
            overflow-hidden
            rounded-2xl
            border
            border-emerald-400/10
            bg-emerald-950/25
            backdrop-blur-2xl
            shadow-[inset_0_1px_1px_rgba(255,255,255,0.04),0_18px_55px_rgba(0,0,0,0.25)]
          "
        >

          <div
            className="
              flex
              items-center
              justify-between
              border-b
              border-emerald-400/[0.08]
              px-6
              py-5
            "
          >

            <div>

              <h2 className="font-semibold text-white">
                Recent Scans
              </h2>

              <p className="mt-1 text-xs text-emerald-100/35">
                Latest security assessments
              </p>

            </div>

            <Clock3
              size={18}
              className="text-emerald-400/50"
            />

          </div>

          {/* Loading */}

          {loading ? (

            <div className="flex min-h-[180px] items-center justify-center">

              <div className="flex items-center gap-3 text-sm text-emerald-100/40">

                <RefreshCw
                  size={18}
                  className="animate-spin text-emerald-400"
                />

                Loading recent scans...

              </div>

            </div>

          ) : recentScans.length === 0 ? (

            /* No scans */

            <div className="flex min-h-[180px] flex-col items-center justify-center text-center">

              <ScanLine
                size={32}
                className="text-emerald-900"
              />

              <p className="mt-3 text-sm text-emerald-100/45">
                No scans available yet.
              </p>

            </div>

          ) : (

            /* Scan List */

            <div className="divide-y divide-emerald-400/[0.06]">

              {recentScans.map((scan) => (

                <div
                  key={
                    scan.id ||
                    scan.scan_id
                  }

                  className="
                    flex
                    flex-col
                    gap-3
                    px-6
                    py-4
                    transition
                    hover:bg-emerald-400/[0.025]
                    sm:flex-row
                    sm:items-center
                    sm:justify-between
                  "
                >

                  {/* Scan Information */}

                  <div>

                    <p className="font-mono text-sm text-emerald-400">

                      {scan.scan_id ||
                        `Scan #${scan.id}`}

                    </p>

                    <p className="mt-1 text-xs text-emerald-100/40">

                      {scan.target ||
                        scan.final_url ||
                        scan.target_url ||
                        "Unknown target"}

                    </p>

                  </div>

                  {/* Scan Status + Score */}

                  <div className="flex items-center gap-4">

                    <span
                      className={`
                        rounded-md
                        border
                        px-2.5
                        py-1
                        text-xs
                        font-medium
                        ${
                          scan.status === "completed"
                            ? "border-emerald-400/15 bg-emerald-400/10 text-emerald-400"
                            : scan.status === "failed"
                              ? "border-red-500/20 bg-red-500/10 text-red-400"
                              : "border-yellow-500/20 bg-yellow-500/10 text-yellow-400"
                        }
                      `}
                    >

                      {scan.status ||
                        "Unknown"}

                    </span>

                    {scan.security_score !== null &&
                      scan.security_score !== undefined && (

                        <span className="text-sm font-semibold text-white">

                          {scan.security_score}/100

                        </span>

                      )}

                  </div>

                </div>

              ))}

            </div>

          )}

        </div>

        {/* ======================================================
            REFRESH
        ======================================================= */}

        <div className="mt-4 flex justify-end">

          <button
            onClick={loadDashboard}
            disabled={loading}

            className="
              inline-flex
              items-center
              gap-2
              rounded-xl
              border
              border-emerald-400/15
              bg-emerald-400/[0.04]
              px-4
              py-2
              text-xs
              font-medium
              text-emerald-100/55
              backdrop-blur-xl
              transition
              hover:border-emerald-400/30
              hover:bg-emerald-400/[0.08]
              hover:text-emerald-300
              disabled:opacity-50
            "
          >

            <RefreshCw
              size={14}
              className={
                loading
                  ? "animate-spin"
                  : ""
              }
            />

            Refresh dashboard

          </button>

        </div>

      </div>

    </div>
  );
}

// ============================================================
// STATISTIC CARD
// ============================================================

function PreviewCard({
  icon: Icon,
  label,
  value,
  description,
  iconClass = "text-emerald-400",
  iconBg = "bg-emerald-400/10",
}) {

  return (

    <div
      className="
        group
        relative
        overflow-hidden
        rounded-2xl
        border
        border-emerald-400/10
        bg-emerald-950/25
        p-5
        backdrop-blur-2xl
        shadow-[inset_0_1px_1px_rgba(255,255,255,0.05),inset_0_-10px_20px_rgba(0,0,0,0.12),0_16px_45px_rgba(0,0,0,0.22)]
        transition-all
        duration-300
        hover:-translate-y-0.5
        hover:border-emerald-400/20
        hover:bg-emerald-900/30
      "
    >

      <div
        className="
          pointer-events-none
          absolute
          right-[-30px]
          top-[-30px]
          h-24
          w-24
          rounded-full
          bg-emerald-400/[0.035]
          blur-2xl
          transition
          duration-500
          group-hover:bg-emerald-400/[0.07]
        "
      />

      <div className="relative flex items-start justify-between">

        <div>

          <p className="text-xs font-medium text-emerald-100/40">
            {label}
          </p>

          <p className="mt-2 text-2xl font-bold text-white">
            {value}
          </p>

        </div>

        <div
          className={`
            flex
            h-10
            w-10
            items-center
            justify-center
            rounded-xl
            border
            border-emerald-400/10
            ${iconBg}
            ${iconClass}
            shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]
          `}
        >

          <Icon
            size={20}
            strokeWidth={1.8}
          />

        </div>

      </div>

      <p className="relative mt-3 text-[10px] text-emerald-100/30">
        {description}
      </p>

    </div>
  );
}

// ============================================================
// MINI STAT
// ============================================================

function MiniStat({
  label,
  value,
  className,
}) {

  return (

    <div
      className="
        rounded-xl
        border
        border-emerald-400/[0.08]
        bg-black/15
        p-3
        backdrop-blur-xl
        shadow-[inset_0_1px_1px_rgba(255,255,255,0.03)]
      "
    >

      <p className="text-[10px] uppercase tracking-wider text-emerald-100/30">
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

export default Dashboard;