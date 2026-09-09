import { useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  RefreshCw,
  Server,
  ShieldCheck,
  ShieldAlert,
  Network,
  Monitor,
  ExternalLink,
  AlertTriangle,
} from "lucide-react";

import { getAssets } from "../api/cyberguardApi";

export default function Assets() {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  async function loadAssets() {
    try {
      setLoading(true);
      setError("");

      const data = await getAssets();

      /*
       * Supports both:
       *   { assets: [...] }
       * and
       *   [...]
       */
      const assetList = Array.isArray(data)
        ? data
        : data.assets || [];

      setAssets(assetList);
    } catch (err) {
      console.error(err);

      setError(
        "Unable to connect to the CyberGuard asset API."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAssets();
  }, []);

  const filteredAssets = useMemo(() => {
    const searchText = search.toLowerCase().trim();

    if (!searchText) {
      return assets;
    }

    return assets.filter((asset) => {
      const ip =
        asset.ip_address?.toLowerCase() || "";

      const hostname =
        asset.hostname?.toLowerCase() || "";

      const operatingSystem =
        asset.operating_system?.toLowerCase() || "";

      const services = Array.isArray(asset.services)
        ? asset.services.join(" ").toLowerCase()
        : String(asset.services || "").toLowerCase();

      return (
        ip.includes(searchText) ||
        hostname.includes(searchText) ||
        operatingSystem.includes(searchText) ||
        services.includes(searchText)
      );
    });
  }, [assets, search]);

  const statistics = useMemo(() => {
    const total = assets.length;

    const highRisk = assets.filter(
      (asset) =>
        asset.risk_level?.toUpperCase() === "HIGH"
    ).length;

    const mediumRisk = assets.filter(
      (asset) =>
        asset.risk_level?.toUpperCase() === "MEDIUM"
    ).length;

    const lowRisk = assets.filter(
      (asset) =>
        asset.risk_level?.toUpperCase() === "LOW"
    ).length;

    return {
      total,
      highRisk,
      mediumRisk,
      lowRisk,
    };
  }, [assets]);

  return (
    <div className="relative min-h-full overflow-hidden bg-[#010604]">

      {/* =====================================================
          MOVING CYBER PARTICLES
      ===================================================== */}

      <Particles
        quantity={85}
        color="#10B981"
        className="z-0 opacity-70"
      />

      {/* Subtle emerald atmospheric glow */}
      <div
        className="
          pointer-events-none
          absolute
          left-1/2
          top-[35%]
          z-0
          h-[500px]
          w-[700px]
          -translate-x-1/2
          rounded-full
          bg-emerald-500/[0.035]
          blur-[120px]
        "
      />

      {/* =====================================================
          EXISTING PAGE CONTENT
      ===================================================== */}

      <div className="relative z-10">

        {/* Breadcrumb */}
        <div className="text-sm text-[#5C8F7D]">
          Security Operations

          <span className="mx-2 text-[#174A3A]">
            /
          </span>

          <span className="text-[#9BC7B5]">
            Assets
          </span>
        </div>

        {/* Header */}
        <div className="mt-3 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">

          <div>
            <h1 className="text-3xl font-bold text-white">
              Assets
            </h1>

            <p className="mt-1 text-sm text-[#719D8E]">
              Discover, monitor and assess your connected assets.
            </p>
          </div>

          <button
            onClick={loadAssets}
            disabled={loading}
            className="
              inline-flex
              items-center
              justify-center
              gap-2
              rounded-lg
              border
              border-emerald-500/30
              bg-emerald-950/30
              px-4
              py-2.5
              text-sm
              font-medium
              text-[#9BC7B5]
              transition-all
              duration-300
              hover:border-emerald-400/70
              hover:bg-emerald-500/10
              hover:text-emerald-300
              hover:shadow-[0_0_25px_rgba(16,185,129,0.12)]
              disabled:cursor-not-allowed
              disabled:opacity-50
            "
          >
            <RefreshCw
              size={16}
              className={loading ? "animate-spin" : ""}
            />

            Refresh
          </button>

        </div>

        {/* Error */}
        {error && (
          <div className="mt-6 flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4">

            <AlertTriangle
              size={20}
              className="mt-0.5 shrink-0 text-red-400"
            />

            <div>
              <p className="font-medium text-red-300">
                Asset API connection failed
              </p>

              <p className="mt-1 text-sm text-red-300/70">
                {error}
              </p>
            </div>

          </div>
        )}

        {/* =====================================================
            STATISTICS
        ===================================================== */}

        <div className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

          <StatCard
            title="Discovered Assets"
            value={statistics.total}
            icon={Server}
            iconClass="text-emerald-400"
            iconBg="bg-emerald-500/10"
          />

          <StatCard
            title="High Risk"
            value={statistics.highRisk}
            icon={ShieldAlert}
            iconClass="text-red-400"
            iconBg="bg-red-500/10"
          />

          <StatCard
            title="Medium Risk"
            value={statistics.mediumRisk}
            icon={ShieldAlert}
            iconClass="text-yellow-400"
            iconBg="bg-yellow-500/10"
          />

          <StatCard
            title="Low Risk"
            value={statistics.lowRisk}
            icon={ShieldCheck}
            iconClass="text-emerald-400"
            iconBg="bg-emerald-500/10"
          />

        </div>

        {/* =====================================================
            ASSETS PANEL
        ===================================================== */}

        <div
          className="
            mt-6
            overflow-hidden
            rounded-xl
            border
            border-emerald-500/20
            bg-[#03100C]/90
            shadow-[0_0_40px_rgba(16,185,129,0.025)]
            backdrop-blur-sm
          "
        >

          {/* Toolbar */}
          <div
            className="
              flex
              flex-col
              gap-4
              border-b
              border-emerald-500/15
              p-5
              lg:flex-row
              lg:items-center
              lg:justify-between
            "
          >

            <div className="relative w-full lg:max-w-md">

              <Search
                size={18}
                className="
                  absolute
                  left-3
                  top-1/2
                  -translate-y-1/2
                  text-[#4F806E]
                "
              />

              <input
                type="text"
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search IP, hostname, OS, service..."
                className="
                  w-full
                  rounded-lg
                  border
                  border-emerald-500/20
                  bg-[#020A07]
                  py-2.5
                  pl-10
                  pr-4
                  text-sm
                  text-white
                  outline-none
                  placeholder:text-[#456B5D]
                  transition
                  focus:border-emerald-400/60
                  focus:ring-1
                  focus:ring-emerald-400/20
                "
              />

            </div>

            <div className="flex items-center gap-2 text-sm text-[#5C8F7D]">

              <Network size={16} />

              <span>
                {filteredAssets.length} asset
                {filteredAssets.length !== 1 ? "s" : ""}
              </span>

            </div>

          </div>

          {/* Loading */}
          {loading && (
            <div className="flex min-h-[300px] items-center justify-center">

              <div className="flex items-center gap-3 text-sm text-[#719D8E]">

                <RefreshCw
                  size={18}
                  className="animate-spin text-emerald-400"
                />

                Loading assets...

              </div>

            </div>
          )}

          {/* Empty */}
          {!loading &&
            !error &&
            filteredAssets.length === 0 && (
              <div className="flex min-h-[300px] flex-col items-center justify-center text-center">

                <Server
                  size={42}
                  className="text-emerald-900"
                />

                <p className="mt-4 text-sm font-medium text-[#9BC7B5]">
                  No assets found
                </p>

                <p className="mt-1 text-xs text-[#5C8F7D]">
                  Run a scan to discover assets.
                </p>

              </div>
            )}

          {/* =====================================================
              TABLE
          ===================================================== */}

          {!loading &&
            filteredAssets.length > 0 && (
              <div className="overflow-x-auto">

                <table className="w-full min-w-[1100px] text-left">

                  <thead>
                    <tr
                      className="
                        border-b
                        border-emerald-500/15
                        text-xs
                        uppercase
                        tracking-wider
                        text-[#5C8F7D]
                      "
                    >

                      <th className="px-5 py-4">
                        IP Address
                      </th>

                      <th className="px-5 py-4">
                        Hostname
                      </th>

                      <th className="px-5 py-4">
                        Operating System
                      </th>

                      <th className="px-5 py-4">
                        Open Ports
                      </th>

                      <th className="px-5 py-4">
                        Services
                      </th>

                      <th className="px-5 py-4">
                        Risk
                      </th>

                      <th className="px-5 py-4">
                        Last Scanned
                      </th>

                      <th className="px-5 py-4">
                        Action
                      </th>

                    </tr>
                  </thead>

                  <tbody>

                    {filteredAssets.map((asset) => {

                      const ports = parsePorts(
                        asset.open_ports
                      );

                      const services = parseServices(
                        asset.services
                      );

                      return (
                        <tr
                          key={asset.id || asset.ip_address}
                          className="
                            border-b
                            border-emerald-500/10
                            transition-all
                            duration-300
                            hover:bg-emerald-500/[0.035]
                          "
                        >

                          {/* IP */}
                          <td className="px-5 py-5">

                            <div className="flex items-center gap-3">

                              <div
                                className="
                                  flex
                                  h-9
                                  w-9
                                  items-center
                                  justify-center
                                  rounded-lg
                                  border
                                  border-emerald-500/15
                                  bg-emerald-500/[0.07]
                                "
                              >
                                <Monitor
                                  size={17}
                                  className="text-emerald-400"
                                />
                              </div>

                              <div>

                                <p className="font-mono text-sm font-medium text-[#D8E8E1]">
                                  {asset.ip_address || "—"}
                                </p>

                                <p className="text-xs text-[#4F806E]">
                                  Asset #{asset.id}
                                </p>

                              </div>

                            </div>

                          </td>

                          {/* Hostname */}
                          <td className="px-5 py-5">

                            <span className="text-sm text-[#83AB9C]">
                              {asset.hostname || "—"}
                            </span>

                          </td>

                          {/* OS */}
                          <td className="max-w-[250px] px-5 py-5">

                            <div className="flex items-center gap-2">

                              <Monitor
                                size={16}
                                className="shrink-0 text-[#4F806E]"
                              />

                              <span className="truncate text-sm text-[#83AB9C]">
                                {asset.operating_system ||
                                  "Unknown"}
                              </span>

                            </div>

                          </td>

                          {/* Ports */}
                          <td className="px-5 py-5">

                            {ports.length > 0 ? (
                              <div className="flex flex-wrap gap-1.5">

                                {ports
                                  .slice(0, 4)
                                  .map((port) => (
                                    <span
                                      key={port}
                                      className="
                                        rounded-md
                                        border
                                        border-emerald-500/10
                                        bg-[#020A07]
                                        px-2
                                        py-1
                                        font-mono
                                        text-xs
                                        text-[#8FBBAA]
                                      "
                                    >
                                      {port}
                                    </span>
                                  ))}

                                {ports.length > 4 && (
                                  <span className="text-xs text-[#4F806E]">
                                    +{ports.length - 4}
                                  </span>
                                )}

                              </div>
                            ) : (
                              <span className="text-sm text-[#4F806E]">
                                —
                              </span>
                            )}

                          </td>

                          {/* Services */}
                          <td className="max-w-[220px] px-5 py-5">

                            {services.length > 0 ? (
                              <div className="flex flex-col gap-1">

                                {services
                                  .slice(0, 3)
                                  .map((service) => (
                                    <span
                                      key={service}
                                      className="truncate text-xs text-[#83AB9C]"
                                    >
                                      {service}
                                    </span>
                                  ))}

                                {services.length > 3 && (
                                  <span className="text-xs text-[#4F806E]">
                                    +{services.length - 3} more
                                  </span>
                                )}

                              </div>
                            ) : (
                              <span className="text-sm text-[#4F806E]">
                                —
                              </span>
                            )}

                          </td>

                          {/* Risk */}
                          <td className="px-5 py-5">

                            <RiskBadge
                              risk={asset.risk_level}
                            />

                          </td>

                          {/* Last scanned */}
                          <td className="px-5 py-5">

                            <span className="text-xs text-[#83AB9C]">
                              {formatDate(
                                asset.last_scanned
                              )}
                            </span>

                          </td>

                          {/* Action */}
                          <td className="px-5 py-5">

                            <button
                              className="
                                inline-flex
                                items-center
                                gap-1.5
                                rounded-md
                                border
                                border-emerald-500/20
                                px-3
                                py-1.5
                                text-xs
                                font-medium
                                text-[#79A995]
                                transition-all
                                duration-300
                                hover:border-emerald-400/60
                                hover:bg-emerald-500/[0.06]
                                hover:text-emerald-300
                              "
                              title="View asset details"
                            >
                              <ExternalLink size={14} />
                              View
                            </button>

                          </td>

                        </tr>
                      );
                    })}

                  </tbody>

                </table>

              </div>
            )}

          {/* Footer */}
          {!loading &&
            filteredAssets.length > 0 && (
              <div className="border-t border-emerald-500/10 px-5 py-3">

                <p className="text-xs text-[#4F806E]">

                  Showing{" "}

                  <span className="text-[#9BC7B5]">
                    {filteredAssets.length}
                  </span>{" "}

                  of{" "}

                  <span className="text-[#9BC7B5]">
                    {assets.length}
                  </span>{" "}

                  discovered assets.

                </p>

              </div>
            )}

        </div>

      </div>
    </div>
  );
}


/* =========================================================
   MOVING PARTICLES
========================================================= */

function Particles({
  quantity = 80,
  color = "#10B981",
  className = "",
}) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    const reduced =
      window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;

    const dpr = Math.min(
      window.devicePixelRatio || 1,
      2
    );

    let particles = [];
    let animationFrame = 0;
    let width = 0;
    let height = 0;

    const hexToRgb = (hex) => {
      const clean = hex.replace("#", "");

      const bigint = parseInt(clean, 16);

      return {
        r: (bigint >> 16) & 255,
        g: (bigint >> 8) & 255,
        b: bigint & 255,
      };
    };

    const rgb = hexToRgb(color);

    const resize = () => {
      const rect =
        canvas.getBoundingClientRect();

      width = rect.width;
      height = rect.height;

      canvas.width = width * dpr;
      canvas.height = height * dpr;

      ctx.setTransform(
        dpr,
        0,
        0,
        dpr,
        0,
        0
      );

      particles = Array.from(
        { length: quantity },
        () => ({
          x: Math.random() * width,
          y: Math.random() * height,

          vx:
            (Math.random() - 0.5) *
            0.22,

          vy:
            (Math.random() - 0.5) *
            0.22,

          size:
            Math.random() * 1.5 +
            0.5,

          alpha:
            Math.random() * 0.45 +
            0.08,

          twinkle:
            Math.random() * 0.012 +
            0.004,
        })
      );
    };

    const draw = () => {
      ctx.clearRect(
        0,
        0,
        width,
        height
      );

      for (const particle of particles) {
        ctx.beginPath();

        ctx.arc(
          particle.x,
          particle.y,
          particle.size,
          0,
          Math.PI * 2
        );

        ctx.fillStyle = `
          rgba(
            ${rgb.r},
            ${rgb.g},
            ${rgb.b},
            ${particle.alpha}
          )
        `;

        ctx.fill();

        /*
         * Very subtle glow around brighter particles
         */
        if (particle.alpha > 0.35) {
          ctx.beginPath();

          ctx.arc(
            particle.x,
            particle.y,
            particle.size * 3.5,
            0,
            Math.PI * 2
          );

          ctx.fillStyle = `
            rgba(
              ${rgb.r},
              ${rgb.g},
              ${rgb.b},
              ${particle.alpha * 0.08}
            )
          `;

          ctx.fill();
        }
      }
    };

    const tick = () => {
      for (const particle of particles) {

        particle.x =
          (particle.x +
            particle.vx +
            width) %
          width;

        particle.y =
          (particle.y +
            particle.vy +
            height) %
          height;

        particle.alpha +=
          particle.twinkle;

        if (
          particle.alpha > 0.55 ||
          particle.alpha < 0.08
        ) {
          particle.twinkle *= -1;
        }
      }

      draw();

      animationFrame =
        requestAnimationFrame(tick);
    };

    resize();

    if (reduced) {
      draw();
    } else {
      animationFrame =
        requestAnimationFrame(tick);
    }

    const resizeObserver =
      new ResizeObserver(resize);

    resizeObserver.observe(canvas);

    return () => {
      cancelAnimationFrame(
        animationFrame
      );

      resizeObserver.disconnect();
    };
  }, [quantity, color]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`
        pointer-events-none
        absolute
        inset-0
        h-full
        w-full
        ${className}
      `}
    />
  );
}


/* =========================================================
   STAT CARD
========================================================= */

function StatCard({
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
        border-emerald-500/20
        bg-[#03100C]/90
        p-5
        transition-all
        duration-300
        hover:border-emerald-400/35
        hover:bg-[#04150F]
        hover:shadow-[0_0_30px_rgba(16,185,129,0.04)]
      "
    >

      <div className="flex items-start justify-between">

        <div>

          <p className="text-sm text-[#719D8E]">
            {title}
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


/* =========================================================
   RISK BADGE
========================================================= */

function RiskBadge({ risk }) {
  const normalized =
    risk?.toUpperCase() || "UNKNOWN";

  const styles = {
    HIGH:
      "border-red-500/30 bg-red-500/10 text-red-400",

    MEDIUM:
      "border-yellow-500/30 bg-yellow-500/10 text-yellow-400",

    LOW:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",

    UNKNOWN:
      "border-emerald-900/40 bg-[#020A07] text-[#789D8E]",
  };

  return (
    <span
      className={`
        inline-flex
        rounded-md
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


/* =========================================================
   PARSE PORTS
========================================================= */

function parsePorts(openPorts) {
  if (!openPorts) {
    return [];
  }

  if (Array.isArray(openPorts)) {
    return openPorts
      .map((port) => {
        if (typeof port === "object") {
          return port.port;
        }

        return port;
      })
      .filter(Boolean);
  }

  try {
    const parsed = JSON.parse(openPorts);

    if (Array.isArray(parsed)) {
      return parsed
        .map((port) => {
          if (typeof port === "object") {
            return port.port;
          }

          return port;
        })
        .filter(Boolean);
    }
  } catch {
    // Ignore invalid JSON and try simple text parsing.
  }

  return String(openPorts)
    .split(",")
    .map((port) => port.trim())
    .filter(Boolean);
}


/* =========================================================
   PARSE SERVICES
========================================================= */

function parseServices(services) {
  if (!services) {
    return [];
  }

  if (Array.isArray(services)) {
    return services.filter(Boolean);
  }

  try {
    const parsed = JSON.parse(services);

    if (Array.isArray(parsed)) {
      return parsed.filter(Boolean);
    }
  } catch {
    // Ignore invalid JSON and use comma-separated values.
  }

  return String(services)
    .split(",")
    .map((service) => service.trim())
    .filter(Boolean);
}


/* =========================================================
   DATE FORMATTER
========================================================= */

function formatDate(dateValue) {
  if (!dateValue) {
    return "—";
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return dateValue;
  }

  return date.toLocaleString([], {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}