import { motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { CardBack, CardFace, FlipCard } from "./cards";

const CARD_W_YOU = 60;
const CARD_W_OPP = 46;
const PILE_W = 52;

type SeatId = "you" | "west" | "north" | "east";

const SEATS: Record<
  SeatId,
  { center: { x: number; y: number }; cardW: number; rotate: number; name: string; labelOffset: { x: number; y: number } }
> = {
  you:   { center: { x: 0,    y: 168  }, cardW: CARD_W_YOU, rotate: 0,   name: "YOU",   labelOffset: { x: 0,   y: 102 } },
  north: { center: { x: 0,    y: -168 }, cardW: CARD_W_OPP, rotate: 180, name: "BOB",   labelOffset: { x: 0,   y: -98 } },
  west:  { center: { x: -150, y: 0    }, cardW: CARD_W_OPP, rotate: 90,  name: "LISA",  labelOffset: { x: -92, y: 0   } },
  east:  { center: { x: 150,  y: 0    }, cardW: CARD_W_OPP, rotate: -90, name: "ALICE", labelOffset: { x: 92,  y: 0   } },
};

// 2x2 offsets within a hand, before rotation. Indices: 0=TL, 1=TR, 2=BL, 3=BR.
function gridOffsets(cardW: number) {
  const cardH = Math.round(cardW * 1.45);
  const dx = cardW / 2 + 4;
  const dy = cardH / 2 + 4;
  return [
    { x: -dx, y: -dy },
    { x:  dx, y: -dy },
    { x: -dx, y:  dy },
    { x:  dx, y:  dy },
  ];
}

function rotatePt(p: { x: number; y: number }, deg: number) {
  const r = (deg * Math.PI) / 180;
  const cos = Math.cos(r), sin = Math.sin(r);
  return { x: p.x * cos - p.y * sin, y: p.x * sin + p.y * cos };
}

interface Slot {
  seat: SeatId;
  index: number; // 0..3
  x: number;
  y: number;
  rotate: number;
  cardW: number;
}

const SLOTS: Slot[] = (Object.keys(SEATS) as SeatId[]).flatMap((seat) => {
  const s = SEATS[seat];
  return gridOffsets(s.cardW).map((off, i) => {
    const rotated = rotatePt(off, s.rotate);
    return {
      seat,
      index: i,
      x: s.center.x + rotated.x,
      y: s.center.y + rotated.y,
      rotate: s.rotate + (i % 2 === 0 ? -1.5 : 1.5),
      cardW: s.cardW,
    };
  });
});

// Deal order: clockwise around the table, one card per seat per round, 4 rounds.
const DEAL_ORDER: SeatId[] = ["you", "west", "north", "east"];
const DEAL_SEQUENCE: Slot[] = (() => {
  const out: Slot[] = [];
  for (let round = 0; round < 4; round++) {
    for (const seat of DEAL_ORDER) {
      const slot = SLOTS.find((s) => s.seat === seat && s.index === round);
      if (slot) out.push(slot);
    }
  }
  return out;
})();

const DEAL_GAP = 0.14; // seconds between successive cards
const DEAL_DURATION = 0.42;
const DEAL_START = 0.35;
const LAST_LANDS_AT =
  DEAL_START + (DEAL_SEQUENCE.length - 1) * DEAL_GAP + DEAL_DURATION;


export default function Dealer() {
  const [stage, setStage] = useState<"idle" | "dealing" | "peeking" | "hiding" | "done">("idle");
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) {
      setStage("done");
      return;
    }
    const timers: number[] = [];
    timers.push(window.setTimeout(() => setStage("dealing"), 200));
    // Peek: ~0.35s after the last card lands.
    const peekAt = (LAST_LANDS_AT + 0.35) * 1000 + 200;
    timers.push(window.setTimeout(() => setStage("peeking"), peekAt));
    // Hide back: ~2.6s after peek begins.
    timers.push(window.setTimeout(() => setStage("hiding"), peekAt + 2600));
    timers.push(window.setTimeout(() => setStage("done"), peekAt + 2600 + 700));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [reduced]);

  const isPeeking = stage === "peeking";

  // Deck is at table center.
  const DECK = { x: 0, y: 0 };

  return (
    <div
      className="scene-fitter"
      style={{ "--scene-w": 500, "--scene-h": 540 } as Record<string, string | number>}
    >
    <div
      className="scene"
      aria-label="A Cambio table mid-deal: four players around a deck. Lisa, Bob, Alice, and You."
    >
      {/* Felt halo */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 60% 55% at 50% 50%, color-mix(in oklab, #173025 70%, transparent), transparent 70%)",
          filter: "blur(2px)",
        }}
      />

      {/* Anchor: center of the table */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: 0,
          height: 0,
        }}
      >
        {/* Deck stack — five layers so the deck has visible thickness;
            top layers fade out one by one as cards are dealt. */}
        {[0, 1, 2, 3, 4].map((i) => {
          // Stagger the disappearance of the top deck layers across the
          // first several dealt cards so the deck visibly thins.
          const fadeAt = DEAL_START + (DEAL_SEQUENCE.length - 1 - i * 3) * DEAL_GAP;
          return (
            <motion.div
              key={`deck-${i}`}
              initial={{ opacity: 0, y: -6 }}
              animate={
                reduced
                  ? { opacity: i === 0 ? 1 : 0.85 - i * 0.1, y: 0 }
                  : stage === "idle"
                    ? { opacity: 0, y: -6 }
                    : { opacity: 1, y: 0 }
              }
              transition={{
                delay: 0.05 + i * 0.04,
                duration: 0.4,
              }}
              style={{
                position: "absolute",
                transform: `translate(${DECK.x - PILE_W / 2 - i * 1.5}px, ${DECK.y - (PILE_W * 1.45) / 2 - i * 1.5}px)`,
                zIndex: i,
              }}
            >
              <CardBack width={PILE_W} />
            </motion.div>
          );
        })}

        {/* Dealt cards */}
        {DEAL_SEQUENCE.map((slot, i) => {
          const finalX = slot.x - slot.cardW / 2;
          const finalY = slot.y - (slot.cardW * 1.45) / 2;
          // Start each card as the top of the deck (with the same per-card stagger
          // so it sits visibly atop the stack just before it flicks out).
          const startX = DECK.x - slot.cardW / 2;
          const startY = DECK.y - (slot.cardW * 1.45) / 2 - 4;
          const delay = DEAL_START + i * DEAL_GAP;

          const isYourBottom =
            slot.seat === "you" && (slot.index === 2 || slot.index === 3);

          // Peeked card content for your bottom-left (index 2) and bottom-right (index 3).
          const peekedFace =
            slot.index === 2
              ? <CardFace width={slot.cardW} rank="A" suit="hearts" />
              : <CardFace width={slot.cardW} rank="6" suit="diamonds" />;

          return (
            <motion.div
              key={`${slot.seat}-${slot.index}`}
              initial={
                reduced
                  ? { x: finalX, y: finalY, opacity: 1, rotate: slot.rotate, scale: 1, zIndex: 0 }
                  : { x: startX, y: startY, opacity: 0, rotate: 0, scale: 1.06, zIndex: 100 - i }
              }
              animate={
                stage === "idle" && !reduced
                  ? {}
                  : {
                      x: finalX,
                      y: finalY,
                      opacity: 1,
                      rotate: slot.rotate,
                      scale: 1,
                    }
              }
              transition={
                reduced
                  ? { duration: 0 }
                  : {
                      delay,
                      duration: DEAL_DURATION,
                      ease: [0.2, 0.8, 0.2, 1],
                      // Snap on at the moment of departure so cards aren't
                      // ghostly-faded while they travel — they leave the deck
                      // already opaque, like a flicked top card.
                      opacity: { delay, duration: 0.001 },
                    }
              }
              style={{ position: "absolute" }}
            >
              {isYourBottom ? (
                <FlipCard
                  width={slot.cardW}
                  flipped={isPeeking}
                  delay={0}
                  back={<CardBack width={slot.cardW} />}
                  face={peekedFace}
                />
              ) : (
                <CardBack width={slot.cardW} />
              )}
            </motion.div>
          );
        })}

        {/* Player labels */}
        {(Object.keys(SEATS) as SeatId[]).map((seat) => {
          const s = SEATS[seat];
          return (
            <motion.div
              key={`label-${seat}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: stage === "idle" ? 0 : 0.7 }}
              transition={{ delay: LAST_LANDS_AT + 0.15, duration: 0.5 }}
              style={{
                position: "absolute",
                left: s.center.x + s.labelOffset.x,
                top: s.center.y + s.labelOffset.y,
                transform: "translate(-50%, -50%)",
                fontFamily: "Cinzel, serif",
                fontSize: seat === "you" ? 12 : 10,
                letterSpacing: "0.32em",
                color: seat === "you" ? "#fbf3dc" : "#ecd596",
                pointerEvents: "none",
                whiteSpace: "nowrap",
              }}
            >
              {s.name}
            </motion.div>
          );
        })}
      </div>
    </div>
    </div>
  );
}
