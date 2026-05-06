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
  grid: CardId[];
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
  return seat.grid.reduce((sum, c) => sum + scoreOf(c), 0);
}

/* ----------------------------------------------------------------------- */
/*  The deterministic game                                                  */
/* ----------------------------------------------------------------------- */

const c = (rank: string, suit: Suit): CardId => ({ rank, suit });

// Initial deal — slot order TL, TR, BL, BR.
const INITIAL: Record<SeatId, CardId[]> = {
  you:   [c("Q", "hearts"),   c("3", "clubs"),    c("A", "hearts"),   c("6", "diamonds")],
  west:  [c("8", "spades"),   c("J", "diamonds"), c("10", "clubs"),   c("4", "hearts")],
  north: [c("5", "hearts"),   c("9", "diamonds"), c("Q", "spades"),   c("2", "clubs")],
  east:  [c("K", "spades"),   c("7", "diamonds"), c("2", "diamonds"), c("J", "hearts")],
};

const INITIAL_DECK_COUNT = 36;

function board(
  grids: Record<SeatId, CardId[]>,
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

function withSlot(grids: Record<SeatId, CardId[]>, seat: SeatId, index: number, card: CardId): Record<SeatId, CardId[]> {
  const next = { ...grids };
  next[seat] = next[seat].map((existing, i) => (i === index ? card : existing));
  return next;
}

function appendCard(grids: Record<SeatId, CardId[]>, seat: SeatId, card: CardId): Record<SeatId, CardId[]> {
  const next = { ...grids };
  next[seat] = [...next[seat], card];
  return next;
}

function removeSlot(grids: Record<SeatId, CardId[]>, seat: SeatId, index: number): Record<SeatId, CardId[]> {
  const next = { ...grids };
  next[seat] = next[seat].filter((_, i) => i !== index);
  return next;
}

function swapSlots(
  grids: Record<SeatId, CardId[]>,
  a: { seat: SeatId; index: number },
  b: { seat: SeatId; index: number },
): Record<SeatId, CardId[]> {
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
      "All cards are face-down. From here on, you'll only see a card when the player whose turn it is is actually looking at it.",
    board: board(grids, { deckCount: deck, discard: pile, activeSeat: null }),
  });

  // 1 — Opening peek
  out.push({
    caption: "Opening peek. Every player privately looks at their own bottom two cards.",
    reasoning:
      "Each player gets exactly one free peek before play begins — their two bottom cards. After this, no more free looks. From now on the only way to learn a card is to play a power card or watch what other people discard.",
    board: board(grids, {
      deckCount: deck,
      discard: pile,
      activeSeat: null,
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

  // 2 — Sam draws 7♣ (held)
  deck--;
  out.push({
    caption: "Sam's turn. He draws the top of the deck — it's the 7♣.",
    reasoning:
      "The first three actions of every turn are draw, decide, discard. Sam's drawn card is shown above his seat — that's the only card visible right now.",
    board: board(grids, {
      deckCount: deck,
      discard: pile,
      activeSeat: "you",
      heldCard: c("7", "clubs"),
    }),
  });

  // 3 — Sam discards the 7, activation peeks his top-left (Q♥)
  pile = [...pile, c("7", "clubs")];
  out.push({
    caption: "Sam discards the 7♣ — \"see your fate\" fires. He peeks his top-left… Q♥. Heavy.",
    reasoning:
      "Sevens and eights let the discarding player look at one of their own cards. Sam now privately knows his top-left is a Queen of hearts (worth 10). He'll want to swap it out at the first opportunity.",
    board: board(grids, {
      deckCount: deck,
      discard: pile,
      activeSeat: "you",
      revealedSlots: ["you-0"],
      highlights: ["you-0"],
    }),
  });

  // 4 — Lisa draws 8♦ (held)
  deck--;
  out.push({
    caption: "Lisa's turn. She draws an 8♦.",
    reasoning:
      "Lisa knows two of her four cards from the opening peek — her bottom-left (10♣) and her bottom-right (4♥). Her top two are unknown. The 8 is a power card; she's about to use it to learn one of them.",
    board: board(grids, {
      deckCount: deck,
      discard: pile,
      activeSeat: "west",
      heldCard: c("8", "diamonds"),
    }),
  });

  // 5 — Lisa discards 8♦, peeks top-left (8♠), and immediately snaps her 8♠
  pile = [...pile, c("8", "diamonds")];
  grids = removeSlot(grids, "west", 0);
  pile = [...pile, c("8", "spades")];
  out.push({
    caption: "Lisa discards the 8♦, peeks her top-left… it's an 8♠. She snaps it down on top of her own discard.",
    reasoning:
      "Two rules in one beat. \"See your fate\" lets Lisa peek her top-left — she finds an 8♠. And because the discarded player can snap their own discard, she instantly slaps the 8♠ down on top of the 8♦. Her grid shrinks from four cards to three, and her score drops by 8. Note that the snap itself doesn't fire any activation — only the original discard did.",
    board: board(grids, {
      deckCount: deck,
      discard: pile,
      activeSeat: "west",
    }),
  });

  // 6 — Bob draws J♣ (held)
  deck--;
  out.push({
    caption: "Bob's turn. He draws a J♣.",
    reasoning:
      "Jacks and Queens blind-swap any two cards on the table. Bob doesn't know what most cards are — he's about to gamble.",
    board: board(grids, {
      deckCount: deck,
      discard: pile,
      activeSeat: "north",
      heldCard: c("J", "clubs"),
    }),
  });

  // 7 — Bob discards J♣, blind-swap: Sam slot 0 ↔ Lisa slot 2 (her bottom-right in the 3-card grid)
  grids = swapSlots(grids, { seat: "you", index: 0 }, { seat: "west", index: 2 });
  pile = [...pile, c("J", "clubs")];
  out.push({
    caption: "Bob discards the J♣ — \"swap unseen\" fires. He blind-swaps Sam's top-left with Lisa's bottom-right.",
    reasoning:
      "Neither card is revealed. Bob has no idea what he just moved. From Sam's perspective: he just lost his Q♥ (worth 10) and gained an unknown. Sam celebrates anyway — almost any card is better than a Queen. Lisa just lost her known 4♥ for an unknown — she's quietly worried.",
    board: board(grids, {
      deckCount: deck,
      discard: pile,
      activeSeat: "north",
      highlights: ["you-0", "west-2"],
    }),
  });

  // 8 — Alice draws 9♥ (held)
  deck--;
  out.push({
    caption: "Alice's turn. She draws a 9♥.",
    reasoning:
      "Nines and tens let you peek another player's card. Alice picks Bob.",
    board: board(grids, {
      deckCount: deck,
      discard: pile,
      activeSeat: "east",
      heldCard: c("9", "hearts"),
    }),
  });

  // 9 — Alice discards 9♥, peeks Bob's top-left (5♥)
  pile = [...pile, c("9", "hearts")];
  out.push({
    caption: "Alice discards the 9♥ — \"spy again\" fires. She peeks Bob's top-left.",
    reasoning:
      "Alice now privately knows Bob has a 5♥ at his top-left. Bob has no idea what she saw, but he can guess from her body language. Real-world Cambio is half memory and half reading other people.",
    board: board(grids, {
      deckCount: deck,
      discard: pile,
      activeSeat: "east",
      revealedSlots: ["north-0"],
      highlights: ["north-0"],
    }),
  });

  // 10 — Sam draws K♠ (held)
  deck--;
  out.push({
    caption: "Sam's turn 2. He draws a K♠.",
    reasoning:
      "Kings — both colours — do two things in one activation: peek any card, and swap any card with one of your own. Sam can plan this carefully.",
    board: board(grids, {
      deckCount: deck,
      discard: pile,
      activeSeat: "you",
      heldCard: c("K", "spades"),
    }),
  });

  // 11 — Sam discards K♠; peeks Alice's bottom-left (2♦)
  pile = [...pile, c("K", "spades")];
  out.push({
    caption: "Sam discards the K♠ — \"peek and fling\" fires. He peeks Alice's bottom-left first.",
    reasoning:
      "Sam picks Alice's bottom-left and sees a 2♦ — a really low card. He'll want to grab that. The King's swap can target any card, not necessarily the one he just peeked, but in this case it's exactly the card he wants.",
    board: board(grids, {
      deckCount: deck,
      discard: pile,
      activeSeat: "you",
      revealedSlots: ["east-2"],
      highlights: ["east-2"],
    }),
  });

  // 12 — Sam K♠ swap: his slot 3 (6♦) ↔ Alice slot 2 (2♦)
  grids = swapSlots(grids, { seat: "you", index: 3 }, { seat: "east", index: 2 });
  out.push({
    caption: "Sam swaps his bottom-right (a 6♦, which he knew from the opening peek) into Alice's bottom-left, taking her 2♦.",
    reasoning:
      "Net for Sam: gave up 6, gained 2 → −4 to his total. Alice's grid stays the same size; she now has a 6♦ where her 2♦ used to be. This is what Black and Red Kings do best: you can engineer a specific gain.",
    board: board(grids, {
      deckCount: deck,
      discard: pile,
      activeSeat: "you",
      highlights: ["you-3", "east-2"],
    }),
  });

  // 13 — Lisa draws and discards an Ace directly
  deck--;
  pile = [...pile, c("A", "clubs")];
  out.push({
    caption: "Lisa's turn. She draws an A♣ and discards it directly — Aces aren't power cards.",
    reasoning:
      "But Aces are matchable. The discard pile now has an Ace on top, and any player who knows they have a matching Ace anywhere on the table can snap it.",
    board: board(grids, {
      deckCount: deck,
      discard: pile,
      activeSeat: "west",
    }),
  });

  // 14 — Sam SNAPS his A♥
  grids = removeSlot(grids, "you", 2);
  pile = [...pile, c("A", "hearts")];
  out.push({
    caption: "SNAP. Sam slaps his A♥ down — he remembered it was his bottom-left.",
    reasoning:
      "Snap eliminates the card from his grid without replacing it. Sam goes from 4 cards to 3. A snapped card never activates, even if it were a power card — only a normal discard does.",
    board: board(grids, {
      deckCount: deck,
      discard: pile,
      activeSeat: "west",
    }),
  });

  // 15 — Bob's failed snap
  grids = appendCard(grids, "north", c("6", "spades"));
  out.push({
    caption: "Bob lunges in too late, slapping his top-left down. Wrong rank — failed snap.",
    reasoning:
      "Bob misremembered which of his cards was the Ace. He turned over a 5♥. The card stays where it was, but Bob is given a face-down penalty card from the deck. His grid grows from 4 to 5.",
    board: board(grids, {
      deckCount: deck - 1,
      discard: pile,
      activeSeat: "west",
      revealedSlots: ["north-0"],
      highlights: ["north-0", "north-4"],
    }),
  });
  deck--;

  // 16 — Bob calls Cambio
  out.push({
    caption: "Bob's turn. Instead of drawing, he calls CAMBIO.",
    reasoning:
      "Bob thinks his hand is good enough to win. His penalty 4 hurt, but most of what he can see in his own grid is low. Each remaining player now takes one final turn, and then everyone reveals.",
    board: board(grids, {
      deckCount: deck,
      discard: pile,
      activeSeat: "north",
    }),
  });

  // 17 — Alice's final turn
  deck--;
  pile = [...pile, c("3", "clubs")];
  out.push({
    caption: "Alice's final turn. She draws a 3♣ and discards it directly — no swap.",
    reasoning:
      "Threes aren't power cards. Alice could have swapped to drop her score, but she'd risk drawing something heavier. She stands.",
    board: board(grids, {
      deckCount: deck,
      discard: pile,
      activeSeat: "east",
    }),
  });

  // 18 — Sam's final turn
  deck--;
  pile = [...pile, c("6", "clubs")];
  out.push({
    caption: "Sam's final turn. He draws a 6♣ and discards directly.",
    reasoning:
      "Sam's three remaining cards: two unknowns (his original top-left Q♥ was blind-swapped away, and he never learned his top-right) and a 2♦ at bottom-right that he took from Alice with the King. He knows just one of his three cards — but his expected total is low. He stands.",
    board: board(grids, {
      deckCount: deck,
      discard: pile,
      activeSeat: "you",
    }),
  });

  // 19 — Lisa's final turn
  deck--;
  pile = [...pile, c("3", "spades")];
  out.push({
    caption: "Lisa's final turn. She draws a 3♠ and discards directly.",
    reasoning:
      "Lisa's top-left used to be the 8♠ she peeked, but Bob blind-swapped it out for an unknown card. She doesn't know what's there now (it's a Q♥ — bad luck for her). Without confidence she can lower her score, she stands.",
    board: board(grids, {
      deckCount: deck,
      discard: pile,
      activeSeat: "west",
    }),
  });

  // 20 — Reveal
  out.push({
    caption: "Everyone reveals. Lowest total wins.",
    reasoning:
      "SAM: 4 + 3 + 2 = 9.   LISA: 10 + 10 + 10 = 30.   BOB: 5 + 9 + 10 + 2 + 6 = 32.   ALICE: 10 + 7 + 6 + 10 = 33. SAM wins commandingly. Bob's J♣ blind-swap accidentally handed Sam a 4 in exchange for his Q♥; Sam's Black King made a clean 6-for-2 trade; and his snap of the A♥ shrunk his grid by one. Bob, who called Cambio, came second — not bad given the failed-snap penalty.",
    board: board(grids, {
      deckCount: deck,
      discard: pile,
      activeSeat: null,
      showScores: true,
    }),
  });

  return out;
})();
