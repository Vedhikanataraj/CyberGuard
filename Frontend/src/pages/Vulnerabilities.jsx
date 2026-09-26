import { useEffect, useMemo, useRef, useState } from "react";

import {
  AlertTriangle,
  Bug,
  Search,
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  ExternalLink,
  X,
} from "lucide-react";

import { getVulnerabilities } from "../api/cyberguardApi";

// ============================================================
// CYBERGUARD PARTICLE BACKGROUND
// Same particle system used by Dashboard
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

      const dpr = Math.min(
        window.devicePixelRatio || 1,
        2
      );

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);

      ctx.setTransform(
        dpr,
        0,
        0,
        dpr,
        0,
        0
      );

      const count = Math.min(
        190,
        Math.max(
          90,
          Math.floor(
            (width * height) / 9000
          )
        )
      );

      particles = Array.from(
        { length: count },
        () => ({
          x: Math.random() * width,
          y: Math.random() * height,

          r:
            Math.random() * 1.55 +
            0.45,

          alpha:
            Math.random() * 0.42 +
            0.20,

          vx:
            (Math.random() - 0.5) *
            0.28,

          vy:
            (Math.random() - 0.5) *
            0.20,

          phase:
            Math.random() *
            Math.PI *
            2,

          pulse:
            Math.random() * 0.012 +
            0.004,
        })
      );
    };

    const animate = () => {
      ctx.clearRect(
        0,
        0,
        width,
        height
      );

      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;

        p.phase += p.pulse;

        if (p.x < -8) {
          p.x = width + 8;
        }

        if (p.x > width + 8) {
          p.x = -8;
        }

        if (p.y < -8) {
          p.y = height + 8;
        }

        if (p.y > height + 8) {
          p.y = -8;
        }

        const alpha = Math.max(
          0.10,
          Math.min(
            0.72,
            p.alpha +
              Math.sin(p.phase) *
                0.12
          )
        );

        // Soft particle halo
        if (p.r > 1.15) {
          ctx.beginPath();

          ctx.arc(
            p.x,
            p.y,
            p.r * 3.2,
            0,
            Math.PI * 2
          );

          ctx.fillStyle =
            `rgba(52, 211, 153, ${
              alpha * 0.045
            })`;

          ctx.fill();
        }

        // Main particle
        ctx.beginPath();

        ctx.arc(
          p.x,
          p.y,
          p.r,
          0,
          Math.PI * 2
        );

        ctx.fillStyle =
          `rgba(94, 234, 212, ${alpha})`;

        ctx.fill();
      });

      animationFrame =
        requestAnimationFrame(
          animate
        );
    };

    resize();
    animate();

    const observer =
      new ResizeObserver(resize);

    observer.observe(canvas);

    window.addEventListener(
      "resize",
      resize
    );

    return () => {
      cancelAnimationFrame(
        animationFrame
      );

      observer.disconnect();

      window.removeEventListener(
        "resize",
        resize
      );
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="
        pointer-events-none
        absolute
        inset-0
        z-0
        h-full
        w-full
        opacity-100
      "
    />
  );
}

/* ============================================================
   SUMMARY CARD
============================================================ */

function SummaryCard({
  title,
  value,
  icon: Icon,
  iconClass,
  iconBg,
}) {
  return (
    <div
      className="
        rounded-xl
        border
        border-[#0E4037]/70
        bg-[#00100C]/70
        p-5
        backdrop-blur-sm
        transition-all
        duration-200
        hover:border-[#0E4037]
        hover:bg-[#031A13]/80
      "
    >

      <div className="flex items-start justify-between">

        <div>

          <p
            className="
              text-sm
              text-[#6F9E91]
            "
          >
            {title}
          </p>

          <p
            className="
              mt-2
              text-2xl
              font-bold
              text-white
            "
          >
            {value}
          </p>

        </div>

        <div
          className={`
            flex
            h-11
            w-11
            items-center
            justify-center
            rounded-xl
            ${iconBg}
          `}
        >
          <Icon
            size={20}
            className={iconClass}
          />
        </div>

      </div>

    </div>
  );
}


/* ============================================================
   SEVERITY BADGE
============================================================ */

function SeverityBadge({ severity }) {
  const normalized =
    severity?.toUpperCase() || "UNKNOWN";

  const styles = {
    CRITICAL:
      "border-red-500/30 bg-red-500/10 text-red-400",

    HIGH:
      "border-orange-500/30 bg-orange-500/10 text-orange-400",

    MEDIUM:
      "border-yellow-500/30 bg-yellow-500/10 text-yellow-400",

    LOW:
      "border-blue-500/30 bg-blue-500/10 text-blue-400",

    UNKNOWN:
      "border-[#285247] bg-[#000B08] text-[#789E94]",
  };

  return (
    <span
      className={`
        inline-flex
        rounded-lg
        border
        px-2.5
        py-1
        text-xs
        font-semibold
        ${styles[normalized] || styles.UNKNOWN}
      `}
    >
      {normalized}
    </span>
  );
}

export default function Vulnerabilities() {
  const [vulnerabilities, setVulnerabilities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState("All");
  const [selectedVulnerability, setSelectedVulnerability] = useState(null);

  // ============================================================
  // LOAD VULNERABILITIES
  // ============================================================

  async function loadVulnerabilities() {
    try {
      setLoading(true);
      setError("");

      const data = await getVulnerabilities();

      setVulnerabilities(data.vulnerabilities || []);
    } catch (err) {
      console.error(err);

      setError(
        "Unable to connect to the CyberGuard backend."
      );
    } finally {
      setLoading(false);
    }
  }

  // ============================================================
  // INITIAL LOAD
  // ============================================================

  useEffect(() => {
    loadVulnerabilities();
  }, []);

  // ============================================================
  // FILTER VULNERABILITIES
  // ============================================================

  const filteredVulnerabilities = useMemo(() => {
    return vulnerabilities.filter((vulnerability) => {
      const severity =
        vulnerability.severity?.toUpperCase() || "";

      const matchesSeverity =
        severityFilter === "All" ||
        severity === severityFilter.toUpperCase();

      const searchText = search.toLowerCase();

      const matchesSearch =
        !searchText ||
        vulnerability.cve_id
          ?.toLowerCase()
          .includes(searchText) ||
        vulnerability.title
          ?.toLowerCase()
          .includes(searchText) ||
        vulnerability.description
          ?.toLowerCase()
          .includes(searchText) ||
        vulnerability.affected_product
          ?.toLowerCase()
          .includes(searchText);

      return matchesSeverity && matchesSearch;
    });
  }, [vulnerabilities, search, severityFilter]);

  // ============================================================
  // COUNTS
  // ============================================================

  const counts = useMemo(() => {
    return {
      total: vulnerabilities.length,

      critical: vulnerabilities.filter(
        (v) =>
          v.severity?.toUpperCase() === "CRITICAL"
      ).length,

      high: vulnerabilities.filter(
        (v) =>
          v.severity?.toUpperCase() === "HIGH"
      ).length,

      medium: vulnerabilities.filter(
        (v) =>
          v.severity?.toUpperCase() === "MEDIUM"
      ).length,

      low: vulnerabilities.filter(
        (v) =>
          v.severity?.toUpperCase() === "LOW"
      ).length,
    };
  }, [vulnerabilities]);

  // ============================================================
  // VIEW VULNERABILITY DETAILS
  // ============================================================

  function openVulnerabilityDetails(vulnerability) {
    setSelectedVulnerability(vulnerability);
  }

  function closeVulnerabilityDetails() {
    setSelectedVulnerability(null);
  }

  // ============================================================
  // PAGE
  // ============================================================

  return (
    <div className="relative min-h-[calc(100vh-76px)] overflow-hidden bg-transparent">

      <ParticleField />

      <div className="relative z-10">

      {/* ======================================================
          BREADCRUMB
      ====================================================== */}

      <div className="text-sm text-[#5F8D80]">
        Security Operations
        <span className="mx-2 text-[#285247]">
          /
        </span>
        <span className="text-[#91B8AD]">
          Vulnerabilities
        </span>
      </div>

      {/* ======================================================
          HEADER
      ====================================================== */}

      <div className="mt-3 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">

        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Vulnerabilities
          </h1>

          <p className="mt-2 text-sm text-[#6F9E91] sm:text-base">
            Identify, prioritize and manage security vulnerabilities.
          </p>
        </div>

        <button
          onClick={loadVulnerabilities}
          disabled={loading}
          className="
            inline-flex
            items-center
            justify-center
            gap-2
            rounded-xl
            border
            border-[#0E4037]
            bg-[#00100C]/80
            px-5
            py-3
            text-sm
            font-medium
            text-[#91B8AD]
            backdrop-blur-sm
            transition-all
            duration-200
            hover:border-[#00E0A3]
            hover:bg-[#041A13]
            hover:text-[#00E0A3]
            disabled:cursor-not-allowed
            disabled:opacity-50
          "
        >
          <RefreshCw
            size={17}
            className={
              loading
                ? "animate-spin"
                : ""
            }
          />

          Refresh
        </button>
      </div>

      {/* ======================================================
          ERROR
      ====================================================== */}

      {error && (
        <div
          className="
            mt-6
            flex
            items-start
            gap-3
            rounded-xl
            border
            border-red-500/30
            bg-red-950/30
            p-4
            backdrop-blur-sm
          "
        >
          <AlertTriangle
            size={20}
            className="mt-0.5 shrink-0 text-red-400"
          />

          <div>
            <p className="font-medium text-red-300">
              Backend connection failed
            </p>

            <p className="mt-1 text-sm text-red-300/70">
              {error}
            </p>
          </div>
        </div>
      )}

      {/* ======================================================
          SUMMARY CARDS
      ====================================================== */}

      <div
        className="
          mt-7
          grid
          grid-cols-1
          gap-4
          sm:grid-cols-2
          xl:grid-cols-5
        "
      >

        {/* TOTAL */}

        <SummaryCard
          title="Total"
          value={counts.total}
          icon={Bug}
          iconClass="text-[#00E0A3]"
          iconBg="bg-[#003D2E]"
        />

        {/* CRITICAL */}

        <SummaryCard
          title="Critical"
          value={counts.critical}
          icon={ShieldAlert}
          iconClass="text-red-400"
          iconBg="bg-red-500/10"
        />

        {/* HIGH */}

        <SummaryCard
          title="High"
          value={counts.high}
          icon={AlertTriangle}
          iconClass="text-orange-400"
          iconBg="bg-orange-500/10"
        />

        {/* MEDIUM */}

        <SummaryCard
          title="Medium"
          value={counts.medium}
          icon={ShieldAlert}
          iconClass="text-yellow-400"
          iconBg="bg-yellow-500/10"
        />

        {/* LOW */}

        <SummaryCard
          title="Low"
          value={counts.low}
          icon={ShieldCheck}
          iconClass="text-blue-400"
          iconBg="bg-blue-500/10"
        />
      </div>

      {/* ======================================================
          MAIN VULNERABILITY AREA
          No large outer blue border
      ====================================================== */}

      <div
        className="
          mt-7
          overflow-hidden
          rounded-xl
          bg-transparent
        "
      >

        {/* ====================================================
            TOOLBAR
        ==================================================== */}

        <div
          className="
            rounded-xl
            bg-[#00100C]/70
            p-5
            backdrop-blur-sm
          "
        >

          <div
            className="
              flex
              flex-col
              gap-4
              lg:flex-row
              lg:items-center
              lg:justify-between
            "
          >

            {/* SEARCH */}

            <div className="relative w-full lg:max-w-xl">

              <Search
                size={19}
                className="
                  absolute
                  left-4
                  top-1/2
                  -translate-y-1/2
                  text-[#4F776D]
                "
              />

              <input
                type="text"
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search CVE, vulnerability, product..."
                className="
                  w-full
                  rounded-xl
                  border
                  border-[#0E4037]
                  bg-[#000B08]
                  py-3
                  pl-11
                  pr-4
                  text-sm
                  text-white
                  outline-none
                  placeholder:text-[#42685E]
                  transition
                  focus:border-[#00E0A3]
                  focus:ring-1
                  focus:ring-[#00E0A3]/20
                "
              />
            </div>

            {/* SEVERITY */}

            <select
              value={severityFilter}
              onChange={(event) =>
                setSeverityFilter(event.target.value)
              }
              className="
                w-full
                rounded-xl
                border
                border-[#0E4037]
                bg-[#000B08]
                px-4
                py-3
                text-sm
                text-[#91B8AD]
                outline-none
                transition
                focus:border-[#00E0A3]
                focus:ring-1
                focus:ring-[#00E0A3]/20
                lg:w-56
              "
            >
              <option value="All">
                All Severities
              </option>

              <option value="Critical">
                Critical
              </option>

              <option value="High">
                High
              </option>

              <option value="Medium">
                Medium
              </option>

              <option value="Low">
                Low
              </option>
            </select>
          </div>
        </div>

        {/* ====================================================
            LOADING
        ==================================================== */}

        {loading && (
          <div
            className="
              flex
              min-h-[300px]
              items-center
              justify-center
              rounded-xl
              bg-[#00100C]/60
            "
          >
            <div
              className="
                flex
                items-center
                gap-3
                text-sm
                text-[#6F9E91]
              "
            >
              <RefreshCw
                size={19}
                className="animate-spin text-[#00E0A3]"
              />

              Loading vulnerabilities...
            </div>
          </div>
        )}

        {/* ====================================================
            EMPTY
        ==================================================== */}

        {!loading &&
          !error &&
          filteredVulnerabilities.length === 0 && (
            <div
              className="
                flex
                min-h-[300px]
                flex-col
                items-center
                justify-center
                rounded-xl
                bg-[#00100C]/60
                text-center
              "
            >
              <ShieldCheck
                size={44}
                className="text-[#285247]"
              />

              <p
                className="
                  mt-4
                  text-sm
                  font-medium
                  text-[#91B8AD]
                "
              >
                No vulnerabilities found
              </p>

              <p
                className="
                  mt-1
                  text-xs
                  text-[#52786D]
                "
              >
                Try changing your search or severity filter.
              </p>
            </div>
          )}

        {/* ====================================================
            TABLE
        ==================================================== */}

        {!loading &&
          filteredVulnerabilities.length > 0 && (
            <div
              className="
                mt-4
                overflow-hidden
                rounded-xl
                bg-[#00100C]/70
              "
            >
              <div className="overflow-x-auto">

                <table
                  className="
                    w-full
                    min-w-[950px]
                    text-left
                  "
                >

                  {/* TABLE HEADER */}

                  <thead>
                    <tr
                      className="
                        border-b
                        border-[#0E4037]/70
                        text-xs
                        uppercase
                        tracking-wider
                        text-[#52786D]
                      "
                    >

                      <th className="px-5 py-4">
                        CVE ID
                      </th>

                      <th className="px-5 py-4">
                        Vulnerability
                      </th>

                      <th className="px-5 py-4">
                        Severity
                      </th>

                      <th className="px-5 py-4">
                        CVSS
                      </th>

                      <th className="px-5 py-4">
                        Affected Product
                      </th>

                      <th className="px-5 py-4">
                        Asset
                      </th>

                      <th className="px-5 py-4">
                        Action
                      </th>

                    </tr>
                  </thead>

                  {/* TABLE BODY */}

                  <tbody>

                    {filteredVulnerabilities.map(
                      (vulnerability) => (
                        <tr
                          key={
                            vulnerability.id ||
                            vulnerability.cve_id
                          }
                          className="
                            border-b
                            border-[#0B3027]/70
                            transition
                            duration-200
                            hover:bg-[#062019]/70
                          "
                        >

                          {/* CVE */}

                          <td className="px-5 py-4">

                            <span
                              className="
                                font-mono
                                text-sm
                                font-medium
                                text-[#00E0A3]
                              "
                            >
                              {vulnerability.cve_id ||
                                "—"}
                            </span>

                          </td>

                          {/* TITLE */}

                          <td className="max-w-[300px] px-5 py-4">

                            <p
                              className="
                                truncate
                                text-sm
                                font-medium
                                text-[#D7E7E1]
                              "
                            >
                              {vulnerability.title ||
                                vulnerability.description ||
                                "Unknown vulnerability"}
                            </p>

                          </td>

                          {/* SEVERITY */}

                          <td className="px-5 py-4">

                            <SeverityBadge
                              severity={
                                vulnerability.severity
                              }
                            />

                          </td>

                          {/* CVSS */}

                          <td className="px-5 py-4">

                            <span
                              className="
                                font-mono
                                text-sm
                                font-medium
                                text-white
                              "
                            >
                              {vulnerability.cvss_score ??
                                "—"}
                            </span>

                          </td>

                          {/* PRODUCT */}

                          <td className="max-w-[250px] px-5 py-4">

                            <p
                              className="
                                truncate
                                text-sm
                                text-[#789E94]
                              "
                            >
                              {vulnerability.affected_product ||
                                "—"}
                            </p>

                          </td>

                          {/* ASSET */}

                          <td className="px-5 py-4">

                            <span
                              className="
                                rounded-md
                                bg-[#000B08]
                                px-2.5
                                py-1
                                font-mono
                                text-xs
                                text-[#789E94]
                              "
                            >
                              Asset #
                              {vulnerability.asset_id ??
                                "—"}
                            </span>

                          </td>

                          {/* ACTION */}

                          <td className="px-5 py-4">

                            <button
                              type="button"
                              onClick={() =>
                                openVulnerabilityDetails(
                                  vulnerability
                                )
                              }
                              className="
                                inline-flex
                                items-center
                                gap-1.5
                                rounded-lg
                                border
                                border-[#0E4037]
                                bg-transparent
                                px-3
                                py-1.5
                                text-xs
                                font-medium
                                text-[#7EA99D]
                                transition-all
                                duration-200
                                hover:border-[#00E0A3]
                                hover:bg-[#003D2E]/30
                                hover:text-[#00E0A3]
                              "
                              title="View vulnerability details"
                            >
                              <ExternalLink
                                size={14}
                              />

                              View
                            </button>

                          </td>

                        </tr>
                      )
                    )}

                  </tbody>

                </table>
              </div>
            </div>
          )}

        {/* ====================================================
            FOOTER
        ==================================================== */}

        {!loading &&
          filteredVulnerabilities.length > 0 && (
            <div
              className="
                px-5
                py-4
              "
            >
              <p
                className="
                  text-xs
                  text-[#52786D]
                "
              >
                Showing{" "}
                <span className="text-[#91B8AD]">
                  {filteredVulnerabilities.length}
                </span>{" "}
                of{" "}
                <span className="text-[#91B8AD]">
                  {vulnerabilities.length}
                </span>{" "}
                vulnerabilities
              </p>
            </div>
          )}

      </div>

      {/* ========================================================
          VULNERABILITY DETAILS MODAL
      ======================================================== */}

      {selectedVulnerability && (
        <div
          className="
            fixed
            inset-0
            z-50
            flex
            items-center
            justify-center
            bg-black/70
            p-4
            backdrop-blur-sm
          "
          role="dialog"
          aria-modal="true"
          aria-labelledby="vulnerability-details-title"
          onClick={closeVulnerabilityDetails}
        >
          <div
            className="
              w-full
              max-w-4xl
              max-h-[90vh]
              overflow-hidden
              rounded-2xl
              border
              border-[#0E4037]
              bg-[#00100C]
              shadow-2xl
            "
            onClick={(event) =>
              event.stopPropagation()
            }
          >

            {/* MODAL HEADER */}

            <div
              className="
                flex
                items-start
                justify-between
                gap-4
                border-b
                border-[#0E4037]/70
                px-6
                py-5
              "
            >
              <div>
                <p
                  className="
                    text-xs
                    uppercase
                    tracking-[0.18em]
                    text-[#52786D]
                  "
                >
                  Vulnerability Details
                </p>

                <h2
                  id="vulnerability-details-title"
                  className="
                    mt-2
                    break-all
                    font-mono
                    text-xl
                    font-bold
                    text-[#00E0A3]
                  "
                >
                  {selectedVulnerability.cve_id ||
                    "Unknown CVE"}
                </h2>
              </div>

              <button
                type="button"
                onClick={closeVulnerabilityDetails}
                className="
                  shrink-0
                  rounded-lg
                  border
                  border-[#0E4037]
                  bg-[#000B08]
                  p-2
                  text-[#789E94]
                  transition
                  hover:border-[#00E0A3]
                  hover:bg-[#003D2E]/30
                  hover:text-[#00E0A3]
                "
                title="Close"
                aria-label="Close vulnerability details"
              >
                <X size={18} />
              </button>
            </div>

            {/* MODAL BODY */}

            <div
              className="
                max-h-[calc(90vh-90px)]
                overflow-y-auto
                px-6
                py-6
              "
            >

              {/* SUMMARY */}

              <div
                className="
                  grid
                  grid-cols-1
                  gap-4
                  sm:grid-cols-2
                  lg:grid-cols-4
                "
              >

                <div
                  className="
                    rounded-xl
                    border
                    border-[#0E4037]/70
                    bg-[#000B08]
                    p-4
                  "
                >
                  <p className="text-xs text-[#52786D]">
                    Severity
                  </p>

                  <div className="mt-2">
                    <SeverityBadge
                      severity={
                        selectedVulnerability.severity
                      }
                    />
                  </div>
                </div>

                <div
                  className="
                    rounded-xl
                    border
                    border-[#0E4037]/70
                    bg-[#000B08]
                    p-4
                  "
                >
                  <p className="text-xs text-[#52786D]">
                    CVSS Score
                  </p>

                  <p
                    className="
                      mt-2
                      font-mono
                      text-xl
                      font-semibold
                      text-white
                    "
                  >
                    {selectedVulnerability.cvss_score ??
                      "—"}
                  </p>
                </div>

                <div
                  className="
                    rounded-xl
                    border
                    border-[#0E4037]/70
                    bg-[#000B08]
                    p-4
                  "
                >
                  <p className="text-xs text-[#52786D]">
                    Asset
                  </p>

                  <p
                    className="
                      mt-2
                      text-sm
                      font-semibold
                      text-white
                    "
                  >
                    Asset #
                    {selectedVulnerability.asset_id ??
                      "—"}
                  </p>
                </div>

                <div
                  className="
                    rounded-xl
                    border
                    border-[#0E4037]/70
                    bg-[#000B08]
                    p-4
                  "
                >
                  <p className="text-xs text-[#52786D]">
                    Detected
                  </p>

                  <p
                    className="
                      mt-2
                      text-sm
                      text-[#91B8AD]
                    "
                  >
                    {selectedVulnerability.detected_at
                      ? new Date(
                          selectedVulnerability.detected_at
                        ).toLocaleString()
                      : "—"}
                  </p>
                </div>

              </div>

              {/* DESCRIPTION */}

              <div
                className="
                  mt-5
                  rounded-xl
                  border
                  border-[#0E4037]/70
                  bg-[#000B08]
                  p-5
                "
              >
                <div
                  className="
                    flex
                    items-center
                    gap-2
                  "
                >
                  <Bug
                    size={17}
                    className="text-[#00E0A3]"
                  />

                  <h3
                    className="
                      text-sm
                      font-semibold
                      text-white
                    "
                  >
                    Description
                  </h3>
                </div>

                <p
                  className="
                    mt-4
                    whitespace-pre-line
                    text-sm
                    leading-7
                    text-[#C7DAD4]
                  "
                >
                  {selectedVulnerability.description ||
                    "No description is available for this vulnerability."}
                </p>
              </div>

              {/* AFFECTED PRODUCT */}

              <div
                className="
                  mt-5
                  rounded-xl
                  border
                  border-[#0E4037]/70
                  bg-[#000B08]
                  p-5
                "
              >
                <h3
                  className="
                    text-sm
                    font-semibold
                    text-white
                  "
                >
                  Affected Product
                </h3>

                <div
                  className="
                    mt-3
                    rounded-lg
                    border
                    border-[#0B3027]
                    bg-[#00100C]
                    p-4
                  "
                >
                  <p
                    className="
                      break-all
                      font-mono
                      text-xs
                      leading-6
                      text-[#39F0A8]
                    "
                  >
                    {selectedVulnerability.affected_product ||
                      "—"}
                  </p>
                </div>
              </div>

              {/* TITLE */}

              <div
                className="
                  mt-5
                  rounded-xl
                  border
                  border-[#0E4037]/70
                  bg-[#000B08]
                  p-5
                "
              >
                <h3
                  className="
                    text-sm
                    font-semibold
                    text-white
                  "
                >
                  Vulnerability
                </h3>

                <p
                  className="
                    mt-3
                    text-sm
                    leading-6
                    text-[#91B8AD]
                  "
                >
                  {selectedVulnerability.title ||
                    "—"}
                </p>
              </div>

              {/* NVD */}

              {selectedVulnerability.cve_id && (
                <div
                  className="
                    mt-5
                    flex
                    flex-wrap
                    items-center
                    justify-between
                    gap-3
                  "
                >
                  <p className="text-xs text-[#52786D]">
                    CVE reference
                  </p>

                  <a
                    href={`https://nvd.nist.gov/vuln/detail/${encodeURIComponent(
                      selectedVulnerability.cve_id
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="
                      inline-flex
                      items-center
                      gap-2
                      rounded-lg
                      border
                      border-[#0E4037]
                      bg-transparent
                      px-4
                      py-2.5
                      text-xs
                      font-medium
                      text-[#91B8AD]
                      transition
                      hover:border-[#00E0A3]
                      hover:bg-[#003D2E]/30
                      hover:text-[#00E0A3]
                    "
                  >
                    Open NVD Details
                    <ExternalLink size={14} />
                  </a>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

    </div>
  </div>
  );
}