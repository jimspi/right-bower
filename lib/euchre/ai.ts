import { isLegal, legalActions } from "./engine";
import {
  SUITS,
  cardPower,
  effectiveSuit,
  isLeftBower,
  isRightBower,
  legalCards,
  makeDeck,
  partnerOf,
  rankValue,
  sameCard,
  teamOf,
} from "./rules";
import type { Action, Card, GameState, Play, Rng, Seat, Suit } from "./types";

export const AI_NAMES: Record<number, string> = { 1: "Jack", 2: "Maya", 3: "Rosa" };

// ---------- Bidding ----------

const TRUMP_POINTS: Record<string, number> = { A: 2, K: 1.5, Q: 1.2, "10": 1, "9": 0.8 };

/** Rough strength of a hand if `trump` were trump. */
export function handStrength(hand: Card[], trump: Suit): number {
  let pts = 0;
  let trumpCount = 0;
  for (const c of hand) {
    if (isRightBower(c, trump)) {
      pts += 3.5;
      trumpCount++;
    } else if (isLeftBower(c, trump)) {
      pts += 3;
      trumpCount++;
    } else if (c.suit === trump) {
      pts += TRUMP_POINTS[c.rank];
      trumpCount++;
    } else if (c.rank === "A") {
      pts += 1.2;
    }
  }
  // Voids in off-suits let a trump-heavy hand ruff.
  if (trumpCount >= 2) {
    for (const s of SUITS) {
      if (s === trump) continue;
      if (!hand.some((c) => effectiveSuit(c, trump) === s)) pts += 0.7;
    }
  }
  return pts;
}

function wantsAlone(hand: Card[], trump: Suit): boolean {
  const right = hand.some((c) => isRightBower(c, trump));
  const left = hand.some((c) => isLeftBower(c, trump));
  const trumpCount = hand.filter((c) => effectiveSuit(c, trump) === trump).length;
  const trumpAce = hand.some((c) => c.suit === trump && c.rank === "A");
  const offAces = hand.filter((c) => c.suit !== trump && c.rank === "A").length;
  if (right && left && trumpCount >= 3 && (trumpAce || offAces >= 1)) return true;
  return handStrength(hand, trump) >= 11;
}

/** Best 5 cards after the dealer picks up `upcard` (simulates the dealer's discard). */
function handAfterPickup(hand: Card[], upcard: Card, trump: Suit): Card[] {
  const six = [...hand, upcard];
  const d = pickDiscard(six, trump);
  return six.filter((c) => !sameCard(c, d));
}

export function pickDiscard(hand: Card[], trump: Suit): Card {
  const offCount: Record<string, number> = {};
  for (const c of hand) {
    const s = effectiveSuit(c, trump);
    offCount[s] = (offCount[s] ?? 0) + 1;
  }
  let best = hand[0];
  let bestScore = Infinity;
  for (const c of hand) {
    const s = effectiveSuit(c, trump);
    let score = rankValue(c, trump);
    // Prefer to void an off-suit (but never throw away an ace for it).
    if (s !== trump && offCount[s] === 1 && c.rank !== "A") score -= 3;
    if (score < bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return best;
}

function chooseBid(s: GameState, rng: Rng): Action {
  const seat = s.turn;
  const hand = s.hands[seat];
  const noise = (rng() - 0.5) * 0.6;
  const isDealer = seat === s.dealer;
  const isDealerPartner = seat === partnerOf(s.dealer);
  const myTeamDeals = teamOf(seat) === teamOf(s.dealer);

  if (s.phase === "bid1") {
    const trump = s.upcard.suit;
    let eff = hand;
    let bonus = 0;
    if (isDealer) {
      eff = handAfterPickup(hand, s.upcard, trump);
      bonus = 0.8;
    } else if (isDealerPartner) {
      bonus = 0.6; // partner gets a free trump
    } else {
      bonus = -1.0; // feeding the opponents a trump
    }
    const strength = handStrength(eff, trump) + bonus + noise;
    if (strength >= 6.3) return { type: "orderUp", alone: wantsAlone(eff, trump) };
    return { type: "pass" };
  }

  // Round 2: best suit other than the turned-down one.
  let bestSuit: Suit = SUITS.find((x) => x !== s.upcard.suit) as Suit;
  let bestVal = -Infinity;
  for (const suit of SUITS) {
    if (suit === s.upcard.suit) continue;
    const v = handStrength(hand, suit);
    if (v > bestVal) {
      bestVal = v;
      bestSuit = suit;
    }
  }
  const threshold = (myTeamDeals ? 5.0 : 5.6) - (isDealer ? 0.6 : 0);
  const mustCall = s.settings.stickTheDealer && isDealer && s.passes === 3;
  if (bestVal + noise >= threshold || mustCall) {
    return { type: "call", suit: bestSuit, alone: wantsAlone(hand, bestSuit) };
  }
  return { type: "pass" };
}

// ---------- Card play ----------

/** Cards not in my hand and not yet seen played (so possibly in others' hands). */
export function unseenCards(s: GameState, seat: Seat): Card[] {
  const seen: Card[] = [...s.hands[seat]];
  for (const t of s.completedTricks) for (const p of t) seen.push(p.card);
  for (const p of s.trick) seen.push(p.card);
  // The dealer knows what they discarded only by absence; the turned-down upcard is public.
  if (s.upcardTurnedDown) seen.push(s.upcard);
  return makeDeck().filter((c) => !seen.some((x) => sameCard(x, c)));
}

function currentWinner(trick: Play[], trump: Suit): Play {
  const led = effectiveSuit(trick[0].card, trump);
  let best = trick[0];
  for (const p of trick) {
    if (cardPower(p.card, trump, led) > cardPower(best.card, trump, led)) best = p;
  }
  return best;
}

function choosePlay(s: GameState): Action {
  const seat = s.turn;
  const trump = s.trump as Suit;
  const hand = s.hands[seat];
  const legal = legalCards(hand, s.trick, trump);
  const play = (c: Card): Action => ({ type: "play", card: c });
  const unseen = unseenCards(s, seat);
  const isTrump = (c: Card) => effectiveSuit(c, trump) === trump;
  const makerTeam = teamOf(s.maker as Seat);
  const iAmMaker = s.maker === seat;
  const myTeamMade = teamOf(seat) === makerTeam;

  if (s.trick.length === 0) {
    const trumps = legal.filter(isTrump).sort((a, b) => rankValue(b, trump) - rankValue(a, trump));
    const offs = legal.filter((c) => !isTrump(c));
    const unseenTrump = unseen.filter(isTrump).length;
    // A card is "boss" if no unseen card of its suit outranks it.
    const isBoss = (c: Card) =>
      !unseen.some(
        (u) =>
          effectiveSuit(u, trump) === effectiveSuit(c, trump) && rankValue(u, trump) > rankValue(c, trump),
      );
    const bossOffs = offs.filter(isBoss).sort((a, b) => rankValue(b, trump) - rankValue(a, trump));
    const lowest = (cs: Card[]) => cs.slice().sort((a, b) => rankValue(a, trump) - rankValue(b, trump))[0];

    if (iAmMaker) {
      if (trumps.length && unseenTrump > 0) return play(trumps[0]);
      if (bossOffs.length) return play(bossOffs[0]);
      if (trumps.length) return play(trumps[0]);
      return play(lowest(offs));
    }
    if (myTeamMade) {
      // Partner called it: lead a strong trump to support, otherwise a boss off-suit card.
      if (trumps.length && (isBoss(trumps[0]) || rankValue(trumps[0], trump) >= 84) && unseenTrump > 0)
        return play(trumps[0]);
      if (bossOffs.length) return play(bossOffs[0]);
      if (offs.length) return play(lowest(offs));
      return play(lowest(trumps));
    }
    // Defender: cash boss off-suit cards (aces first), else lead low and keep trump for ruffing.
    if (bossOffs.length) return play(bossOffs[0]);
    if (offs.length) return play(lowest(offs));
    return play(lowest(trumps));
  }

  const led = effectiveSuit(s.trick[0].card, trump);
  const winning = currentWinner(s.trick, trump);
  const winPower = cardPower(winning.card, trump, led);
  const byPower = (a: Card, b: Card) => cardPower(a, trump, led) - cardPower(b, trump, led);
  const byValue = (a: Card, b: Card) => rankValue(a, trump) - rankValue(b, trump);

  if (winning.seat === partnerOf(seat)) {
    // Partner has it: throw away our lowest card.
    return play(legal.slice().sort(byValue)[0]);
  }
  const winners = legal.filter((c) => cardPower(c, trump, led) > winPower).sort(byPower);
  if (winners.length) return play(winners[0]);
  return play(legal.slice().sort(byValue)[0]);
}

/** Choose an action for whichever seat is on turn. Always returns a legal action. */
export function chooseAction(s: GameState, rng: Rng = Math.random): Action {
  let a: Action;
  switch (s.phase) {
    case "bid1":
    case "bid2":
      a = chooseBid(s, rng);
      break;
    case "dealerDiscard":
      a = { type: "discard", card: pickDiscard(s.hands[s.turn], s.trump as Suit) };
      break;
    case "play":
      a = choosePlay(s);
      break;
    case "trickEnd":
      return { type: "collectTrick" };
    default:
      return { type: "nextHand" };
  }
  // Safety net: fall back to the first legal action if the heuristic misfires.
  const legal = legalActions(s);
  return isLegal(s, a) ? a : legal[0];
}
