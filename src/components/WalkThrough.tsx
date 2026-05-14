import { motion, AnimatePresence } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { CardBack, CardFace, FlipCard } from "./cards";
import { STEPS, totalOf, type BoardState, type CardId, type SeatId } from "./walkthrough-script";

type SeatConfig = {
  center: { x: number; y: number };
  cardW: number;
  rotate: number;
  name: string;
  labelOffset: { x: number; y: number };
  verticalLabel?: boolean;
};
type SeatLayoutMap = Record<SeatId, SeatConfig>;

interface LayoutPreset {
  layout: SeatLayoutMap;
  scene: { w: number; h: number };
  pileW: number;
  deckLeft: number;
  discardLeft: number;
  pileTop: number;
  subLabelTop: number;
  subLabelFontSize: number;
  heldW: number;
  heldFactor: number;
  showHeld: boolean;
  labelFontSize: number;
  labelSpacing: string;
  subLabelPad: number;
  captionFontSize: string;
  reasoningFontSize: string;
  showActiveText: boolean;
  scoreFontSize: number;
  showPileLabels: boolean;
}

const DESKTOP_PRESET: LayoutPreset = {
  layout: {
    you:   { center: { x: 0,    y: 200  }, cardW: 60, rotate: 0,   name: "SAM",   labelOffset: { x: 0,    y: 135  } },
    north: { center: { x: 0,    y: -200 }, cardW: 48, rotate: 180, name: "BOB",   labelOffset: { x: 0,    y: -125 } },
    west:  { center: { x: -200, y: 0    }, cardW: 48, rotate: 90,  name: "LISA",  labelOffset: { x: -135, y: 0    } },
    east:  { center: { x: 200,  y: 0    }, cardW: 48, rotate: -90, name: "ALICE", labelOffset: { x: 135,  y: 0    } },
  },
  scene: { w: 720, h: 760 },
  pileW: 56,
  deckLeft: -36,
  discardLeft: 36,
  pileTop: -36,
  subLabelTop: 60,
  subLabelFontSize: 9,
  heldW: 60,
  heldFactor: 0.55,
  showHeld: true,
  labelFontSize: 11,
  labelSpacing: "0.32em",
  subLabelPad: 28,
  captionFontSize: "1.25rem",
  reasoningFontSize: "0.98rem",
  showActiveText: true,
  scoreFontSize: 22,
  showPileLabels: true,
};

const MOBILE_PRESET: LayoutPreset = {
  layout: {
    you:   { center: { x: 0,    y: 200  }, cardW: 56, rotate: 0,   name: "SAM",   labelOffset: { x: 0, y: 106 } },
    north: { center: { x: 0,    y: -215 }, cardW: 44, rotate: 180, name: "BOB",   labelOffset: { x: 0, y: -86 } },
    west:  { center: { x: -112, y: -70  }, cardW: 44, rotate: 90,  name: "LISA",  labelOffset: { x: 0, y: -78 } },
    east:  { center: { x: 112,  y: -70  }, cardW: 44, rotate: -90, name: "ALICE", labelOffset: { x: 0, y: -78 } },
  },
  scene: { w: 380, h: 650 },
  pileW: 34,
  deckLeft: -36,
  discardLeft: 4,
  pileTop: 24,
  subLabelTop: 76,
  subLabelFontSize: 7,
  heldW: 0,
  heldFactor: 0,
  showHeld: false,
  labelFontSize: 9,
  labelSpacing: "0.22em",
  subLabelPad: 15,
  captionFontSize: "1.05rem",
  reasoningFontSize: "0.92rem",
  showActiveText: false,
  scoreFontSize: 16,
  showPileLabels: false,
};

function useIsMobile(breakpoint = 640) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const check = () => setIsMobile(mq.matches);
    check();
    mq.addEventListener("change", check);
    return () => mq.removeEventListener("change", check);
  }, [breakpoint]);
  return isMobile;
}

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
  cfg,
  state,
  revealedSlots,
  userRevealedSlots,
  highlights,
  allRevealed,
  onCardClick,
}: {
  seat: SeatId;
  cfg: SeatConfig;
  state: BoardState["seats"][SeatId];
  revealedSlots: Set<string>;
  userRevealedSlots: Set<string>;
  highlights: Set<string>;
  allRevealed: boolean;
  onCardClick: (slotKey: string) => void;
}) {
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
  cfg,
  active,
  score,
  preset,
}: {
  seat: SeatId;
  cfg: SeatConfig;
  active: boolean;
  score: number | null;
  preset: LayoutPreset;
}) {
  const fontSize = preset.labelFontSize + (seat === "you" ? 1 : 0);
  const scoreFontSize = preset.scoreFontSize;
  // If the label sits "above" the seat (negative y offset), the cards are
  // below it, so the score should appear above the label to avoid overlapping
  // the cards on the reveal step.
  const scoreAbove = cfg.labelOffset.y < 0;
  const scoreNode =
    score !== null ? (
      <motion.div
        initial={{ opacity: 0, y: scoreAbove ? 4 : -4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.4 }}
        style={{
          marginTop: scoreAbove ? 0 : 6,
          marginBottom: scoreAbove ? 6 : 0,
          fontFamily: "Cinzel, serif",
          color: "#fbf3dc",
          fontSize: scoreFontSize,
          letterSpacing: "0.05em",
        }}
      >
        {score}
      </motion.div>
    ) : null;
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
      {scoreAbove && scoreNode}
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
          padding: active ? "5px 10px" : "5px 0",
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
            letterSpacing: preset.labelSpacing,
            fontSize,
            whiteSpace: "nowrap",
          }}
        >
          {cfg.name}
        </motion.div>
      </motion.div>
      {active && preset.showActiveText && (
        <motion.div
          initial={{ opacity: 0, y: -2 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          style={{
            marginTop: 4,
            color: "#d4a64a",
            fontFamily: "Inter, sans-serif",
            fontSize: Math.max(9, fontSize - 1),
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            fontStyle: "italic",
          }}
        >
          active
        </motion.div>
      )}
      {!scoreAbove && scoreNode}
    </div>
  );
}

function DeckAndDiscard({
  board,
  deckRevealed,
  onDeckClick,
  preset,
}: {
  board: BoardState;
  deckRevealed: boolean;
  onDeckClick: () => void;
  preset: LayoutPreset;
}) {
  const top = board.discard[board.discard.length - 1];
  const deckTop = board.deckTop;
  const deckLayers = Math.min(
    4,
    Math.max(1, Math.floor(board.deckCount / 8)),
  );
  const { pileW, deckLeft, discardLeft, pileTop, subLabelTop, subLabelFontSize, subLabelPad } = preset;
  return (
    <div style={{ position: "absolute", left: 0, top: 0 }}>
      {/* deck stack */}
      <div
        onClick={deckTop ? onDeckClick : undefined}
        style={{
          position: "absolute",
          left: deckLeft,
          top: pileTop,
          width: pileW + (deckLayers - 1) * 1.5,
          height: Math.round(pileW * 1.45) + (deckLayers - 1) * 1.5,
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
            <CardBack width={pileW} />
          </div>
        ))}
        {/* topmost card — flips on click if there is a known top */}
        <div style={{ position: "absolute", top: 0, left: 0 }}>
          {deckTop ? (
            <FlipCard
              width={pileW}
              flipped={deckRevealed}
              back={<CardBack width={pileW} />}
              face={<CardFace width={pileW} rank={deckTop.rank} suit={deckTop.suit} />}
            />
          ) : (
            <CardBack width={pileW} />
          )}
        </div>
      </div>
      {/* discard pile (top card always shown face-up; empty slot if pile is empty) */}
      <div style={{ position: "absolute", left: discardLeft, top: pileTop }}>
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
              <CardFace width={pileW} rank={top.rank} suit={top.suit} />
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              style={{
                width: pileW,
                height: Math.round(pileW * 1.45),
                borderRadius: 8,
                border: "1px dashed color-mix(in oklab, #d4a64a 35%, transparent)",
              }}
            />
          )}
        </AnimatePresence>
      </div>
      {preset.showPileLabels && (
        <>
          <div
            style={{
              position: "absolute",
              left: deckLeft + subLabelPad,
              top: subLabelTop,
              transform: "translate(-50%, 0)",
              fontFamily: "Cinzel, serif",
              letterSpacing: "0.32em",
              fontSize: subLabelFontSize,
              color: "#ecd596",
              opacity: 0.6,
            }}
          >
            DECK
          </div>
          <div
            style={{
              position: "absolute",
              left: discardLeft + subLabelPad,
              top: subLabelTop,
              transform: "translate(-50%, 0)",
              fontFamily: "Cinzel, serif",
              letterSpacing: "0.32em",
              fontSize: subLabelFontSize,
              color: "#ecd596",
              opacity: 0.6,
            }}
          >
            DISCARD
          </div>
        </>
      )}
    </div>
  );
}

function HeldCard({ board, preset }: { board: BoardState; preset: LayoutPreset }) {
  if (!board.heldCard || !board.activeSeat || !preset.showHeld) return null;
  const cfg = preset.layout[board.activeSeat];
  const cx = cfg.center.x * preset.heldFactor;
  const cy = cfg.center.y * preset.heldFactor;
  const w = preset.heldW;
  const h = Math.round(w * 1.45);
  return (
    <motion.div
      key={`held-${board.heldCard.rank}-${board.heldCard.suit}`}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      style={{
        position: "absolute",
        left: cx - w / 2,
        top: cy - h / 2,
        zIndex: 5,
        filter:
          "drop-shadow(0 0 14px color-mix(in oklab, #d4a64a 50%, transparent))",
      }}
    >
      <CardFace width={w} rank={board.heldCard.rank} suit={board.heldCard.suit} />
    </motion.div>
  );
}

export default function WalkThrough() {
  const isMobile = useIsMobile();
  const preset = isMobile ? MOBILE_PRESET : DESKTOP_PRESET;
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
    <div
      style={{
        width: "100%",
        maxWidth: 980,
        margin: "0 auto",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: isMobile ? 8 : 12,
          marginBottom: isMobile ? 12 : 18,
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            fontFamily: "Cinzel, serif",
            color: "#ecd596",
            letterSpacing: "0.22em",
            fontSize: isMobile ? 10 : 11,
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
            fontSize: isMobile ? 10 : 11,
            color: "#ecd596",
            background: "transparent",
            border: "1px solid color-mix(in oklab, #d4a64a 50%, transparent)",
            padding: isMobile ? "5px 10px" : "6px 14px",
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
          style={{ marginBottom: isMobile ? 14 : 22 }}
        >
          <div
            style={{
              color: "#f4ede1",
              fontSize: preset.captionFontSize,
              lineHeight: 1.5,
            }}
          >
            {current.caption}
          </div>
          {current.reasoning && (
            <div
              style={{
                marginTop: isMobile ? "0.6rem" : "1rem",
                color: "color-mix(in oklab, #f4ede1 80%, transparent)",
                fontSize: preset.reasoningFontSize,
                lineHeight: 1.6,
              }}
            >
              {current.reasoning}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <div
        className="scene-fitter"
        style={{ "--scene-w": preset.scene.w, "--scene-h": preset.scene.h } as Record<string, string | number>}
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
          <DeckAndDiscard board={board} deckRevealed={deckRevealed} onDeckClick={onDeckClick} preset={preset} />
          {(Object.keys(preset.layout) as SeatId[]).map((seat) => (
            <SeatGrid
              key={seat}
              seat={seat}
              cfg={preset.layout[seat]}
              state={board.seats[seat]}
              revealedSlots={revealedSlots}
              userRevealedSlots={userRevealed}
              highlights={highlights}
              allRevealed={!!board.showScores}
              onCardClick={onCardClick}
            />
          ))}
          <HeldCard board={board} preset={preset} />
          {(Object.keys(preset.layout) as SeatId[]).map((seat) => (
            <SeatLabel
              key={`label-${seat}`}
              seat={seat}
              cfg={preset.layout[seat]}
              active={board.activeSeat === seat}
              score={board.showScores ? totalOf(board.seats[seat]) : null}
              preset={preset}
            />
          ))}
        </div>
      </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: 12,
          marginTop: isMobile ? 12 : 18,
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
            padding: isMobile ? "12px 0" : "10px 22px",
            borderRadius: 4,
            cursor: step === 0 ? "default" : "pointer",
            flex: isMobile ? 1 : "none",
            minHeight: 44,
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
            padding: isMobile ? "12px 0" : "10px 22px",
            borderRadius: 4,
            cursor: step === total - 1 ? "default" : "pointer",
            flex: isMobile ? 1 : "none",
            minHeight: 44,
          }}
        >
          NEXT →
        </button>
      </div>
    </div>
  );
}
