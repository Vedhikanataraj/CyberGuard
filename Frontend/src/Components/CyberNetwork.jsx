import { useEffect, useMemo, useState } from "react";

const NODES = [
  { x: 50, y: 47, size: 8, core: true },

  { x: 30, y: 31, size: 4 },
  { x: 21, y: 52, size: 3 },
  { x: 34, y: 68, size: 4 },

  { x: 70, y: 31, size: 4 },
  { x: 79, y: 52, size: 3 },
  { x: 66, y: 68, size: 4 },

  { x: 42, y: 24, size: 3 },
  { x: 58, y: 24, size: 3 },
  { x: 43, y: 76, size: 3 },
  { x: 57, y: 76, size: 3 },
];

const CONNECTIONS = [
  [0, 1],
  [0, 2],
  [0, 3],
  [0, 4],
  [0, 5],
  [0, 6],

  [1, 2],
  [1, 7],
  [2, 3],
  [3, 8],

  [4, 5],
  [4, 9],
  [5, 6],
  [6, 10],

  [7, 9],
  [8, 10],
  [1, 4],
  [3, 6],
];

function interpolate(a, b, t) {
  return a + (b - a) * t;
}

export default function CyberNetwork() {
  const [packetIndex, setPacketIndex] = useState(0);

  const packets = useMemo(() => {
    return CONNECTIONS.map(([from, to], index) => ({
      from,
      to,
      delay: index * 0.7,
      duration: 3.5 + (index % 3) * 0.8,
    }));
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setPacketIndex((value) => value + 1);
    }, 1200);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden">

      {/* =====================================================
          ATMOSPHERIC GLOWS
      ===================================================== */}

      <div className="cyber-orb cyber-orb-one" />
      <div className="cyber-orb cyber-orb-two" />
      <div className="cyber-orb cyber-orb-three" />

      {/* =====================================================
          NETWORK
      ===================================================== */}

      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >

        <defs>

          <filter id="emerald-glow">
            <feGaussianBlur
              stdDeviation="1.5"
              result="blur"
            />

            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <radialGradient id="coreGradient">
            <stop
              offset="0%"
              stopColor="#34D399"
              stopOpacity="0.65"
            />

            <stop
              offset="50%"
              stopColor="#10B981"
              stopOpacity="0.25"
            />

            <stop
              offset="100%"
              stopColor="#10B981"
              stopOpacity="0"
            />
          </radialGradient>

        </defs>


        {/* =================================================
            CONNECTION LINES
        ================================================= */}

        {CONNECTIONS.map(([from, to], index) => {

          const start = NODES[from];
          const end = NODES[to];

          return (
            <line
              key={`line-${index}`}
              x1={start.x}
              y1={start.y}
              x2={end.x}
              y2={end.y}
              className={
                index % 3 === 0
                  ? "cyber-line"
                  : "cyber-line subtle"
              }
            />
          );
        })}


        {/* =================================================
            CENTRAL CORE
        ================================================= */}

        <circle
          cx="50"
          cy="47"
          r="15"
          fill="url(#coreGradient)"
          className="core-aura"
        />

        <circle
          cx="50"
          cy="47"
          r="8"
          className="radar-ring"
          fill="none"
        />

        <circle
          cx="50"
          cy="47"
          r="12"
          className="radar-ring radar-ring-delay"
          fill="none"
        />


        {/* =================================================
            PACKETS
        ================================================= */}

        {packets.map((packet, index) => {

          const start = NODES[packet.from];
          const end = NODES[packet.to];

          const progress =
            ((packetIndex * 0.15 + index * 0.19) % 1);

          const x = interpolate(
            start.x,
            end.x,
            progress
          );

          const y = interpolate(
            start.y,
            end.y,
            progress
          );

          return (
            <circle
              key={`packet-${index}`}
              cx={x}
              cy={y}
              r="0.7"
              className="data-packet"
              style={{
                opacity:
                  progress > 0.05 && progress < 0.95
                    ? 0.95
                    : 0,
              }}
            />
          );
        })}

      </svg>


      {/* =====================================================
          NODES
      ===================================================== */}

      {NODES.map((node, index) => (

        <div
          key={`node-${index}`}
          className={
            node.core
              ? "network-node network-node-core"
              : "network-node"
          }
          style={{
            left: `${node.x}%`,
            top: `${node.y}%`,
            width: `${node.size}px`,
            height: `${node.size}px`,
            animationDelay: `${index * 0.18}s`,
          }}
        />

      ))}


      {/* =====================================================
          FLOATING SECURITY LABELS
      ===================================================== */}

      <div className="floating-security-label label-one">
        <span className="label-dot" />
        SURFACE MONITORING
      </div>

      <div className="floating-security-label label-two">
        <span className="label-dot" />
        THREAT INTELLIGENCE
      </div>

      <div className="floating-security-label label-three">
        <span className="label-dot" />
        CVE ANALYSIS
      </div>

      <div className="floating-security-label label-four">
        <span className="label-dot" />
        RISK ENGINE
      </div>


      {/* =====================================================
          EDGE TRACES
      ===================================================== */}

      <div className="edge-trace edge-trace-left" />
      <div className="edge-trace edge-trace-right" />
      <div className="edge-trace edge-trace-bottom" />

    </div>
  );
}