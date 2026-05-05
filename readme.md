# Cambio — TODO

Outstanding work to pick up next session.

---

## Live walkthrough demo

An interactive, step-by-step walkthrough of a single Cambio game on a dedicated route (e.g. `/walkthrough`).

### Behaviour
- **Arrow keys** to navigate: `→` advance to the next step, `←` go back to the previous one.
- Optional: `space` advance, `home` reset to the start, `end` jump to the final reveal.
- The whole game replays as a series of discrete states the user can scrub through at their own pace.

### Composition
- Re-use the homepage table scene (You + Lisa + Bob + Alice, deck and discard in the middle) as the canvas.
- Each step animates a single in-game action and updates a short caption explaining what just happened and *why* — turning the rules into a guided tour.

### Suggested step sequence (sketch — refine while building)
1. Deal: 16 face-down cards out from the deck, four per player.
2. Opening peek: each player turns over their bottom two cards in turn, then flips them back.
3. **Your turn 1.** Draw from deck → reveal a 7♣ → peek your top-left card → discard the 7. Caption: *"Seven or eight — see your fate."*
4. **Lisa's turn.** Draws something forgettable, swaps into her grid.
5. **Bob's turn.** Draws a Jack → blind-swap one of yours with one of Alice's. Caption explains *Jack or Queen — swap unseen*.
6. **Alice's turn.** Draws a Queen → blind-swap.
7. **Snap.** Someone's discarded card matches one of your known cards — snap it onto the pile, your array shrinks. Caption explains snap.
8. **Your turn 2.** Draw a Red King (−1) → keep it, swap out a 10. Big visible score drop.
9. **Bob calls Cambio.** Each remaining player takes one final turn.
10. **Reveal.** Flip every card on the table, score everyone, lowest wins.

### Component / state design notes
- Single state machine: `step: number`. Each step is a pure function from previous board state.
- Use the existing `Dealer.tsx` rendering primitives (`CardBack`, `CardFace`, the seat layout) — do not rebuild from scratch.
- Animations should be *snappy* (200–350 ms) so power users can fly through with the arrow keys.
- Pre-computed deterministic hand for the demo, not random — so captions and visuals stay in sync.
- Mobile: tap left/right halves of the screen to advance/retreat.

### Out of scope for v1
- No real game logic engine; the steps are scripted.
- No multiplayer or live state.
- No sound.
