import { motion } from "motion/react";
import { useEffect, useState } from "react";

const positions = [
  { x: -56, y: -76, label: "top-left" },
  { x: 56, y: -76, label: "top-right" },
  { x: -56, y: 76, label: "bottom-left" },
  { x: 56, y: 76, label: "bottom-right" },
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
          fontSize: Math.max(10, size * 0.16),
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
        width: 320,
        height: 360,
        display: "grid",
        placeItems: "center",
      }}
      aria-label="A four-card Cambio hand, dealt face down in a 2 by 2 grid"
    >
      {positions.map((p, i) => (
        <motion.div
          key={p.label}
          initial={{ x: 0, y: -260, opacity: 0, rotate: -14, scale: 0.9 }}
          animate={
            started
              ? {
                  x: p.x,
                  y: p.y,
                  opacity: 1,
                  rotate: (i % 2 === 0 ? -1 : 1) * 1.5,
                  scale: 1,
                }
              : {}
          }
          transition={{
            delay: 0.25 + i * 0.18,
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
