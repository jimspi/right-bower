export type Suit = "S" | "H" | "D" | "C";
export type Rank = "9" | "10" | "J" | "Q" | "K" | "A";
export interface Card {
  suit: Suit;
  rank: Rank;
}
/** Seats go clockwise: 0 = South (human), 1 = West, 2 = North (partner), 3 = East. */
export type Seat = 0 | 1 | 2 | 3;
/** Team 0 = South + North ("Us"), team 1 = West + East ("Them"). */
export type Team = 0 | 1;

export interface Play {
  seat: Seat;
  card: Card;
}

export type Phase =
  | "bid1"
  | "bid2"
  | "dealerDiscard"
  | "play"
  | "trickEnd"
  | "handOver"
  | "gameOver";

export interface Settings {
  stickTheDealer: boolean;
}

export interface BidEntry {
  seat: Seat;
  kind: "pass" | "order" | "call";
  suit?: Suit;
  alone?: boolean;
}

export interface HandResult {
  kind: "played" | "thrownIn";
  maker: Seat | null;
  trump: Suit | null;
  alone: boolean;
  makerTricks: number;
  defenderTricks: number;
  scoringTeam: Team | null;
  points: number;
  march: boolean;
  euchred: boolean;
}

export interface GameState {
  settings: Settings;
  scores: [number, number];
  dealer: Seat;
  hands: Card[][];
  kitty: Card[];
  upcard: Card;
  upcardTurnedDown: boolean;
  phase: Phase;
  turn: Seat;
  passes: number;
  bidLog: BidEntry[];
  trump: Suit | null;
  maker: Seat | null;
  alone: boolean;
  sittingOut: Seat | null;
  trick: Play[];
  tricksWon: [number, number];
  completedTricks: Play[][];
  lastTrick: Play[] | null;
  lastTrickWinner: Seat | null;
  winner: Team | null;
  result: HandResult | null;
  handNumber: number;
}

export type Action =
  | { type: "pass" }
  | { type: "orderUp"; alone: boolean }
  | { type: "call"; suit: Suit; alone: boolean }
  | { type: "discard"; card: Card }
  | { type: "play"; card: Card }
  | { type: "collectTrick" }
  | { type: "nextHand" };

export type Rng = () => number;
