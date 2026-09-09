import { useEffect, useMemo, useRef, useState } from "react";

import {
  Search,
  RefreshCw,
  Eye,
  Clock3,
  CheckCircle2,
  XCircle,
  Loader2,
  ShieldCheck,
  Globe,
  Server,
  ScanLine,
  AlertTriangle,
} from "lucide-react";

import { useNavigate } from "react-router-dom";

// ============================================================
// API
// ============================================================

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// ============================================================
// PARTICLE BACKGROUND — same visual treatment as Dashboard/New Scan
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

      const count = Math.min(190, Math.max(90, Math.floor((width * height) / 9000)));
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

        const alpha = Math.max(0.10, Math.min(0.72, p.alpha + Math.sin(p.phase) * 0.12));

        if (p.r > 1.15) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r * 3.2, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(52, 211, 153, ${alpha * 0.045})`;
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
      className="pointer-events-none fixed inset-0 z-[5] h-screen w-screen"
    />
  );
}

// ============================================================
// SCAN HISTORY
// ============================================================

export default function ScanHistory() {
  const navigate = useNavigate();

  const [scans, setScans] = useState([]);

  const [loading, setLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState("");

  const [search, setSearch] = useState("");

  const [selectedType, setSelectedType] = useState("all");

  const [selectedStatus, setSelectedStatus] = useState("all");

  // ==========================================================
  // LOAD SCANS
  // ==========================================================

  async function loadScans(showRefresh = false) {
    try {
      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      console.log("Loading scan history...");

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

      console.log(
        "Scan history HTTP status:",
        response.status
      );

      const contentType =
        response.headers.get("content-type") || "";

      let data;

      if (contentType.includes("application/json")) {
        data = await response.json();
      } else {
        const text = await response.text();

        data = {
          detail:
            text || "Backend returned an empty response.",
        };
      }

      console.log(
        "Scan history response:",
        data
      );

      if (!response.ok) {
        throw new Error(
          getErrorMessage(data)
        );
      }

      // ------------------------------------------------------
      // Backend response:
      //
      // {
      //   total: 2,
      //   scans: [...]
      // }
      // ------------------------------------------------------

      const scanList = Array.isArray(data)
        ? data
        : Array.isArray(data.scans)
        ? data.scans
        : [];

      setScans(scanList);

    } catch (err) {
      console.error(
        "Scan history error:",
        err
      );

      setError(
        err?.message === "Authentication required."
          ? "Your session is not available. Please return to the Dashboard and try Scan History again."
          : err?.message ||
            "Unable to load scan history."
      );

      setScans([]);

    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  // ==========================================================
  // ERROR MESSAGE
  // ==========================================================

  function getErrorMessage(data) {
    if (!data) {
      return "Request failed.";
    }

    if (typeof data.detail === "string") {
      return data.detail;
    }

    if (Array.isArray(data.detail)) {
      return data.detail
        .map((item) => {
          if (typeof item === "string") {
            return item;
          }

          return (
            item?.msg ||
            item?.message ||
            JSON.stringify(item)
          );
        })
        .join(", ");
    }

    if (data.message) {
      return data.message;
    }

    if (data.error) {
      return data.error;
    }

    return "Request failed.";
  }

  // ==========================================================
  // INITIAL LOAD
  // ==========================================================

  useEffect(() => {
    loadScans();
  }, []);

  // ==========================================================
  // FILTER
  // ==========================================================

  const filteredScans = useMemo(() => {
    return scans.filter((scan) => {
      const searchText =
        search.trim().toLowerCase();

      const scanId =
        String(scan.scan_id || "").toLowerCase();

      const target =
        String(scan.target || "").toLowerCase();

      const scanType =
        String(
          scan.scan_type ||
            inferScanType(scan)
        ).toLowerCase();

      const status =
        String(
          scan.status || ""
        ).toLowerCase();

      const matchesSearch =
        !searchText ||
        scanId.includes(searchText) ||
        target.includes(searchText) ||
        scanType.includes(searchText);

      const matchesType =
        selectedType === "all" ||
        scanType === selectedType;

      const matchesStatus =
        selectedStatus === "all" ||
        status === selectedStatus;

      return (
        matchesSearch &&
        matchesType &&
        matchesStatus
      );
    });
  }, [
    scans,
    search,
    selectedType,
    selectedStatus,
  ]);

  // ==========================================================
  // VIEW SCAN
  // ==========================================================

  function viewScan(scan) {
    const scanId = scan.scan_id;

    if (!scanId) {
      console.error(
        "Cannot open scan: scan_id missing",
        scan
      );

      return;
    }

    console.log(
      "Opening scan:",
      scanId
    );

    /*
      We will create the report page next.

      For now navigate using the scan ID.
    */

    navigate(
      `/scans/${encodeURIComponent(scanId)}`
    );
  }

  // ==========================================================
  // PAGE
  // ==========================================================

  return (
    <div className="relative min-h-full overflow-hidden bg-[#000806] pb-10">
      <ParticleField />
      <div className="relative z-10">

      {/* ======================================================
          HEADER
      ======================================================= */}

      <div className="mb-7">

        <p className="text-xs text-[#5D897C]">
          Security Operations /{" "}
          <span className="text-[#A0BDB5]">
            Scan History
          </span>
        </p>

        <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">

          <div>

            <h1 className="text-3xl font-bold tracking-tight text-white">
              Scan History
            </h1>

            <p className="mt-1 text-sm text-[#6C9488]">
              Review previous security assessments
              and their results.
            </p>

          </div>

          {/* REFRESH */}

          <button
            type="button"
            onClick={() => loadScans(true)}
            disabled={refreshing}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#104A36] bg-[#04120E] px-4 py-2.5 text-sm font-medium text-[#8FBDA9] transition hover:border-[#00A878] hover:text-[#00E39A] disabled:cursor-not-allowed disabled:opacity-50"
          >

            <RefreshCw
              size={16}
              className={
                refreshing
                  ? "animate-spin"
                  : ""
              }
            />

            Refresh

          </button>

        </div>

      </div>


      {/* ======================================================
          ERROR
      ======================================================= */}

      {error && (

        <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4">

          <XCircle
            size={20}
            className="mt-0.5 shrink-0 text-red-400"
          />

          <div>

            <p className="text-sm font-medium text-red-300">
              Unable to load scan history
            </p>

            <p className="mt-1 text-xs text-red-400/90">
              {error}
            </p>

          </div>

        </div>

      )}


      {/* ======================================================
          MAIN CARD
      ======================================================= */}

      <div className="overflow-hidden rounded-xl bg-transparent">

        {/* ====================================================
            FILTER BAR
        ===================================================== */}

        <div className="p-5">

          <div className="flex flex-col gap-3 lg:flex-row">

            {/* SEARCH */}

            <div className="relative flex-1">

              <Search
                size={17}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-[#52796E]"
              />

              <input
                type="text"
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search scan ID, target or scan type..."
                className="w-full rounded-lg border border-[#104A36] bg-[#04120E] py-3 pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-[#426F5B] focus:border-[#00E39A] focus:ring-1 focus:ring-[#00E39A]/20"
              />

            </div>


            {/* TYPE */}

            <select
              value={selectedType}
              onChange={(event) =>
                setSelectedType(
                  event.target.value
                )
              }
              className="rounded-lg border border-[#104A36] bg-[#04120E] px-4 py-3 text-sm text-[#B6CEC2] outline-none focus:border-[#00E39A]"
            >

              <option value="all">
                All Scan Types
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


            {/* STATUS */}

            <select
              value={selectedStatus}
              onChange={(event) =>
                setSelectedStatus(
                  event.target.value
                )
              }
              className="rounded-lg border border-[#104A36] bg-[#04120E] px-4 py-3 text-sm text-[#B6CEC2] outline-none focus:border-[#00E39A]"
            >

              <option value="all">
                All Status
              </option>

              <option value="completed">
                Completed
              </option>

              <option value="running">
                Running
              </option>

              <option value="failed">
                Failed
              </option>

            </select>

          </div>


          {/* COUNT */}

          <div className="mt-4 flex items-center justify-between">

            <p className="text-xs text-[#52796E]">

              Showing{" "}
              <span className="text-[#A0BDB5]">
                {filteredScans.length}
              </span>{" "}
              of{" "}
              <span className="text-[#A0BDB5]">
                {scans.length}
              </span>{" "}
              scans

            </p>

          </div>

        </div>


        {/* ====================================================
            LOADING
        ===================================================== */}

        {loading && (

          <div className="flex min-h-[300px] items-center justify-center">

            <div className="text-center">

              <Loader2
                size={30}
                className="mx-auto animate-spin text-[#20E6A8]"
              />

              <p className="mt-3 text-sm text-[#6C9488]">
                Loading scan history...
              </p>

            </div>

          </div>

        )}


        {/* ====================================================
            EMPTY
        ===================================================== */}

        {!loading &&
          !error &&
          filteredScans.length === 0 && (

            <div className="flex min-h-[320px] items-center justify-center p-8">

              <div className="text-center">

                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-[#0B3A2F] bg-[#02110E]">

                  <Clock3
                    size={25}
                    className="text-[#52796E]"
                  />

                </div>

                <h2 className="mt-4 text-lg font-semibold text-white">
                  No scans found
                </h2>

                <p className="mt-2 max-w-md text-sm text-[#62877A]">

                  {scans.length === 0
                    ? "Run your first security scan and it will appear here."
                    : "No scans match your current search or filters."}

                </p>

              </div>

            </div>

          )}


        {/* ====================================================
            DESKTOP TABLE
        ===================================================== */}

        {!loading &&
          filteredScans.length > 0 && (

            <div className="overflow-x-auto">

              <table className="w-full min-w-[1100px]">

                <thead>

                  <tr className="border-b border-[#0B3B2B] bg-[#061A13]">

                    <th className="px-5 py-4 text-left text-[10px] font-semibold uppercase tracking-wider text-[#52796E]">
                      Scan ID
                    </th>

                    <th className="px-5 py-4 text-left text-[10px] font-semibold uppercase tracking-wider text-[#52796E]">
                      Type
                    </th>

                    <th className="px-5 py-4 text-left text-[10px] font-semibold uppercase tracking-wider text-[#52796E]">
                      Target
                    </th>

                    <th className="px-5 py-4 text-left text-[10px] font-semibold uppercase tracking-wider text-[#52796E]">
                      Status
                    </th>

                    <th className="px-5 py-4 text-left text-[10px] font-semibold uppercase tracking-wider text-[#52796E]">
                      Score
                    </th>

                    <th className="px-5 py-4 text-left text-[10px] font-semibold uppercase tracking-wider text-[#52796E]">
                      Risk
                    </th>

                    <th className="px-5 py-4 text-left text-[10px] font-semibold uppercase tracking-wider text-[#52796E]">
                      Started
                    </th>

                    <th className="px-5 py-4 text-right text-[10px] font-semibold uppercase tracking-wider text-[#52796E]">
                      Action
                    </th>

                  </tr>

                </thead>


                <tbody>

                  {filteredScans.map(
                    (scan) => (

                      <ScanRow
                        key={
                          scan.scan_id ||
                          scan.id
                        }
                        scan={scan}
                        onView={() =>
                          viewScan(scan)
                        }
                      />

                    )
                  )}

                </tbody>

              </table>

            </div>

          )}

      </div>
      </div>

    </div>
  );
}


// ============================================================
// SCAN ROW
// ============================================================

function ScanRow({
  scan,
  onView,
}) {

  const type =
    String(
      scan.scan_type ||
        inferScanType(scan)
    ).toLowerCase();

  return (

    <tr className="border-b border-[#083222] transition hover:bg-[#06251E]">

      {/* SCAN ID */}

      <td className="px-5 py-4">

        <p className="font-mono text-xs font-medium text-[#20E6A8]">
          {scan.scan_id || "Unknown"}
        </p>

      </td>


      {/* TYPE */}

      <td className="px-5 py-4">

        <ScanTypeBadge
          type={type}
        />

      </td>


      {/* TARGET */}

      <td className="max-w-[280px] px-5 py-4">

        <p
          className="truncate font-mono text-xs text-[#A0BDB5]"
          title={scan.target || ""}
        >
          {scan.target || "Unknown"}
        </p>

      </td>


      {/* STATUS */}

      <td className="px-5 py-4">

        <StatusBadge
          status={scan.status}
        />

      </td>


      {/* SCORE */}

      <td className="px-5 py-4">

        {scan.security_score !==
          null &&
        scan.security_score !==
          undefined ? (

          <span className="text-sm font-semibold text-white">
            {scan.security_score}/100
          </span>

        ) : (

          <span className="text-sm text-[#52796E]">
            —
          </span>

        )}

      </td>


      {/* RISK */}

      <td className="px-5 py-4">

        <RiskBadge
          risk={scan.risk_level}
        />

      </td>


      {/* STARTED */}

      <td className="px-5 py-4">

        <p className="whitespace-nowrap text-xs text-[#6C9488]">
          {formatDate(scan.started_at)}
        </p>

      </td>


      {/* ACTION */}

      <td className="px-5 py-4 text-right">

        <button
          type="button"
          onClick={onView}
          className="inline-flex items-center gap-2 rounded-lg border border-[#104A36] bg-[#04120E] px-3 py-2 text-xs font-medium text-[#8FBDA9] transition hover:border-[#00A878] hover:text-[#00E39A]"
        >

          <Eye size={14} />

          View

        </button>

      </td>

    </tr>

  );
}


// ============================================================
// SCAN TYPE BADGE
// ============================================================

function ScanTypeBadge({
  type,
}) {

  const normalized =
    String(type || "unknown")
      .toLowerCase();

  let Icon = ScanLine;

  let label = "FULL";

  let className =
    "border-[#00B982]/30 bg-[#00B982]/10 text-[#20E6A8]";

  if (normalized === "web") {

    Icon = Globe;

    label = "WEB";

    className =
      "border-[#00B982]/30 bg-[#00B982]/10 text-[#20E6A8]";

  }

  if (
    normalized === "ports" ||
    normalized === "port"
  ) {

    Icon = Server;

    label = "PORT";

    className =
      "border-orange-400/30 bg-orange-400/10 text-orange-300";

  }

  return (

    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-semibold ${className}`}
    >

      <Icon size={12} />

      {label}

    </span>

  );
}


// ============================================================
// STATUS BADGE
// ============================================================

function StatusBadge({
  status,
}) {

  const normalized =
    String(status || "unknown")
      .toLowerCase();

  if (normalized === "completed") {

    return (

      <span className="inline-flex items-center gap-1.5 rounded-md border border-green-500/20 bg-green-500/10 px-2 py-1 text-[10px] font-semibold text-green-400">

        <CheckCircle2 size={12} />

        COMPLETED

      </span>

    );

  }

  if (normalized === "failed") {

    return (

      <span className="inline-flex items-center gap-1.5 rounded-md border border-red-500/20 bg-red-500/10 px-2 py-1 text-[10px] font-semibold text-red-400">

        <XCircle size={12} />

        FAILED

      </span>

    );

  }

  if (normalized === "running") {

    return (

      <span className="inline-flex items-center gap-1.5 rounded-md border border-yellow-500/20 bg-yellow-500/10 px-2 py-1 text-[10px] font-semibold text-yellow-400">

        <Loader2
          size={12}
          className="animate-spin"
        />

        RUNNING

      </span>

    );

  }

  return (

    <span className="rounded-md border border-[#0B3A2F] bg-[#02110E] px-2 py-1 text-[10px] font-semibold text-[#6C9488]">
      {String(status || "UNKNOWN").toUpperCase()}
    </span>

  );
}


// ============================================================
// RISK BADGE
// ============================================================

function RiskBadge({
  risk,
}) {

  const normalized =
    String(risk || "unknown")
      .toLowerCase();

  let className =
    "border-[#0B3A2F] bg-[#02110E] text-[#6C9488]";

  if (
    normalized === "critical"
  ) {

    className =
      "border-red-500/30 bg-red-500/10 text-red-400";

  } else if (
    normalized === "high"
  ) {

    className =
      "border-orange-400/30 bg-orange-400/10 text-orange-300";

  } else if (
    normalized === "moderate" ||
    normalized === "medium"
  ) {

    className =
      "border-yellow-400/30 bg-yellow-400/10 text-yellow-300";

  } else if (
    normalized === "low"
  ) {

    className =
      "border-[#00D69A]/30 bg-[#00D69A]/10 text-[#20E6A8]";

  }

  return (

    <span
      className={`rounded-md border px-2 py-1 text-[10px] font-semibold ${className}`}
    >
      {String(risk || "Unknown").toUpperCase()}
    </span>

  );
}


// ============================================================
// INFER SCAN TYPE
// ============================================================

function inferScanType(scan) {

  /*
    This is only a fallback for older database records
    where scan_type may not exist.
  */

  if (
    scan.scan_type
  ) {
    return scan.scan_type;
  }

  if (
    scan.target &&
    (
      scan.target.startsWith("http://") ||
      scan.target.startsWith("https://")
    )
  ) {

    return "web";

  }

  return "full";
}


// ============================================================
// DATE FORMAT
// ============================================================

function formatDate(value) {

  if (!value) {
    return "—";
  }

  try {

    return new Date(
      value
    ).toLocaleString(
      "en-IN",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }
    );

  } catch {

    return String(value);

  }
}