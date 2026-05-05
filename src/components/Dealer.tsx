import { motion } from "motion/react";
import { useEffect, useState } from "react";

const positions = [
  { x: -120, y: -90 },
  { x: 120, y: -90 },
  { x: -120, y: 90 },
  { x: 120, y: 90 },
];

function CardBack({ size = 96 }: { size?: number }) {
  const w = size;
  const h = Math.round(size * 1.45);
  return (
    <div
      style={{
        width: w,
        height: h,
        borderRadius: 10,
        background: "linear-gradient(135deg,#173025,#0b1410)",
        border: "1px solid color-mix(in oklab, #d4a64a 55%, transparent)",
        boxShadow: "0 18px 30px -18px rgba(0,0,0,0.7)",
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 6,
          borderRadius: 6,
          border: "1px solid color-mix(in oklab, #d4a64a 35%, transparent)",
          backgroundImage:
            "repeating-linear-gradient(45deg, color-mix(in oklab, #d4a64a 12%, transparent) 0 2px, transparent 2px 8px), repeating-linear-gradient(-45deg, color-mix(in oklab, #d4a64a 10%, transparent) 0 2px, transparent 2px 8px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          placeItems: "center",
          color: "#ecd596",
          fontFamily: "Cinzel, serif",
          letterSpacing: "0.25em",
          fontSize: 14,
        }}
      >
        C
      </div>
    </div>
  );
}

export default function Dealer() {
  const [started, setStarted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setStarted(true), 200);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      style={{
        position: "relative",
        width: 360,
        height: 380,
        display: "grid",
        placeItems: "center",
      }}
      aria-hidden="true"
    >
      {/* deck source */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        style={{ position: "absolute", top: 8, left: "50%", transform: "translateX(-50%)" }}
      >
        <div style={{ position: "relative" }}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                top: -i * 1.5,
                left: -i * 1.5,
              }}
            >
              <CardBack size={70} />
            </div>
          ))}
          <CardBack size={70} />
        </div>
      </motion.div>

      {/* dealt cards */}
      {positions.map((p, i) => (
        <motion.div
          key={i}
          initial={{ x: 0, y: -180, opacity: 0, rotate: -10 }}
          animate={
            started
              ? { x: p.x, y: p.y, opacity: 1, rotate: (i % 2 === 0 ? -1 : 1) * 2 }
              : {}
          }
          transition={{
            delay: 0.5 + i * 0.18,
            duration: 0.55,
            ease: [0.2, 0.8, 0.2, 1],
          }}
          style={{ position: "absolute" }}
        >
          <CardBack size={96} />
        </motion.div>
      ))}
    </div>
  );
}
