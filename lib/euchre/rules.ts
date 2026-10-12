import type { Card, Play, Rank, Seat, Suit, Team } from "./types";

export const SUITS: Suit[] = ["S", "H", "D", "C"];
export const RANKS: Rank[] = ["9", "10", "J", "Q", "K", "A"];
export const SEAT_NAMES = ["South", "West", "North", "East"] as const;
export const WIN_SCORE = 10;

export const teamOf = (s: Seat): Team => (s % 2) as Team;
export const nextSeat = (s: Seat): Seat => ((s + 1) % 4) as Seat;
export const partnerOf = (s: Seat): Seat => ((s + 2) % 4) as Seat;

export function sameColor(s: Suit): Suit {
  return s === "S" ? "C" : s === "C" ? "S" : s === "H" ? "D" : "H";
}

export const sameCard = (a: Card, b: Card) => a.suit === b.suit && a.rank === b.rank;

export function makeDeck(): Card[] {
  const d: Card[] = [];
  for (const suit of SUITS) for (const rank of RANKS) d.push({ suit, rank });
  return d;
}

/** Fisher-Yates shuffle (returns a new array). */
export function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const isRightBower = (c: Card, trump: Suit) => c.rank === "J" && c.suit === trump;
export const isLeftBower = (c: Card, trump: Suit) =>
  c.rank === "J" && c.suit === sameColor(trump);

/** The suit a card belongs to once trump is known (left bower is trump). */
export function effectiveSuit(c: Card, trump: Suit): Suit {
  return isLeftBower(c, trump) ? trump : c.suit;
}

const PLAIN_ORDER: Record<Rank, number> = { "9": 1, "10": 2, J: 3, Q: 4, K: 5, A: 6 };
const TRUMP_ORDER: Record<Rank, number> = { "9": 1, "10": 2, Q: 3, K: 4, A: 5, J: 0 };

/** Strength of a card in a trick with the given trump and led suit (0 = cannot win). */
export function cardPower(c: Card, trump: Suit, led: Suit): number {
  if (isRightBower(c, trump)) return 100;
  if (isLeftBower(c, trump)) return 99;
  if (c.suit === trump) return 80 + TRUMP_ORDER[c.rank];
  if (c.suit === led) return PLAIN_ORDER[c.rank];
  return 0;
}

/** Total ordering for comparing cards of the same effective suit (ignores led suit). */
export function rankValue(c: Card, trump: Suit): number {
  if (isRightBower(c, trump)) return 100;
  if (isLeftBower(c, trump)) return 99;
  if (c.suit === trump) return 80 + TRUMP_ORDER[c.rank];
  return PLAIN_ORDER[c.rank];
}

export function legalCards(hand: Card[], trick: Play[], trump: Suit): Card[] {
  if (trick.length === 0) return hand.slice();
  const led = effectiveSuit(trick[0].card, trump);
  const follow = hand.filter((c) => effectiveSuit(c, trump) === led);
  return follow.length ? follow : hand.slice();
}

export function trickWinner(trick: Play[], trump: Suit): Seat {
  const led = effectiveSuit(trick[0].card, trump);
  let best = trick[0];
  for (const p of trick) {
    if (cardPower(p.card, trump, led) > cardPower(best.card, trump, led)) best = p;
  }
  return best.seat;
}

export const SUIT_SYMBOL: Record<Suit, string> = { S: "♠", H: "♥", D: "♦", C: "♣" };
export const SUIT_NAME: Record<Suit, string> = {
  S: "Spades",
  H: "Hearts",
  D: "Diamonds",
  C: "Clubs",
};
