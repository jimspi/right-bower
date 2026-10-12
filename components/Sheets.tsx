"use client";

import type { ReactNode } from "react";
import type { AppSettings, LifetimeRecord, Speed, CardSize } from "@/lib/store";
import { SuitIcon } from "@/components/PlayingCard";

export function Modal({
  title,
  onClose,
  children,
  center,
}: {
  title?: string;
  onClose: () => void;
  children: ReactNode;
  center?: boolean;
}) {
  return (
    <div
      className={`absolute inset-0 z-50 flex bg-black/60 backdrop-blur-[2px] ${center ? "items-center" : "items-end"} justify-center p-3`}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="panel flex max-h-[88%] w-full flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        style={{ paddingBottom: "max(0px, env(safe-area-inset-bottom))" }}
      >
        {title && (
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
            <h2 className="font-display text-xl font-bold gold-text">{title}</h2>
            <button className="btn" onClick={onClose} aria-label="Close">
              ✕
            </button>
          </div>
        )}
        <div className="sheet-scroll p-4">{children}</div>
      </div>
    </div>
  );
}

export function Confirm({
  title,
  body,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal onClose={onCancel} center>
      <h2 className="font-display text-xl font-bold gold-text">{title}</h2>
      <p className="mt-2 text-sm text-cream/85">{body}</p>
      <div className="mt-4 flex gap-3">
        <button className="btn flex-1" onClick={onCancel}>
          Cancel
        </button>
        <button className="btn btn-danger flex-1" onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

export function MenuSheet({
  onClose,
  onNew,
  onRules,
  onSettings,
  onAbout,
}: {
  onClose: () => void;
  onNew: () => void;
  onRules: () => void;
  onSettings: () => void;
  onAbout: () => void;
}) {
  return (
    <Modal title="Menu" onClose={onClose}>
      <div className="flex flex-col gap-3">
        <button className="btn btn-gold text-lg" onClick={onNew}>
          New Game
        </button>
        <button className="btn" onClick={onRules}>
          How to Play
        </button>
        <button className="btn" onClick={onSettings}>
          Settings
        </button>
        <button className="btn" onClick={onAbout}>
          About
        </button>
      </div>
    </Modal>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex min-h-[52px] items-center justify-between gap-3 border-b border-white/10 py-2 last:border-0">
      <div>
        <div className="font-semibold">{label}</div>
        {hint && <div className="text-xs text-cream/60">{hint}</div>}
      </div>
      {children}
    </div>
  );
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={`relative h-[30px] w-[52px] shrink-0 rounded-full border border-white/20 transition-colors ${on ? "bg-gold" : "bg-black/40"}`}
      style={{ minHeight: 30 }}
    >
      <span
        className="absolute top-[2px] h-[24px] w-[24px] rounded-full bg-cream shadow transition-all"
        style={{ left: on ? 26 : 2 }}
      />
    </button>
  );
}

function Seg<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { v: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex overflow-hidden rounded-xl border border-white/15">
      {options.map((o) => (
        <button
          key={o.v}
          onClick={() => onChange(o.v)}
          className={`min-h-[44px] px-3 text-sm font-semibold ${value === o.v ? "bg-gold text-[#1d1604]" : "bg-black/30 text-cream"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function SettingsSheet({
  settings,
  onChange,
  onClose,
}: {
  settings: AppSettings;
  onChange: (p: Partial<AppSettings>) => void;
  onClose: () => void;
}) {
  return (
    <Modal title="Settings" onClose={onClose}>
      <Row label="Stick the Dealer" hint="If all pass in round 2, the dealer must name trump.">
        <Toggle label="Stick the Dealer" on={settings.stickTheDealer} onChange={(v) => onChange({ stickTheDealer: v })} />
      </Row>
      <Row label="Game speed">
        <Seg<Speed>
          value={settings.speed}
          onChange={(v) => onChange({ speed: v })}
          options={[
            { v: "slow", label: "Slow" },
            { v: "normal", label: "Normal" },
            { v: "fast", label: "Fast" },
          ]}
        />
      </Row>
      <Row label="Card size">
        <Seg<CardSize>
          value={settings.cardSize}
          onChange={(v) => onChange({ cardSize: v })}
          options={[
            { v: "small", label: "S" },
            { v: "medium", label: "M" },
            { v: "large", label: "L" },
          ]}
        />
      </Row>
      <Row label="Four-color suits" hint="Spades black, hearts red, diamonds blue, clubs green.">
        <Toggle label="Four-color suits" on={settings.fourColor} onChange={(v) => onChange({ fourColor: v })} />
      </Row>
      <Row label="Sound" hint="Subtle effects. Off by default.">
        <Toggle label="Sound" on={settings.sound} onChange={(v) => onChange({ sound: v })} />
      </Row>
      <Row label="Haptics" hint="Vibration on supported devices.">
        <Toggle label="Haptics" on={settings.haptics} onChange={(v) => onChange({ haptics: v })} />
      </Row>
      <button className="btn btn-gold mt-3 w-full" onClick={onClose}>
        Done
      </button>
    </Modal>
  );
}

function H({ children }: { children: ReactNode }) {
  return <h3 className="mb-1 mt-4 font-display text-lg font-bold text-gold first:mt-0">{children}</h3>;
}
function Li({ children }: { children: ReactNode }) {
  return <li className="mb-1 pl-1">{children}</li>;
}

export function RulesSheet({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="How to Play" onClose={onClose}>
      <div className="text-[15px] leading-snug text-cream/90">
        <H>The goal</H>
        <ul className="list-disc pl-5">
          <Li>Four players, two teams. You and Maya (North) are <b>Us</b>; Jack and Rosa are <b>Them</b>.</Li>
          <Li>First team to <b>10 points</b> wins.</Li>
        </ul>

        <H>The cards</H>
        <ul className="list-disc pl-5">
          <Li>24 cards: 9, 10, J, Q, K, A in each suit. Each player gets 5; four sit in the kitty, and the top one is turned up.</Li>
          <Li>The dealer rotates clockwise each hand (the gold <b>D</b> marks the dealer).</Li>
        </ul>

        <H>Trump ranking</H>
        <ul className="list-disc pl-5">
          <Li><b>Right bower</b>: the Jack of trump. Highest card.</Li>
          <Li><b>Left bower</b>: the Jack of the same color. Second highest, and it <i>is</i> a trump. If ♥ is trump, J♦ is a heart.</Li>
          <Li>Then trump A, K, Q, 10, 9.</Li>
          <Li>Other suits rank A, K, Q, J, 10, 9.</Li>
        </ul>
        <div className="mt-2 flex items-center gap-1 rounded-lg bg-black/30 p-2 text-sm">
          Example, trump is <SuitIcon suit="H" size={14} /> :
          <b className="ml-1">J♥ &gt; J♦ &gt; A♥ &gt; K♥ &gt; Q♥ &gt; 10♥ &gt; 9♥</b>
        </div>

        <H>Bidding</H>
        <ul className="list-disc pl-5">
          <Li><b>Round 1:</b> starting left of the dealer, each player passes or <b>orders it up</b>, making the upcard&apos;s suit trump. The dealer then picks up the upcard and discards one card.</Li>
          <Li><b>Round 2:</b> if all pass, the upcard is turned down. Each player may name any <i>other</i> suit as trump, or pass.</Li>
          <Li>If everyone passes again, the hand is thrown in and the next dealer deals.</Li>
          <Li><b>Stick the Dealer</b> (setting): the dealer can&apos;t pass in round 2.</Li>
          <Li><b>Go alone:</b> when you order up or name trump, you may play without your partner for bigger points. Your partner sits out.</Li>
          <Li>The team that calls trump are the <b>makers</b>; the others are the <b>defenders</b>.</Li>
        </ul>

        <H>Playing a hand</H>
        <ul className="list-disc pl-5">
          <Li>Five tricks. The player left of the dealer leads (or the next player still in the hand).</Li>
          <Li><b>You must follow the led suit</b> if you can. The left bower counts as trump, not its printed suit. If you can&apos;t follow, play anything.</Li>
          <Li>Highest trump wins the trick; with no trump, the highest card of the led suit wins. The winner leads next.</Li>
          <Li>Playable cards are bright. Illegal cards are dimmed.</Li>
        </ul>

        <H>Scoring</H>
        <table className="w-full text-sm">
          <tbody>
            {[
              ["Makers take 3 or 4 tricks", "1 point"],
              ["Makers take all 5 (a march)", "2 points"],
              ["Makers take fewer than 3 (euchred)", "2 to defenders"],
              ["Lone maker takes 3 or 4", "1 point"],
              ["Lone maker takes all 5", "4 points"],
              ["Lone maker is euchred", "2 to defenders"],
            ].map(([a, b]) => (
              <tr key={a} className="border-b border-white/10 last:border-0">
                <td className="py-1.5 pr-2">{a}</td>
                <td className="py-1.5 text-right font-bold text-gold">{b}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <H>Tips</H>
        <ul className="list-disc pl-5">
          <Li>Win cheaply: don&apos;t trump a trick your partner is already winning.</Li>
          <Li>Count trump! Once the right bower is gone, your left bower is the boss.</Li>
          <Li>Off-suit aces are great on defense.</Li>
        </ul>
      </div>
      <button className="btn btn-gold mt-4 w-full" onClick={onClose}>
        Got it
      </button>
    </Modal>
  );
}

export function AboutSheet({ record, onClose }: { record: LifetimeRecord; onClose: () => void }) {
  return (
    <Modal title="About" onClose={onClose}>
      <div className="flex flex-col items-center gap-2 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon-192.png" alt="Right Bower logo" width={96} height={96} className="rounded-[22px] shadow-lg" />
        <div className="font-display text-2xl font-extrabold gold-text">Right Bower</div>
        <p className="text-sm text-cream/80">
          Single-player Euchre. No accounts, no ads, no servers. Everything runs on your device and works offline.
        </p>
        <div className="mt-2 grid w-full grid-cols-2 gap-3">
          <div className="rounded-xl bg-black/30 p-3">
            <div className="text-2xl font-bold text-gold">{record.won}</div>
            <div className="text-xs text-cream/70">Games won</div>
          </div>
          <div className="rounded-xl bg-black/30 p-3">
            <div className="text-2xl font-bold text-gold">{record.lost}</div>
            <div className="text-xs text-cream/70">Games lost</div>
          </div>
        </div>
        <p className="mt-2 text-xs text-cream/50">Your game, settings, and record are saved in this browser.</p>
      </div>
    </Modal>
  );
}
