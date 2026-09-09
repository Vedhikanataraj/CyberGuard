import { useState } from "react";
import { Eye, EyeOff, ShieldCheck } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import { RetroGrid } from "../Components/velora/retro-grid";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function Register() {
  const navigate = useNavigate();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!fullName.trim()) {
      setError("Please enter your full name.");
      return;
    }

    if (!email.trim()) {
      setError("Please enter your email.");
      return;
    }

    if (!phone.trim()) {
      setError("Please enter your phone number.");
      return;
    }

    if (password.length < 12) {
      setError("Password must contain at least 12 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(
        `${API_BASE_URL}/api/auth/register`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            full_name: fullName.trim(),
            email: email.trim(),
            phone: phone.trim(),
            password,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        const message =
          typeof data.detail === "string"
            ? data.detail
            : Array.isArray(data.detail)
              ? data.detail
                  .map((item) => item.msg)
                  .join(", ")
              : "Registration failed.";

        throw new Error(message);
      }

      setSuccess(
        "Account created successfully. Redirecting to login..."
      );

      setTimeout(() => {
        navigate("/login", {
          replace: true,
        });
      }, 1200);
    } catch (err) {
      setError(
        err.message || "Registration failed."
      );
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
          PROFESSIONAL EMERALD RETRO GRID
      ===================================================== */}

      <RetroGrid
        className="z-0"
        angle={62}
        cellSize={64}
        opacity={0.42}
        speed={18}
      />


      {/* =====================================================
          NAVIGATION
      ===================================================== */}

      <nav
        className="
          relative
          z-20
          mx-auto
          flex
          h-20
          max-w-7xl
          items-center
          justify-between
          px-6
          md:px-10
          lg:px-12
        "
      >

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
              border-emerald-400/25
              bg-emerald-400/[0.06]
              text-emerald-400
              shadow-[0_0_25px_rgba(16,185,129,0.08)]
            "
          >
            <ShieldCheck
              size={18}
              strokeWidth={1.8}
            />
          </div>

          <span
            className="
              text-sm
              font-bold
              tracking-[0.18em]
            "
          >
            CYBERGUARD
          </span>

        </Link>


        <p className="text-xs text-white/45">

          Already have an account?{" "}

          <Link
            to="/login"
            className="
              font-semibold
              text-emerald-400
              transition
              hover:text-emerald-300
            "
          >
            Sign in
          </Link>

        </p>

      </nav>


      {/* =====================================================
          REGISTER AREA
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
          py-12
        "
      >

        <div className="w-full max-w-[470px]">


          {/* =================================================
              HEADER
          ================================================= */}

          <div className="mb-7 text-center">

            <div
              className="
                mb-5
                inline-flex
                items-center
                gap-2
                rounded-full
                border
                border-emerald-400/20
                bg-emerald-400/[0.045]
                px-4
                py-2
                text-[10px]
                font-medium
                uppercase
                tracking-[0.24em]
                text-emerald-400/70
                backdrop-blur-xl
              "
            >

              <span
                className="
                  h-1.5
                  w-1.5
                  rounded-full
                  bg-emerald-400
                  shadow-[0_0_12px_rgba(16,185,129,0.9)]
                "
              />

              Secure registration

            </div>


            <h1
              className="
                text-4xl
                font-bold
                tracking-[-0.045em]
                text-white
                sm:text-5xl
              "
            >
              Create your account.
            </h1>


            <p
              className="
                mt-4
                text-sm
                leading-6
                text-white/45
              "
            >
              Start securing your digital surface
              with CyberGuard.
            </p>

          </div>


          {/* =================================================
              FORM CARD
          ================================================= */}

          <div
            className="
              rounded-2xl
              border
              border-emerald-400/15
              bg-[#071a1b]/80
              p-6
              shadow-[0_20px_80px_rgba(0,0,0,0.35)]
              backdrop-blur-xl
              sm:p-8
            "
          >

            {/* ERROR */}

            {error && (
              <div
                className="
                  mb-5
                  rounded-xl
                  border
                  border-red-400/20
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


            {/* SUCCESS */}

            {success && (
              <div
                className="
                  mb-5
                  rounded-xl
                  border
                  border-emerald-400/25
                  bg-emerald-400/10
                  px-4
                  py-3
                  text-sm
                  text-emerald-300
                "
              >
                {success}
              </div>
            )}


            <form
              onSubmit={handleSubmit}
              className="space-y-4"
            >

              {/* FULL NAME */}

              <div>

                <label
                  htmlFor="fullName"
                  className="
                    mb-2
                    block
                    text-xs
                    font-medium
                    text-white/65
                  "
                >
                  Full name
                </label>

                <input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(event) =>
                    setFullName(event.target.value)
                  }
                  placeholder="Enter your full name"
                  autoComplete="name"
                  className="
                    w-full
                    rounded-xl
                    border
                    border-emerald-400/10
                    bg-[#041114]/80
                    px-4
                    py-3
                    text-sm
                    text-white
                    outline-none
                    transition
                    placeholder:text-white/25
                    focus:border-emerald-400/50
                    focus:ring-4
                    focus:ring-emerald-400/10
                  "
                />

              </div>


              {/* EMAIL + PHONE */}

              <div className="grid gap-4 sm:grid-cols-2">

                <div>

                  <label
                    htmlFor="email"
                    className="
                      mb-2
                      block
                      text-xs
                      font-medium
                      text-white/65
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
                      border-emerald-400/10
                      bg-[#041114]/80
                      px-4
                      py-3
                      text-sm
                      text-white
                      outline-none
                      transition
                      placeholder:text-white/25
                      focus:border-emerald-400/50
                      focus:ring-4
                      focus:ring-emerald-400/10
                    "
                  />

                </div>


                <div>

                  <label
                    htmlFor="phone"
                    className="
                      mb-2
                      block
                      text-xs
                      font-medium
                      text-white/65
                    "
                  >
                    Phone number
                  </label>

                  <input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(event) =>
                      setPhone(event.target.value)
                    }
                    placeholder="+91 9876543210"
                    autoComplete="tel"
                    className="
                      w-full
                      rounded-xl
                      border
                      border-emerald-400/10
                      bg-[#041114]/80
                      px-4
                      py-3
                      text-sm
                      text-white
                      outline-none
                      transition
                      placeholder:text-white/25
                      focus:border-emerald-400/50
                      focus:ring-4
                      focus:ring-emerald-400/10
                    "
                  />

                </div>

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
                    text-white/65
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
                    placeholder="Minimum 12 characters"
                    autoComplete="new-password"
                    className="
                      w-full
                      rounded-xl
                      border
                      border-emerald-400/10
                      bg-[#041114]/80
                      px-4
                      py-3
                      pr-12
                      text-sm
                      text-white
                      outline-none
                      transition
                      placeholder:text-white/25
                      focus:border-emerald-400/50
                      focus:ring-4
                      focus:ring-emerald-400/10
                    "
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowPassword(
                        !showPassword
                      )
                    }
                    className="
                      absolute
                      right-3
                      top-1/2
                      -translate-y-1/2
                      rounded-md
                      p-1
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

                <p
                  className="
                    mt-2
                    text-xs
                    text-white/30
                  "
                >
                  Use at least 12 characters
                  for a stronger account.
                </p>

              </div>


              {/* CONFIRM PASSWORD */}

              <div>

                <label
                  htmlFor="confirmPassword"
                  className="
                    mb-2
                    block
                    text-xs
                    font-medium
                    text-white/65
                  "
                >
                  Confirm password
                </label>

                <div className="relative">

                  <input
                    id="confirmPassword"
                    type={
                      showConfirmPassword
                        ? "text"
                        : "password"
                    }
                    value={confirmPassword}
                    onChange={(event) =>
                      setConfirmPassword(
                        event.target.value
                      )
                    }
                    placeholder="Re-enter your password"
                    autoComplete="new-password"
                    className="
                      w-full
                      rounded-xl
                      border
                      border-emerald-400/10
                      bg-[#041114]/80
                      px-4
                      py-3
                      pr-12
                      text-sm
                      text-white
                      outline-none
                      transition
                      placeholder:text-white/25
                      focus:border-emerald-400/50
                      focus:ring-4
                      focus:ring-emerald-400/10
                    "
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowConfirmPassword(
                        !showConfirmPassword
                      )
                    }
                    className="
                      absolute
                      right-3
                      top-1/2
                      -translate-y-1/2
                      rounded-md
                      p-1
                      text-white/30
                      transition
                      hover:text-emerald-400
                    "
                    aria-label={
                      showConfirmPassword
                        ? "Hide password"
                        : "Show password"
                    }
                  >
                    {showConfirmPassword ? (
                      <EyeOff size={18} />
                    ) : (
                      <Eye size={18} />
                    )}
                  </button>

                </div>

              </div>


              {/* CREATE ACCOUNT */}

              <button
                type="submit"
                disabled={loading}
                className="
                  group
                  relative
                  mt-2
                  w-full
                  overflow-hidden
                  rounded-xl
                  bg-emerald-400
                  px-4
                  py-3.5
                  text-sm
                  font-semibold
                  text-[#02110d]
                  shadow-[0_0_30px_rgba(16,185,129,0.16)]
                  transition
                  duration-300
                  hover:bg-emerald-300
                  hover:shadow-[0_0_40px_rgba(16,185,129,0.25)]
                  disabled:cursor-not-allowed
                  disabled:opacity-50
                "
              >

                <span className="relative z-10">
                  {loading
                    ? "Creating account..."
                    : "Create account →"}
                </span>

              </button>

            </form>


            {/* LOGIN */}

            <div
              className="
                mt-7
                border-t
                border-emerald-400/10
                pt-6
                text-center
              "
            >

              <p className="text-sm text-white/35">
                Already have a CyberGuard account?
              </p>

              <Link
                to="/login"
                className="
                  mt-2
                  inline-block
                  text-sm
                  font-semibold
                  text-emerald-400
                  transition
                  hover:text-emerald-300
                "
              >
                Sign in to your account →
              </Link>

            </div>

          </div>

        </div>

      </section>

    </main>
  );
}