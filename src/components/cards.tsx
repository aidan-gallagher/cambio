import { motion } from "motion/react";
import type { ReactNode } from "react";

export type Suit = "hearts" | "diamonds" | "spades" | "clubs" | "joker";

export const SUIT_GLYPH: Record<Suit, string> = {
  hearts: "\u2665",
  diamonds: "\u2666",
  spades: "\u2660",
  clubs: "\u2663",
  joker: "\u2605",
};

export function isRedSuit(suit: Suit): boolean {
  return suit === "hearts" || suit === "diamonds";
}

export function CardBack({ width = 56 }: { width?: number }) {
  const w = width;
  const h = Math.round(width * 1.45);
  return (
    <div
      style={{
        width: w,
        height: h,
        borderRadius: 8,
        background: "linear-gradient(135deg,#173025,#0b1410)",
        border: "1px solid color-mix(in oklab, #d4a64a 55%, transparent)",
        boxShadow: "0 14px 24px -16px rgba(0,0,0,0.7)",
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 4,
          borderRadius: 5,
          border: "1px solid color-mix(in oklab, #d4a64a 35%, transparent)",
          backgroundImage:
            "repeating-linear-gradient(45deg, color-mix(in oklab, #d4a64a 12%, transparent) 0 2px, transparent 2px 6px), repeating-linear-gradient(-45deg, color-mix(in oklab, #d4a64a 10%, transparent) 0 2px, transparent 2px 6px)",
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
          letterSpacing: "0.22em",
          fontSize: Math.max(8, width * 0.18),
        }}
      >
        C
      </div>
    </div>
  );
}

export function CardFace({
  width,
  rank,
  suit,
}: {
  width: number;
  rank: string;
  suit: Suit;
}) {
  const w = width;
  const h = Math.round(width * 1.45);
  const isJoker = suit === "joker" || rank === "JOKER";
  const fs = w * 0.32;
  const pip = w * 0.18;
  const center = w * 0.7;
  const glyph = SUIT_GLYPH[suit];
  const color = isRedSuit(suit) ? "#c0322a" : "#0c1612";

  if (isJoker) {
    return (
      <div
        style={{
          width: w,
          height: h,
          borderRadius: 8,
          background: "#f4ede1",
          color: "#0c1612",
          position: "relative",
          boxShadow:
            "inset 0 0 0 1px rgba(0,0,0,0.08), 0 16px 28px -16px rgba(0,0,0,0.7)",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              fontFamily: "Cinzel, serif",
              letterSpacing: "0.22em",
              fontSize: Math.max(8, w * 0.16),
            }}
          >
            JOKER
          </div>
          <div style={{ color: "#b8862b", fontSize: w * 1.1, lineHeight: 1 }}>
            ★
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        width: w,
        height: h,
        borderRadius: 8,
        background: "#f4ede1",
        color,
        position: "relative",
        boxShadow:
          "inset 0 0 0 1px rgba(0,0,0,0.08), 0 16px 28px -16px rgba(0,0,0,0.7)",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 4,
          left: 6,
          lineHeight: 1,
          fontSize: fs,
          fontWeight: 600,
        }}
      >
        <div>{rank}</div>
        <div style={{ fontSize: pip }}>{glyph}</div>
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 4,
          right: 6,
          lineHeight: 1,
          fontSize: fs,
          fontWeight: 600,
          transform: "rotate(180deg)",
        }}
      >
        <div>{rank}</div>
        <div style={{ fontSize: pip }}>{glyph}</div>
      </div>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          placeItems: "center",
          fontSize: center,
          opacity: 0.92,
        }}
      >
        {glyph}
      </div>
    </div>
  );
}

export function FlipCard({
  width,
  flipped,
  delay = 0,
  back,
  face,
}: {
  width: number;
  flipped: boolean;
  delay?: number;
  back: ReactNode;
  face: ReactNode;
}) {
  const h = Math.round(width * 1.45);
  return (
    <div style={{ width, height: h, perspective: 1000 }}>
      <motion.div
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ duration: 0.55, ease: [0.2, 0.8, 0.2, 1], delay }}
        style={{
          width: "100%",
          height: "100%",
          position: "relative",
          transformStyle: "preserve-3d",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            backfaceVisibility: "hidden",
          }}
        >
          {back}
        </div>
        <div
          style={{
            position: "absolute",
            inset: 0,
            backfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
          }}
        >
          {face}
        </div>
      </motion.div>
    </div>
  );
}
