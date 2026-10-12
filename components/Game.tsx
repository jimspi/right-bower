"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import {
  AI_NAMES,
  RANKS,
  SUIT_NAME,
  SUIT_SYMBOL,
  SUITS,
  effectiveSuit,
  legalCards,
  rankValue,
  sameCard,
  type Card,
  type GameState,
  type Seat,
  type Suit,
} from "@/lib/euchre";
import { useGame } from "@/lib/useGame";
import { cue } from "@/lib/feedback";
import { CardBack, PlayingCard, SuitIcon } from "@/components/PlayingCard";
import { AboutSheet, Confirm, MenuSheet, Modal, RulesSheet, SettingsSheet } from "@/components/Sheets";

type Sheet = null | "menu" | "rules" | "settings" | "about" | "confirmNew" | "lastTrick";

const SEAT_NAME = (s: Seat) => (s === 0 ? "You" : AI_NAMES[s]);
const TEAM_NAME = (t: 0 | 1) => (t === 0 ? "Us" : "Them");
const SUIT_ORDER: Suit[] = ["S", "H", "C", "D"];
const CARD_BASE = { small: 58, medium: 68, large: 80 } as const;

function sortHand(hand: Card[], trump: Suit | null): Card[] {
  return [...hand].sort((a, b) => {
    const sa = trump ? effectiveSuit(a, trump) : a.suit;
    const sb = trump ? effectiveSuit(b, trump) : b.suit;
    if (sa !== sb) {
      if (trump) {
        if (sa === trump) return -1;
        if (sb === trump) return 1;
      }
      return SUIT_ORDER.indexOf(sa) - SUIT_ORDER.indexOf(sb);
    }
    const ra = trump ? rankValue(a, trump) : RANKS.indexOf(a.rank);
    const rb = trump ? rankValue(b, trump) : RANKS.indexOf(b.rank);
    return rb - ra;
  });
}

function useDelayedFlag(cond: boolean, ms: number) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!cond) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOn(false);
      return;
    }
    const id = window.setTimeout(() => setOn(true), ms);
    return () => window.clearTimeout(id);
  }, [cond, ms]);
  return on && cond;
}

const cardKey = (c: Card) => c.rank + c.suit;

function SuitBadge({ suit, size = 22, fourColor }: { suit: Suit; size?: number; fourColor: boolean }) {
  return (
    <span
      className="inline-grid place-items-center rounded-full bg-cream shadow"
      style={{ width: size, height: size }}
    >
      <SuitIcon suit={suit} size={size * 0.62} fourColor={fourColor} />
    </span>
  );
}

function describeResult(s: GameState) {
  const r = s.result;
  if (!r) return { head: "", sub: "", detail: "" };
  if (r.kind === "thrownIn")
    return { head: "Thrown in", sub: "Everyone passed. New deal.", detail: "" };
  const who = SEAT_NAME(r.maker as Seat);
  const head = `${who} ${r.euchred ? "got euchred!" : "made it!"}${r.march ? " March!" : ""}`;
  const sub = `+${r.points} for ${TEAM_NAME(r.scoringTeam as 0 | 1)}`;
  const detail = `${r.alone ? "Going alone. " : ""}Makers took ${r.makerTricks}, defenders ${r.defenderTricks}.`;
  return { head, sub, detail };
}

const SEAT_DIR: Record<Seat, { x: number; y: number }> = {
  0: { x: 0, y: 220 },
  1: { x: -220, y: 0 },
  2: { x: 0, y: -220 },
  3: { x: 220, y: 0 },
};
const SWEEP = {
  sweep: (d: { x: number; y: number }) => ({
    opacity: 0,
    scale: 0.5,
    x: d.x,
    y: d.y,
    transition: { duration: 0.35 },
  }),
};
const TRICK_POS: Record<Seat, { left: number; top: number; rot: number }> = {
  0: { left: 86, top: 119, rot: -3 },
  1: { left: 6, top: 60, rot: 5 },
  2: { left: 86, top: 0, rot: 2 },
  3: { left: 166, top: 60, rot: -5 },
};

export default function Game() {
  const [sheet, setSheet] = useState<Sheet>(null);
  const [alone, setAlone] = useState(false);
  const [selected, setSelected] = useState<Card | null>(null);
  const [shake, setShake] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const hintTimer = useRef<number | null>(null);

  const { ready, state, settings, record, apply, startNewGame, updateSettings } = useGame(sheet !== null);
  const fb = useMemo(() => ({ sound: settings.sound, haptics: settings.haptics }), [settings.sound, settings.haptics]);

  const showHint = useCallback((msg: string) => {
    setHint(msg);
    if (hintTimer.current) window.clearTimeout(hintTimer.current);
    hintTimer.current = window.setTimeout(() => setHint(null), 2200);
  }, []);

  const phase = state?.phase;
  const summaryReady = useDelayedFlag(phase === "handOver" || phase === "gameOver", 750);

  const humanHand = useMemo(
    () => (state ? sortHand(state.hands[0], state.trump) : []),
    [state],
  );

  if (!ready || !state) {
    return (
      <main className="app-root items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon-192.png" alt="Right Bower" width={96} height={96} className="relative rounded-[22px]" />
      </main>
    );
  }

  const s = state;
  const trump = s.trump;
  const myTurn = s.turn === 0;
  const legal: Card[] =
    s.phase === "play" && myTurn && trump ? legalCards(s.hands[0], s.trick, trump) : [];
  const ledSuit = s.trick.length && trump ? effectiveSuit(s.trick[0].card, trump) : null;
  const sittingOut = s.sittingOut === 0;
  const fourColor = settings.fourColor;

  // ----- actions -----
  const closeSheet = () => setSheet(null);
  const doNew = () => {
    setSheet(null);
    setSelected(null);
    setAlone(false);
    startNewGame();
  };
  const onCardTap = (c: Card) => {
    if (s.phase === "dealerDiscard" && myTurn) {
      setSelected((cur) => (cur && sameCard(cur, c) ? null : c));
      cue("card", fb);
      return;
    }
    if (s.phase !== "play") return;
    if (!myTurn) {
      showHint(sittingOut ? "You're sitting out this hand." : "Hold on — it's not your turn.");
      return;
    }
    if (!legal.some((l) => sameCard(l, c))) {
      setShake(cardKey(c));
      window.setTimeout(() => setShake(null), 400);
      cue("error", fb);
      showHint(ledSuit ? `You must follow suit (${SUIT_SYMBOL[ledSuit]}).` : "That card can't be played.");
      return;
    }
    apply({ type: "play", card: c });
  };

  // ----- status line -----
  let status = "";
  const dealerName = SEAT_NAME(s.dealer);
  switch (s.phase) {
    case "bid1":
      status = myTurn
        ? `Your call — order up ${SUIT_NAME[s.upcard.suit]} or pass`
        : `${SEAT_NAME(s.turn)} is deciding…`;
      break;
    case "bid2":
      status = myTurn
        ? s.settings.stickTheDealer && s.dealer === 0 && s.passes === 3
          ? "Stuck! You must name trump"
          : "Name a trump suit, or pass"
        : `${SEAT_NAME(s.turn)} is deciding…`;
      break;
    case "dealerDiscard":
      status = myTurn
        ? selected
          ? "Confirm the discard"
          : "Pick up the upcard — tap a card to discard"
        : `${dealerName} picks up and discards…`;
      break;
    case "play":
      if (sittingOut) status = "You're sitting out this hand";
      else if (myTurn)
        status = ledSuit
          ? legal.length < s.hands[0].length || legal.length === 1
            ? `Your turn — follow suit (${SUIT_SYMBOL[ledSuit]})`
            : "Your turn — can't follow, play any card"
          : "Your turn — lead a card";
      else status = `${SEAT_NAME(s.turn)} is playing…`;
      break;
    case "trickEnd":
      status = `${s.lastTrickWinner === 0 ? "You take" : SEAT_NAME(s.lastTrickWinner as Seat) + " takes"} the trick`;
      break;
    default:
      status = s.phase === "gameOver" ? "Game over" : "Hand complete";
  }

  // ----- bubbles during bidding -----
  const bubbles: Partial<Record<Seat, string>> = {};
  if (s.phase === "bid1" || s.phase === "bid2") {
    for (const b of s.bidLog) {
      bubbles[b.seat] =
        b.kind === "pass"
          ? "Pass"
          : b.kind === "order"
            ? b.alone
              ? "Order it up — alone!"
              : "Order it up!"
            : `${SUIT_NAME[b.suit as Suit]}${b.alone ? " — alone!" : "!"}`;
    }
  }

  const cw = CARD_BASE[settings.cardSize];
  const n = humanHand.length;
  const handCw = `min(${cw}px, calc((min(100vw, 560px) - 28px) / ${1 + 0.72 * (n - 1)}))`;

  const makerName = s.maker !== null ? SEAT_NAME(s.maker) : null;
  const stuck = s.settings.stickTheDealer && s.phase === "bid2" && s.dealer === 0 && s.passes === 3;

  // ----- seat widgets -----
  const nameChip = (seat: Seat) => {
    const active = s.turn === seat && ["bid1", "bid2", "play", "dealerDiscard"].includes(s.phase);
    return (
      <div className="flex items-center gap-1">
        <span
          className={`chip ${active ? "turn-glow border-gold text-gold-light" : ""}`}
          style={active ? { borderColor: "var(--gold)" } : undefined}
        >
          {SEAT_NAME(seat)}
          {seat === 2 && <span className="text-[9px] opacity-70">partner</span>}
        </span>
        {s.dealer === seat && <span className="dealer-chip" title="Dealer">D</span>}
        {s.maker === seat && s.phase !== "bid1" && s.phase !== "bid2" && (
          <span className="chip" style={{ background: "rgba(227,185,78,.2)" }}>
            {s.alone ? "alone" : "maker"}
          </span>
        )}
      </div>
    );
  };

  const backs = (seat: Seat, vertical: boolean) => {
    const count = s.hands[seat].length;
    const out = s.sittingOut === seat;
    return (
      <div
        className={`flex ${vertical ? "flex-col items-center" : "flex-row items-center justify-center"} ${out ? "opacity-30" : ""}`}
      >
        {Array.from({ length: count }).map((_, i) => (
          <motion.div
            key={`${s.handNumber}-${seat}-${i}`}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.05 * i + seat * 0.03, duration: 0.25 }}
            style={
              vertical
                ? { width: 44, height: 30, marginTop: i === 0 ? 0 : -16, position: "relative" }
                : { width: 36, height: 50, marginLeft: i === 0 ? 0 : -20 }
            }
          >
            {vertical ? (
              <div
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  width: 30,
                  height: 43,
                  transform: "translate(-50%,-50%) rotate(90deg)",
                  filter: "drop-shadow(0 1px 2px rgba(0,0,0,.5))",
                }}
              >
                <CardBack />
              </div>
            ) : (
              <div className="h-full w-full" style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,.5))" }}>
                <CardBack />
              </div>
            )}
          </motion.div>
        ))}
      </div>
    );
  };

  const bubble = (seat: Seat, cls: string) =>
    bubbles[seat] ? (
      <motion.div
        key={`${seat}-${bubbles[seat]}`}
        initial={{ opacity: 0, y: 6, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className={`pointer-events-none absolute z-10 rounded-full bg-cream px-3 py-1 text-xs font-bold text-[#14291f] shadow-lg ${cls}`}
      >
        {bubbles[seat]}
      </motion.div>
    ) : null;

  const info = (
    <div className="flex min-h-[26px] flex-wrap items-center justify-center gap-x-2 gap-y-0.5 px-2 text-[11px] text-cream/85">
      {trump && s.maker !== null ? (
        <>
          <span className="flex items-center gap-1 font-semibold">
            <SuitBadge suit={trump} size={20} fourColor={fourColor} />
            {SUIT_NAME[trump]} · {makerName === "You" ? "you called" : `${makerName} called`}
          </span>
          {s.alone && (
            <span className="chip" style={{ background: "rgba(227,185,78,.25)", color: "var(--gold-2)" }}>
              ALONE
            </span>
          )}
          <span className="chip">
            Tricks&nbsp; Us <b className="text-gold-light">{s.tricksWon[0]}</b> · Them <b className="text-gold-light">{s.tricksWon[1]}</b>
          </span>
        </>
      ) : (
        <span className="font-semibold">
          Bidding · round {s.phase === "bid2" ? 2 : 1}
          {s.phase === "bid2" ? ` · ${SUIT_NAME[s.upcard.suit]} turned down` : ""}
        </span>
      )}
    </div>
  );

  const summary = describeResult(s);

  return (
    <MotionConfig reducedMotion="user">
      <main className="app-root select-none">
        {/* Header */}
        <header className="relative z-10 px-2 pt-1">
          <div className="flex items-center justify-between gap-2">
            <button className="btn px-0" style={{ width: 46 }} aria-label="Menu" onClick={() => setSheet("menu")}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </button>
            <div className="flex flex-1 items-stretch justify-center overflow-hidden rounded-2xl border border-gold/30 bg-black/35">
              <div className="flex flex-1 items-center justify-center gap-2 px-3 py-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-cream/70">Us</span>
                <span className="font-display text-3xl font-extrabold leading-none gold-text" aria-label={`Us ${s.scores[0]}`}>
                  {s.scores[0]}
                </span>
              </div>
              <div className="my-1 w-px bg-gold/25" />
              <div className="flex flex-1 items-center justify-center gap-2 px-3 py-1">
                <span className="font-display text-3xl font-extrabold leading-none gold-text" aria-label={`Them ${s.scores[1]}`}>
                  {s.scores[1]}
                </span>
                <span className="text-[11px] font-bold uppercase tracking-wider text-cream/70">Them</span>
              </div>
            </div>
            <button className="btn px-0" style={{ width: 46 }} aria-label="New game" onClick={() => setSheet("confirmNew")}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 12a8 8 0 1 1-2.6-5.9M20 4v5h-5" />
              </svg>
            </button>
          </div>
          {info}
        </header>

        {/* Table */}
        <section className="relative min-h-0 flex-1">
          {/* North (partner) */}
          <div className="absolute left-1/2 top-1 flex -translate-x-1/2 flex-col items-center gap-1">
            {nameChip(2)}
            {backs(2, false)}
            {s.sittingOut === 2 && <span className="text-[10px] text-cream/70">sitting out</span>}
          </div>
          {bubble(2, "left-1/2 top-[88px] -translate-x-1/2")}

          {/* West */}
          <div className="absolute left-1 top-1/2 flex -translate-y-1/2 flex-col items-center gap-1">
            {nameChip(1)}
            {backs(1, true)}
            {s.sittingOut === 1 && <span className="text-[10px] text-cream/70">out</span>}
          </div>
          {bubble(1, "left-[66px] top-1/2 -translate-y-1/2")}

          {/* East */}
          <div className="absolute right-1 top-1/2 flex -translate-y-1/2 flex-col items-center gap-1">
            {nameChip(3)}
            {backs(3, true)}
            {s.sittingOut === 3 && <span className="text-[10px] text-cream/70">out</span>}
          </div>
          {bubble(3, "right-[66px] top-1/2 -translate-y-1/2")}

          {/* Center: trick or upcard */}
          <div className="absolute left-1/2 top-1/2 -ml-[115px] -mt-[105px] h-[200px] w-[230px]">
            {(s.phase === "bid1" || s.phase === "bid2") && (
              <motion.div
                key={`up-${s.handNumber}-${s.phase}`}
                initial={{ opacity: 0, y: -30, rotate: -8 }}
                animate={{ opacity: 1, y: 0, rotate: s.phase === "bid1" ? 3 : -3 }}
                transition={{ delay: 0.35 }}
                className="absolute left-1/2 top-1/2 -ml-[41px] -mt-[58px] w-[82px]"
                style={{ aspectRatio: "70/100", filter: "drop-shadow(0 6px 10px rgba(0,0,0,.5))" }}
              >
                {s.phase === "bid1" ? <PlayingCard card={s.upcard} fourColor={fourColor} /> : <CardBack />}
              </motion.div>
            )}
            <AnimatePresence custom={SEAT_DIR[(s.lastTrickWinner ?? 0) as Seat]}>
              {s.trick.map((p) => (
                <motion.div
                  key={`${s.handNumber}-${s.completedTricks.length}-${p.seat}`}
                  custom={SEAT_DIR[(s.lastTrickWinner ?? 0) as Seat]}
                  initial={{ opacity: 0, scale: 0.8, x: SEAT_DIR[p.seat].x * 0.6, y: SEAT_DIR[p.seat].y * 0.6 }}
                  animate={{ opacity: 1, scale: 1, x: 0, y: 0, rotate: TRICK_POS[p.seat].rot }}
                  variants={SWEEP}
                  exit="sweep"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  className="absolute w-[58px]"
                  style={{
                    left: TRICK_POS[p.seat].left,
                    top: TRICK_POS[p.seat].top,
                    aspectRatio: "70/100",
                    filter: "drop-shadow(0 4px 6px rgba(0,0,0,.45))",
                    outline: s.phase === "trickEnd" && s.lastTrickWinner === p.seat ? "2px solid var(--gold)" : undefined,
                    outlineOffset: 1,
                    borderRadius: 7,
                  }}
                >
                  <PlayingCard card={p.card} fourColor={fourColor} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {bubble(0, "bottom-[8px] left-1/2 -translate-x-1/2")}

          {/* Hint toast */}
          <AnimatePresence>
            {hint && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="absolute bottom-2 left-1/2 z-30 -translate-x-1/2 whitespace-nowrap rounded-full bg-cream px-4 py-2 text-sm font-bold text-[#14291f] shadow-xl"
              >
                {hint}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Bidding / discard panel */}
          {myTurn && (s.phase === "bid1" || s.phase === "bid2" || s.phase === "dealerDiscard") && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="panel absolute inset-x-2 bottom-1 z-20 p-3"
            >
              {s.phase === "bid1" && (
                <>
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="font-semibold">
                      Upcard: <span className="text-gold-light">{s.upcard.rank}{SUIT_SYMBOL[s.upcard.suit]}</span>
                      {s.dealer === 0 && <span className="text-cream/70"> · you pick it up</span>}
                    </span>
                    <AloneToggle alone={alone} onChange={setAlone} />
                  </div>
                  <div className="flex gap-2">
                    <button className="btn flex-1" onClick={() => { setAlone(false); apply({ type: "pass" }); }}>
                      Pass
                    </button>
                    <button
                      className="btn btn-gold flex-[1.6]"
                      onClick={() => { apply({ type: "orderUp", alone }); setAlone(false); }}
                    >
                      {alone ? "Order it up — alone" : "Order it up"}
                    </button>
                  </div>
                </>
              )}
              {s.phase === "bid2" && (
                <>
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="font-semibold">Name trump</span>
                    <AloneToggle alone={alone} onChange={setAlone} />
                  </div>
                  <div className="flex gap-2">
                    {SUITS.filter((x) => x !== s.upcard.suit).map((suit) => (
                      <button
                        key={suit}
                        className="btn btn-gold flex flex-1 flex-col items-center justify-center gap-0 px-1 py-1"
                        style={{ minHeight: 54 }}
                        aria-label={`Name ${SUIT_NAME[suit]} as trump${alone ? ", going alone" : ""}`}
                        onClick={() => { apply({ type: "call", suit, alone }); setAlone(false); }}
                      >
                        <span className="grid h-7 w-7 place-items-center rounded-full bg-cream">
                          <SuitIcon suit={suit} size={18} fourColor={fourColor} />
                        </span>
                        <span className="text-[11px] leading-tight">{SUIT_NAME[suit]}</span>
                      </button>
                    ))}
                    <button
                      className="btn flex-1"
                      disabled={stuck}
                      onClick={() => { setAlone(false); apply({ type: "pass" }); }}
                    >
                      {stuck ? "Stuck" : "Pass"}
                    </button>
                  </div>
                </>
              )}
              {s.phase === "dealerDiscard" && (
                <div className="flex items-center gap-2">
                  <div className="flex-1 text-sm font-semibold">
                    You picked up {s.upcard.rank}
                    {SUIT_SYMBOL[s.upcard.suit]}.
                    <div className="text-xs font-normal text-cream/70">Tap a card, then discard it.</div>
                  </div>
                  <button
                    className="btn btn-gold"
                    disabled={!selected}
                    onClick={() => {
                      if (selected) {
                        apply({ type: "discard", card: selected });
                        setSelected(null);
                      }
                    }}
                  >
                    Discard
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </section>

        {/* Status */}
        <div
          className="relative z-10 flex min-h-[30px] items-center justify-center px-3 text-center text-[13px] font-semibold text-gold-light"
          aria-live="polite"
        >
          {status}
        </div>

        {/* South row */}
        <div className="relative z-10 flex items-center justify-between px-3 pb-1">
          <div className="flex items-center gap-1">
            <span
              className={`chip ${myTurn && ["bid1", "bid2", "play", "dealerDiscard"].includes(s.phase) ? "turn-glow" : ""}`}
              style={myTurn && ["bid1", "bid2", "play", "dealerDiscard"].includes(s.phase) ? { borderColor: "var(--gold)" } : undefined}
            >
              You
            </span>
            {s.dealer === 0 && <span className="dealer-chip">D</span>}
            {s.maker === 0 && s.phase !== "bid1" && s.phase !== "bid2" && (
              <span className="chip" style={{ background: "rgba(227,185,78,.2)" }}>{s.alone ? "alone" : "maker"}</span>
            )}
          </div>
          {s.lastTrick && (
            <button
              className="btn px-3 text-xs"
              style={{ minHeight: 36, minWidth: 44 }}
              onClick={() => setSheet("lastTrick")}
            >
              Last trick
            </button>
          )}
        </div>

        {/* Hand */}
        <div
          className="relative z-10 flex items-end justify-center px-2 pb-2"
          style={{ ["--cw" as string]: handCw, height: `calc(${handCw} * 1.4 + 22px)` }}
        >
          <div className={`flex items-end justify-center ${sittingOut ? "opacity-35" : ""}`}>
            {humanHand.map((c, i) => {
              const mid = (n - 1) / 2;
              const off = i - mid;
              const isLegal = s.phase === "play" && myTurn && legal.some((l) => sameCard(l, c));
              const dim = s.phase === "play" && myTurn && !isLegal;
              const isSel = selected && sameCard(selected, c);
              const lift = isSel ? -16 : isLegal ? -6 : 0;
              const key = cardKey(c);
              return (
                <motion.div
                  key={`${s.handNumber}-${key}`}
                  layout="position"
                  initial={{ opacity: 0, y: 90, scale: 0.8 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ delay: 0.07 * i, type: "spring", stiffness: 300, damping: 26 }}
                  style={{ marginLeft: i === 0 ? 0 : `calc(var(--cw) * -0.28)`, zIndex: i }}
                >
                  <button
                    onClick={() => onCardTap(c)}
                    aria-label={`${c.rank} of ${SUIT_NAME[c.suit]}${isLegal ? ", playable" : ""}`}
                    className={`block ${shake === key ? "shake" : ""}`}
                    style={{
                      width: "var(--cw)",
                      aspectRatio: "70/100",
                      padding: 0,
                      border: 0,
                      background: "none",
                      transformOrigin: "50% 120%",
                      transform: `translateY(${lift + Math.abs(off) * Math.abs(off) * 1.6}px) rotate(${off * 2.4}deg)`,
                      transition: "transform .18s ease, filter .18s ease",
                      filter: `${dim ? "brightness(.5) saturate(.7)" : ""} drop-shadow(0 4px 6px rgba(0,0,0,.45))`,
                      borderRadius: 8,
                      boxShadow: isLegal || isSel ? "0 0 0 2.5px var(--gold)" : undefined,
                    }}
                  >
                    <PlayingCard card={c} fourColor={fourColor} />
                  </button>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Hand summary */}
        {s.phase === "handOver" && summaryReady && sheet === null && (
          <Modal onClose={() => {}} center>
            <div className="text-center">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="font-display text-2xl font-extrabold gold-text"
              >
                {summary.head}
              </motion.div>
              <div className="mt-1 text-xl font-bold">{summary.sub}</div>
              {summary.detail && <div className="mt-1 text-sm text-cream/75">{summary.detail}</div>}
              <div className="mt-3 flex items-center justify-center gap-6 text-sm">
                <span>Us <b className="text-2xl text-gold-light">{s.scores[0]}</b></span>
                <span>Them <b className="text-2xl text-gold-light">{s.scores[1]}</b></span>
              </div>
              <button className="btn btn-gold mt-4 w-full" onClick={() => apply({ type: "nextHand" })}>
                Continue
              </button>
            </div>
          </Modal>
        )}

        {/* Game over */}
        {s.phase === "gameOver" && summaryReady && sheet === null && (
          <GameOver s={s} record={record} summary={summary} onAgain={doNew} onMenu={() => setSheet("menu")} />
        )}

        {/* Sheets */}
        {sheet === "menu" && (
          <MenuSheet
            onClose={closeSheet}
            onNew={() => setSheet("confirmNew")}
            onRules={() => setSheet("rules")}
            onSettings={() => setSheet("settings")}
            onAbout={() => setSheet("about")}
          />
        )}
        {sheet === "rules" && <RulesSheet onClose={closeSheet} />}
        {sheet === "settings" && <SettingsSheet settings={settings} onChange={updateSettings} onClose={closeSheet} />}
        {sheet === "about" && <AboutSheet record={record} onClose={closeSheet} />}
        {sheet === "confirmNew" && (
          <Confirm
            title="Start a new game?"
            body="Your current game and its score will be abandoned."
            confirmLabel="New Game"
            onConfirm={doNew}
            onCancel={closeSheet}
          />
        )}
        {sheet === "lastTrick" && s.lastTrick && (
          <Modal title="Last trick" onClose={closeSheet}>
            <div className="flex justify-center gap-3">
              {s.lastTrick.map((p) => {
                const won = s.completedTricks.length > 0 && winnerOf(s, p.seat);
                return (
                  <div key={p.seat} className="flex flex-col items-center gap-1">
                    <div
                      className="w-[64px] rounded-lg"
                      style={{ aspectRatio: "70/100", outline: won ? "2.5px solid var(--gold)" : undefined, outlineOffset: 2 }}
                    >
                      <PlayingCard card={p.card} fourColor={fourColor} />
                    </div>
                    <span className={`text-xs font-semibold ${won ? "text-gold-light" : "text-cream/70"}`}>
                      {SEAT_NAME(p.seat)}
                    </span>
                  </div>
                );
              })}
            </div>
          </Modal>
        )}
      </main>
    </MotionConfig>
  );
}

function winnerOf(s: GameState, seat: Seat): boolean {
  if (!s.lastTrick || !s.trump) return false;
  const led = effectiveSuit(s.lastTrick[0].card, s.trump);
  const power = (c: Card) => {
    const eff = effectiveSuit(c, s.trump as Suit);
    if (eff === s.trump) return 100 + rankValue(c, s.trump as Suit);
    if (eff === led) return rankValue(c, s.trump as Suit);
    return 0;
  };
  let best = s.lastTrick[0];
  for (const p of s.lastTrick) if (power(p.card) > power(best.card)) best = p;
  return best.seat === seat;
}

function AloneToggle({ alone, onChange }: { alone: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={alone}
      onClick={() => onChange(!alone)}
      className={`flex items-center gap-2 rounded-full border px-3 text-xs font-bold ${alone ? "border-gold bg-gold text-[#1d1604]" : "border-white/20 bg-black/30"}`}
      style={{ minHeight: 44 }}
    >
      <span
        className={`grid h-4 w-4 place-items-center rounded-full border text-[10px] ${alone ? "border-[#1d1604]" : "border-white/50"}`}
      >
        {alone ? "✓" : ""}
      </span>
      Go alone
    </button>
  );
}

const CONFETTI = Array.from({ length: 26 }, (_, i) => ({
  left: (i * 37) % 100,
  delay: (i % 9) * 0.25,
  dur: 3 + (i % 5) * 0.6,
  suit: SUITS[i % 4],
  size: 16 + (i % 4) * 6,
}));

function GameOver({
  s,
  record,
  summary,
  onAgain,
  onMenu,
}: {
  s: GameState;
  record: { won: number; lost: number };
  summary: { head: string; sub: string; detail: string };
  onAgain: () => void;
  onMenu: () => void;
}) {
  const won = s.winner === 0;
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center overflow-hidden bg-black/75 p-4 backdrop-blur-sm">
      {won &&
        CONFETTI.map((c, i) => (
          <motion.span
            key={i}
            className="pointer-events-none absolute top-0"
            style={{ left: `${c.left}%` }}
            initial={{ y: -40, opacity: 0, rotate: 0 }}
            animate={{ y: 760, opacity: [0, 1, 1, 0], rotate: 360 }}
            transition={{ duration: c.dur, delay: c.delay, repeat: Infinity, ease: "linear" }}
          >
            <SuitIcon suit={c.suit} size={c.size} color={c.suit === "H" || c.suit === "D" ? "#e3b94e" : "#fbf6e9"} />
          </motion.span>
        ))}
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="panel relative w-full max-w-[360px] p-6 text-center"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon-192.png" alt="" width={72} height={72} className="mx-auto rounded-2xl" />
        <div className="mt-3 font-display text-3xl font-extrabold gold-text">
          {won ? "You win!" : "They win"}
        </div>
        <div className="mt-1 text-sm text-cream/80">
          {won ? "Take a bow. That was some fine Euchre." : "Tough luck. Shuffle up and go again."}
        </div>
        <div className="mt-4 flex items-center justify-center gap-8">
          <div>
            <div className="text-xs uppercase tracking-wider text-cream/60">Us</div>
            <div className={`font-display text-5xl font-extrabold ${won ? "gold-text" : ""}`}>{s.scores[0]}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-cream/60">Them</div>
            <div className={`font-display text-5xl font-extrabold ${!won ? "gold-text" : ""}`}>{s.scores[1]}</div>
          </div>
        </div>
        {summary.head && <div className="mt-3 text-xs text-cream/60">Final hand: {summary.head} {summary.sub}</div>}
        <div className="mt-1 text-xs text-cream/60">
          Lifetime: {record.won} won · {record.lost} lost
        </div>
        <div className="mt-5 flex flex-col gap-2">
          <button className="btn btn-gold text-lg" onClick={onAgain}>
            Play Again
          </button>
          <button className="btn" onClick={onMenu}>
            Menu
          </button>
        </div>
      </motion.div>
    </div>
  );
}
