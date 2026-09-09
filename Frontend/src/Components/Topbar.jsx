import {
  Menu,
  Search,
  Bell,
  ChevronDown,
  ShieldCheck,
} from "lucide-react";

import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Topbar({ onMenuClick }) {

  // ==========================================================
  // AUTHENTICATION
  // ==========================================================

  const {
    user,
    logout,
  } = useAuth();

  const navigate = useNavigate();


  // ==========================================================
  // USER DATA
  // ==========================================================

  const fullName =
    user?.full_name || "User";

  const role =
    user?.role === "admin"
      ? "Administrator"
      : "User";


  // ==========================================================
  // INITIALS
  // ==========================================================

  const initials = fullName
    .trim()
    .split(/\s+/)
    .map((name) => name[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();


  // ==========================================================
  // LOGOUT
  // ==========================================================

  async function handleLogout() {

    try {

      await logout();

      navigate(
        "/login",
        { replace: true }
      );

    } catch (error) {

      console.error(
        "Logout failed:",
        error
      );

      navigate(
        "/login",
        { replace: true }
      );
    }
  }


  return (
    <header
      className="
        sticky
        top-0
        z-30

        h-[76px]

        border-b
        border-emerald-400/[0.10]

        bg-[#041F19]/98

        backdrop-blur-xl

        shadow-[0_8px_30px_rgba(0,0,0,0.15)]
      "
    >

      <div
        className="
          flex
          h-full
          items-center
          justify-between
          gap-4

          px-4
          sm:px-6
          lg:px-8
        "
      >

        {/* ==================================================
            LEFT
        ================================================== */}

        <div className="flex items-center gap-3">

          {/* Mobile menu */}

          <button
            type="button"
            onClick={onMenuClick}
            className="
              rounded-lg

              border
              border-emerald-400/[0.12]

              bg-emerald-400/[0.035]

              p-2

              text-emerald-100/40

              transition

              hover:border-emerald-400/25
              hover:bg-emerald-400/[0.07]
              hover:text-emerald-300

              lg:hidden
            "
          >
            <Menu size={20} />
          </button>


          {/* Breadcrumb */}

          <div
            className="
              hidden

              items-center
              gap-2

              text-xs

              text-emerald-100/35

              lg:flex
            "
          >

            <ShieldCheck
              size={15}
              className="text-emerald-400"
            />

            <span>
              Security Operations
            </span>

            <span className="text-emerald-400/20">
              /
            </span>

            <span className="text-emerald-100/65">
              Dashboard
            </span>

          </div>

        </div>


        {/* ==================================================
            RIGHT
        ================================================== */}

        <div className="flex items-center gap-2 sm:gap-3">


          {/* SEARCH */}

          <div
            className="
              hidden

              h-10
              w-56

              items-center
              gap-2

              rounded-lg

              border
              border-emerald-400/[0.10]

              bg-emerald-400/[0.035]

              px-3

              backdrop-blur-xl

              md:flex
              lg:w-64
            "
          >

            <Search
              size={16}
              className="
                shrink-0
                text-emerald-100/30
              "
            />

            <input
              type="text"
              placeholder="Search..."
              className="
                min-w-0
                flex-1

                bg-transparent

                text-xs
                text-white

                outline-none

                placeholder:text-emerald-100/20
              "
            />

            <kbd
              className="
                rounded

                border
                border-emerald-400/[0.10]

                bg-emerald-400/[0.035]

                px-1.5
                py-0.5

                text-[9px]

                text-emerald-100/30
              "
            >
              /
            </kbd>

          </div>


          {/* MOBILE SEARCH */}

          <button
            type="button"
            className="
              rounded-lg

              border
              border-emerald-400/[0.12]

              bg-emerald-400/[0.035]

              p-2.5

              text-emerald-100/40

              transition

              hover:border-emerald-400/25
              hover:bg-emerald-400/[0.07]
              hover:text-emerald-300

              md:hidden
            "
          >
            <Search size={18} />
          </button>


          {/* NOTIFICATIONS */}

          <button
            type="button"
            className="
              relative

              rounded-lg

              border
              border-emerald-400/[0.12]

              bg-emerald-400/[0.035]

              p-2.5

              text-emerald-100/40

              transition

              hover:border-emerald-400/25
              hover:bg-emerald-400/[0.07]
              hover:text-emerald-300
            "
          >

            <Bell size={18} />

            <span
              className="
                absolute
                -right-1
                -top-1

                flex
                h-4
                w-4

                items-center
                justify-center

                rounded-full

                border-2
                border-[#061916]

                bg-red-500

                text-[8px]
                font-bold
                text-white
              "
            >
              3
            </span>

          </button>


          {/* DIVIDER */}

          <div
            className="
              mx-1

              hidden

              h-8
              w-px

              bg-emerald-400/[0.10]

              sm:block
            "
          />


          {/* USER */}

          <div className="relative group">

            <button
              type="button"
              className="
                flex
                items-center
                gap-2

                rounded-lg

                px-1.5
                py-1.5

                transition

                hover:bg-emerald-400/[0.035]
              "
            >

              {/* Avatar */}

              <div
                className="
                  flex
                  h-9
                  w-9

                  items-center
                  justify-center

                  rounded-full

                  border
                  border-emerald-400/25

                  bg-emerald-400/[0.08]

                  text-emerald-300

                  shadow-[0_0_18px_rgba(16,185,129,0.08)]
                "
              >

                <span className="text-xs font-bold">
                  {initials}
                </span>

              </div>


              {/* User name */}

              <div className="hidden text-left sm:block">

                <p
                  className="
                    text-xs
                    font-semibold
                    text-white
                  "
                >
                  {fullName}
                </p>

                <p
                  className="
                    mt-0.5

                    text-[10px]

                    text-emerald-100/30
                  "
                >
                  {role}
                </p>

              </div>


              <ChevronDown
                size={15}
                className="
                  hidden

                  text-emerald-100/30

                  sm:block
                "
              />

            </button>


            {/* ==================================================
                USER DROPDOWN
            ================================================== */}

            <div
              className="
                invisible

                absolute
                right-0
                top-full

                mt-2

                w-48

                translate-y-1

                rounded-xl

                border
                border-emerald-400/[0.12]

                bg-[#071B17]

                p-2

                opacity-0

                shadow-[0_20px_50px_rgba(0,0,0,0.35)]

                backdrop-blur-2xl

                transition-all
                duration-150

                group-hover:visible
                group-hover:translate-y-0
                group-hover:opacity-100
              "
            >

              {/* User information */}

              <div
                className="
                  border-b
                  border-emerald-400/[0.08]

                  px-3
                  py-2.5
                "
              >

                <p
                  className="
                    truncate

                    text-xs
                    font-semibold

                    text-white
                  "
                >
                  {fullName}
                </p>

                <p
                  className="
                    mt-1

                    truncate

                    text-[10px]

                    text-emerald-100/30
                  "
                >
                  {user?.email}
                </p>

              </div>


              {/* Sign out */}

              <button
                type="button"
                onClick={handleLogout}
                className="
                  mt-1

                  w-full

                  rounded-lg

                  px-3
                  py-2

                  text-left

                  text-xs

                  text-red-400

                  transition

                  hover:bg-red-500/10
                  hover:text-red-300
                "
              >
                Sign out
              </button>

            </div>

          </div>

        </div>

      </div>

    </header>
  );
}