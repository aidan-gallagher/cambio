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
    caption: "The deck is shuffled and four cards are dealt face-down to each player in a 2×2 grid.",
    reasoning:
      "All cards are face-down. From here on you'll only see a card when the player whose turn it is is actually looking at it.",
    board: board(grids, { deckCount: deck, discard: pile, activeSeat: null, deckTop: c("8", "diamonds") }),
  });

  // 1 — Opening peek
  out.push({
    caption: "Opening peek. Every player privately looks at their own bottom two cards.",
    reasoning:
      "Each player gets exactly one free peek before play begins — their two bottom cards. Sam now privately knows A♥ and 6♦; Lisa knows 10♣ and 4♠; Bob knows 5♠ and 10♥ (and that 10♥ is about to matter); Alice knows 2♦ and J♥. After this, no more free looks.",
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
      "Sam already knows two of his cards sum to only 7 (A♥ + 6♦), with TL and TR still unknown. The 8 he just drew is heavier than an average unknown — and 8 is a power card. Discarding it directly trades zero score for a free private peek.",
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
    caption: "Sam discards the 8♦ — \"see your fate\" fires. He peeks his top-left: 4♥.",
    reasoning:
      "Sam now privately knows three of his four cards (TL 4♥, BL A♥, BR 6♦) — total 11 plus an unknown TR. He's already deep in low-hand territory.",
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
    caption: "Lisa's turn. She draws a 3♠ — and she knows there's a 10♣ sitting in her grid.",
    reasoning:
      "From the opening peek Lisa knows her bottom-left is a 10♣. A 3 swapped into that exact slot is a guaranteed 7-point drop, and the displaced 10 is a power card — \"spy again\" — so she gets to peek an opponent on the way out. This is the textbook play.",
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
    caption: "Lisa swaps the 3♠ into her bottom-left. The 10♣ hits the discard, fires \"spy again,\" and Lisa peeks Alice's bottom-right → J♥.",
    reasoning:
      "Deterministic −7 on the swap, plus a free reconnaissance peek. She picks Alice's BR on a hunch. A J found there is exactly the kind of intelligence she'll be able to reuse later — remember this peek; it returns in step 13.",
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
    caption: "SNAP. Bob remembers his bottom-right is a 10♥ from the opening peek and slaps it onto the 10♣. Successful snap — his grid shrinks 4 → 3.",
    reasoning:
      "Snapping your own card is pure value: the card just leaves your grid, no replacement, no power activation. Bob's score drops by 10 in a single instant. He now holds three cards: TL (10♠, unknown to him), TR (6♣, unknown), BL (5♠, peeked).",
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
    caption: "Bob's turn. He draws a 5♥.",
    reasoning:
      "Bob's only known card is BL = 5♠. Swapping the 5♥ into BL is a no-op. Discarding directly does nothing (5 isn't a power card). His best line is to swap into one of the unknowns: about a 50% chance of triggering a power on the way out, and the displaced card is on average roughly a 6 — a small expected gain. He picks TL.",
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
    caption: "Bob swaps the 5♥ into his top-left. The displaced 10♠ activates — \"spy again\" — and Bob peeks Alice's top-left → 7♣.",
    reasoning:
      "The gamble pays off: the unknown was a 10♠ (−5 score) AND a power card (free spy). Bob now knows two of his three cards (TL 5♥, BL 5♠) summing to 10, with TR still unknown — plus a private read on Alice's TL.",
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
    caption: "Lisa lunges to snap. Muscle memory from the opening peek says \"10 in BL,\" she forgets she just swapped it out, and slaps her BL face-up — exposing her own 3♠. Failed snap.",
    reasoning:
      "A real-world misplay: the opening-peek memory of \"10 in my bottom-left\" overrode her own most-recent move. The 3♠ stays publicly visible and Lisa draws a face-down penalty card (8♣) into a fifth slot. Her grid: TL Q♠, TR 4♦, BL 3♠ (visible), BR 4♠, slot 4 8♣.",
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
    caption: "Alice's turn. She draws a K♣ — a Black King, worth 10 if kept but a peek-and-fling if discarded.",
    reasoning:
      "A Black King discarded is the most leveraged single card in the game. Alice already holds J♥ at her BR (10 points) — and Lisa's exposed 3♠ at BL is the lowest publicly-known card on the table. Trading her J for that 3 is a clean −7. The K is worth burning for the effect.",
    board: board(grids, {
      deckCount: deck,
      discard: pile,
      activeSeat: "east",
      heldCard: c("K", "clubs"),
      deckTop: c("2", "clubs"),
      // Lisa's BL is still publicly exposed from the failed snap.
      revealedSlots: ["west-2"],
    }),
  });

  // 11 — Alice discards K♣, peek own TR = 7♦, swap her BR (J♥) ↔ Lisa's BL (3♠)
  pile = [...pile, c("K", "clubs")];
  grids = swapSlots(grids, { seat: "east", index: 3 }, { seat: "west", index: 2 });
  out.push({
    caption: "Alice discards the K♣ — peek-and-fling. She peeks her own TR (7♦) and then swaps her BR (J♥) with Lisa's exposed BL (3♠). Alice −7, Lisa +7.",
    reasoning:
      "Peek-and-fling resolves as two independent effects. Alice picks the peek on her TR (one of her two remaining unknowns — she still doesn't know TL). The swap targets the lowest publicly-known card on the table. The 3♠ moves face-up into Alice's BR; the J♥ slides face-down into Lisa's BL. Lisa, having seen Alice's BR was a J back in step 5, can now deduce her new BL is that J — if she's paying attention.",
    board: board(grids, {
      deckCount: deck,
      discard: pile,
      activeSeat: "east",
      deckTop: c("2", "clubs"),
      revealedSlots: ["east-1", "east-3"],
      highlights: ["east-1", "east-3", "west-2"],
    }),
  });

  // 12 — Sam calls Cambio
  out.push({
    caption: "Sam's turn 2. Instead of drawing, he calls CAMBIO.",
    reasoning:
      "Sam has 3 of 4 cards known: 4 + 1 + 6 = 11 plus an unknown TR — call it ~17 on the average, 21 in the worst case. Table read: Lisa is sitting on five cards including a face-down penalty and an unknown she just absorbed from Alice (Alice burned a King to dump it, so it's almost certainly heavy). Bob snapped a 10, then swapped a drawn card into TL displacing another 10 — he's down to three cards but two of them are still unknowns. Alice unloaded her J onto Lisa but still carries unknowns of her own. Sam's known-low is the safest hand on the table; he locks it in before anyone else can grind theirs down further.",
    board: board(grids, {
      deckCount: deck,
      discard: pile,
      activeSeat: "you",
      deckTop: c("2", "clubs"),
      // Alice's BR now holds the exposed 3♠ that came from Lisa's BL.
      revealedSlots: ["east-3"],
    }),
  });

  // 13 — Lisa final turn: draws 2♣, swaps into BL (deduced J♥). J fires
  //      swap-unseen; she swaps her TL ↔ Alice's BR.
  deck--;
  grids = withSlot(grids, "west", 2, c("2", "clubs"));
  pile = [...pile, c("J", "hearts")];
  grids = swapSlots(grids, { seat: "west", index: 0 }, { seat: "east", index: 3 });
  out.push({
    caption: "Lisa's final turn. She draws a 2♣ and — connecting her step-5 spy to Alice's K-swap — deduces her BL is that J♥. She swaps the 2 in (−8). The displaced J fires swap-unseen, and she blind-swaps her unknown TL with Alice's exposed BR (3♠).",
    reasoning:
      "Two big drops in one turn, both enabled by attention paid earlier. The BL swap is a deterministic −8 (J → 2). The J's swap-unseen lets her dump an unknown for a known low: her TL was Q♠ (10), Alice's BR was 3♠ — Lisa drops another 7. Total turn: −15 on Lisa, +7 on Alice.",
    board: board(grids, {
      deckCount: deck,
      discard: pile,
      activeSeat: "west",
      deckTop: c("7", "spades"),
      revealedSlots: ["west-0"],
      highlights: ["west-2", "west-0", "east-3"],
    }),
  });

  // 14 — Bob final turn: draws 7♠, discards directly, see-your-fate, peek own TR = 6♣
  deck--;
  pile = [...pile, c("7", "spades")];
  out.push({
    caption: "Bob's final turn. He draws a 7♠. Every swap raises his score, so he discards directly — \"see your fate\" — and peeks his last unknown (TR → 6♣).",
    reasoning:
      "Bob's grid is TL 5♥, TR ?, BL 5♠. Swapping a 7 displaces a 5 or an unknown averaging 6 — every option pushes his score up. The 7's see-your-fate gives him the satisfaction of full hand knowledge (final: 16) but no further drop.",
    board: board(grids, {
      deckCount: deck,
      discard: pile,
      activeSeat: "north",
      deckTop: c("4", "clubs"),
      // Lisa's TL now publicly holds the 3♠ from her swap-unseen.
      revealedSlots: ["north-1", "west-0"],
      highlights: ["north-1"],
    }),
  });

  // 15 — Alice final turn: draws 4♣, swaps into TR (known 7♦),
  //      7 fires see-your-fate, peek own TL = 7♣.
  deck--;
  grids = withSlot(grids, "east", 1, c("4", "clubs"));
  pile = [...pile, c("7", "diamonds")];
  out.push({
    caption: "Alice's final turn. She draws a 4♣ and swaps it into her TR (known 7♦). The displaced 7 fires see-your-fate; she peeks her TL → 7♣.",
    reasoning:
      "TR was Alice's only known high card, so swapping the 4 in is a deterministic −3. She still has one unknown (her BR — whatever Lisa just dumped on her via swap-unseen), but no fourth action can do anything about it. The 7's see-your-fate is purely informational; she peeks TL for closure. Final: 7 + 4 + 2 + Q♠ = 23.",
    board: board(grids, {
      deckCount: deck,
      discard: pile,
      activeSeat: "east",
      // Lisa's TL still publicly shows the 3♠.
      revealedSlots: ["east-0", "west-0"],
      highlights: ["east-0", "east-1"],
    }),
  });

  // 16 — Reveal
  out.push({
    caption: "Everyone reveals. Lowest total wins.",
    reasoning:
      "SAM: 4 + 3 + 1 + 6 = 14 — winner. BOB: 5 + 6 + 5 = 16 — second. LISA: 3 + 4 + 2 + 4 + 8 = 21 — third. ALICE: 7 + 4 + 2 + 10 = 23 — fourth. Sam's call held by 2. Lessons: optimal first-turn swaps compound (Lisa's −7 setup made her J-deduction five steps later worth another −15); a clean snap of your own known card is a free −10 (Bob); and a confident Cambio call against a tightly-clustered field can still hold if you're already deepest.",
    board: board(grids, {
      deckCount: deck,
      discard: pile,
      activeSeat: null,
      showScores: true,
    }),
  });

  return out;
})();
