import { useEffect, useRef, useState } from "react";
import {
  ScanLine,
  ShieldCheck,
  Globe,
  Server,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowLeft,
  Radio,
  ExternalLink,
} from "lucide-react";
import { Link } from "react-router-dom";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// ============================================================
// CYBERGUARD DASHBOARD-MATCHED PARTICLE FIELD
// ============================================================

function ParticleField() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let frame;
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
          Math.min(0.82, p.alpha + Math.sin(p.phase) * 0.14)
        );

        if (p.r > 1.15) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r * 3.2, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(52, 211, 153, ${alpha * 0.065})`;
          ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(52, 211, 153, ${alpha})`;
        ctx.fill();
      });

      frame = requestAnimationFrame(animate);
    };

    resize();
    animate();

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    window.addEventListener("resize", resize);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="fixed inset-0 z-[5] h-screen w-screen pointer-events-none"
    />
  );
}

const SCAN_TYPES = {
  full: {
    title: "Full Security Scan",
    description:
      "Complete assessment combining network discovery, service detection, OS/CPE identification, CVE analysis and web security checks.",
    endpoint: "/api/scan",
    icon: ShieldCheck,
  },
  web: {
    title: "Web Security Scan",
    description:
      "Assess an authorized website for security headers, configuration weaknesses and web security findings.",
    endpoint: "/api/web-scan",
    icon: Globe,
  },
  ports: {
    title: "Port Security Scan",
    description:
      "Discover open TCP ports, running services, operating-system information, CPEs and related CVEs.",
    endpoint: "/api/scan/ports",
    icon: Radio,
  },
};

export default function NewScan() {
  const [scanType, setScanType] = useState("full");
  const [target, setTarget] = useState("127.0.0.1");
  const [portRange, setPortRange] = useState("1-1000");

  const [scanning, setScanning] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [error, setError] = useState("");

  function getErrorMessage(data) {
    if (!data) return "Scan request failed.";

    if (typeof data.detail === "string") return data.detail;

    if (Array.isArray(data.detail)) {
      return data.detail
        .map((item) => {
          if (typeof item === "string") return item;
          return item?.msg || item?.message || JSON.stringify(item);
        })
        .join(", ");
    }

    if (data.detail) {
      try {
        return JSON.stringify(data.detail);
      } catch {
        return "Scan request failed.";
      }
    }

    return data.message || data.error || "Scan request failed.";
  }

  function validateTarget(value) {
    const trimmed = value.trim();

    if (!trimmed) return "Please enter a target.";

    // Allows:
    // 127.0.0.1
    // 192.168.1.10
    // example.com
    // http://example.com
    // https://example.com/path
    const targetPattern =
      /^(https?:\/\/)?(([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}|localhost|(\d{1,3}\.){3}\d{1,3})(:\d{1,5})?(\/.*)?$/;

    if (!targetPattern.test(trimmed)) {
      return "Enter a valid IP address, hostname, or URL.";
    }

    return "";
  }

  async function checkBackendConnection() {
    console.log("Checking backend connection...");

    try {
      const response = await fetch(`${API_BASE_URL}/docs`, {
        method: "GET",
      });

      console.log("Backend connection status:", response.status);

      if (!response.ok) {
        throw new Error(
          `Backend responded with HTTP ${response.status}.`
        );
      }

      console.log("Backend connection successful.");
      return true;
    } catch (err) {
      console.error("Backend connection failed:", err);

      setError(
        `Backend is not connected. Make sure FastAPI is running at ${API_BASE_URL}.`
      );

      return false;
    }
  }

  async function startScan() {
    const targetError = validateTarget(target);

    if (targetError) {
      setError(targetError);
      return;
    }

    if ((scanType === "full" || scanType === "ports") && !portRange.trim()) {
      setError("Please enter a port range.");
      return;
    }

    setScanning(true);
    setCompleted(false);
    setScanResult(null);
    setError("");

    const selected = SCAN_TYPES[scanType];

    console.log("==============================");
    console.log("CYBERGUARD API DEBUG");
    console.log("==============================");
    console.log("Frontend API URL:", API_BASE_URL);
    console.log("Endpoint:", selected.endpoint);
    console.log("Full URL:", `${API_BASE_URL}${selected.endpoint}`);
    console.log("Target:", target.trim());
    console.log("Port Range:", portRange.trim());
    console.log("Scan Type:", scanType);

    try {
      const backendConnected = await checkBackendConnection();

      if (!backendConnected) {
        setScanning(false);
        return;
      }

      console.log("Sending scan request...");

      const body =
        scanType === "web"
          ? {
              target: target.trim(),
              port_range: portRange.trim(),
            }
          : {
              target: target.trim(),
              port_range: portRange.trim(),
            };

      const response = await fetch(
        `${API_BASE_URL}${selected.endpoint}`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(body),
        }
      );

      console.log("Scan HTTP status:", response.status);
      console.log(
        "Scan HTTP status text:",
        response.statusText
      );

      const contentType =
        response.headers.get("content-type") || "";

      console.log("Response Content-Type:", contentType);

      let data;

      if (contentType.includes("application/json")) {
        data = await response.json();
      } else {
        const text = await response.text();
        data = {
          detail:
            text || "Server returned an empty response.",
        };
      }

      console.log("BACKEND RESPONSE:", data);

      if (!response.ok) {
        const message = getErrorMessage(data);

        if (response.status === 422) {
          throw new Error(
            `Backend rejected the request (422 Validation Error): ${message}`
          );
        }

        if (response.status === 404) {
          throw new Error(
            `Endpoint not found (404). Check that ${selected.endpoint} exists in FastAPI.`
          );
        }

        if (response.status >= 500) {
          throw new Error(
            `Backend error (${response.status}): ${message}`
          );
        }

        throw new Error(message);
      }

      if (!data || typeof data !== "object") {
        throw new Error("Backend returned an invalid response.");
      }

      console.log("Scan completed successfully.");

      setScanResult(data);
      setCompleted(true);
    } catch (err) {
      console.error("==============================");
      console.error("CYBERGUARD SCAN ERROR");
      console.error("==============================");
      console.error(err);

      setError(
        err?.message ||
          "Unable to start scan. Check the backend console."
      );
    } finally {
      setScanning(false);
    }
  }

  function resetScan() {
    setScanning(false);
    setCompleted(false);
    setScanResult(null);
    setError("");
  }

  function selectScanType(type) {
    setScanType(type);
    setCompleted(false);
    setScanResult(null);
    setError("");

    if (type === "web") {
      if (
        target === "127.0.0.1" ||
        target === "192.168.1.10"
      ) {
        setTarget("http://127.0.0.1:8000");
      }
    }

    if (type !== "web" && target === "http://127.0.0.1:8000") {
      setTarget("127.0.0.1");
    }
  }

  const selected = SCAN_TYPES[scanType];
  const SelectedIcon = selected.icon;

  return (
    <div className="relative min-h-screen pb-10">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-[5] overflow-hidden"
      >
        <ParticleField />
      </div>

      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 bg-[#020907]"
      />

      <div className="relative z-10">
      <div className="mb-7">
        <p className="text-xs text-[#628F7F]">
          Security Operations /{" "}
          <span className="text-[#B6CEC2]">New Scan</span>
        </p>

        <div className="mt-2">
          <h1 className="text-3xl font-bold tracking-tight text-white">
            New Scan
          </h1>

          <p className="mt-1 text-sm text-[#729B87]">
            Choose an assessment type and scan an authorized target.
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4">
          <XCircle
            size={20}
            className="mt-0.5 shrink-0 text-red-400"
          />

          <div className="min-w-0">
            <p className="text-sm font-medium text-red-300">
              Scan failed
            </p>

            <p className="mt-1 break-words text-xs leading-5 text-red-400/90">
              {error}
            </p>
          </div>
        </div>
      )}

      {!scanning && !completed && (
        <div className="rounded-xl border border-[#0B3B2B] bg-[#061A13]">
          <div className="border-b border-[#0B3B2B] px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#00A878]/10">
                <ScanLine
                  size={20}
                  className="text-[#39F0A8]"
                />
              </div>

              <div>
                <h2 className="font-semibold text-white">
                  Scan Configuration
                </h2>

                <p className="mt-1 text-xs text-[#67927E]">
                  Select the security assessment you want to perform.
                </p>
              </div>
            </div>
          </div>

          <div className="p-6">
            <div>
              <label className="text-sm font-medium text-[#B6CEC2]">
                Scan Type
              </label>

              <p className="mt-1 text-xs text-[#67927E]">
                Each scan type produces a different security report.
              </p>

              <div className="mt-3 grid gap-3 lg:grid-cols-3">
                {Object.entries(SCAN_TYPES).map(
                  ([type, config]) => {
                    const Icon = config.icon;
                    const active = scanType === type;

                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => selectScanType(type)}
                        className={`rounded-xl border p-4 text-left transition ${
                          active
                            ? "border-[#00E39A] bg-[#00A878]/10"
                            : "border-[#0B3B2B] bg-[#04120E] hover:border-[#205541]"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                              active
                                ? "bg-[#00A878]/20"
                                : "bg-[#061A13]"
                            }`}
                          >
                            <Icon
                              size={20}
                              className={
                                active
                                  ? "text-[#39F0A8]"
                                  : "text-[#67927E]"
                              }
                            />
                          </div>

                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold text-white">
                                {config.title}
                              </p>

                              {active && (
                                <span className="rounded-full bg-[#00E39A]/10 px-2 py-0.5 text-[9px] font-medium text-[#39F0A8]">
                                  SELECTED
                                </span>
                              )}
                            </div>

                            <p className="mt-1 text-xs leading-5 text-[#5E8A76]">
                              {config.description}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  }
                )}
              </div>
            </div>

            <div className="mt-7">
              <label className="text-sm font-medium text-[#B6CEC2]">
                Target
              </label>

              <p className="mt-1 text-xs text-[#67927E]">
                Enter an authorized IP address, hostname or URL.
              </p>

              <input
                type="text"
                value={target}
                onChange={(event) =>
                  setTarget(event.target.value)
                }
                placeholder={
                  scanType === "web"
                    ? "https://example.com"
                    : "127.0.0.1"
                }
                disabled={scanning}
                className="mt-3 w-full rounded-lg border border-[#104A36] bg-[#04120E] px-4 py-3 text-sm text-white outline-none transition placeholder:text-[#426F5B] focus:border-[#00E39A] focus:ring-1 focus:ring-[#00E39A]/20 disabled:opacity-60"
              />

              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setTarget("127.0.0.1")}
                  className="rounded-md border border-[#0B3B2B] bg-[#04120E] px-2.5 py-1 text-[10px] text-[#729B87] hover:text-white"
                >
                  127.0.0.1
                </button>

                <button
                  type="button"
                  onClick={() => setTarget("192.168.1.10")}
                  className="rounded-md border border-[#0B3B2B] bg-[#04120E] px-2.5 py-1 text-[10px] text-[#729B87] hover:text-white"
                >
                  192.168.1.10
                </button>

                <button
                  type="button"
                  onClick={() => setTarget("example.com")}
                  className="rounded-md border border-[#0B3B2B] bg-[#04120E] px-2.5 py-1 text-[10px] text-[#729B87] hover:text-white"
                >
                  example.com
                </button>
              </div>
            </div>

            {(scanType === "full" || scanType === "ports") && (
              <div className="mt-6">
                <label className="text-sm font-medium text-[#B6CEC2]">
                  Port Range
                </label>

                <p className="mt-1 text-xs text-[#67927E]">
                  Specify which TCP ports should be assessed.
                </p>

                <input
                  type="text"
                  value={portRange}
                  onChange={(event) =>
                    setPortRange(event.target.value)
                  }
                  placeholder="1-1000"
                  disabled={scanning}
                  className="mt-3 w-full rounded-lg border border-[#104A36] bg-[#04120E] px-4 py-3 text-sm text-white outline-none transition placeholder:text-[#426F5B] focus:border-[#00E39A] focus:ring-1 focus:ring-[#00E39A]/20 disabled:opacity-60"
                />
              </div>
            )}

            <div className="mt-6 rounded-lg border border-[#0B3B2B] bg-[#04120E] p-4">
              <div className="flex items-start gap-3">
                <SelectedIcon
                  size={18}
                  className="mt-0.5 shrink-0 text-[#39F0A8]"
                />

                <div>
                  <p className="text-xs font-medium text-[#B6CEC2]">
                    Selected assessment
                  </p>

                  <p className="mt-1 text-sm font-semibold text-white">
                    {selected.title}
                  </p>

                  <p className="mt-1 text-xs leading-5 text-[#67927E]">
                    {selected.description}
                  </p>

                  <p className="mt-2 font-mono text-[10px] text-[#4F806B]">
                    POST {selected.endpoint}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  setTarget(
                    scanType === "web"
                      ? "http://127.0.0.1:8000"
                      : "127.0.0.1"
                  );
                  setPortRange("1-1000");
                  setError("");
                  setScanResult(null);
                  setCompleted(false);
                }}
                className="rounded-lg border border-[#104A36] bg-[#04120E] px-5 py-3 text-sm font-medium text-[#8FBDA9] transition hover:border-[#205541] hover:text-white"
              >
                Reset
              </button>

              <button
                type="button"
                onClick={startScan}
                disabled={scanning}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#00D98F] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#00E39A] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ScanLine size={17} />
                Start {scanType === "full"
                  ? "Full Scan"
                  : scanType === "web"
                  ? "Web Scan"
                  : "Port Scan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {scanning && (
        <ScanningReport
          scanType={scanType}
          target={target}
        />
      )}

      {completed && scanResult && (
        <div>
          {scanType === "full" && (
            <FullScanReport
              result={scanResult}
              target={target}
              onReset={resetScan}
            />
          )}

          {scanType === "web" && (
            <WebScanReport
              result={scanResult}
              target={target}
              onReset={resetScan}
            />
          )}

          {scanType === "ports" && (
            <PortScanReport
              result={scanResult}
              target={target}
              onReset={resetScan}
            />
          )}
        </div>
      )}
    </div>
    </div>
  );
}

function ScanningReport({ scanType, target }) {
  const config = SCAN_TYPES[scanType];
  const Icon = config.icon;

  return (
    <div className="rounded-xl border border-[#0B3B2B] bg-[#061A13] p-8">
      <div className="flex min-h-[420px] flex-col items-center justify-center text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[#00A878]/20 bg-[#00A878]/10">
          <Loader2
            size={30}
            className="animate-spin text-[#39F0A8]"
          />
        </div>

        <h2 className="mt-5 text-xl font-semibold text-white">
          {config.title} in progress
        </h2>

        <p className="mt-2 max-w-lg text-sm leading-6 text-[#729B87]">
          {scanType === "full" &&
            "CyberGuard is running network discovery, service detection, CVE analysis and web security checks."}

          {scanType === "web" &&
            "CyberGuard is analyzing the authorized web target and checking its security configuration."}

          {scanType === "ports" &&
            "CyberGuard is discovering open ports, services, operating-system information and related vulnerabilities."}
        </p>

        <div className="mt-6 flex items-center gap-3 rounded-lg border border-[#0B3B2B] bg-[#04120E] px-5 py-3">
          <Icon size={18} className="text-[#39F0A8]" />

          <div className="text-left">
            <p className="text-xs text-[#67927E]">
              Target
            </p>

            <p className="mt-1 max-w-md break-all font-mono text-sm text-[#00E39A]">
              {target}
            </p>
          </div>
        </div>

        <div className="mt-7 w-full max-w-md">
          <div className="h-1.5 overflow-hidden rounded-full bg-[#0B3B2B]">
            <div className="h-full w-2/3 animate-pulse rounded-full bg-[#00E39A]" />
          </div>

          <p className="mt-3 text-xs text-[#67927E]">
            Running security analysis...
          </p>
        </div>
      </div>
    </div>
  );
}

function ReportHeader({
  title,
  description,
  result,
  icon: Icon,
}) {
  return (
    <div className="rounded-xl border border-green-500/20 bg-[#061A13]">
      <div className="border-b border-[#0B3B2B] px-6 py-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-500/10">
              <CheckCircle2
                size={21}
                className="text-green-400"
              />
            </div>

            <div>
              <h2 className="font-semibold text-white">
                {title}
              </h2>

              <p className="mt-1 text-xs text-[#67927E]">
                {description}
              </p>
            </div>
          </div>

          <span className="hidden rounded-full border border-green-500/20 bg-green-500/10 px-3 py-1 text-xs font-medium text-green-400 sm:block">
            completed
          </span>
        </div>
      </div>

      <div className="border-b border-[#0B3B2B] px-6 py-4">
        <div className="flex items-center gap-2 text-xs text-[#67927E]">
          <Icon size={14} className="text-[#39F0A8]" />
          Scan ID:
          <span className="font-mono text-[#B6CEC2]">
            {result.scan_id || "Not provided"}
          </span>
        </div>
      </div>
    </div>
  );
}

function FullScanReport({ result, target, onReset }) {
  const network = result.network_scan || result;
  const web = result.web_scan;
  const openPorts =
    network.open_ports ||
    result.open_ports ||
    [];
  const vulnerabilities =
    network.vulnerabilities ||
    result.vulnerabilities ||
    [];
  const cveSummary =
    network.cve_summary ||
    result.cve_summary ||
    {};
  const asset =
    network.asset ||
    result.asset ||
    {};

  const score = result.security_score ?? "—";
  const grade = result.grade || "—";
  const risk =
    result.risk_level ||
    asset.risk_level ||
    "Unknown";

  return (
    <div>
      <ReportHeader
        title="Full Security Scan Completed"
        description="Network, vulnerability and web security assessment completed."
        result={result}
        icon={ShieldCheck}
      />

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ResultCard
          icon={ShieldCheck}
          label="Security Score"
          value={score}
        />

        <ResultCard
          icon={AlertTriangle}
          label="Risk Level"
          value={risk}
        />

        <ResultCard
          icon={Server}
          label="Open Ports"
          value={openPorts.length}
        />

        <ResultCard
          icon={AlertTriangle}
          label="Vulnerabilities"
          value={
            cveSummary.total ??
            vulnerabilities.length
          }
        />
      </div>

      <div className="mt-5 rounded-xl border border-[#0B3B2B] bg-[#061A13] p-6">
        <h2 className="font-semibold text-white">
          Overall Assessment
        </h2>

        <div className="mt-5 grid gap-4 sm:grid-cols-4">
          <MiniResult
            label="Grade"
            value={grade}
            className="text-[#39F0A8]"
          />

          <MiniResult
            label="Critical"
            value={cveSummary.critical ?? 0}
            className="text-red-400"
          />

          <MiniResult
            label="High"
            value={cveSummary.high ?? 0}
            className="text-orange-400"
          />

          <MiniResult
            label="Medium"
            value={cveSummary.medium ?? 0}
            className="text-yellow-400"
          />
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-[#0B3B2B] bg-[#061A13] p-6">
        <h2 className="font-semibold text-white">
          Target Information
        </h2>

        <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <InfoItem
            label="Target"
            value={result.target || target}
          />

          <InfoItem
            label="Hostname"
            value={result.hostname || asset.hostname || "Unknown"}
          />

          <InfoItem
            label="Operating System"
            value={
              network.os_detection?.name ||
              asset.operating_system ||
              "Unknown"
            }
          />

          <InfoItem
            label="CPE"
            value={network.cpe || "Not resolved"}
          />
        </div>
      </div>

      <OpenPortsSection ports={openPorts} />

      <VulnerabilitySection
        vulnerabilities={vulnerabilities}
        summary={cveSummary}
      />

      {web && (
        <WebDetailsSection
          web={web}
          findings={result.web_findings || web.findings || []}
        />
      )}

      <ReportActions onReset={onReset} />
    </div>
  );
}

function WebScanReport({ result, target, onReset }) {
  const findings =
    result.web_scan?.findings ||
    result.findings ||
    [];

  const summary = result.summary || buildFindingSummary(findings);

  return (
    <div>
      <ReportHeader
        title="Web Security Scan Completed"
        description="Web application security assessment completed."
        result={result}
        icon={Globe}
      />

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ResultCard
          icon={ShieldCheck}
          label="Security Score"
          value={result.security_score ?? "—"}
        />

        <ResultCard
          icon={AlertTriangle}
          label="Risk Level"
          value={result.risk_level || "Unknown"}
        />

        <ResultCard
          icon={Globe}
          label="HTTP Status"
          value={result.web_scan?.status_code ?? "—"}
        />

        <ResultCard
          icon={AlertTriangle}
          label="Findings"
          value={summary.total ?? findings.length}
        />
      </div>

      <div className="mt-5 rounded-xl border border-[#0B3B2B] bg-[#061A13] p-6">
        <h2 className="font-semibold text-white">
          Web Security Summary
        </h2>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <MiniResult
            label="Critical"
            value={summary.critical ?? 0}
            className="text-red-400"
          />

          <MiniResult
            label="High"
            value={summary.high ?? 0}
            className="text-orange-400"
          />

          <MiniResult
            label="Medium"
            value={summary.medium ?? 0}
            className="text-yellow-400"
          />

          <MiniResult
            label="Low"
            value={summary.low ?? 0}
            className="text-blue-400"
          />

          <MiniResult
            label="Info"
            value={summary.informational ?? 0}
            className="text-[#39F0A8]"
          />
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-[#0B3B2B] bg-[#061A13] p-6">
        <h2 className="font-semibold text-white">
          Web Target
        </h2>

        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          <InfoItem
            label="Target"
            value={result.target || target}
          />

          <InfoItem
            label="Final URL"
            value={
              result.web_scan?.final_url ||
              result.final_url ||
              "Not available"
            }
          />
        </div>
      </div>

      <FindingList findings={findings} />

      {result.web_scan?.headers_checked?.length > 0 && (
        <div className="mt-5 rounded-xl border border-[#0B3B2B] bg-[#061A13] p-6">
          <h2 className="font-semibold text-white">
            Security Headers Checked
          </h2>

          <div className="mt-4 flex flex-wrap gap-2">
            {result.web_scan.headers_checked.map(
              (header, index) => (
                <span
                  key={`${header}-${index}`}
                  className="rounded-md border border-[#104A36] bg-[#04120E] px-3 py-1.5 font-mono text-xs text-[#8FBDA9]"
                >
                  {typeof header === "string"
                    ? header
                    : JSON.stringify(header)}
                </span>
              )
            )}
          </div>
        </div>
      )}

      <ReportActions onReset={onReset} />
    </div>
  );
}

function PortScanReport({ result, target, onReset }) {
  const ports = result.open_ports || [];
  const vulnerabilities = result.vulnerabilities || [];
  const summary = result.cve_summary || {};
  const asset = result.asset || {};
  const os = result.os_detection || {};

  return (
    <div>
      <ReportHeader
        title="Port Security Scan Completed"
        description="Port discovery, service detection, OS detection and CVE assessment completed."
        result={result}
        icon={Radio}
      />

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ResultCard
          icon={Server}
          label="Open Ports"
          value={
            result.total_open_ports ??
            ports.length
          }
        />

        <ResultCard
          icon={Server}
          label="Services"
          value={(asset.services || []).length}
        />

        <ResultCard
          icon={AlertTriangle}
          label="CVEs"
          value={summary.total ?? vulnerabilities.length}
        />

        <ResultCard
          icon={ShieldCheck}
          label="Risk Level"
          value={
            asset.risk_level ||
            result.risk_level ||
            "Unknown"
          }
        />
      </div>

      <div className="mt-5 rounded-xl border border-[#0B3B2B] bg-[#061A13] p-6">
        <h2 className="font-semibold text-white">
          Asset Discovery
        </h2>

        <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <InfoItem
            label="Target"
            value={result.target || target}
          />

          <InfoItem
            label="Hostname"
            value={asset.hostname || "Unknown"}
          />

          <InfoItem
            label="Operating System"
            value={os.name || asset.operating_system || "Unknown"}
          />

          <InfoItem
            label="CPE"
            value={result.cpe || "Not resolved"}
          />
        </div>
      </div>

      <OpenPortsSection ports={ports} />

      <VulnerabilitySection
        vulnerabilities={vulnerabilities}
        summary={summary}
      />

      {result.cve_error && (
        <div className="mt-5 rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4">
          <p className="text-sm font-medium text-yellow-300">
            CVE lookup warning
          </p>

          <p className="mt-1 text-xs text-yellow-400/80">
            {result.cve_error}
          </p>
        </div>
      )}

      <ReportActions onReset={onReset} />
    </div>
  );
}

function OpenPortsSection({ ports }) {
  if (!ports?.length) {
    return (
      <div className="mt-5 rounded-xl border border-[#0B3B2B] bg-[#061A13] p-6">
        <h2 className="font-semibold text-white">
          Open Ports
        </h2>

        <p className="mt-2 text-sm text-[#5E8A76]">
          No open TCP ports were reported by the scanner.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-5 rounded-xl border border-[#0B3B2B] bg-[#061A13]">
      <div className="border-b border-[#0B3B2B] px-6 py-5">
        <h2 className="font-semibold text-white">
          Open Ports
        </h2>

        <p className="mt-1 text-xs text-[#67927E]">
          TCP services discovered during the scan.
        </p>
      </div>

      <div className="divide-y divide-[#083222]">
        {ports.map((port, index) => (
          <div
            key={`${port.port}-${port.protocol}-${index}`}
            className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-center gap-4">
              <span className="rounded-md bg-[#04120E] px-3 py-1 font-mono text-sm text-[#00E39A]">
                {port.port}
              </span>

              <div>
                <p className="text-sm text-white">
                  {port.service || "Unknown service"}
                </p>

                <p className="mt-1 text-xs text-[#67927E]">
                  {port.product || "Product unknown"}
                  {" • "}
                  {port.protocol?.toUpperCase() || "TCP"}
                </p>
              </div>
            </div>

            <span className="text-xs font-medium text-green-400">
              {port.state || "open"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function VulnerabilitySection({ vulnerabilities, summary }) {
  return (
    <div className="mt-5 rounded-xl border border-[#0B3B2B] bg-[#061A13]">
      <div className="border-b border-[#0B3B2B] px-6 py-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-semibold text-white">
              Vulnerability Report
            </h2>

            <p className="mt-1 text-xs text-[#67927E]">
              CVEs identified during the assessment.
            </p>
          </div>

          <span className="text-xl font-bold text-white">
            {summary.total ?? vulnerabilities.length}
          </span>
        </div>
      </div>

      <div className="divide-y divide-[#083222]">
        {vulnerabilities.length === 0 ? (
          <div className="px-6 py-6">
            <p className="text-sm text-[#5E8A76]">
              No CVE vulnerabilities were returned.
            </p>
          </div>
        ) : (
          vulnerabilities.slice(0, 20).map(
            (vulnerability, index) => (
              <div
                key={`${vulnerability.cve_id || "cve"}-${index}`}
                className="flex flex-col gap-3 px-6 py-4 lg:flex-row lg:items-center lg:justify-between"
              >
                <div className="min-w-0">
                  <p className="font-mono text-sm font-medium text-[#39F0A8]">
                    {vulnerability.cve_id || "Unknown CVE"}
                  </p>

                  {vulnerability.description && (
                    <p className="mt-1 max-w-4xl text-xs leading-5 text-[#729B87]">
                      {vulnerability.description}
                    </p>
                  )}

                  {vulnerability.affected_product && (
                    <p className="mt-1 font-mono text-[10px] text-[#67927E]">
                      {vulnerability.affected_product}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  {vulnerability.cvss_score != null && (
                    <span className="text-sm font-semibold text-white">
                      CVSS {vulnerability.cvss_score}
                    </span>
                  )}

                  <SeverityBadge
                    severity={vulnerability.severity}
                  />
                </div>
              </div>
            )
          )
        )}
      </div>

      {vulnerabilities.length > 20 && (
        <div className="border-t border-[#0B3B2B] px-6 py-4">
          <p className="text-xs text-[#67927E]">
            Showing first 20 of {vulnerabilities.length} vulnerabilities.
          </p>
        </div>
      )}
    </div>
  );
}

function FindingList({ findings }) {
  return (
    <div className="mt-5 rounded-xl border border-[#0B3B2B] bg-[#061A13]">
      <div className="border-b border-[#0B3B2B] px-6 py-5">
        <h2 className="font-semibold text-white">
          Web Security Findings
        </h2>

        <p className="mt-1 text-xs text-[#67927E]">
          Security issues returned by the web scanner.
        </p>
      </div>

      {findings.length === 0 ? (
        <div className="px-6 py-6">
          <p className="text-sm text-[#5E8A76]">
            No web security findings were returned.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-[#083222]">
          {findings.map((finding, index) => (
            <div
              key={`${finding.title || "finding"}-${index}`}
              className="px-6 py-5"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-white">
                    {finding.title || "Security Finding"}
                  </p>

                  {finding.category && (
                    <p className="mt-1 text-[10px] uppercase tracking-wider text-[#67927E]">
                      {finding.category}
                    </p>
                  )}
                </div>

                <SeverityBadge
                  severity={finding.severity}
                />
              </div>

              {finding.description && (
                <p className="mt-3 text-xs leading-6 text-[#729B87]">
                  {finding.description}
                </p>
              )}

              {finding.recommendation && (
                <div className="mt-3 rounded-lg border border-[#0B3B2B] bg-[#04120E] p-3">
                  <p className="text-[10px] uppercase tracking-wider text-[#67927E]">
                    Recommendation
                  </p>

                  <p className="mt-1 text-xs leading-5 text-[#8FBDA9]">
                    {finding.recommendation}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function WebDetailsSection({ web, findings }) {
  return (
    <div className="mt-5 rounded-xl border border-[#0B3B2B] bg-[#061A13] p-6">
      <h2 className="font-semibold text-white">
        Web Security Details
      </h2>

      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <InfoItem
          label="HTTP Status"
          value={web.status_code ?? "Unknown"}
        />

        <InfoItem
          label="Final URL"
          value={web.final_url || "Unknown"}
        />
      </div>

      <div className="mt-5">
        <p className="text-xs text-[#67927E]">
          Web Findings
        </p>

        <p className="mt-1 text-sm text-white">
          {findings.length}
        </p>
      </div>
    </div>
  );
}

function InfoItem({ label, value }) {
  return (
    <div>
      <p className="text-xs text-[#67927E]">
        {label}
      </p>

      <p className="mt-1 break-all text-sm text-white">
        {String(value ?? "Unknown")}
      </p>
    </div>
  );
}

function ResultCard({ icon: Icon, label, value }) {
  return (
    <div className="rounded-xl border border-[#0B3B2B] bg-[#04120E] p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-[#67927E]">
            {label}
          </p>

          <p className="mt-2 text-2xl font-bold capitalize text-white">
            {value}
          </p>
        </div>

        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#00A878]/10">
          <Icon
            size={19}
            className="text-[#39F0A8]"
          />
        </div>
      </div>
    </div>
  );
}

function MiniResult({ label, value, className }) {
  return (
    <div className="rounded-lg border border-[#0B3B2B] bg-[#04120E] p-4">
      <p className="text-[10px] uppercase tracking-wider text-[#67927E]">
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

function SeverityBadge({ severity }) {
  const normalized = String(
    severity || "UNKNOWN"
  ).toUpperCase();

  let className =
    "border-[#0B3B2B] bg-[#04120E] text-[#729B87]";

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

function ReportActions({ onReset }) {
  return (
    <div className="mt-5 flex flex-wrap justify-end gap-3">
      <Link
        to="/dashboard"
        className="inline-flex items-center gap-2 rounded-lg border border-[#104A36] bg-[#061E15] px-4 py-2.5 text-sm font-medium text-[#8FBDA9] transition hover:border-[#00A878] hover:text-[#00E39A]"
      >
        <ArrowLeft size={16} />
        Dashboard
      </Link>

      <Link
        to="/scan-history"
        className="inline-flex items-center gap-2 rounded-lg border border-[#104A36] bg-[#061E15] px-4 py-2.5 text-sm font-medium text-[#8FBDA9] transition hover:border-[#00A878] hover:text-[#00E39A]"
      >
        <ExternalLink size={16} />
        Scan History
      </Link>

      <button
        type="button"
        onClick={onReset}
        className="inline-flex items-center gap-2 rounded-lg bg-[#00D98F] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#00E39A]"
      >
        <ScanLine size={16} />
        Scan Again
      </button>
    </div>
  );
}

function buildFindingSummary(findings) {
  const summary = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    informational: 0,
    total: findings.length,
  };

  findings.forEach((finding) => {
    const severity = String(
      finding?.severity || ""
    ).toLowerCase();

    if (severity in summary) {
      summary[severity] += 1;
    }
  });

  return summary;
}
