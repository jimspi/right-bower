import {
  SUITS,
  WIN_SCORE,
  legalCards,
  makeDeck,
  nextSeat,
  partnerOf,
  sameCard,
  shuffle,
  teamOf,
  trickWinner,
} from "./rules";
import type {
  Action,
  Card,
  GameState,
  HandResult,
  Rng,
  Seat,
  Settings,
  Suit,
  Team,
} from "./types";

export const DEFAULT_SETTINGS: Settings = { stickTheDealer: false };

/** Deal a fresh hand with the given dealer, keeping scores/settings from `base`. */
export function dealHand(
  base: Pick<GameState, "settings" | "scores" | "handNumber">,
  dealer: Seat,
  rng: Rng = Math.random,
): GameState {
  const deck = shuffle(makeDeck(), rng);
  const hands: Card[][] = [[], [], [], []];
  let idx = 0;
  // 3-2-3-2 then 2-3-2-3, clockwise starting left of the dealer.
  for (let round = 0; round < 2; round++) {
    for (let i = 0; i < 4; i++) {
      const seat = (dealer + 1 + i) % 4;
      const n = (i + round) % 2 === 0 ? 3 : 2;
      for (let k = 0; k < n; k++) hands[seat].push(deck[idx++]);
    }
  }
  const kitty = deck.slice(idx);
  return {
    settings: base.settings,
    scores: [base.scores[0], base.scores[1]],
    dealer,
    hands,
    kitty,
    upcard: kitty[0],
    upcardTurnedDown: false,
    phase: "bid1",
    turn: nextSeat(dealer),
    passes: 0,
    bidLog: [],
    trump: null,
    maker: null,
    alone: false,
    sittingOut: null,
    trick: [],
    tricksWon: [0, 0],
    completedTricks: [],
    lastTrick: null,
    lastTrickWinner: null,
    winner: null,
    result: null,
    handNumber: base.handNumber + 1,
  };
}

export function newGame(settings: Settings = DEFAULT_SETTINGS, rng: Rng = Math.random): GameState {
  const dealer = Math.floor(rng() * 4) as Seat;
  return dealHand({ settings, scores: [0, 0], handNumber: 0 }, dealer, rng);
}

/** Next seat clockwise that is actually playing this hand. */
export function nextActive(state: Pick<GameState, "sittingOut">, seat: Seat): Seat {
  let s = nextSeat(seat);
  if (s === state.sittingOut) s = nextSeat(s);
  return s;
}

export const tricksNeeded = (s: Pick<GameState, "alone">) => (s.alone ? 3 : 4);

function startPlay(s: GameState): GameState {
  return { ...s, phase: "play", turn: nextActive(s, s.dealer), trick: [], passes: 0 };
}

function setTrump(s: GameState, suit: Suit, alone: boolean, kind: "order" | "call"): GameState {
  const caller = s.turn;
  const sittingOut = alone ? partnerOf(caller) : null;
  const next: GameState = {
    ...s,
    trump: suit,
    maker: caller,
    alone,
    sittingOut,
    bidLog: [...s.bidLog, { seat: caller, kind, suit, alone }],
  };
  if (kind === "order" && sittingOut !== s.dealer) {
    // Dealer picks up the upcard and must discard.
    const hands = next.hands.map((h) => h.slice());
    hands[s.dealer].push(s.upcard);
    return { ...next, hands, phase: "dealerDiscard", turn: s.dealer };
  }
  return startPlay(next);
}

function finishHand(s: GameState): GameState {
  const maker = s.maker as Seat;
  const makerTeam = teamOf(maker);
  const defTeam = (1 - makerTeam) as Team;
  const makerTricks = s.tricksWon[makerTeam];
  const defenderTricks = s.tricksWon[defTeam];
  let scoringTeam: Team;
  let points: number;
  const march = makerTricks === 5;
  const euchred = makerTricks < 3;
  if (euchred) {
    scoringTeam = defTeam;
    points = 2;
  } else {
    scoringTeam = makerTeam;
    points = march ? (s.alone ? 4 : 2) : 1;
  }
  const scores: [number, number] = [s.scores[0], s.scores[1]];
  scores[scoringTeam] += points;
  const result: HandResult = {
    kind: "played",
    maker,
    trump: s.trump,
    alone: s.alone,
    makerTricks,
    defenderTricks,
    scoringTeam,
    points,
    march,
    euchred,
  };
  const winner: Team | null = scores[0] >= WIN_SCORE ? 0 : scores[1] >= WIN_SCORE ? 1 : null;
  return {
    ...s,
    scores,
    result,
    winner,
    trick: [],
    phase: winner === null ? "handOver" : "gameOver",
  };
}

/** All actions the seat on turn may legally take (for the UI and for validating the AI). */
export function legalActions(s: GameState): Action[] {
  const out: Action[] = [];
  switch (s.phase) {
    case "bid1":
      out.push({ type: "pass" }, { type: "orderUp", alone: false }, { type: "orderUp", alone: true });
      break;
    case "bid2": {
      const stuck = s.settings.stickTheDealer && s.turn === s.dealer && s.passes === 3;
      if (!stuck) out.push({ type: "pass" });
      for (const suit of SUITS) {
        if (suit === s.upcard.suit) continue;
        out.push({ type: "call", suit, alone: false }, { type: "call", suit, alone: true });
      }
      break;
    }
    case "dealerDiscard":
      for (const card of s.hands[s.turn]) out.push({ type: "discard", card });
      break;
    case "play":
      for (const card of legalCards(s.hands[s.turn], s.trick, s.trump as Suit))
        out.push({ type: "play", card });
      break;
    case "trickEnd":
      out.push({ type: "collectTrick" });
      break;
    case "handOver":
      out.push({ type: "nextHand" });
      break;
  }
  return out;
}

export function isLegal(s: GameState, a: Action): boolean {
  return legalActions(s).some((l) => {
    if (l.type !== a.type) return false;
    switch (l.type) {
      case "orderUp":
        return l.alone === (a as typeof l).alone;
      case "call":
        return l.suit === (a as typeof l).suit && l.alone === (a as typeof l).alone;
      case "discard":
      case "play":
        return sameCard(l.card, (a as typeof l).card);
      default:
        return true;
    }
  });
}

/** Pure reducer. Illegal actions return the state unchanged. */
export function reduce(s: GameState, a: Action, rng: Rng = Math.random): GameState {
  if (!isLegal(s, a)) return s;
  switch (a.type) {
    case "pass": {
      const bidLog = [...s.bidLog, { seat: s.turn, kind: "pass" as const }];
      const passes = s.passes + 1;
      if (passes < 4) return { ...s, bidLog, passes, turn: nextSeat(s.turn) };
      if (s.phase === "bid1") {
        return {
          ...s,
          bidLog: [],
          passes: 0,
          phase: "bid2",
          upcardTurnedDown: true,
          turn: nextSeat(s.dealer),
        };
      }
      // Everyone passed twice: thrown in.
      const result: HandResult = {
        kind: "thrownIn",
        maker: null,
        trump: null,
        alone: false,
        makerTricks: 0,
        defenderTricks: 0,
        scoringTeam: null,
        points: 0,
        march: false,
        euchred: false,
      };
      return { ...s, bidLog, passes, result, phase: "handOver" };
    }
    case "orderUp":
      return setTrump(s, s.upcard.suit, a.alone, "order");
    case "call":
      return setTrump(s, a.suit, a.alone, "call");
    case "discard": {
      const hands = s.hands.map((h) => h.slice());
      const i = hands[s.turn].findIndex((c) => sameCard(c, a.card));
      hands[s.turn].splice(i, 1);
      return startPlay({ ...s, hands });
    }
    case "play": {
      const hands = s.hands.map((h) => h.slice());
      const i = hands[s.turn].findIndex((c) => sameCard(c, a.card));
      hands[s.turn].splice(i, 1);
      const trick = [...s.trick, { seat: s.turn, card: a.card }];
      if (trick.length < tricksNeeded(s)) {
        return { ...s, hands, trick, turn: nextActive(s, s.turn) };
      }
      const winner = trickWinner(trick, s.trump as Suit);
      const tricksWon: [number, number] = [s.tricksWon[0], s.tricksWon[1]];
      tricksWon[teamOf(winner)]++;
      return { ...s, hands, trick, tricksWon, phase: "trickEnd", turn: winner, lastTrickWinner: winner };
    }
    case "collectTrick": {
      const completedTricks = [...s.completedTricks, s.trick];
      const base: GameState = { ...s, completedTricks, lastTrick: s.trick, trick: [] };
      if (completedTricks.length === 5) return finishHand(base);
      return { ...base, phase: "play", turn: s.lastTrickWinner as Seat };
    }
    case "nextHand":
      return dealHand(s, nextSeat(s.dealer), rng);
  }
}
