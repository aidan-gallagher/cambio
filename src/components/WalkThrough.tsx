import { motion, AnimatePresence } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { CardBack, CardFace, FlipCard } from "./cards";
import { STEPS, totalOf, type BoardState, type CardId, type SeatId } from "./walkthrough-script";

const SEAT_LAYOUT: Record<
  SeatId,
  { center: { x: number; y: number }; cardW: number; rotate: number; name: string; labelOffset: { x: number; y: number } }
> = {
  you:   { center: { x: 0,    y: 200  }, cardW: 60, rotate: 0,   name: "SAM",   labelOffset: { x: 0,    y: 135  } },
  north: { center: { x: 0,    y: -200 }, cardW: 48, rotate: 180, name: "BOB",   labelOffset: { x: 0,    y: -125 } },
  west:  { center: { x: -200, y: 0    }, cardW: 48, rotate: 90,  name: "LISA",  labelOffset: { x: -135, y: 0    } },
  east:  { center: { x: 200,  y: 0    }, cardW: 48, rotate: -90, name: "ALICE", labelOffset: { x: 135,  y: 0    } },
};

function gridOffsets(cardW: number, count: number) {
  const cardH = Math.round(cardW * 1.45);
  const dx = cardW / 2 + 4;
  const dy = cardH / 2 + 4;
  const offsets: Array<{ x: number; y: number }> = [
    { x: -dx, y: -dy },
    { x:  dx, y: -dy },
    { x: -dx, y:  dy },
    { x:  dx, y:  dy },
  ];
  for (let i = 4; i < count; i++) {
    const k = i - 4;
    offsets.push({ x: dx + (cardW + 8), y: -dy + (k % 2) * (cardH + 8) });
  }
  return offsets;
}

function rotatePt(p: { x: number; y: number }, deg: number) {
  const r = (deg * Math.PI) / 180;
  const cos = Math.cos(r), sin = Math.sin(r);
  return { x: p.x * cos - p.y * sin, y: p.x * sin + p.y * cos };
}

function CardSlot({
  card,
  width,
  flipped,
  glow,
  onClick,
}: {
  card: CardId;
  width: number;
  flipped: boolean;
  glow: boolean;
  onClick?: () => void;
}) {
  return (
    <motion.div
      animate={{
        boxShadow: glow
          ? "0 0 0 2px #d4a64a, 0 0 26px 4px color-mix(in oklab, #d4a64a 60%, transparent)"
          : "0 0 0 0 rgba(0,0,0,0)",
      }}
      transition={{ duration: 0.3 }}
      onClick={onClick}
      style={{
        borderRadius: 8,
        display: "inline-block",
        cursor: onClick ? "pointer" : "default",
      }}
    >
      <FlipCard
        width={width}
        flipped={flipped}
        back={<CardBack width={width} />}
        face={<CardFace width={width} rank={card.rank} suit={card.suit} />}
      />
    </motion.div>
  );
}

function SeatGrid({
  seat,
  state,
  revealedSlots,
  userRevealedSlots,
  highlights,
  allRevealed,
  onCardClick,
}: {
  seat: SeatId;
  state: BoardState["seats"][SeatId];
  revealedSlots: Set<string>;
  userRevealedSlots: Set<string>;
  highlights: Set<string>;
  allRevealed: boolean;
  onCardClick: (slotKey: string) => void;
}) {
  const cfg = SEAT_LAYOUT[seat];
  const offsets = gridOffsets(cfg.cardW, state.grid.length);
  return (
    <div style={{ position: "absolute", left: cfg.center.x, top: cfg.center.y }}>
      {state.grid.map((card, i) => {
        if (card === null) return null;
        const off = offsets[i] ?? { x: 0, y: 0 };
        const rotated = rotatePt(off, cfg.rotate);
        const tilt = (i % 2 === 0 ? -1.5 : 1.5);
        const slotKey = `${seat}-${i}`;
        const flipped =
          allRevealed ||
          revealedSlots.has(slotKey) ||
          userRevealedSlots.has(slotKey);
        const glow = highlights.has(slotKey);
        return (
          <motion.div
            layout
            key={`${seat}-${card.rank}-${card.suit}`}
            initial={false}
            animate={{
              x: rotated.x - cfg.cardW / 2,
              y: rotated.y - (cfg.cardW * 1.45) / 2,
              rotate: cfg.rotate + tilt,
            }}
            transition={{ type: "spring", stiffness: 280, damping: 30 }}
            style={{ position: "absolute" }}
          >
            <CardSlot
              card={card}
              width={cfg.cardW}
              flipped={flipped}
              glow={glow}
              onClick={() => onCardClick(slotKey)}
            />
          </motion.div>
        );
      })}
    </div>
  );
}

function SeatLabel({
  seat,
  active,
  score,
}: {
  seat: SeatId;
  active: boolean;
  score: number | null;
}) {
  const cfg = SEAT_LAYOUT[seat];
  return (
    <div
      style={{
        position: "absolute",
        left: cfg.center.x + cfg.labelOffset.x,
        top: cfg.center.y + cfg.labelOffset.y,
        transform: "translate(-50%, -50%)",
        textAlign: "center",
        pointerEvents: "none",
      }}
    >
      <motion.div
        animate={{
          borderColor: active
            ? "color-mix(in oklab, #d4a64a 80%, transparent)"
            : "rgba(0,0,0,0)",
          backgroundColor: active
            ? "color-mix(in oklab, #d4a64a 12%, transparent)"
            : "rgba(0,0,0,0)",
        }}
        transition={{ duration: 0.3 }}
        style={{
          display: "inline-block",
          padding: active ? "5px 12px" : "5px 0",
          borderRadius: 4,
          border: "1px solid rgba(0,0,0,0)",
        }}
      >
        <motion.div
          animate={{
            color: active ? "#fbf3dc" : "#ecd596",
            opacity: active ? 1 : 0.65,
          }}
          transition={{ duration: 0.3 }}
          style={{
            fontFamily: "Cinzel, serif",
            letterSpacing: "0.32em",
            fontSize: seat === "you" ? 12 : 11,
            whiteSpace: "nowrap",
          }}
        >
          {SEAT_LAYOUT[seat].name}
        </motion.div>
      </motion.div>
      {active && (
        <motion.div
          initial={{ opacity: 0, y: -2 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          style={{
            marginTop: 4,
            color: "#d4a64a",
            fontFamily: "Inter, sans-serif",
            fontSize: 10,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            fontStyle: "italic",
          }}
        >
          active
        </motion.div>
      )}
      {score !== null && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          style={{
            marginTop: 6,
            fontFamily: "Cinzel, serif",
            color: "#fbf3dc",
            fontSize: 22,
            letterSpacing: "0.05em",
          }}
        >
          {score}
        </motion.div>
      )}
    </div>
  );
}

function DeckAndDiscard({
  board,
  deckRevealed,
  onDeckClick,
}: {
  board: BoardState;
  deckRevealed: boolean;
  onDeckClick: () => void;
}) {
  const top = board.discard[board.discard.length - 1];
  const deckTop = board.deckTop;
  const deckLayers = Math.min(
    4,
    Math.max(1, Math.floor(board.deckCount / 8)),
  );
  return (
    <div style={{ position: "absolute", left: 0, top: 0 }}>
      {/* deck stack */}
      <div
        onClick={deckTop ? onDeckClick : undefined}
        style={{
          position: "absolute",
          left: -36,
          top: -36,
          width: 56 + (deckLayers - 1) * 1.5,
          height: Math.round(56 * 1.45) + (deckLayers - 1) * 1.5,
          cursor: deckTop ? "pointer" : "default",
        }}
      >
        {/* lower layers — always face-down */}
        {Array.from({ length: deckLayers - 1 }).map((_, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              top: -(i + 1) * 1.5,
              left: -(i + 1) * 1.5,
            }}
          >
            <CardBack width={56} />
          </div>
        ))}
        {/* topmost card — flips on click if there is a known top */}
        <div style={{ position: "absolute", top: 0, left: 0 }}>
          {deckTop ? (
            <FlipCard
              width={56}
              flipped={deckRevealed}
              back={<CardBack width={56} />}
              face={<CardFace width={56} rank={deckTop.rank} suit={deckTop.suit} />}
            />
          ) : (
            <CardBack width={56} />
          )}
        </div>
      </div>
      {/* discard pile (top card always shown face-up; empty slot if pile is empty) */}
      <div style={{ position: "absolute", left: 36, top: -36 }}>
        <AnimatePresence mode="popLayout">
          {top ? (
            <motion.div
              key={`${top.rank}-${top.suit}-${board.discard.length}`}
              initial={{ opacity: 0, scale: 0.9, rotate: 0 }}
              animate={{ opacity: 1, scale: 1, rotate: -3 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35 }}
              style={{
                position: "absolute",
                filter:
                  "drop-shadow(0 0 12px color-mix(in oklab, #d4a64a 30%, transparent))",
              }}
            >
              <CardFace width={56} rank={top.rank} suit={top.suit} />
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              style={{
                width: 56,
                height: Math.round(56 * 1.45),
                borderRadius: 8,
                border: "1px dashed color-mix(in oklab, #d4a64a 35%, transparent)",
              }}
            />
          )}
        </AnimatePresence>
      </div>
      {/* sub-labels */}
      <div
        style={{
          position: "absolute",
          left: -36 + 28,
          top: 60,
          transform: "translate(-50%, 0)",
          fontFamily: "Cinzel, serif",
          letterSpacing: "0.32em",
          fontSize: 9,
          color: "#ecd596",
          opacity: 0.6,
        }}
      >
        DECK
      </div>
      <div
        style={{
          position: "absolute",
          left: 36 + 28,
          top: 60,
          transform: "translate(-50%, 0)",
          fontFamily: "Cinzel, serif",
          letterSpacing: "0.32em",
          fontSize: 9,
          color: "#ecd596",
          opacity: 0.6,
        }}
      >
        DISCARD
      </div>
    </div>
  );
}

function HeldCard({ board }: { board: BoardState }) {
  if (!board.heldCard || !board.activeSeat) return null;
  const cfg = SEAT_LAYOUT[board.activeSeat];
  const cx = cfg.center.x * 0.55;
  const cy = cfg.center.y * 0.55;
  return (
    <motion.div
      key={`held-${board.heldCard.rank}-${board.heldCard.suit}`}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      style={{
        position: "absolute",
        left: cx - 30,
        top: cy - 44,
        filter:
          "drop-shadow(0 0 14px color-mix(in oklab, #d4a64a 50%, transparent))",
      }}
    >
      <CardFace width={60} rank={board.heldCard.rank} suit={board.heldCard.suit} />
    </motion.div>
  );
}

export default function WalkThrough() {
  const [step, setStep] = useState(0);
  const [userRevealed, setUserRevealed] = useState<Set<string>>(new Set());
  const [deckRevealed, setDeckRevealed] = useState(false);
  const total = STEPS.length;

  // Step navigation also clears any user-toggled card peeks so they
  // don't leak across steps.
  const go = (delta: number) => {
    setStep((s) => Math.max(0, Math.min(total - 1, s + delta)));
    setUserRevealed(new Set());
    setDeckRevealed(false);
  };

  const goTo = (s: number) => {
    setStep(Math.max(0, Math.min(total - 1, s)));
    setUserRevealed(new Set());
    setDeckRevealed(false);
  };

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") {
        e.preventDefault();
        go(1);
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        go(-1);
      } else if (e.key === "Home") {
        e.preventDefault();
        goTo(0);
      } else if (e.key === "End") {
        e.preventDefault();
        goTo(total - 1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total]);

  const onCardClick = (slotKey: string) => {
    setUserRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(slotKey)) next.delete(slotKey);
      else next.add(slotKey);
      return next;
    });
  };

  const onDeckClick = () => setDeckRevealed((v) => !v);

  const current = STEPS[step];
  const board = current.board;
  const revealedSlots = useMemo(
    () => new Set(board.revealedSlots ?? []),
    [board.revealedSlots],
  );
  const highlights = useMemo(
    () => new Set(board.highlights ?? []),
    [board.highlights],
  );

  return (
    <div style={{ width: "100%", maxWidth: 980, margin: "0 auto" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 18,
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            fontFamily: "Cinzel, serif",
            color: "#ecd596",
            letterSpacing: "0.22em",
            fontSize: 11,
            opacity: 0.7,
            whiteSpace: "nowrap",
          }}
        >
          STEP {step + 1} / {total}
        </div>
        <div
          style={{
            flex: 1,
            height: 1,
            background: "color-mix(in oklab, #d4a64a 30%, transparent)",
          }}
        />
        <button
          onClick={() => goTo(0)}
          style={{
            fontFamily: "Cinzel, serif",
            letterSpacing: "0.18em",
            fontSize: 11,
            color: "#ecd596",
            background: "transparent",
            border: "1px solid color-mix(in oklab, #d4a64a 50%, transparent)",
            padding: "6px 14px",
            borderRadius: 4,
            cursor: "pointer",
          }}
        >
          RESTART
        </button>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={`text-${step}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.3 }}
          style={{ marginBottom: 22 }}
        >
          <div
            style={{
              color: "#f4ede1",
              fontSize: "1.25rem",
              lineHeight: 1.5,
            }}
          >
            {current.caption}
          </div>
          {current.reasoning && (
            <div
              style={{
                marginTop: "1rem",
                color: "color-mix(in oklab, #f4ede1 80%, transparent)",
                fontSize: "0.98rem",
                lineHeight: 1.65,
              }}
            >
              {current.reasoning}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <div
        className="scene-fitter"
        style={{ "--scene-w": 720, "--scene-h": 760 } as Record<string, string | number>}
      >
      <div
        className="scene"
        aria-label="A Cambio walkthrough table view."
      >
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: "10% 8%",
            background:
              "radial-gradient(ellipse 60% 55% at 50% 50%, color-mix(in oklab, #173025 70%, transparent), transparent 70%)",
            filter: "blur(6px)",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: 0,
            height: 0,
          }}
        >
          <DeckAndDiscard board={board} deckRevealed={deckRevealed} onDeckClick={onDeckClick} />
          {(Object.keys(SEAT_LAYOUT) as SeatId[]).map((seat) => (
            <SeatGrid
              key={seat}
              seat={seat}
              state={board.seats[seat]}
              revealedSlots={revealedSlots}
              userRevealedSlots={userRevealed}
              highlights={highlights}
              allRevealed={!!board.showScores}
              onCardClick={onCardClick}
            />
          ))}
          <HeldCard board={board} />
          {(Object.keys(SEAT_LAYOUT) as SeatId[]).map((seat) => (
            <SeatLabel
              key={`label-${seat}`}
              seat={seat}
              active={board.activeSeat === seat}
              score={board.showScores ? totalOf(board.seats[seat]) : null}
            />
          ))}
        </div>
      </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: 12,
          marginTop: 18,
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <button
          onClick={() => go(-1)}
          disabled={step === 0}
          style={{
            fontFamily: "Cinzel, serif",
            letterSpacing: "0.18em",
            fontSize: 12,
            color:
              step === 0
                ? "color-mix(in oklab, #ecd596 30%, transparent)"
                : "#ecd596",
            background: "transparent",
            border: "1px solid color-mix(in oklab, #d4a64a 50%, transparent)",
            padding: "10px 22px",
            borderRadius: 4,
            cursor: step === 0 ? "default" : "pointer",
          }}
        >
          ← PREV
        </button>
        <button
          onClick={() => go(1)}
          disabled={step === total - 1}
          style={{
            fontFamily: "Cinzel, serif",
            letterSpacing: "0.18em",
            fontSize: 12,
            color:
              step === total - 1
                ? "color-mix(in oklab, #ecd596 30%, transparent)"
                : "#0b1410",
            background:
              step === total - 1 ? "transparent" : "#d4a64a",
            border: "1px solid color-mix(in oklab, #d4a64a 50%, transparent)",
            padding: "10px 22px",
            borderRadius: 4,
            cursor: step === total - 1 ? "default" : "pointer",
          }}
        >
          NEXT →
        </button>
      </div>
    </div>
  );
}
