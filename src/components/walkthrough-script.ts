/**
 * Scripted walkthrough of a single Cambio game.
 *
 * The viewer sees the table from a *shifting* perspective: at each step,
 * only the cards that are *currently* being looked at by the active player
 * are face-up. Everything else is face-down. The deck count, discard top,
 * and the active player's currently-held card are always shown.
 *
 * Conventions:
 *   - SeatId order around the table: "you" (south, displayed as SAM),
 *     west (Lisa), north (Bob), east (Alice).
 *   - Each seat's grid is an ordered array of cards, slot order
 *     0=TL, 1=TR, 2=BL, 3=BR. Penalty cards append at index 4+.
 *   - `revealedSlots` is the set of slot keys ("west-2") whose cards are
 *     currently face-up. This is recomputed for every step.
 *   - `highlights` is a separate set of slot keys to draw attention to
 *     (glow), independent of whether the card is revealed.
 *   - `discard` is the discard pile bottom→top; the last entry is the top.
 *     The top is always shown face-up. Cards beneath are not rendered.
 *   - `showScores` reveals every card and draws score totals next to seats.
 */

export type SeatId = "you" | "west" | "north" | "east";

export type Suit = "hearts" | "diamonds" | "spades" | "clubs" | "joker";

export interface CardId {
  rank: string;
  suit: Suit;
}

export interface SeatState {
  /** Slot-stable grid: removed cards become null so the remaining cards
   *  don't shift. Penalty cards append to the end. */
  grid: (CardId | null)[];
}

export interface BoardState {
  seats: Record<SeatId, SeatState>;
  /** Number of cards remaining in the deck (visual stack thickness only). */
  deckCount: number;
  /** Discard pile bottom→top; last entry is what's visible on top. */
  discard: CardId[];
  /** Player whose turn it is, or null when no one is mid-turn. */
  activeSeat: SeatId | null;
  /** Card the active player is currently holding off-grid (just drawn). */
  heldCard?: CardId | null;
  /** The card that's currently on top of the deck (next to be drawn).
   *  Used for the click-to-peek-deck learning aid. */
  deckTop?: CardId | null;
  /** Slot keys ("you-2") that are face-up during this step. */
  revealedSlots?: string[];
  /** Slot keys to highlight with a glow — independent of revelation. */
  highlights?: string[];
  /** End-of-game state: every card face-up, scores visible. */
  showScores?: boolean;
}

export interface Step {
  caption: string;
  reasoning?: string;
  board: BoardState;
}

/* ----------------------------------------------------------------------- */
/*  Card-value scoring (cambiocardgame.com canonical)                       */
/* ----------------------------------------------------------------------- */

export function scoreOf(c: CardId): number {
  if (c.suit === "joker") return 0;
  if (c.rank === "K" && (c.suit === "hearts" || c.suit === "diamonds")) return -1;
  if (c.rank === "K") return 10;
  if (c.rank === "A") return 1;
  if (c.rank === "J" || c.rank === "Q") return 10;
  return parseInt(c.rank, 10);
}

export function totalOf(seat: SeatState): number {
  return seat.grid.reduce<number>(
    (sum, c) => sum + (c === null ? 0 : scoreOf(c)),
    0,
  );
}

/* ----------------------------------------------------------------------- */
/*  The deterministic game                                                  */
/* ----------------------------------------------------------------------- */

const c = (rank: string, suit: Suit): CardId => ({ rank, suit });

// Initial deal — slot order TL, TR, BL, BR.
type Slot = CardId | null;
const INITIAL: Record<SeatId, Slot[]> = {
  you:   [c("4", "hearts"),    c("3", "clubs"),     c("A", "hearts"),    c("6", "diamonds")],
  west:  [c("Q", "spades"),    c("4", "diamonds"),  c("10", "clubs"),    c("4", "spades")],
  north: [c("10", "spades"),   c("6", "clubs"),     c("5", "spades"),    c("10", "hearts")],
  east:  [c("7", "clubs"),     c("7", "diamonds"),  c("2", "diamonds"),  c("J", "hearts")],
};

// 54 cards (52 + 2 jokers) minus 16 dealt = 38 in the deck before play.
const INITIAL_DECK_COUNT = 38;

function board(
  grids: Record<SeatId, Slot[]>,
  opts: Omit<BoardState, "seats">,
): BoardState {
  return {
    seats: {
      you:   { grid: grids.you },
      west:  { grid: grids.west },
      north: { grid: grids.north },
      east:  { grid: grids.east },
    },
    ...opts,
  };
}

function withSlot(grids: Record<SeatId, Slot[]>, seat: SeatId, index: number, card: CardId): Record<SeatId, Slot[]> {
  const next = { ...grids };
  next[seat] = next[seat].map((existing, i) => (i === index ? card : existing));
  return next;
}

function appendCard(grids: Record<SeatId, Slot[]>, seat: SeatId, card: CardId): Record<SeatId, Slot[]> {
  const next = { ...grids };
  next[seat] = [...next[seat], card];
  return next;
}

/** Slot-stable removal: leaves a null at the index instead of compacting. */
function removeSlot(grids: Record<SeatId, Slot[]>, seat: SeatId, index: number): Record<SeatId, Slot[]> {
  const next = { ...grids };
  next[seat] = next[seat].map((card, i) => (i === index ? null : card));
  return next;
}

function swapSlots(
  grids: Record<SeatId, Slot[]>,
  a: { seat: SeatId; index: number },
  b: { seat: SeatId; index: number },
): Record<SeatId, Slot[]> {
  const next = { ...grids };
  const cardA = next[a.seat][a.index];
  const cardB = next[b.seat][b.index];
  next[a.seat] = next[a.seat].map((card, i) => (i === a.index ? cardB : card));
  next[b.seat] = next[b.seat].map((card, i) => (i === b.index ? cardA : card));
  return next;
}

export const STEPS: Step[] = (() => {
  const out: Step[] = [];
  let grids = INITIAL;
  let deck = INITIAL_DECK_COUNT;
  let pile: CardId[] = [];

  // 0 — Deal
  out.push({
    caption: "Deal. Four face-down cards to each player in a 2×2 grid.",
    reasoning:
      "You only see a card when the active player is looking at it.",
    board: board(grids, { deckCount: deck, discard: pile, activeSeat: null, deckTop: c("8", "diamonds") }),
  });

  // 1 — Opening peek
  out.push({
    caption: "Opening peek. Every player privately looks at their own bottom two cards.",
    reasoning:
      "Sam sees A♥, 6♦. Lisa sees 10♣, 4♠. Bob sees 5♠, 10♥. Alice sees 2♦, J♥. No more free peeks after this.",
    board: board(grids, {
      deckCount: deck,
      discard: pile,
      activeSeat: null,
      deckTop: c("8", "diamonds"),
      revealedSlots: [
        "you-2", "you-3",
        "west-2", "west-3",
        "north-2", "north-3",
        "east-2", "east-3",
      ],
      highlights: [
        "you-2", "you-3",
        "west-2", "west-3",
        "north-2", "north-3",
        "east-2", "east-3",
      ],
    }),
  });

  // 2 — Sam draws 8♦
  deck--;
  out.push({
    caption: "Sam's turn. He draws an 8♦.",
    reasoning:
      "8 is a power card. Discard direct for a free self-peek.",
    board: board(grids, {
      deckCount: deck,
      discard: pile,
      activeSeat: "you",
      heldCard: c("8", "diamonds"),
      deckTop: c("3", "spades"),
    }),
  });

  // 3 — Sam discards 8♦, peeks own TL = 4♥
  pile = [...pile, c("8", "diamonds")];
  out.push({
    caption: "Sam discards the 8♦ — \"see your fate\" fires. He peeks his TL: 4♥.",
    reasoning:
      "Sam now knows three of four: 4 + 1 + 6 = 11. TR unknown.",
    board: board(grids, {
      deckCount: deck,
      discard: pile,
      activeSeat: "you",
      deckTop: c("3", "spades"),
      revealedSlots: ["you-0"],
      highlights: ["you-0"],
    }),
  });

  // 4 — Lisa draws 3♠
  deck--;
  out.push({
    caption: "Lisa's turn. She draws a 3♠.",
    reasoning:
      "She knows BL = 10♣. Swap the 3 in: −7, and the 10 fires \"spy again.\"",
    board: board(grids, {
      deckCount: deck,
      discard: pile,
      activeSeat: "west",
      heldCard: c("3", "spades"),
      deckTop: c("5", "hearts"),
    }),
  });

  // 5 — Lisa swaps 3♠ into BL, displaces 10♣, spy peek Alice's BR = J♥
  grids = withSlot(grids, "west", 2, c("3", "spades"));
  pile = [...pile, c("10", "clubs")];
  out.push({
    caption: "Lisa swaps the 3♠ into BL. The 10♣ fires \"spy again\" — she peeks Alice's BR → J♥.",
    reasoning:
      "Remember the J♥ — it matters in step 13.",
    board: board(grids, {
      deckCount: deck,
      discard: pile,
      activeSeat: "west",
      deckTop: c("5", "hearts"),
      revealedSlots: ["east-3"],
      highlights: ["west-2", "east-3"],
    }),
  });

  // 6 — Bob snaps his known BR = 10♥ onto the 10♣
  grids = removeSlot(grids, "north", 3);
  pile = [...pile, c("10", "hearts")];
  out.push({
    caption: "SNAP. Bob slaps his BR 10♥ onto the 10♣. Grid shrinks 4 → 3.",
    reasoning:
      "Snapping your own card removes it with no replacement. Bob drops 10 free.",
    board: board(grids, {
      deckCount: deck,
      discard: pile,
      activeSeat: "west",
      deckTop: c("5", "hearts"),
      highlights: ["north-3"],
    }),
  });

  // 7 — Bob draws 5♥
  deck--;
  out.push({
    caption: "Bob's turn. He draws a 5♥. He swaps it into his unknown TL.",
    board: board(grids, {
      deckCount: deck,
      discard: pile,
      activeSeat: "north",
      heldCard: c("5", "hearts"),
      deckTop: c("8", "clubs"),
    }),
  });

  // 8 — Bob swaps 5♥ into TL, displaces 10♠, spy Alice's TL = 7♣
  grids = withSlot(grids, "north", 0, c("5", "hearts"));
  pile = [...pile, c("10", "spades")];
  out.push({
    caption: "Bob swaps 5♥ into TL. Displaced 10♠ fires \"spy again\" — he peeks Alice's TL → 7♣.",
    reasoning:
      "Lucky: the unknown was a 10. −5 swap plus a free spy.",
    board: board(grids, {
      deckCount: deck,
      discard: pile,
      activeSeat: "north",
      deckTop: c("8", "clubs"),
      revealedSlots: ["east-0"],
      highlights: ["north-0", "east-0"],
    }),
  });

  // 9 — Lisa FAILED SNAP — slaps her BL forgetting she just dumped the 10
  grids = appendCard(grids, "west", c("8", "clubs"));
  out.push({
    caption: "Lisa snaps on the 10♠, forgetting she swapped the 10 out of BL. Failed snap.",
    reasoning:
      "Penalty: she draws a face-down card as a fifth card.",
    board: board(grids, {
      deckCount: deck - 1,
      discard: pile,
      activeSeat: "north",
      deckTop: c("K", "clubs"),
      revealedSlots: ["west-2"],
      highlights: ["west-2", "west-4"],
    }),
  });
  deck--;

  // 10 — Alice draws K♣
  deck--;
  out.push({
    caption: "Alice's turn. She draws a K♣.",
    reasoning:
      "She holds J♥ (10). Everyone just saw Lisa's BL is a 3♠. Burn the K to swap J for 3.",
    board: board(grids, {
      deckCount: deck,
      discard: pile,
      activeSeat: "east",
      heldCard: c("K", "clubs"),
      deckTop: c("2", "clubs"),
    }),
  });

  // 11 — Alice discards K♣, peek own TR = 7♦, swap her BR (J♥) ↔ Lisa's BL (3♠)
  pile = [...pile, c("K", "clubs")];
  grids = swapSlots(grids, { seat: "east", index: 3 }, { seat: "west", index: 2 });
  out.push({
    caption: "Alice discards K♣. Peeks her TR (7♦), swaps her BR (J♥) ↔ Lisa's BL (3♠). Alice −7, Lisa +7.",
    reasoning:
      "Lisa can deduce her new BL is the J♥ she spied in step 5.",
    board: board(grids, {
      deckCount: deck,
      discard: pile,
      activeSeat: "east",
      deckTop: c("2", "clubs"),
      revealedSlots: ["east-1"],
      highlights: ["east-1", "east-3", "west-2"],
    }),
  });

  // 12 — Sam calls Cambio
  out.push({
    caption: "Sam's turn 2. He calls CAMBIO.",
    reasoning:
      "Sam: 11 known + 1 unknown ≈ 17. Lisa has 5 cards. Bob has unknowns. Alice just absorbed an unknown. Sam locks in the safest hand.",
    board: board(grids, {
      deckCount: deck,
      discard: pile,
      activeSeat: "you",
      deckTop: c("2", "clubs"),
    }),
  });

  // 13 — Lisa final turn: draws 2♣, swaps into BL (deduced J♥). J fires
  //      swap-unseen; she swaps her TL ↔ Alice's BR.
  deck--;
  grids = withSlot(grids, "west", 2, c("2", "clubs"));
  pile = [...pile, c("J", "hearts")];
  grids = swapSlots(grids, { seat: "west", index: 0 }, { seat: "east", index: 3 });
  out.push({
    caption: "Lisa's final turn. She draws 2♣, deduces BL = J♥, swaps it in (−8). J fires swap-unseen — she blind-swaps TL ↔ Alice's BR (known 3♠).",
    reasoning:
      "Unknown TL was Q♠ — another −7. Turn total: Lisa −15, Alice +7.",
    board: board(grids, {
      deckCount: deck,
      discard: pile,
      activeSeat: "west",
      deckTop: c("7", "spades"),
      highlights: ["west-2", "west-0", "east-3"],
    }),
  });

  // 14 — Bob final turn: draws 7♠, discards directly, see-your-fate, peek own TR = 6♣
  deck--;
  pile = [...pile, c("7", "spades")];
  out.push({
    caption: "Bob's final turn. He draws 7♠, discards direct — \"see your fate\" — peeks TR → 6♣.",
    reasoning:
      "Every swap raises his score. Final: 16.",
    board: board(grids, {
      deckCount: deck,
      discard: pile,
      activeSeat: "north",
      deckTop: c("4", "clubs"),
      revealedSlots: ["north-1"],
      highlights: ["north-1"],
    }),
  });

  // 15 — Alice final turn: draws 4♣, swaps into TR (known 7♦),
  //      7 fires see-your-fate, peek own TL = 7♣.
  deck--;
  grids = withSlot(grids, "east", 1, c("4", "clubs"));
  pile = [...pile, c("7", "diamonds")];
  out.push({
    caption: "Alice's final turn. She draws 4♣, swaps into TR (7♦). The 7 fires see-your-fate — she peeks TL → 7♣.",
    reasoning:
      "−3. Final: 7 + 4 + 2 + 10 = 23.",
    board: board(grids, {
      deckCount: deck,
      discard: pile,
      activeSeat: "east",
      revealedSlots: ["east-0"],
      highlights: ["east-0", "east-1"],
    }),
  });

  // 16 — Reveal
  out.push({
    caption: "Everyone reveals. Lowest total wins.",
    reasoning:
      "Sam 14 · Bob 16 · Lisa 21 · Alice 23. Sam wins by 2.",
    board: board(grids, {
      deckCount: deck,
      discard: pile,
      activeSeat: null,
      showScores: true,
    }),
  });

  return out;
})();
