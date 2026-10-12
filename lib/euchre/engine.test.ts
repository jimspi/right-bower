import { describe, expect, it } from "vitest";
import {
  cardPower,
  chooseAction,
  dealHand,
  effectiveSuit,
  isLegal,
  legalActions,
  legalCards,
  newGame,
  reduce,
  trickWinner,
  type Action,
  type Card,
  type GameState,
  type Seat,
  type Suit,
} from "./index";

const c = (rank: Card["rank"], suit: Suit): Card => ({ rank, suit });

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

function base(over: Partial<GameState> = {}): GameState {
  const s = dealHand({ settings: { stickTheDealer: false }, scores: [0, 0], handNumber: 0 }, 0, seeded(1));
  return { ...s, ...over };
}

describe("trump ranking", () => {
  it("ranks right bower > left bower > A > K > Q > 10 > 9", () => {
    const order = [c("J", "H"), c("J", "D"), c("A", "H"), c("K", "H"), c("Q", "H"), c("10", "H"), c("9", "H")];
    const p = order.map((x) => cardPower(x, "H", "S"));
    for (let i = 1; i < p.length; i++) expect(p[i - 1]).toBeGreaterThan(p[i]);
  });
  it("left bower counts as trump", () => {
    expect(effectiveSuit(c("J", "D"), "H")).toBe("H");
    expect(effectiveSuit(c("J", "S"), "H")).toBe("S");
  });
  it("non-trump suits rank A K Q J 10 9", () => {
    const order = [c("A", "S"), c("K", "S"), c("Q", "S"), c("J", "S"), c("10", "S"), c("9", "S")];
    const p = order.map((x) => cardPower(x, "H", "S"));
    for (let i = 1; i < p.length; i++) expect(p[i - 1]).toBeGreaterThan(p[i]);
  });
  it("off-suit non-trump cards have no power", () => {
    expect(cardPower(c("A", "C"), "H", "S")).toBe(0);
  });
});

describe("follow suit", () => {
  it("left bower is trump, not its printed suit", () => {
    // Diamonds led, hearts trump: J♦ is a heart, so a hand with J♦ and no other diamond may play anything.
    const hand = [c("J", "D"), c("9", "S")];
    const trick = [{ seat: 1 as Seat, card: c("A", "D") }];
    expect(legalCards(hand, trick, "H")).toHaveLength(2);
  });
  it("must play left bower when trump is led", () => {
    const hand = [c("J", "D"), c("9", "S")];
    const trick = [{ seat: 1 as Seat, card: c("9", "H") }];
    expect(legalCards(hand, trick, "H")).toEqual([c("J", "D")]);
  });
  it("must follow printed suit when able", () => {
    const hand = [c("9", "D"), c("9", "S"), c("A", "H")];
    const trick = [{ seat: 1 as Seat, card: c("A", "D") }];
    expect(legalCards(hand, trick, "H")).toEqual([c("9", "D")]);
  });
  it("can play anything when void", () => {
    const hand = [c("9", "C"), c("9", "S")];
    const trick = [{ seat: 1 as Seat, card: c("A", "D") }];
    expect(legalCards(hand, trick, "H")).toHaveLength(2);
  });
});

describe("trick winner", () => {
  it("highest led suit wins with no trump", () => {
    const t = [
      { seat: 1 as Seat, card: c("9", "S") },
      { seat: 2 as Seat, card: c("A", "D") },
      { seat: 3 as Seat, card: c("K", "S") },
      { seat: 0 as Seat, card: c("Q", "S") },
    ];
    expect(trickWinner(t, "H")).toBe(3);
  });
  it("any trump beats led suit; right bower beats left", () => {
    const t = [
      { seat: 1 as Seat, card: c("A", "S") },
      { seat: 2 as Seat, card: c("9", "H") },
      { seat: 3 as Seat, card: c("J", "D") },
      { seat: 0 as Seat, card: c("J", "H") },
    ];
    expect(trickWinner(t, "H")).toBe(0);
    expect(trickWinner(t.slice(0, 3), "H")).toBe(3);
  });
  it("left bower does not follow its printed suit when that suit is led", () => {
    const t = [
      { seat: 1 as Seat, card: c("9", "D") },
      { seat: 2 as Seat, card: c("A", "D") },
    ];
    // hearts trump: J♦ played on a diamond lead is trump and wins
    t.push({ seat: 3 as Seat, card: c("J", "D") });
    expect(trickWinner(t, "H")).toBe(3);
  });
});

describe("dealing", () => {
  it("deals 5 each, 4 in kitty, upcard from kitty, 24 unique cards", () => {
    const s = newGame(undefined, seeded(7));
    expect(s.hands.map((h) => h.length)).toEqual([5, 5, 5, 5]);
    expect(s.kitty).toHaveLength(4);
    expect(s.upcard).toEqual(s.kitty[0]);
    const all = [...s.hands.flat(), ...s.kitty].map((x) => x.rank + x.suit);
    expect(new Set(all).size).toBe(24);
    expect(s.turn).toBe((s.dealer + 1) % 4);
  });
});

describe("bidding", () => {
  it("order up in round 1: dealer picks up and discards", () => {
    let s = base({ dealer: 3, turn: 0 });
    s = reduce(s, { type: "orderUp", alone: false });
    expect(s.trump).toBe(s.upcard.suit);
    expect(s.phase).toBe("dealerDiscard");
    expect(s.turn).toBe(3);
    expect(s.hands[3]).toHaveLength(6);
    s = reduce(s, { type: "discard", card: s.hands[3][0] });
    expect(s.hands[3]).toHaveLength(5);
    expect(s.phase).toBe("play");
    expect(s.turn).toBe(0); // left of dealer
  });
  it("four passes go to round 2, turning the upcard down", () => {
    let s = base();
    for (let i = 0; i < 4; i++) s = reduce(s, { type: "pass" });
    expect(s.phase).toBe("bid2");
    expect(s.upcardTurnedDown).toBe(true);
    expect(s.turn).toBe((s.dealer + 1) % 4);
  });
  it("cannot name the turned-down suit in round 2", () => {
    let s = base();
    for (let i = 0; i < 4; i++) s = reduce(s, { type: "pass" });
    expect(isLegal(s, { type: "call", suit: s.upcard.suit, alone: false })).toBe(false);
    const other = (["S", "H", "D", "C"] as Suit[]).find((x) => x !== s.upcard.suit) as Suit;
    expect(isLegal(s, { type: "call", suit: other, alone: false })).toBe(true);
  });
  it("eight passes throw the hand in and rotate the dealer", () => {
    let s = base();
    const d = s.dealer;
    for (let i = 0; i < 8; i++) s = reduce(s, { type: "pass" });
    expect(s.phase).toBe("handOver");
    expect(s.result?.kind).toBe("thrownIn");
    s = reduce(s, { type: "nextHand" });
    expect(s.dealer).toBe((d + 1) % 4);
    expect(s.phase).toBe("bid1");
    expect(s.scores).toEqual([0, 0]);
  });
  it("stick the dealer: dealer cannot pass in round 2", () => {
    let s = base({ settings: { stickTheDealer: true } });
    for (let i = 0; i < 4; i++) s = reduce(s, { type: "pass" });
    for (let i = 0; i < 3; i++) s = reduce(s, { type: "pass" });
    expect(s.turn).toBe(s.dealer);
    expect(isLegal(s, { type: "pass" })).toBe(false);
    expect(reduce(s, { type: "pass" })).toBe(s);
    expect(legalActions(s).every((a) => a.type === "call")).toBe(true);
  });
  it("without stick the dealer, dealer may pass", () => {
    let s = base();
    for (let i = 0; i < 7; i++) s = reduce(s, { type: "pass" });
    expect(isLegal(s, { type: "pass" })).toBe(true);
  });
  it("round 2 call sets trump with no pickup", () => {
    let s = base();
    for (let i = 0; i < 4; i++) s = reduce(s, { type: "pass" });
    const suit = (["S", "H", "D", "C"] as Suit[]).find((x) => x !== s.upcard.suit) as Suit;
    s = reduce(s, { type: "call", suit, alone: false });
    expect(s.phase).toBe("play");
    expect(s.trump).toBe(suit);
    expect(s.hands.every((h) => h.length === 5)).toBe(true);
  });
});

describe("going alone", () => {
  it("partner sits out and is skipped in the play order", () => {
    let s = base({ dealer: 3, turn: 0 }); // South first to bid
    s = reduce(s, { type: "orderUp", alone: true });
    expect(s.sittingOut).toBe(2);
    s = reduce(s, { type: "discard", card: s.hands[3][0] });
    expect(s.turn).toBe(0);
    const order: Seat[] = [];
    for (let i = 0; i < 3; i++) {
      order.push(s.turn);
      s = reduce(s, chooseAction(s, seeded(i)));
    }
    expect(order).toEqual([0, 1, 3]);
    expect(s.phase).toBe("trickEnd");
    expect(s.trick).toHaveLength(3);
  });
  it("skipped leader: if left of dealer sits out, next active player leads", () => {
    // dealer 3 (East); South (0) is left of dealer. North (2) calls alone -> South sits out.
    let s = base({ dealer: 3, turn: 2 });
    s = reduce(s, { type: "orderUp", alone: true });
    expect(s.sittingOut).toBe(0);
    s = reduce(s, { type: "discard", card: s.hands[3][0] });
    expect(s.turn).toBe(1);
  });
  it("dealer's partner alone: dealer sits out, no pickup", () => {
    // dealer 0; partner is 2. Seat 2 orders up alone.
    let s = base({ dealer: 0, turn: 2 });
    s = reduce(s, { type: "orderUp", alone: true });
    expect(s.sittingOut).toBe(0);
    expect(s.phase).toBe("play");
    expect(s.hands[0]).toHaveLength(5);
    expect(s.turn).toBe(1);
  });
  it("dealer alone: dealer still picks up", () => {
    let s = base({ dealer: 0, turn: 0 });
    s = reduce(s, { type: "orderUp", alone: true });
    expect(s.phase).toBe("dealerDiscard");
    expect(s.hands[0]).toHaveLength(6);
  });
  it("dealer still picks up when someone else (not partner) goes alone", () => {
    let s = base({ dealer: 0, turn: 1 });
    s = reduce(s, { type: "orderUp", alone: true });
    expect(s.sittingOut).toBe(3);
    expect(s.phase).toBe("dealerDiscard");
  });
});

/** Build a state in the play phase that is one trick from the end of a hand. */
function finalTrickState(maker: Seat, alone: boolean, makerTricks: number): GameState {
  const makerTeam = maker % 2;
  const tricksWon: [number, number] = [0, 0];
  tricksWon[makerTeam] = makerTricks;
  tricksWon[1 - makerTeam] = 5 - makerTricks;
  const trick = [
    { seat: 1 as Seat, card: c("9", "S") },
    { seat: 2 as Seat, card: c("9", "D") },
    { seat: 3 as Seat, card: c("10", "S") },
    { seat: 0 as Seat, card: c("Q", "S") },
  ];
  return base({
    phase: "trickEnd",
    trump: "H",
    maker,
    alone,
    sittingOut: alone ? (((maker + 2) % 4) as Seat) : null,
    trick: alone ? trick.slice(0, 3) : trick,
    tricksWon,
    completedTricks: [[], [], [], []],
    lastTrickWinner: 0,
  });
}

describe("scoring", () => {
  const score = (maker: Seat, alone: boolean, makerTricks: number, start: [number, number] = [0, 0]) => {
    const s = finalTrickState(maker, alone, makerTricks);
    return reduce({ ...s, scores: start }, { type: "collectTrick" });
  };
  it("makers take 3 or 4: 1 point", () => {
    expect(score(0, false, 3).scores).toEqual([1, 0]);
    expect(score(1, false, 4).scores).toEqual([0, 1]);
  });
  it("march: 2 points", () => {
    expect(score(0, false, 5).scores).toEqual([2, 0]);
  });
  it("euchre: defenders get 2", () => {
    expect(score(0, false, 2).scores).toEqual([0, 2]);
    expect(score(1, false, 0).scores).toEqual([2, 0]);
  });
  it("alone: 3-4 tricks = 1, march = 4, euchred = 2 to defenders", () => {
    expect(score(0, true, 3).scores).toEqual([1, 0]);
    expect(score(0, true, 4).scores).toEqual([1, 0]);
    expect(score(0, true, 5).scores).toEqual([4, 0]);
    expect(score(1, true, 2).scores).toEqual([2, 0]);
  });
  it("hand result describes outcome", () => {
    const s = score(0, false, 5);
    expect(s.result).toMatchObject({ march: true, points: 2, scoringTeam: 0, euchred: false });
    expect(s.phase).toBe("handOver");
  });
  it("game ends at 10", () => {
    const s = score(1, false, 5, [3, 8]);
    expect(s.scores).toEqual([3, 10]);
    expect(s.phase).toBe("gameOver");
    expect(s.winner).toBe(1);
  });
  it("game continues at 9", () => {
    const s = score(1, false, 3, [3, 8]);
    expect(s.phase).toBe("handOver");
    expect(s.winner).toBeNull();
  });
  it("lone march can jump past 10", () => {
    const s = score(0, true, 5, [8, 9]);
    expect(s.scores).toEqual([12, 9]);
    expect(s.winner).toBe(0);
  });
});

describe("illegal actions", () => {
  it("are ignored", () => {
    const s = base();
    expect(reduce(s, { type: "collectTrick" })).toBe(s);
    expect(reduce(s, { type: "discard", card: s.hands[0][0] })).toBe(s);
  });
  it("playing a card that breaks follow-suit is rejected", () => {
    let s = base({ dealer: 3, turn: 0 });
    s = reduce(s, { type: "orderUp", alone: false });
    s = reduce(s, { type: "discard", card: s.hands[3][0] });
    s = reduce(s, chooseAction(s, seeded(2)));
    const led = effectiveSuit(s.trick[0].card, s.trump as Suit);
    const hand = s.hands[s.turn];
    const bad = hand.find((x) => effectiveSuit(x, s.trump as Suit) !== led);
    if (bad && hand.some((x) => effectiveSuit(x, s.trump as Suit) === led)) {
      const a: Action = { type: "play", card: bad };
      expect(reduce(s, a)).toBe(s);
    }
  });
});
