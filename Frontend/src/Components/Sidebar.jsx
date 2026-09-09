import {
  LayoutDashboard,
  ScanLine,
  History,
  ShieldAlert,
  FileText,
  Server,
  Settings,
  LogOut,
  ShieldCheck,
  X,
} from "lucide-react";

import { NavLink } from "react-router-dom";

const navigation = [
  {
    label: "Dashboard",
    icon: LayoutDashboard,
    path: "/dashboard",
  },
  {
    label: "New Scan",
    icon: ScanLine,
    path: "/scan/new",
  },
  {
    label: "Scan History",
    icon: History,
    path: "/scans",
  },
  {
    label: "Vulnerabilities",
    icon: ShieldAlert,
    path: "/vulnerabilities",
  },
  {
    label: "Reports",
    icon: FileText,
    path: "/reports",
  },
  {
    label: "Assets",
    icon: Server,
    path: "/assets",
  },
  {
    label: "Settings",
    icon: Settings,
    path: "/settings",
  },
];

export default function Sidebar({
  mobileOpen,
  setMobileOpen,
}) {
  return (
    <>
      {/* =====================================================
          MOBILE BACKDROP
      ===================================================== */}

      {mobileOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          onClick={() => setMobileOpen(false)}
          className="
            fixed
            inset-0
            z-40
            bg-black/60
            backdrop-blur-sm
            lg:hidden
          "
        />
      )}

      {/* =====================================================
          SIDEBAR
      ===================================================== */}

      <aside
        className={`
          fixed
          left-0
          top-0
          z-50
          flex
          h-screen
          w-64
          flex-col

          border-r
          border-emerald-400/[0.10]

          bg-[#03251D]

          shadow-[8px_0_35px_rgba(0,0,0,0.18)]

          transition-transform
          duration-300

          lg:translate-x-0

          ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >

        {/* =====================================================
            BRAND
        ===================================================== */}

        <div
          className="
            flex
            h-[76px]
            items-center
            justify-between

            border-b
            border-emerald-400/20

            px-5
          "
        >

          <div className="flex items-center gap-3">

            {/* Logo */}

            <div
              className="
                flex
                h-10
                w-10
                items-center
                justify-center

                rounded-xl

                border
                border-emerald-400/30

                bg-emerald-400/[0.07]

                text-emerald-400

                shadow-[0_0_24px_rgba(16,185,129,0.10)]
              "
            >
              <ShieldCheck
                size={23}
                strokeWidth={1.8}
              />
            </div>

            {/* Brand */}

            <div>

              <h1
                className="
                  text-[17px]
                  font-bold
                  tracking-tight
                  text-white
                "
              >
                Cyber
                <span className="text-emerald-400">
                  Guard
                </span>
              </h1>

              <p
                className="
                  mt-0.5
                  text-[9px]
                  font-medium
                  uppercase
                  tracking-[0.14em]
                  text-emerald-100/35
                "
              >
                Vulnerability Scanner
              </p>

            </div>

          </div>


          {/* Mobile close */}

          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="
              rounded-lg
              p-2

              text-emerald-100/35

              transition

              hover:bg-emerald-400/[0.06]
              hover:text-emerald-300

              lg:hidden
            "
          >
            <X size={19} />
          </button>

        </div>


        {/* =====================================================
            NAVIGATION
        ===================================================== */}

        <nav className="flex-1 overflow-y-auto px-3 py-5">

          <p
            className="
              mb-3
              px-3

              text-[10px]
              font-semibold
              uppercase
              tracking-[0.16em]

              text-emerald-100/25
            "
          >
            Workspace
          </p>


          <div className="space-y-1">

            {navigation.map((item) => {

              const Icon = item.icon;

              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) => `
                    group
                    flex
                    w-full
                    items-center
                    gap-3

                    rounded-lg

                    px-3
                    py-2.5

                    text-sm
                    font-medium

                    transition-all
                    duration-200

                    ${
                      isActive
                        ? `
                          bg-emerald-400/[0.10]

                          text-emerald-300

                          shadow-[inset_2px_0_0_#10B981]
                        `
                        : `
                          text-emerald-100/55

                          hover:bg-emerald-400/[0.045]

                          hover:text-emerald-100
                        `
                    }
                  `}
                >

                  {({ isActive }) => (
                    <>
                      <Icon
                        size={18}
                        strokeWidth={
                          isActive ? 2 : 1.7
                        }
                        className={
                          isActive
                            ? "text-emerald-400"
                            : "text-emerald-100/30 group-hover:text-emerald-300"
                        }
                      />

                      <span>
                        {item.label}
                      </span>
                    </>
                  )}

                </NavLink>
              );

            })}

          </div>

        </nav>


        {/* =====================================================
            SCANNER STATUS
        ===================================================== */}

        <div
          className="
            mx-3
            mb-4

            rounded-xl

            border
            border-emerald-400/[0.12]

            bg-emerald-400/[0.045]

            p-3.5

            shadow-[0_0_25px_rgba(16,185,129,0.04)]
          "
        >

          <div className="flex items-center gap-2">

            <span className="relative flex h-2.5 w-2.5">

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
                  h-2.5
                  w-2.5

                  rounded-full

                  bg-emerald-400

                  shadow-[0_0_10px_rgba(16,185,129,0.5)]
                "
              />

            </span>

            <span
              className="
                text-xs
                font-medium
                text-emerald-100/75
              "
            >
              Scanner Online
            </span>

          </div>

          <p
            className="
              mt-2

              text-[10px]
              leading-relaxed

              text-emerald-100/35
            "
          >
            CyberGuard protection services are operational.
          </p>

        </div>


        {/* =====================================================
            LOGOUT
        ===================================================== */}

        <div
          className="
            border-t
            border-emerald-400/[0.10]

            p-3
          "
        >

          <button
            type="button"
            className="
              group
              flex
              w-full
              items-center
              gap-3

              rounded-lg

              px-3
              py-2.5

              text-sm
              font-medium

              text-emerald-100/50

              transition

              hover:bg-red-500/[0.05]
              hover:text-red-400
            "
          >

            <LogOut
              size={18}
              className="
                text-emerald-100/30

                group-hover:text-red-400
              "
            />

            <span>
              Logout
            </span>

          </button>

        </div>


        {/* =====================================================
            FOOTER
        ===================================================== */}

        <div
          className="
            border-t
            border-emerald-400/[0.10]

            px-4
            py-3
          "
        >

          <p
            className="
              text-[9px]
              uppercase
              tracking-[0.13em]

              text-emerald-400/25
            "
          >
            CyberGuard Security Platform
          </p>

          <p
            className="
              mt-1

              text-[9px]

              text-emerald-100/20
            "
          >
            v1.0.0
          </p>

        </div>

      </aside>
    </>
  );
}