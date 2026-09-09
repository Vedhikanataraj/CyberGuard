export default function CyberBackground() {
  const particles = [
    [7, 17, 2, 0, 18], [15, 74, 1, 3, 22], [23, 26, 1, 6, 19],
    [31, 88, 2, 1, 24], [69, 14, 1, 8, 21], [77, 78, 2, 4, 20],
    [88, 31, 1, 2, 25], [94, 62, 2, 7, 23], [58, 91, 1, 5, 18],
  ];

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-[#080808]">

      <div className="ambient-halo ambient-halo-left" />
      <div className="ambient-halo ambient-halo-right" />
      <div className="ambient-halo ambient-halo-bottom" />

      <div className="ambient-particles" aria-hidden="true">
        {particles.map(([left, top, size, delay, duration], index) => (
          <span
            key={index}
            className="ambient-particle"
            style={{
              left: `${left}%`, top: `${top}%`, width: `${size}px`, height: `${size}px`,
              animationDelay: `-${delay}s`, animationDuration: `${duration}s`,
            }}
          />
        ))}
      </div>

      {/* Top Glow */}
      <div
        className="
          absolute
          left-1/2
          top-[-300px]
          h-[700px]
          w-[700px]
          -translate-x-1/2
          rounded-full
          bg-[#4658ff]/15
          blur-[150px]
          animate-cyber-pulse
        "
      />

      {/* Left Glow */}
      <div
        className="
          absolute
          left-[-250px]
          top-[30%]
          h-[500px]
          w-[500px]
          rounded-full
          bg-[#7c6cff]/8
          blur-[140px]
          animate-floating-glow
        "
      />

      {/* Right Glow */}
      <div
        className="
          absolute
          right-[-250px]
          top-[45%]
          h-[500px]
          w-[500px]
          rounded-full
          bg-[#4658ff]/8
          blur-[140px]
          animate-floating-glow-reverse
        "
      />

      {/* Vignette */}
      <div
        className="
          absolute
          inset-0
          bg-[radial-gradient(circle_at_center,transparent_20%,rgba(0,0,0,0.55)_100%)]
        "
      />

    </div>
  );
}
