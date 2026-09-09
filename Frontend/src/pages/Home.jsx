import { Link } from "react-router-dom";

import { RetroGrid } from "../Components/velora/retro-grid";
import { Particles } from "../Components/velora/particles";
import { Typewriter } from "../Components/velora/typewriter";



export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#061318] text-white">

      {/* =========================================================
          BACKGROUND LAYER
      ========================================================= */}

      <div className="pointer-events-none absolute inset-0 z-0">

        {/* Moving perspective retro grid */}
        <RetroGrid
          className="z-0"
          angle={55}
          cellSize={56}
          opacity={0.48}
        />

        {/* Emerald particles */}
        <Particles
          className="absolute inset-0 z-[1]"
          quantity={70}
          color="#10B981"
          size={1.2}
          staticity={30}
          ease={50}
        />

        {/* Existing CyberGuard network effect */}
        <div className="absolute inset-0 z-[2] opacity-30">
          
        </div>

      </div>


      {/* =========================================================
          NAVIGATION
      ========================================================= */}

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

        {/* LOGO */}

        <Link
          to="/"
          className="flex items-center gap-3"
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

            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              className="h-5 w-5 text-emerald-400"
            >
              <path d="M12 3 19 6v5c0 4.6-2.8 8.2-7 10-4.2-1.8-7-5.4-7-10V6l7-3Z" />
              <path d="m8.8 12 2.1 2.1 4.4-4.4" />
            </svg>

          </div>


          <div className="flex flex-col">

            <span
              className="
                text-sm
                font-bold
                tracking-[0.2em]
                text-white
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


        {/* NAVIGATION LINKS */}

        <div
          className="
            hidden
            items-center
            gap-9
            text-xs
            text-white/45
            md:flex
          "
        >

          <a
            href="#platform"
            className="transition duration-300 hover:text-emerald-400"
          >
            Platform
          </a>

          <a
            href="#scans"
            className="transition duration-300 hover:text-emerald-400"
          >
            Intelligence
          </a>

          <a
            href="#security"
            className="transition duration-300 hover:text-emerald-400"
          >
            Security
          </a>

          <a
            href="#architecture"
            className="transition duration-300 hover:text-emerald-400"
          >
            Architecture
          </a>

        </div>


        {/* LOGIN */}

        <Link
          to="/login"
          className="
            rounded-full
            border
            border-emerald-400/20
            bg-emerald-400/[0.05]
            px-6
            py-2.5
            text-xs
            font-semibold
            text-white
            transition
            duration-300
            hover:border-emerald-400/50
            hover:bg-emerald-400/[0.12]
            hover:text-emerald-300
          "
        >
          Log in
        </Link>

      </nav>


      {/* =========================================================
          HERO
      ========================================================= */}

      <section
        className="
          relative
          z-10
          flex
          min-h-[calc(100vh-80px)]
          items-center
          justify-center
          px-6
          pb-20
          pt-16
        "
      >

        {/* Hero glow */}

        <div
          className="
            pointer-events-none
            absolute
            left-1/2
            top-1/3
            h-[500px]
            w-[700px]
            -translate-x-1/2
            -translate-y-1/2
            rounded-full
            bg-emerald-400/[0.04]
            blur-[120px]
          "
        />


        {/* HERO CONTENT */}

        <div
          className="
            relative
            z-20
            mx-auto
            max-w-6xl
            text-center
          "
        >

          {/* STATUS BADGE */}

          <div
            className="
              mb-8
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
                shadow-[0_0_15px_#10B981]
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
              Autonomous Security Intelligence
            </span>

          </div>


          {/* MAIN HEADING */}

          <h1
            className="
              text-5xl
              font-black
              leading-[0.9]
              tracking-[-0.06em]
              sm:text-7xl
              lg:text-[108px]
            "
          >

            <span className="block text-white">
              Defend
            </span>

            <span
              className="
                block
                bg-gradient-to-b
                from-white
                via-white
                to-emerald-300/50
                bg-clip-text
                text-transparent
              "
            >
              Everything.
            </span>

          </h1>


          {/* TYPEWRITER */}

          <div
            className="
              mt-8
              text-xl
              font-semibold
              text-emerald-400
              sm:text-2xl
            "
          >

            <Typewriter
              words={[
                "Analyze your attack surface.",
                "Discover exposed services.",
                "Detect vulnerabilities.",
                "Understand your security posture.",
                "Defend your digital infrastructure.",
              ]}
              typeSpeed={55}
              deleteSpeed={35}
              holdTime={1800}
              loop
              cursor
            />

          </div>


          {/* DESCRIPTION */}

          <p
            className="
              mx-auto
              mt-7
              max-w-2xl
              text-sm
              leading-7
              text-white/45
              sm:text-base
            "
          >
            CyberGuard discovers exposed services, analyzes vulnerabilities,
            correlates CVEs and transforms raw security data into actionable
            security intelligence.
          </p>


          {/* CTA BUTTONS */}

          <div
            className="
              mt-10
              flex
              flex-col
              items-center
              justify-center
              gap-3
              sm:flex-row
            "
          >

            {/* IMPORTANT:
                This goes to LOGIN first.
            */}

            <Link
              to="/login"
              className="
                group
                relative
                flex
                items-center
                gap-3
                overflow-hidden
                rounded-full
                bg-emerald-400
                px-8
                py-4
                text-sm
                font-semibold
                text-[#031014]
                shadow-[0_0_35px_rgba(16,185,129,0.18)]
                transition
                duration-300
                hover:scale-[1.03]
                hover:bg-emerald-300
                hover:shadow-[0_0_55px_rgba(16,185,129,0.3)]
              "
            >

              <span className="relative z-10">
                Start Security Scan
              </span>

              <span
                className="
                  relative
                  z-10
                  text-lg
                  transition
                  duration-300
                  group-hover:translate-x-1
                "
              >
                →
              </span>

            </Link>


            <a
              href="#platform"
              className="
                flex
                items-center
                gap-3
                rounded-full
                border
                border-emerald-400/20
                bg-white/[0.025]
                px-8
                py-4
                text-sm
                font-semibold
                text-white/65
                backdrop-blur-xl
                transition
                duration-300
                hover:border-emerald-400/40
                hover:bg-emerald-400/[0.05]
                hover:text-white
              "
            >
              Explore Platform

              <span className="text-lg">
                →
              </span>

            </a>

          </div>


          {/* SMALL SECURITY LABELS */}

          <div
            className="
              mt-14
              flex
              flex-wrap
              items-center
              justify-center
              gap-x-5
              gap-y-2
              text-[9px]
              uppercase
              tracking-[0.28em]
              text-emerald-400/35
            "
          >

            <span>WEB SECURITY</span>

            <span>•</span>

            <span>NETWORK DISCOVERY</span>

            <span>•</span>

            <span>CVE INTELLIGENCE</span>

            <span>•</span>

            <span>RISK ANALYSIS</span>

          </div>

        </div>


        {/* SCROLL INDICATOR */}

        <div
          className="
            absolute
            bottom-7
            left-1/2
            z-20
            -translate-x-1/2
            text-center
          "
        >

          <div
            className="
              mb-3
              text-[8px]
              uppercase
              tracking-[0.3em]
              text-emerald-400/40
            "
          >
            Scroll to explore
          </div>

          <div
            className="
              mx-auto
              flex
              h-9
              w-5
              justify-center
              rounded-full
              border
              border-emerald-400/20
              p-1
            "
          >

            <div
              className="
                h-1.5
                w-1
                animate-bounce
                rounded-full
                bg-emerald-400
              "
            />

          </div>

        </div>

      </section>


      {/* =========================================================
          PLATFORM
      ========================================================= */}

      <section
        id="platform"
        className="
          relative
          z-10
          mx-auto
          max-w-7xl
          px-6
          py-28
          md:px-10
          lg:px-12
        "
      >

        <div className="mx-auto max-w-3xl text-center">

          <div
            className="
              mb-5
              text-[10px]
              font-semibold
              uppercase
              tracking-[0.25em]
              text-emerald-400
            "
          >
            Security, made clear
          </div>


          <h2
            className="
              text-4xl
              font-bold
              leading-[1]
              tracking-[-0.05em]
              text-white
              sm:text-6xl
            "
          >
            Know your surface.

            <span
              className="
                block
                text-white/35
              "
            >
              Secure what matters.
            </span>

          </h2>


          <p
            className="
              mx-auto
              mt-6
              max-w-2xl
              text-sm
              leading-7
              text-white/40
              sm:text-base
            "
          >
            CyberGuard turns scattered attack-surface signals into a focused
            security workflow for your team.
          </p>

        </div>


        {/* PLATFORM CARDS */}

        <div
          id="scans"
          className="
            mt-16
            grid
            gap-5
            md:grid-cols-3
          "
        >

          {[
            {
              number: "01",
              title: "Discover",
              text: "Map exposed services, web applications and security gaps across your digital surface.",
            },
            {
              number: "02",
              title: "Understand",
              text: "Bring findings, evidence, CVEs and severity into one clear security view.",
            },
            {
              number: "03",
              title: "Prioritize",
              text: "Focus remediation on the vulnerabilities that create the greatest risk.",
            },
          ].map((item) => (

            <article
              key={item.number}
              className="
                group
                rounded-2xl
                border
                border-emerald-400/10
                bg-white/[0.025]
                p-7
                backdrop-blur-xl
                transition
                duration-500
                hover:-translate-y-2
                hover:border-emerald-400/25
                hover:bg-emerald-400/[0.035]
              "
            >

              <div
                className="
                  text-xs
                  font-medium
                  tracking-[0.18em]
                  text-emerald-400
                "
              >
                {item.number}
              </div>


              <h3
                className="
                  mt-14
                  text-2xl
                  font-semibold
                  tracking-[-0.03em]
                  text-white
                "
              >
                {item.title}
              </h3>


              <p
                className="
                  mt-4
                  text-sm
                  leading-6
                  text-white/40
                "
              >
                {item.text}
              </p>


              <div
                className="
                  mt-8
                  text-xs
                  font-medium
                  text-emerald-400/60
                  transition
                  duration-300
                  group-hover:text-emerald-400
                "
              >
                Explore capability →
              </div>

            </article>

          ))}

        </div>

      </section>


      {/* =========================================================
          SECURITY SCANNER SECTION
      ========================================================= */}

      <section
        id="security"
        className="
          relative
          z-10
          border-y
          border-white/[0.05]
          px-6
          py-28
        "
      >

        <div
          className="
            mx-auto
            grid
            max-w-7xl
            items-center
            gap-14
            lg:grid-cols-2
          "
        >

          {/* LEFT */}

          <div>

            <div
              className="
                mb-5
                text-[10px]
                font-semibold
                uppercase
                tracking-[0.25em]
                text-emerald-400
              "
            >
              Security Scanner
            </div>


            <h2
              className="
                text-4xl
                font-bold
                leading-[1]
                tracking-[-0.05em]
                sm:text-6xl
              "
            >

              See the scan.

              <span
                className="
                  block
                  text-white/35
                "
              >
                Understand the result.
              </span>

            </h2>


            <p
              className="
                mt-7
                max-w-xl
                text-sm
                leading-7
                text-white/40
                sm:text-base
              "
            >
              From target normalization to port discovery, OS detection,
              CVE lookup and security scoring, CyberGuard turns every scan
              into a structured assessment.
            </p>


            <Link
              to="/login"
              className="
                mt-8
                inline-flex
                items-center
                gap-2
                text-xs
                font-semibold
                uppercase
                tracking-[0.2em]
                text-emerald-400
                transition
                hover:text-emerald-300
              "
            >
              Run a scan
              <span className="text-lg">
                →
              </span>
            </Link>

          </div>


          {/* TERMINAL */}

          <div
            className="
              overflow-hidden
              rounded-2xl
              border
              border-emerald-400/20
              bg-[#030708]/90
              shadow-[0_0_70px_rgba(16,185,129,0.06)]
              backdrop-blur-xl
            "
          >

            {/* TERMINAL HEADER */}

            <div
              className="
                flex
                items-center
                gap-2
                border-b
                border-white/[0.08]
                px-5
                py-4
              "
            >

              <span className="h-3 w-3 rounded-full bg-red-500/80" />
              <span className="h-3 w-3 rounded-full bg-yellow-500/80" />
              <span className="h-3 w-3 rounded-full bg-emerald-500/80" />

              <span
                className="
                  ml-3
                  text-xs
                  text-white/30
                "
              >
                cyberguard-scanner
              </span>

            </div>


            {/* TERMINAL CONTENT */}

            <div
              className="
                min-h-[280px]
                p-6
                font-mono
                text-sm
              "
            >

              <div className="text-emerald-400">
                $ cyberguard_scan example.com
              </div>

              <div className="mt-5 space-y-3 text-white/45">

                <p>
                  Initializing security assessment...
                </p>

                <p>
                  Resolving target...
                </p>

                <p>
                  Discovering exposed services...
                </p>

                <p>
                  Detecting technologies...
                </p>

                <p>
                  Correlating CVEs...
                </p>

              </div>


              <div
                className="
                  mt-5
                  flex
                  items-center
                  gap-2
                  text-emerald-400
                "
              >

                <span>
                  $
                </span>

                <span className="animate-pulse">
                  _
                </span>

              </div>

            </div>

          </div>

        </div>

      </section>


      {/* =========================================================
          ARCHITECTURE
      ========================================================= */}

      <section
        id="architecture"
        className="
          relative
          z-10
          mx-auto
          max-w-7xl
          px-6
          py-28
          md:px-10
          lg:px-12
        "
      >

        <div className="mx-auto max-w-3xl text-center">

          <div
            className="
              mb-5
              text-[10px]
              font-semibold
              uppercase
              tracking-[0.25em]
              text-emerald-400
            "
          >
            Security architecture
          </div>


          <h2
            className="
              text-4xl
              font-bold
              tracking-[-0.05em]
              sm:text-6xl
            "
          >
            Intelligence behind
            <span className="block text-white/35">
              every assessment.
            </span>
          </h2>


          <p
            className="
              mx-auto
              mt-6
              max-w-2xl
              text-sm
              leading-7
              text-white/40
            "
          >
            CyberGuard connects discovery, analysis, vulnerability
            intelligence and risk prioritization into one security workflow.
          </p>

        </div>


        <div
          className="
            mt-14
            grid
            gap-4
            sm:grid-cols-2
            lg:grid-cols-4
          "
        >

          {[
            "Attack Surface",
            "Network Discovery",
            "CVE Intelligence",
            "Risk Analysis",
          ].map((item, index) => (

            <div
              key={item}
              className="
                rounded-xl
                border
                border-emerald-400/10
                bg-white/[0.02]
                p-6
                transition
                duration-300
                hover:border-emerald-400/25
                hover:bg-emerald-400/[0.03]
              "
            >

              <div
                className="
                  mb-5
                  text-xs
                  text-emerald-400
                "
              >
                0{index + 1}
              </div>

              <div
                className="
                  text-sm
                  font-semibold
                  text-white
                "
              >
                {item}
              </div>

            </div>

          ))}

        </div>

      </section>


      {/* =========================================================
          FINAL CTA
      ========================================================= */}

      <section
        className="
          relative
          z-10
          px-6
          pb-32
          pt-10
        "
      >

        <div
          className="
            mx-auto
            max-w-6xl
            rounded-3xl
            border
            border-emerald-400/15
            bg-emerald-400/[0.025]
            px-6
            py-20
            text-center
            backdrop-blur-xl
            sm:px-10
          "
        >

          <div
            className="
              mx-auto
              mb-6
              flex
              h-14
              w-14
              items-center
              justify-center
              rounded-2xl
              border
              border-emerald-400/20
              bg-emerald-400/[0.07]
            "
          >

            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              className="h-7 w-7 text-emerald-400"
            >
              <path d="M12 3 19 6v5c0 4.6-2.8 8.2-7 10-4.2-1.8-7-5.4-7-10V6l7-3Z" />
              <path d="m8.8 12 2.1 2.1 4.4-4.4" />
            </svg>

          </div>


          <h2
            className="
              text-4xl
              font-bold
              tracking-[-0.05em]
              sm:text-5xl
            "
          >
            Know your surface.
          </h2>


          <p
            className="
              mx-auto
              mt-5
              max-w-xl
              text-sm
              leading-7
              text-white/40
            "
          >
            Start your CyberGuard security assessment and turn your
            attack surface into actionable intelligence.
          </p>


          <Link
            to="/login"
            className="
              mt-8
              inline-flex
              items-center
              gap-3
              rounded-full
              bg-emerald-400
              px-8
              py-4
              text-sm
              font-semibold
              text-[#031014]
              transition
              duration-300
              hover:scale-[1.03]
              hover:bg-emerald-300
              hover:shadow-[0_0_45px_rgba(16,185,129,0.25)]
            "
          >
            Start Security Scan
            <span className="text-lg">
              →
            </span>
          </Link>

        </div>

      </section>


      {/* =========================================================
          FOOTER
      ========================================================= */}

      <footer
        className="
          relative
          z-20
          border-t
          border-white/[0.06]
          px-6
          py-8
        "
      >

        <div
          className="
            mx-auto
            flex
            max-w-7xl
            flex-col
            items-center
            justify-between
            gap-4
            text-xs
            text-white/25
            sm:flex-row
          "
        >

          <span>
            © {new Date().getFullYear()} CyberGuard
          </span>

          <span className="tracking-[0.15em]">
            SECURITY INTELLIGENCE PLATFORM
          </span>

        </div>

      </footer>

    </main>
  );
}