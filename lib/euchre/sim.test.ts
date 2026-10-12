import { describe, expect, it } from "vitest";
import { chooseAction, isLegal, newGame, reduce, type GameState } from "./index";

function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("AI simulation", () => {
  it("plays 1000 full games without getting stuck or making an illegal move", () => {
    let alone = 0;
    let euchres = 0;
    let hands = 0;
    let thrownIn = 0;
    for (let g = 0; g < 1000; g++) {
      const rng = seeded(g + 1);
      let s: GameState = newGame({ stickTheDealer: g % 2 === 0 }, rng);
      let steps = 0;
      while (s.phase !== "gameOver") {
        if (++steps > 20000) throw new Error(`game ${g} stuck in phase ${s.phase}`);
        const a = chooseAction(s, rng);
        if (!isLegal(s, a)) throw new Error(`illegal ${JSON.stringify(a)} in ${s.phase}`);
        const prev = s;
        s = reduce(s, a, rng);
        if (s === prev) throw new Error(`no progress on ${JSON.stringify(a)}`);
        if (s.phase === "handOver" || s.phase === "gameOver") {
          hands++;
          if (s.result?.kind === "thrownIn") thrownIn++;
          else {
            if (s.result?.alone) alone++;
            if (s.result?.euchred) euchres++;
            expect(s.completedTricks.length).toBe(5);
            expect(s.tricksWon[0] + s.tricksWon[1]).toBe(5);
          }
        }
      }
      expect(s.winner).not.toBeNull();
      expect(Math.max(...s.scores)).toBeGreaterThanOrEqual(10);
    }
    // Sanity on AI behaviour: some variety, not degenerate.
    expect(hands).toBeGreaterThan(5000);
    expect(alone).toBeGreaterThan(0);
    expect(euchres).toBeGreaterThan(0);
    console.log({ hands, alone, euchres, thrownIn });
  }, 120000);
});
