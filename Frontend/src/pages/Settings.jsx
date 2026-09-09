import { useEffect, useRef, useState } from "react";

import {
  Settings as SettingsIcon,
  Server,
  ShieldCheck,
  Bell,
  Palette,
  Save,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Loader2,
  Trash2,
} from "lucide-react";

// ============================================================
// CONFIGURATION
// ============================================================

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const DEFAULT_SETTINGS = {
  defaultScanType: "full",
  defaultPortRange: "1-1000",
  scanTimeout: "60",
  autoSaveResults: true,

  scanCompletedNotification: true,
  scanFailedNotification: true,
  criticalNotification: true,

  confirmBeforeScan: true,
};

// ============================================================
// SETTINGS PAGE
// ============================================================

export default function Settings() {
  const [settings, setSettings] = useState(
    DEFAULT_SETTINGS
  );

  const [saved, setSaved] = useState(false);

  const [testingConnection, setTestingConnection] =
    useState(false);

  const [connectionStatus, setConnectionStatus] =
    useState("unknown");

  const [connectionMessage, setConnectionMessage] =
    useState("");

  // ==========================================================
  // LOAD SETTINGS
  // ==========================================================

  useEffect(() => {
    try {
      const storedSettings =
        localStorage.getItem(
          "cyberguard_settings"
        );

      if (storedSettings) {
        const parsedSettings =
          JSON.parse(storedSettings);

        setSettings({
          ...DEFAULT_SETTINGS,
          ...parsedSettings,
        });
      }
    } catch (error) {
      console.error(
        "Unable to load settings:",
        error
      );
    }

    // Test backend automatically
    testBackendConnection();
  }, []);

  // ==========================================================
  // UPDATE SETTING
  // ==========================================================

  function updateSetting(key, value) {
    setSettings((previous) => ({
      ...previous,
      [key]: value,
    }));

    setSaved(false);
  }

  // ==========================================================
  // SAVE SETTINGS
  // ==========================================================

  function saveSettings() {
    try {
      localStorage.setItem(
        "cyberguard_settings",
        JSON.stringify(settings)
      );

      setSaved(true);

      setTimeout(() => {
        setSaved(false);
      }, 3000);
    } catch (error) {
      console.error(
        "Unable to save settings:",
        error
      );
    }
  }

  // ==========================================================
  // RESET SETTINGS
  // ==========================================================

  function resetSettings() {
    const confirmed =
      window.confirm(
        "Reset all CyberGuard settings to their default values?"
      );

    if (!confirmed) {
      return;
    }

    setSettings(DEFAULT_SETTINGS);

    localStorage.setItem(
      "cyberguard_settings",
      JSON.stringify(DEFAULT_SETTINGS)
    );

    setSaved(true);

    setTimeout(() => {
      setSaved(false);
    }, 3000);
  }

  // ==========================================================
  // TEST BACKEND CONNECTION
  // ==========================================================

  async function testBackendConnection() {
    try {
      setTestingConnection(true);

      setConnectionStatus(
        "checking"
      );

      setConnectionMessage(
        "Checking backend connection..."
      );

      console.log(
        "Checking CyberGuard backend..."
      );

      const response = await fetch(
        `${API_BASE_URL}/api/dashboard/summary`,
        {
          method: "GET",
          credentials: "include",
          headers: {
            Accept: "application/json",
          },
        }
      );

      console.log(
        "Backend status:",
        response.status
      );

      if (!response.ok) {
        throw new Error(
          `Backend returned HTTP ${response.status}`
        );
      }

      const data =
        await response.json();

      console.log(
        "Backend response:",
        data
      );

      setConnectionStatus(
        "connected"
      );

      setConnectionMessage(
        "CyberGuard backend is connected and responding."
      );
    } catch (error) {
      console.error(
        "Backend connection failed:",
        error
      );

      setConnectionStatus(
        "disconnected"
      );

      setConnectionMessage(
        error?.message ||
          "Unable to connect to the backend."
      );
    } finally {
      setTestingConnection(false);
    }
  }

  // ==========================================================
  // CLEAR LOCAL SETTINGS
  // ==========================================================

  function clearLocalSettings() {
    const confirmed =
      window.confirm(
        "Clear locally stored CyberGuard settings?"
      );

    if (!confirmed) {
      return;
    }

    localStorage.removeItem(
      "cyberguard_settings"
    );

    setSettings(
      DEFAULT_SETTINGS
    );

    setSaved(true);

    setTimeout(() => {
      setSaved(false);
    }, 3000);
  }

  // ==========================================================
  // PAGE
  // ==========================================================

  return (
    <div className="relative min-h-full overflow-hidden bg-[#010604]">

      {/* ====================================================
          MOVING EMERALD PARTICLES
      ===================================================== */}

      <Particles
        quantity={500}
        color="#10B981"
        className="z-0 opacity-60"
      />

      {/* ====================================================
          ATMOSPHERIC EMERALD GLOW
      ===================================================== */}

      <div
        className="
          pointer-events-none
          absolute
          left-1/2
          top-[25%]
          z-0
          h-[550px]
          w-[750px]
          -translate-x-1/2
          rounded-full
          bg-emerald-500/[0.035]
          blur-[130px]
        "
      />

      <div
        className="
          pointer-events-none
          absolute
          left-[5%]
          top-[55%]
          z-0
          h-[300px]
          w-[300px]
          rounded-full
          bg-emerald-400/[0.025]
          blur-[100px]
        "
      />

      {/* ====================================================
          ACTUAL SETTINGS CONTENT
      ===================================================== */}

      <div className="relative z-10 pb-10">

        {/* ====================================================
            HEADER
        ===================================================== */}

        <div>

          <p className="text-xs text-[#5C8F7D]">
            Security Operations /{" "}
            <span className="text-[#9BC7B5]">
              Settings
            </span>
          </p>

          <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">
            Settings
          </h1>

          <p className="mt-1 text-sm text-[#719D8E]">
            Configure CyberGuard and scanner
            preferences.
          </p>

        </div>


        {/* ====================================================
            SAVE MESSAGE
        ===================================================== */}

        {saved && (

          <div
            className="
              mt-6
              flex
              items-center
              gap-3
              rounded-xl
              border
              border-emerald-500/20
              bg-emerald-500/[0.08]
              p-4
              shadow-[0_0_25px_rgba(16,185,129,0.05)]
            "
          >

            <CheckCircle2
              size={19}
              className="text-emerald-400"
            />

            <p className="text-sm text-emerald-300">
              Settings saved successfully.
            </p>

          </div>

        )}


        {/* ====================================================
            SCANNER CONFIGURATION
        ===================================================== */}

        <section
          className="
            mt-7
            rounded-xl
            border
            border-emerald-500/20
            bg-[#03100C]/90
            shadow-[0_0_30px_rgba(16,185,129,0.025)]
            backdrop-blur-sm
          "
        >

          <SectionHeader
            icon={ShieldCheck}
            title="Scanner Configuration"
            description="Configure the default behavior of security scans."
          />

          <div className="p-6">

            {/* DEFAULT SCAN TYPE */}

            <div>

              <label className="text-sm font-medium text-[#9BC7B5]">
                Default Scan Type
              </label>

              <p className="mt-1 text-xs text-[#4F806E]">
                Select the scan type that should be
                selected by default on the New Scan page.
              </p>

              <select
                value={
                  settings.defaultScanType
                }
                onChange={(event) =>
                  updateSetting(
                    "defaultScanType",
                    event.target.value
                  )
                }
                className="
                  mt-3
                  w-full
                  rounded-lg
                  border
                  border-emerald-500/20
                  bg-[#020A07]
                  px-4
                  py-3
                  text-sm
                  text-white
                  outline-none
                  transition
                  focus:border-emerald-400/60
                  focus:ring-1
                  focus:ring-emerald-400/20
                  sm:max-w-xl
                "
              >

                <option value="full">
                  Full Security Scan
                </option>

                <option value="web">
                  Web Security Scan
                </option>

                <option value="ports">
                  Port Security Scan
                </option>

              </select>

            </div>


            {/* PORT RANGE */}

            <div className="mt-6">

              <label className="text-sm font-medium text-[#9BC7B5]">
                Default Port Range
              </label>

              <p className="mt-1 text-xs text-[#4F806E]">
                Default TCP port range used for
                full and port scans.
              </p>

              <input
                type="text"
                value={
                  settings.defaultPortRange
                }
                onChange={(event) =>
                  updateSetting(
                    "defaultPortRange",
                    event.target.value
                  )
                }
                placeholder="1-1000"
                className="
                  mt-3
                  w-full
                  rounded-lg
                  border
                  border-emerald-500/20
                  bg-[#020A07]
                  px-4
                  py-3
                  text-sm
                  text-white
                  outline-none
                  placeholder:text-[#315B4B]
                  transition
                  focus:border-emerald-400/60
                  focus:ring-1
                  focus:ring-emerald-400/20
                  sm:max-w-xl
                "
              />

            </div>


            {/* TIMEOUT */}

            <div className="mt-6">

              <label className="text-sm font-medium text-[#9BC7B5]">
                Scan Timeout
              </label>

              <p className="mt-1 text-xs text-[#4F806E]">
                Maximum amount of time allowed for a
                scan operation.
              </p>

              <div className="mt-3 flex items-center gap-3">

                <input
                  type="number"
                  min="10"
                  max="3600"
                  value={
                    settings.scanTimeout
                  }
                  onChange={(event) =>
                    updateSetting(
                      "scanTimeout",
                      event.target.value
                    )
                  }
                  className="
                    w-full
                    rounded-lg
                    border
                    border-emerald-500/20
                    bg-[#020A07]
                    px-4
                    py-3
                    text-sm
                    text-white
                    outline-none
                    transition
                    focus:border-emerald-400/60
                    focus:ring-1
                    focus:ring-emerald-400/20
                    sm:max-w-[220px]
                  "
                />

                <span className="text-sm text-[#4F806E]">
                  seconds
                </span>

              </div>

            </div>


            {/* AUTO SAVE */}

            <div className="mt-6">

              <ToggleRow
                title="Automatically save scan results"
                description="Keep completed scan results available in Scan History and Reports."
                checked={
                  settings.autoSaveResults
                }
                onChange={(value) =>
                  updateSetting(
                    "autoSaveResults",
                    value
                  )
                }
              />

            </div>

          </div>

        </section>


        {/* ====================================================
            BACKEND CONNECTION
        ===================================================== */}

        <section
          className="
            mt-5
            rounded-xl
            border
            border-emerald-500/20
            bg-[#03100C]/90
            shadow-[0_0_30px_rgba(16,185,129,0.025)]
            backdrop-blur-sm
          "
        >

          <SectionHeader
            icon={Server}
            title="Backend Connection"
            description="Monitor the connection between the CyberGuard frontend and API."
          />

          <div className="p-6">

            <div>

              <p className="text-xs uppercase tracking-wider text-[#4F806E]">
                API URL
              </p>

              <p className="mt-2 break-all font-mono text-sm text-emerald-400">
                {API_BASE_URL}
              </p>

            </div>


            {/* STATUS */}

            <div
              className="
                mt-5
                flex
                flex-col
                gap-4
                rounded-lg
                border
                border-emerald-500/15
                bg-[#020A07]
                p-4
                sm:flex-row
                sm:items-center
                sm:justify-between
              "
            >

              <div className="flex items-start gap-3">

                {connectionStatus ===
                  "connected" && (

                  <CheckCircle2
                    size={20}
                    className="mt-0.5 text-emerald-400"
                  />

                )}

                {connectionStatus ===
                  "disconnected" && (

                  <XCircle
                    size={20}
                    className="mt-0.5 text-red-400"
                  />

                )}

                {connectionStatus ===
                  "checking" && (

                  <Loader2
                    size={20}
                    className="
                      mt-0.5
                      animate-spin
                      text-emerald-400
                    "
                  />

                )}

                {connectionStatus ===
                  "unknown" && (

                  <Server
                    size={20}
                    className="mt-0.5 text-[#4F806E]"
                  />

                )}


                <div>

                  <p className="text-sm font-medium text-white">

                    {connectionStatus ===
                    "connected"
                      ? "Backend Connected"
                      : connectionStatus ===
                        "disconnected"
                      ? "Backend Disconnected"
                      : connectionStatus ===
                        "checking"
                      ? "Checking Connection"
                      : "Connection Status Unknown"}

                  </p>

                  <p className="mt-1 text-xs text-[#4F806E]">
                    {connectionMessage}
                  </p>

                </div>

              </div>


              <button
                type="button"
                onClick={
                  testBackendConnection
                }
                disabled={
                  testingConnection
                }
                className="
                  inline-flex
                  shrink-0
                  items-center
                  justify-center
                  gap-2
                  rounded-lg
                  border
                  border-emerald-500/25
                  bg-emerald-500/[0.06]
                  px-4
                  py-2.5
                  text-sm
                  font-medium
                  text-[#9BC7B5]
                  transition
                  hover:border-emerald-400/60
                  hover:bg-emerald-500/[0.08]
                  hover:text-emerald-300
                  disabled:cursor-not-allowed
                  disabled:opacity-50
                "
              >

                {testingConnection ? (
                  <Loader2
                    size={16}
                    className="animate-spin"
                  />
                ) : (
                  <Server
                    size={16}
                  />
                )}

                Test Connection

              </button>

            </div>

          </div>

        </section>


        {/* ====================================================
            NOTIFICATIONS
        ===================================================== */}

        <section
          className="
            mt-5
            rounded-xl
            border
            border-emerald-500/20
            bg-[#03100C]/90
            shadow-[0_0_30px_rgba(16,185,129,0.025)]
            backdrop-blur-sm
          "
        >

          <SectionHeader
            icon={Bell}
            title="Notifications"
            description="Choose which security events should be highlighted."
          />

          <div className="divide-y divide-emerald-500/10">

            <ToggleRow
              title="Scan completed"
              description="Show a notification when a security scan finishes successfully."
              checked={
                settings.scanCompletedNotification
              }
              onChange={(value) =>
                updateSetting(
                  "scanCompletedNotification",
                  value
                )
              }
            />

            <ToggleRow
              title="Scan failed"
              description="Show a notification when a scan cannot be completed."
              checked={
                settings.scanFailedNotification
              }
              onChange={(value) =>
                updateSetting(
                  "scanFailedNotification",
                  value
                )
              }
            />

            <ToggleRow
              title="Critical vulnerability detected"
              description="Highlight scans containing critical security findings."
              checked={
                settings.criticalNotification
              }
              onChange={(value) =>
                updateSetting(
                  "criticalNotification",
                  value
                )
              }
            />

          </div>

        </section>


        {/* ====================================================
            SECURITY
        ===================================================== */}

        <section
          className="
            mt-5
            rounded-xl
            border
            border-emerald-500/20
            bg-[#03100C]/90
            shadow-[0_0_30px_rgba(16,185,129,0.025)]
            backdrop-blur-sm
          "
        >

          <SectionHeader
            icon={ShieldCheck}
            title="Security Preferences"
            description="Control confirmation behavior before potentially sensitive operations."
          />

          <div className="divide-y divide-emerald-500/10">

            <ToggleRow
              title="Confirm before starting a scan"
              description="Ask for confirmation before submitting a scan request."
              checked={
                settings.confirmBeforeScan
              }
              onChange={(value) =>
                updateSetting(
                  "confirmBeforeScan",
                  value
                )
              }
            />

          </div>

        </section>


        {/* ====================================================
            APPEARANCE
        ===================================================== */}

        <section
          className="
            mt-5
            rounded-xl
            border
            border-emerald-500/20
            bg-[#03100C]/90
            shadow-[0_0_30px_rgba(16,185,129,0.025)]
            backdrop-blur-sm
          "
        >

          <SectionHeader
            icon={Palette}
            title="Appearance"
            description="Current CyberGuard interface appearance."
          />

          <div className="p-6">

            <div
              className="
                rounded-lg
                border
                border-emerald-500/15
                bg-[#020A07]
                p-4
              "
            >

              <p className="text-sm font-medium text-white">
                Dark Security Interface
              </p>

              <p className="mt-1 text-xs text-[#4F806E]">
                CyberGuard currently uses the dark
                security operations interface.
              </p>

              <div
                className="
                  mt-3
                  inline-flex
                  items-center
                  gap-2
                  rounded-full
                  border
                  border-emerald-500/20
                  bg-emerald-500/[0.05]
                  px-3
                  py-1.5
                "
              >

                <span
                  className="
                    h-2
                    w-2
                    rounded-full
                    bg-emerald-400
                    shadow-[0_0_10px_rgba(16,185,129,0.8)]
                  "
                />

                <span className="text-xs text-[#9BC7B5]">
                  Active
                </span>

              </div>

            </div>

          </div>

        </section>


        {/* ====================================================
            DANGER ZONE
        ===================================================== */}

        <section
          className="
            mt-5
            rounded-xl
            border
            border-red-500/20
            bg-[#03100C]/90
            shadow-[0_0_30px_rgba(16,185,129,0.02)]
            backdrop-blur-sm
          "
        >

          <div
            className="
              border-b
              border-red-500/10
              px-6
              py-5
            "
          >

            <div className="flex items-center gap-3">

              <div
                className="
                  flex
                  h-10
                  w-10
                  items-center
                  justify-center
                  rounded-xl
                  bg-red-500/10
                "
              >

                <Trash2
                  size={19}
                  className="text-red-400"
                />

              </div>

              <div>

                <h2 className="font-semibold text-white">
                  Danger Zone
                </h2>

                <p className="mt-1 text-xs text-[#4F806E]">
                  Actions affecting locally stored
                  application preferences.
                </p>

              </div>

            </div>

          </div>


          <div
            className="
              flex
              flex-col
              gap-4
              p-6
              sm:flex-row
              sm:items-center
              sm:justify-between
            "
          >

            <div>

              <p className="text-sm font-medium text-white">
                Clear local settings
              </p>

              <p className="mt-1 text-xs text-[#4F806E]">
                Remove saved CyberGuard preferences
                from this browser.
              </p>

            </div>


            <button
              type="button"
              onClick={
                clearLocalSettings
              }
              className="
                inline-flex
                items-center
                justify-center
                gap-2
                rounded-lg
                border
                border-red-500/30
                bg-red-500/10
                px-4
                py-2.5
                text-sm
                font-medium
                text-red-400
                transition
                hover:bg-red-500/20
              "
            >

              <Trash2
                size={16}
              />

              Clear Settings

            </button>

          </div>

        </section>


        {/* ====================================================
            BOTTOM ACTIONS
        ===================================================== */}

        <div
          className="
            mt-6
            flex
            flex-col-reverse
            gap-3
            sm:flex-row
            sm:justify-end
          "
        >

          <button
            type="button"
            onClick={
              resetSettings
            }
            className="
              inline-flex
              items-center
              justify-center
              gap-2
              rounded-lg
              border
              border-emerald-500/20
              bg-[#020A07]
              px-5
              py-3
              text-sm
              font-medium
              text-[#9BC7B5]
              transition
              hover:border-emerald-400/50
              hover:bg-emerald-500/[0.04]
              hover:text-white
            "
          >

            <RotateCcw
              size={16}
            />

            Reset Defaults

          </button>


          <button
            type="button"
            onClick={
              saveSettings
            }
            className="
              inline-flex
              items-center
              justify-center
              gap-2
              rounded-lg
              bg-emerald-500
              px-6
              py-3
              text-sm
              font-semibold
              text-white
              transition
              hover:bg-emerald-400
              hover:shadow-[0_0_25px_rgba(16,185,129,0.18)]
              active:scale-[0.98]
            "
          >

            <Save
              size={16}
            />

            Save Changes

          </button>

        </div>

      </div>

    </div>
  );
}


// ============================================================
// SECTION HEADER
// ============================================================

function SectionHeader({
  icon: Icon,
  title,
  description,
}) {
  return (

    <div
      className="
        border-b
        border-emerald-500/15
        px-6
        py-5
      "
    >

      <div className="flex items-center gap-3">

        <div
          className="
            flex
            h-10
            w-10
            items-center
            justify-center
            rounded-xl
            bg-emerald-500/10
            shadow-[0_0_18px_rgba(16,185,129,0.05)]
          "
        >

          <Icon
            size={20}
            className="text-emerald-400"
          />

        </div>

        <div>

          <h2 className="font-semibold text-white">
            {title}
          </h2>

          <p className="mt-1 text-xs text-[#4F806E]">
            {description}
          </p>

        </div>

      </div>

    </div>
  );
}


// ============================================================
// TOGGLE ROW
// ============================================================

function ToggleRow({
  title,
  description,
  checked,
  onChange,
}) {
  return (

    <div
      className="
        flex
        flex-col
        gap-4
        px-6
        py-5
        sm:flex-row
        sm:items-center
        sm:justify-between
      "
    >

      <div>

        <p className="text-sm font-medium text-white">
          {title}
        </p>

        <p
          className="
            mt-1
            max-w-2xl
            text-xs
            leading-5
            text-[#4F806E]
          "
        >
          {description}
        </p>

      </div>


      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() =>
          onChange(!checked)
        }
        className={`
          relative
          h-6
          w-11
          shrink-0
          rounded-full
          transition
          ${
            checked
              ? "bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.25)]"
              : "bg-[#12352A]"
          }
        `}
      >

        <span
          className={`
            absolute
            top-1
            h-4
            w-4
            rounded-full
            bg-white
            transition
            ${
              checked
                ? "left-6"
                : "left-1"
            }
          `}
        />

      </button>

    </div>
  );
}


// ============================================================
// MOVING EMERALD PARTICLES
// ============================================================

function Particles({
  quantity = 90,
  color = "#10B981",
  className = "",
}) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas =
      canvasRef.current;

    if (!canvas) return;

    const ctx =
      canvas.getContext("2d");

    if (!ctx) return;

    const reduced =
      window
        .matchMedia(
          "(prefers-reduced-motion: reduce)"
        )
        .matches;

    const dpr =
      Math.min(
        window.devicePixelRatio || 1,
        2
      );

    let particles = [];

    let raf = 0;

    let width = 0;

    let height = 0;


    const resize = () => {

      const rect =
        canvas.getBoundingClientRect();

      width = rect.width;

      height = rect.height;

      canvas.width =
        width * dpr;

      canvas.height =
        height * dpr;

      ctx.setTransform(
        dpr,
        0,
        0,
        dpr,
        0,
        0
      );


      particles =
        Array.from(
          {
            length: quantity,
          },
          () => ({
            x:
              Math.random() *
              width,

            y:
              Math.random() *
              height,

            vx:
              (Math.random() - 0.5) *
              0.22,

            vy:
              (Math.random() - 0.5) *
              0.22,

            size:
              Math.random() *
                1.5 +
              0.4,

            alpha:
              Math.random() *
                0.4 +
              0.08,

            twinkle:
              Math.random() *
                0.012 +
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

      for (
        const p of particles
      ) {

        ctx.beginPath();

        ctx.arc(
          p.x,
          p.y,
          p.size,
          0,
          Math.PI * 2
        );

        ctx.fillStyle =
          color;

        ctx.globalAlpha =
          p.alpha;

        ctx.fill();

        ctx.globalAlpha =
          1;
      }
    };


    const tick = () => {

      for (
        const p of particles
      ) {

        p.x =
          (p.x +
            p.vx +
            width) %
          width;

        p.y =
          (p.y +
            p.vy +
            height) %
          height;

        p.alpha +=
          p.twinkle;


        if (
          p.alpha > 0.55 ||
          p.alpha < 0.08
        ) {
          p.twinkle *= -1;
        }
      }

      draw();

      raf =
        requestAnimationFrame(
          tick
        );
    };


    resize();


    if (reduced) {

      draw();

    } else {

      raf =
        requestAnimationFrame(
          tick
        );
    }


    const resizeObserver =
      new ResizeObserver(
        resize
      );

    resizeObserver.observe(
      canvas
    );


    return () => {

      cancelAnimationFrame(
        raf
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