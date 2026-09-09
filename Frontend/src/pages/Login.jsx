import { useState } from "react";
import { Eye, EyeOff, ShieldCheck, ArrowRight } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import { RetroGrid } from "../Components/velora/retro-grid";
import { Typewriter } from "../Components/velora/typewriter";

import { useAuth } from "../context/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const { login, checkSession } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");

    if (!email.trim()) {
      setError("Please enter your email.");
      return;
    }

    if (!password) {
      setError("Please enter your password.");
      return;
    }

    try {
      setLoading(true);

      await login(email.trim(), password);

// Refresh the complete authenticated user data
// before entering the dashboard.
await checkSession();

navigate("/dashboard", {
  replace: true,
});
    } catch (err) {
      setError(err.message || "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      className="
        relative
        min-h-screen
        overflow-hidden
        bg-[#061318]
        text-white
      "
    >

      {/* =====================================================
          ANIMATED BACKGROUND
      ===================================================== */}

      <div
        className="
          pointer-events-none
          absolute
          inset-0
          z-0
          overflow-hidden
        "
      >

        {/* Moving Retro Grid */}

        <RetroGrid
          className="z-0"
          angle={55}
          cellSize={56}
          opacity={0.48}
        />

        {/* Network animation */}

        <div
          className="
            absolute
            inset-0
            z-[1]
            opacity-35
          "
        >
          
        </div>

        {/* Emerald center glow */}

        <div
          className="
            absolute
            left-1/2
            top-1/2
            h-[600px]
            w-[600px]
            -translate-x-1/2
            -translate-y-1/2
            rounded-full
            bg-emerald-400/[0.045]
            blur-[140px]
          "
        />

        {/* Small moving glow */}

        <div
          className="
            absolute
            left-[20%]
            top-[30%]
            h-32
            w-32
            animate-pulse
            rounded-full
            bg-emerald-400/[0.08]
            blur-[70px]
          "
        />

        <div
          className="
            absolute
            right-[15%]
            bottom-[20%]
            h-40
            w-40
            animate-pulse
            rounded-full
            bg-emerald-300/[0.05]
            blur-[80px]
            [animation-delay:1.5s]
          "
        />

      </div>


      {/* =====================================================
          NAVIGATION
      ===================================================== */}

      <nav
        className="
          relative
          z-30
          mx-auto
          flex
          h-20
          max-w-7xl
          items-center
          justify-between
          border-b
          border-white/[0.06]
          px-6
          md:px-10
          lg:px-12
        "
      >

        {/* Logo */}

        <Link
          to="/"
          className="
            flex
            items-center
            gap-3
          "
        >

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
              bg-emerald-400/[0.08]
              shadow-[0_0_25px_rgba(16,185,129,0.08)]
            "
          >

            <ShieldCheck
              size={20}
              strokeWidth={1.8}
              className="text-emerald-400"
            />

          </div>


          <div className="flex flex-col">

            <span
              className="
                text-sm
                font-bold
                tracking-[0.2em]
              "
            >
              CYBERGUARD
            </span>

            <span
              className="
                text-[8px]
                tracking-[0.28em]
                text-emerald-400/50
              "
            >
              SECURITY INTELLIGENCE
            </span>

          </div>

        </Link>


        {/* Register */}

        <p
          className="
            text-xs
            text-white/40
          "
        >

          New here?{" "}

          <Link
            to="/register"
            className="
              font-semibold
              text-emerald-400
              transition
              duration-300
              hover:text-emerald-300
            "
          >
            Create account
          </Link>

        </p>

      </nav>


      {/* =====================================================
          LOGIN AREA
      ===================================================== */}

      <section
        className="
          relative
          z-10
          flex
          min-h-[calc(100vh-80px)]
          items-center
          justify-center
          px-6
          py-16
        "
      >

        <div
          className="
            relative
            z-20
            w-full
            max-w-[440px]
          "
        >

          {/* =================================================
              TOP STATUS
          ================================================= */}

          <div
            className="
              mb-8
              text-center
            "
          >

            <div
              className="
                mb-5
                inline-flex
                items-center
                gap-2
                rounded-full
                border
                border-emerald-400/20
                bg-emerald-400/[0.05]
                px-5
                py-2.5
                backdrop-blur-xl
              "
            >

              <span
                className="
                  h-1.5
                  w-1.5
                  animate-pulse
                  rounded-full
                  bg-emerald-400
                  shadow-[0_0_14px_#10B981]
                "
              />

              <span
                className="
                  text-[10px]
                  font-medium
                  uppercase
                  tracking-[0.25em]
                  text-emerald-300/70
                "
              >
                Secure Access
              </span>

            </div>


            {/* Heading */}

            <h1
              className="
                text-4xl
                font-black
                tracking-[-0.05em]
                sm:text-5xl
              "
            >
              Welcome back.
            </h1>


            {/* Typewriter */}

            <div
              className="
                mt-4
                min-h-[28px]
                text-sm
                font-medium
                text-emerald-400
              "
            >

              <Typewriter
                words={[
                  "Protect your digital surface.",
                  "Analyze your security posture.",
                  "Monitor exposed services.",
                  "Stay ahead of vulnerabilities.",
                ]}
                typeSpeed={55}
                deleteSpeed={35}
                holdTime={1700}
                loop
                cursor
              />

            </div>


            <p
              className="
                mx-auto
                mt-4
                max-w-sm
                text-sm
                leading-6
                text-white/40
              "
            >
              Sign in to manage your security posture
              and start a new assessment.
            </p>

          </div>


          {/* =================================================
              LOGIN CARD
          ================================================= */}

          <div
            className="
              relative
              overflow-hidden
              rounded-2xl
              border
              border-emerald-400/15
              bg-[#07171c]/80
              p-6
              shadow-[0_0_80px_rgba(16,185,129,0.06)]
              backdrop-blur-2xl
              sm:p-8
            "
          >

            {/* Card glow */}

            <div
              className="
                pointer-events-none
                absolute
                -right-20
                -top-20
                h-40
                w-40
                rounded-full
                bg-emerald-400/[0.08]
                blur-[70px]
              "
            />


            {/* Top animated line */}

            <div
              className="
                absolute
                left-0
                right-0
                top-0
                h-px
                bg-gradient-to-r
                from-transparent
                via-emerald-400/50
                to-transparent
              "
            />


            {/* Error */}

            {error && (
              <div
                className="
                  relative
                  z-10
                  mb-5
                  rounded-xl
                  border
                  border-red-400/25
                  bg-red-400/10
                  px-4
                  py-3
                  text-sm
                  text-red-200
                "
              >
                {error}
              </div>
            )}


            {/* FORM */}

            <form
              onSubmit={handleSubmit}
              className="
                relative
                z-10
                space-y-5
              "
            >

              {/* EMAIL */}

              <div>

                <label
                  htmlFor="email"
                  className="
                    mb-2
                    block
                    text-xs
                    font-medium
                    text-white/60
                  "
                >
                  Email address
                </label>

                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) =>
                    setEmail(event.target.value)
                  }
                  placeholder="you@example.com"
                  autoComplete="email"
                  className="
                    w-full
                    rounded-xl
                    border
                    border-white/10
                    bg-black/20
                    px-4
                    py-3.5
                    text-sm
                    text-white
                    outline-none
                    transition
                    duration-300
                    placeholder:text-white/20
                    focus:border-emerald-400/50
                    focus:bg-emerald-400/[0.025]
                    focus:ring-4
                    focus:ring-emerald-400/[0.08]
                  "
                />

              </div>


              {/* PASSWORD */}

              <div>

                <label
                  htmlFor="password"
                  className="
                    mb-2
                    block
                    text-xs
                    font-medium
                    text-white/60
                  "
                >
                  Password
                </label>


                <div className="relative">

                  <input
                    id="password"
                    type={
                      showPassword
                        ? "text"
                        : "password"
                    }
                    value={password}
                    onChange={(event) =>
                      setPassword(event.target.value)
                    }
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    className="
                      w-full
                      rounded-xl
                      border
                      border-white/10
                      bg-black/20
                      px-4
                      py-3.5
                      pr-12
                      text-sm
                      text-white
                      outline-none
                      transition
                      duration-300
                      placeholder:text-white/20
                      focus:border-emerald-400/50
                      focus:bg-emerald-400/[0.025]
                      focus:ring-4
                      focus:ring-emerald-400/[0.08]
                    "
                  />


                  <button
                    type="button"
                    onClick={() =>
                      setShowPassword(!showPassword)
                    }
                    className="
                      absolute
                      right-3
                      top-1/2
                      -translate-y-1/2
                      rounded-md
                      p-1.5
                      text-white/30
                      transition
                      hover:text-emerald-400
                    "
                    aria-label={
                      showPassword
                        ? "Hide password"
                        : "Show password"
                    }
                  >

                    {showPassword ? (
                      <EyeOff size={18} />
                    ) : (
                      <Eye size={18} />
                    )}

                  </button>

                </div>

              </div>


              {/* LOGIN BUTTON */}

              <button
                type="submit"
                disabled={loading}
                className="
                  group
                  relative
                  mt-2
                  flex
                  w-full
                  items-center
                  justify-center
                  gap-3
                  overflow-hidden
                  rounded-xl
                  bg-emerald-400
                  px-4
                  py-3.5
                  text-sm
                  font-semibold
                  text-[#031014]
                  shadow-[0_0_30px_rgba(16,185,129,0.12)]
                  transition
                  duration-300
                  hover:bg-emerald-300
                  hover:shadow-[0_0_45px_rgba(16,185,129,0.22)]
                  disabled:cursor-not-allowed
                  disabled:opacity-50
                "
              >

                {/* Button shine */}

                <span
                  className="
                    absolute
                    inset-0
                    -translate-x-full
                    bg-white/20
                    transition
                    duration-700
                    group-hover:translate-x-full
                  "
                />

                <span className="relative z-10">

                  {loading
                    ? "Authenticating..."
                    : "Sign in"}

                </span>


                {!loading && (
                  <ArrowRight
                    size={17}
                    className="
                      relative
                      z-10
                      transition
                      duration-300
                      group-hover:translate-x-1
                    "
                  />
                )}

              </button>

            </form>


            {/* DIVIDER */}

            <div
              className="
                my-7
                flex
                items-center
                gap-4
              "
            >

              <div className="h-px flex-1 bg-white/[0.07]" />

              <span
                className="
                  text-[9px]
                  uppercase
                  tracking-[0.2em]
                  text-white/20
                "
              >
                CyberGuard
              </span>

              <div className="h-px flex-1 bg-white/[0.07]" />

            </div>


            {/* REGISTER */}

            <p
              className="
                relative
                z-10
                text-center
                text-sm
                text-white/35
              "
            >

              Don't have an account?{" "}

              <Link
                to="/register"
                className="
                  font-semibold
                  text-emerald-400
                  transition
                  duration-300
                  hover:text-emerald-300
                "
              >
                Create account
              </Link>

            </p>

          </div>


          {/* SECURITY FOOTER */}

          <div
            className="
              mt-6
              flex
              items-center
              justify-center
              gap-2
              text-[9px]
              uppercase
              tracking-[0.2em]
              text-emerald-400/30
            "
          >

            <ShieldCheck size={12} />

            Authorized security testing only

          </div>

        </div>

      </section>

    </main>
  );
}