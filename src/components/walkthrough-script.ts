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
  north: [c("10", "spades"),   c("9", "diamonds"),  c("4", "clubs"),     c("7", "spades")],
  east:  [c("7", "clubs"),     c("7", "diamonds"),  c("2", "diamonds"),  c("J", "hearts")],
};

const INITIAL_DECK_COUNT = 36;

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
      "Each player gets exactly one free peek before play begins — their two bottom cards. After this, no more free looks. From now on the only way to learn a card is via a power-card effect or by watching what other people discard.",
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
      "The first three actions of every turn are draw, decide, discard. Sam's drawn card is shown above his seat — that's the only card visible right now.",
    board: board(grids, {
      deckCount: deck,
      discard: pile,
      activeSeat: "you",
      heldCard: c("8", "diamonds"),
      deckTop: c("3", "spades"),
    }),
  });

  // 3 — Sam discards 8♦; sees-your-fate peeks his top-left (4♥)
  pile = [...pile, c("8", "diamonds")];
  out.push({
    caption: "Sam discards the 8♦ — \"see your fate\" fires. He peeks his top-left… 4♥. Already low.",
    reasoning:
      "Sevens and eights let the discarding player look at one of their own cards. Sam now privately knows three of his four cards (top-left 4♥, bottom-left A♥, bottom-right 6♦). His top-right is still a mystery.",
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
    caption: "Lisa's turn. She draws a 3♠ — a low card she'd love to keep.",
    reasoning:
      "Lisa knows her bottom two cards from the opening peek (10♣ and 4♠). She doesn't know either of her top cards, but she trusts they're probably worse than a 3 — and the 3 isn't a power card, so discarding it directly would do nothing useful.",
    board: board(grids, {
      deckCount: deck,
      discard: pile,
      activeSeat: "west",
      heldCard: c("3", "spades"),
      deckTop: c("5", "hearts"),
    }),
  });

  // 5 — Lisa swaps 3♠ into TR; old 4♦ to discard
  grids = withSlot(grids, "west", 1, c("3", "spades"));
  pile = [...pile, c("4", "diamonds")];
  out.push({
    caption: "Lisa swaps the 3♠ into her top-right. The displaced 4♦ hits the discard pile — 4 isn't a power card, so no effect.",
    reasoning:
      "Lisa took a small gamble: the unknown card she just discarded turned out to be a 4 (worth 4), almost the same as the 3 she swapped in. Net change to her score: −1. The 4 sits face-up on the pile, ready to be snapped by anyone who has a matching 4.",
    board: board(grids, {
      deckCount: deck,
      discard: pile,
      activeSeat: "west",
      deckTop: c("5", "hearts"),
      highlights: ["west-1"],
    }),
  });

  // 6 — Bob snaps his 4♣ onto the 4♦
  grids = removeSlot(grids, "north", 2);
  pile = [...pile, c("4", "clubs")];
  out.push({
    caption: "SNAP. Bob remembers his bottom-left is a 4♣ from the opening peek and slaps it onto the 4♦. His grid shrinks 4 → 3.",
    reasoning:
      "When you snap one of your own cards onto a same-rank discard, that card just leaves your grid — no replacement. Bob's score drops by 4 and his grid is now three cards: 10♠ (top-left, unknown to him), 9♦ (top-right, unknown), and 7♠ (bottom-right, peeked at opening).",
    board: board(grids, {
      deckCount: deck,
      discard: pile,
      activeSeat: "west",
      deckTop: c("5", "hearts"),
    }),
  });

  // 7 — Bob draws 5♥
  deck--;
  out.push({
    caption: "Bob's turn. He draws a 5♥.",
    reasoning:
      "Bob's grid is three cards: an unknown top-left, an unknown top-right, and a known 7♠ at bottom-right. Swapping the 5♥ in trades a small known card for a small unknown — but if the displaced card is a power card, the activation might be worth more than the score change.",
    board: board(grids, {
      deckCount: deck,
      discard: pile,
      activeSeat: "north",
      heldCard: c("5", "hearts"),
      deckTop: c("8", "clubs"),
    }),
  });

  // 8 — Bob swaps 5♥ into his TL (slot 0); the displaced 10♠ activates "spy again"
  grids = withSlot(grids, "north", 0, c("5", "hearts"));
  pile = [...pile, c("10", "spades")];
  out.push({
    caption: "Bob swaps the 5♥ into his top-left. The displaced 10♠ activates — \"spy again\" — and Bob peeks Alice's top-left → 7♣.",
    reasoning:
      "Lucky for Bob: the displaced card was a 10♠ (worth 10, swapping it out drops his score by 5) AND it's a power card — so he gets to peek another player's card too. He picks Alice's top-left and sees a 7♣. Remember that — it'll matter shortly.",
    board: board(grids, {
      deckCount: deck,
      discard: pile,
      activeSeat: "north",
      deckTop: c("8", "clubs"),
      revealedSlots: ["east-0"],
      highlights: ["east-0", "north-0"],
    }),
  });

  // 9 — Lisa's FAILED SNAP — slaps her TL (Q♠) thinking it's where her known 10 lives
  grids = appendCard(grids, "west", c("8", "clubs"));
  out.push({
    caption: "Lisa lunges to snap. She slaps her top-left down — but it's a Q♠. Wrong card, failed snap.",
    reasoning:
      "Lisa knew she had a 10 in her grid from the opening peek, but she misremembered the slot — her actual 10♣ is at her bottom-left, not her top-left. The Q♠ stays where it is (now visibly a Q to anyone watching). Lisa draws a face-down penalty card and her grid grows 4 → 5.",
    board: board(grids, {
      deckCount: deck - 1,
      discard: pile,
      activeSeat: "north",
      deckTop: c("K", "diamonds"),
      revealedSlots: ["west-0"],
      highlights: ["west-0", "west-4"],
    }),
  });
  deck--;

  // 10 — Alice draws K♦ (Red King)
  deck--;
  out.push({
    caption: "Alice's turn. She draws a K♦ — a Red King, worth −1.",
    reasoning:
      "Red Kings are the lowest-scoring card in the game. Any opportunity to put one in your grid is a gift. The King is also a power card, so whichever card she displaces will activate.",
    board: board(grids, {
      deckCount: deck,
      discard: pile,
      activeSeat: "east",
      heldCard: c("K", "diamonds"),
      deckTop: c("5", "diamonds"),
    }),
  });

  // 11 — Alice swaps K♦ into TR; displaced 7♦ activates "see your fate"
  grids = withSlot(grids, "east", 1, c("K", "diamonds"));
  pile = [...pile, c("7", "diamonds")];
  out.push({
    caption: "Alice swaps the Red King into her top-right. The displaced 7♦ activates — Alice peeks her own top-left → 7♣. She now knows all four of her cards.",
    reasoning:
      "Alice is having a great turn: she put a Red King (−1) into her grid, displacing a 7 (worth 7) — a 8-point swing. The 7's activation lets her peek one of her own cards; she chooses her top-left and learns it's a 7♣.",
    board: board(grids, {
      deckCount: deck,
      discard: pile,
      activeSeat: "east",
      deckTop: c("5", "diamonds"),
      revealedSlots: ["east-0"],
      highlights: ["east-0", "east-1"],
    }),
  });

  // 12 — Bob snaps Alice's TL 7♣ onto the discarded 7♦, transfers his 9♦ to Alice's TL
  // Mutation: pile += east[0]; east[0] = north[1]; remove north[1].
  {
    const aliceTL = grids.east[0];
    const bobsGift = grids.north[1];
    pile = [...pile, aliceTL];
    grids = {
      ...grids,
      east: grids.east.map((card, i) => (i === 0 ? bobsGift : card)),
      north: grids.north.map((card, i) => (i === 1 ? null : card)),
    };
  }
  out.push({
    caption: "SNAP. Bob remembers from his earlier peek that Alice's top-left is also a 7. He slaps it onto the discarded 7♦, then transfers his own 9♦ into Alice's empty slot.",
    reasoning:
      "When you snap another player's card, you eliminate one of your own and give them a card from your grid in return. Bob picks his 9♦ — his highest remaining card — to dump on Alice. Bob's grid shrinks 3 → 2; Alice's stays at 4 but her top-left (which she just learned was a 7♣) is now an unknown 9♦.",
    board: board(grids, {
      deckCount: deck,
      discard: pile,
      activeSeat: "east",
      deckTop: c("5", "diamonds"),
      highlights: ["east-0"],
    }),
  });

  // 13 — Sam's turn 2 — uneventful (kept as-is per request to leave step <14 alone)
  deck--;
  pile = [...pile, c("5", "diamonds")];
  out.push({
    caption: "Sam's turn 2. He draws a 5♦ and discards it directly — no swap, no useful activation.",
    reasoning:
      "Sam knows three of his four cards (4♥, A♥, 6♦) and his unknown top-right is probably worse than the 5 he just drew. But swapping is only worth it if you have evidence the unknown is heavier — Sam's playing it safe.",
    board: board(grids, {
      deckCount: deck,
      discard: pile,
      activeSeat: "you",
      deckTop: c("K", "clubs"),
    }),
  });

  // 14 — Lisa draws K♣ (held)
  deck--;
  out.push({
    caption: "Lisa's turn 2. She draws a Black King — K♣.",
    reasoning:
      "A Black King is 10 points if you keep it, but discarded it triggers \"peek and fling\" — peek any card on the table, then swap any card with one of her own. Lisa wants to use the effect to dump her highest known card on someone else.",
    board: board(grids, {
      deckCount: deck,
      discard: pile,
      activeSeat: "west",
      heldCard: c("K", "clubs"),
      deckTop: c("2", "spades"),
    }),
  });

  // 15 — Lisa discards K♣, peeks Sam's BR (6♦)
  pile = [...pile, c("K", "clubs")];
  out.push({
    caption: "Lisa discards the K♣ — peek-and-fling fires. She peeks Sam's bottom-right and finds a 6♦.",
    reasoning:
      "Lisa's looking for a low card in another player's grid that she can dump her Q♠ (10) onto. A 6 is decent — better than her Q. She'll swap.",
    board: board(grids, {
      deckCount: deck,
      discard: pile,
      activeSeat: "west",
      deckTop: c("2", "spades"),
      revealedSlots: ["you-3"],
      highlights: ["you-3"],
    }),
  });

  // 16 — Lisa swaps her Q♠ ↔ Sam's BR
  grids = swapSlots(grids, { seat: "west", index: 0 }, { seat: "you", index: 3 });
  out.push({
    caption: "Lisa swaps her Q♠ into Sam's bottom-right, taking the 6♦.",
    reasoning:
      "Lisa drops 4 points (10 → 6); Sam's score climbs by 4. The swap is observed, so Sam now knows his bottom-right is a Q♠ — useful to him on his final turn.",
    board: board(grids, {
      deckCount: deck,
      discard: pile,
      activeSeat: "west",
      deckTop: c("2", "spades"),
      highlights: ["west-0", "you-3"],
    }),
  });

  // 17 — Bob calls Cambio
  out.push({
    caption: "Bob's turn 2. Instead of drawing, he calls CAMBIO.",
    reasoning:
      "Bob has only two cards left — 5♥ at top-left (he placed it himself) and 7♠ at bottom-right (peeked at opening). His known total is 12 and he thinks that's the lowest at the table. He locks it in. Each remaining player now takes one final turn.",
    board: board(grids, {
      deckCount: deck,
      discard: pile,
      activeSeat: "north",
      deckTop: c("2", "spades"),
    }),
  });

  // 18 — Alice's final turn — swap 2♠ for unknown TL (was 9♦); 9 activates spy-again, peeks Bob's BR
  deck--;
  grids = withSlot(grids, "east", 0, c("2", "spades"));
  pile = [...pile, c("9", "diamonds")];
  out.push({
    caption: "Alice's final turn. She draws a 2♠ and swaps it into her top-left, displacing Bob's gift. The 9♦ activates \"spy again\" — Alice peeks Bob's bottom-right (a 7♠).",
    reasoning:
      "Alice suspected Bob's transferred card was high — Bob would have dumped his worst. Swapping a known 2 in for the unknown drops her score by 7. The 9 fires a spy on the way out and Alice glimpses one of Bob's cards, but the round's about to end.",
    board: board(grids, {
      deckCount: deck,
      discard: pile,
      activeSeat: "east",
      deckTop: c("3", "diamonds"),
      revealedSlots: ["north-3"],
      highlights: ["east-0", "north-3"],
    }),
  });

  // 19 — Sam's final turn — swap 3♦ for Q♠ (slot 3); Q♠ activates blind swap (Sam slot 1 ↔ Alice slot 1)
  deck--;
  grids = withSlot(grids, "you", 3, c("3", "diamonds"));
  pile = [...pile, c("Q", "spades")];
  grids = swapSlots(grids, { seat: "you", index: 1 }, { seat: "east", index: 1 });
  out.push({
    caption: "Sam's final turn. He swaps his drawn 3♦ into the Q♠ slot Lisa dumped on him. The Q♠ activates \"swap unseen\" — Sam blind-swaps his unknown top-right with Alice's known Red King.",
    reasoning:
      "Two big drops in one turn: swapping a 3 in for a known 10 is −7 deterministic. The discarded Q♠ activates a blind swap; Sam targets his last unknown (his top-right) and the publicly-known Red King at Alice's top-right. Sam loses an unknown ~6 on average and gains a known −1.",
    board: board(grids, {
      deckCount: deck,
      discard: pile,
      activeSeat: "you",
      deckTop: c("5", "clubs"),
      highlights: ["you-3", "you-1", "east-1"],
    }),
  });

  // 20 — Lisa's final turn — swap 5♣ for 10♣ (slot 2); 10 activates spy-again, peeks Bob's BR
  deck--;
  grids = withSlot(grids, "west", 2, c("5", "clubs"));
  pile = [...pile, c("10", "clubs")];
  out.push({
    caption: "Lisa's final turn. She draws a 5♣ and swaps it into her bottom-left, displacing the 10♣. The 10 activates \"spy again\" — Lisa peeks Bob's bottom-right (a 7♠).",
    reasoning:
      "Drops 5 points cleanly. The 10's activation gives a free piece of info Lisa will never use, but she plays out the effect anyway.",
    board: board(grids, {
      deckCount: deck,
      discard: pile,
      activeSeat: "west",
      revealedSlots: ["north-3"],
      highlights: ["west-2", "north-3"],
    }),
  });

  // 21 — Reveal
  out.push({
    caption: "Everyone reveals. Lowest total wins.",
    reasoning:
      "SAM: 4 + (−1) + 1 + 3 = 7 — winner. BOB: 5 + 7 = 12 — second. ALICE: 2 + 3 + 2 + 10 = 17 — third. LISA: 6 + 3 + 5 + 4 + 8 = 26 — fourth. Bob locked in his 12 thinking nobody could beat it, but he didn't reckon with Lisa's late King swap (which dumped her Q on Sam, but then Sam swapped it right back out) or Sam's Q-blind-swap that brought him a Red King. The lesson: Cambio calls are bets on what the rest of the table will do, not just your own hand.",
    board: board(grids, {
      deckCount: deck,
      discard: pile,
      activeSeat: null,
      showScores: true,
    }),
  });

  return out;
})();
