import { cn } from "@/lib/utils";

export function RetroGrid({
  className,
  angle = 62,
  cellSize = 64,
  opacity = 0.42,
  speed = 18,
  ...props
}) {
  return (
    <div
      aria-hidden="true"
      data-slot="retro-grid"
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden",
        className
      )}
      style={{
        opacity,
        "--retro-speed": `${speed}s`,
      }}
      {...props}
    >
      {/* =====================================================
          GRID ATMOSPHERE
      ===================================================== */}

      <div
        className="
          absolute
          inset-0
          bg-[radial-gradient(ellipse_at_50%_45%,rgba(16,185,129,0.07),transparent_55%)]
        "
      />

      {/* =====================================================
          PERSPECTIVE GRID
      ===================================================== */}

      <div
        className="
          absolute
          inset-x-[-60%]
          top-[42%]
          h-[160%]
          w-[220%]
          origin-top
        "
        style={{
          transform: `perspective(700px) rotateX(${angle}deg)`,
        }}
      >
        <div
          className="
            retro-grid-plane
            absolute
            inset-0
          "
          style={{
            backgroundImage: `
              linear-gradient(
                to right,
                rgba(16,185,129,0.115) 1px,
                transparent 1px
              ),
              linear-gradient(
                to bottom,
                rgba(16,185,129,0.115) 1px,
                transparent 1px
              )
            `,
            backgroundSize: `${cellSize}px ${cellSize}px`,
          }}
        />
      </div>

      {/* =====================================================
          HORIZON
      ===================================================== */}

      <div
        className="
          absolute
          left-0
          right-0
          top-[42%]
          h-px
          bg-gradient-to-r
          from-transparent
          via-emerald-400/25
          to-transparent
        "
      />

      {/* =====================================================
          HORIZON GLOW
      ===================================================== */}

      <div
        className="
          absolute
          left-1/2
          top-[42%]
          h-24
          w-[70%]
          -translate-x-1/2
          -translate-y-1/2
          rounded-full
          bg-emerald-400/[0.035]
          blur-3xl
        "
      />

      {/* =====================================================
          SCANNING HIGHLIGHT
      ===================================================== */}

      <div
        className="
          retro-scan-line
          absolute
          left-0
          right-0
          h-[1px]
          bg-gradient-to-r
          from-transparent
          via-emerald-300/20
          to-transparent
        "
      />

      {/* =====================================================
          CINEMATIC FADE
      ===================================================== */}

      <div
        className="
          absolute
          inset-0
          bg-[linear-gradient(to_bottom,rgba(6,19,24,0.95)_0%,transparent_25%,transparent_70%,rgba(6,19,24,0.95)_100%)]
        "
      />

      {/* Side vignette */}

      <div
        className="
          absolute
          inset-0
          bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(2,10,12,0.65)_100%)]
        "
      />
    </div>
  );
}