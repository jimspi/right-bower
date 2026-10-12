"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { chooseAction, newGame, reduce, type Action, type GameState } from "@/lib/euchre";
import { cue } from "@/lib/feedback";
import {
  DEFAULT_APP_SETTINGS,
  loadGame,
  loadRecord,
  loadSettings,
  saveGame,
  saveRecord,
  saveSettings,
  type AppSettings,
  type LifetimeRecord,
} from "@/lib/store";

const SPEED_MULT = { slow: 1.7, normal: 1, fast: 0.3 } as const;

export function useGame(paused: boolean) {
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<GameState | null>(null);
  const [settings, setSettingsState] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const [record, setRecord] = useState<LifetimeRecord>({ won: 0, lost: 0 });
  const stateRef = useRef<GameState | null>(null);
  const settingsRef = useRef(settings);
  const recordRef = useRef(record);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  // Load persisted data after mount (avoids hydration mismatch).
  useEffect(() => {
    const st = loadSettings();
    const rec = loadRecord();
    let g = loadGame();
    if (g) g = { ...g, settings: { stickTheDealer: st.stickTheDealer } };
    else g = newGame({ stickTheDealer: st.stickTheDealer });
    stateRef.current = g;
    recordRef.current = rec;
    settingsRef.current = st;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSettingsState(st);
    setRecord(rec);
    setState(g);
    setReady(true);
  }, []);

  const apply = useCallback((a: Action) => {
    const prev = stateRef.current;
    if (!prev) return;
    const next = reduce(prev, a);
    if (next === prev) return;
    stateRef.current = next;
    setState(next);
    saveGame(next);
    const fb = { sound: settingsRef.current.sound, haptics: settingsRef.current.haptics };
    if (a.type === "play") cue("card", fb);
    else if (a.type === "pass" || a.type === "orderUp" || a.type === "call") cue("bid", fb);
    else if (a.type === "collectTrick" && prev.lastTrickWinner !== null) {
      if (prev.lastTrickWinner % 2 === 0) cue("trick", fb);
    }
    if (prev.phase !== "gameOver" && next.phase === "gameOver") {
      const won = next.winner === 0;
      const rec = {
        won: recordRef.current.won + (won ? 1 : 0),
        lost: recordRef.current.lost + (won ? 0 : 1),
      };
      recordRef.current = rec;
      setRecord(rec);
      saveRecord(rec);
      cue(won ? "win" : "lose", fb);
    } else if (next.result?.euchred && prev.result !== next.result) {
      cue("euchre", fb);
    }
  }, []);

  const startNewGame = useCallback(() => {
    const g = newGame({ stickTheDealer: settingsRef.current.stickTheDealer });
    stateRef.current = g;
    setState(g);
    saveGame(g);
  }, []);

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    const next = { ...settingsRef.current, ...patch };
    settingsRef.current = next;
    setSettingsState(next);
    saveSettings(next);
    if ("stickTheDealer" in patch && stateRef.current) {
      const g = { ...stateRef.current, settings: { stickTheDealer: next.stickTheDealer } };
      stateRef.current = g;
      setState(g);
      saveGame(g);
    }
  }, []);

  // Drive the computer players and automatic trick collection.
  useEffect(() => {
    if (!ready || !state || paused) return;
    const mult = SPEED_MULT[settings.speed];
    let delay: number | null = null;
    let action: Action | null = null;
    switch (state.phase) {
      case "trickEnd":
        delay = 1050 * mult;
        action = { type: "collectTrick" };
        break;
      case "bid1":
      case "bid2":
      case "dealerDiscard":
      case "play":
        if (state.turn !== 0) delay = (400 + Math.random() * 500) * mult;
        break;
    }
    if (delay === null) return;
    const snapshot = state;
    const id = window.setTimeout(() => {
      if (stateRef.current !== snapshot) return;
      apply(action ?? chooseAction(snapshot));
    }, delay);
    return () => window.clearTimeout(id);
  }, [ready, state, paused, settings.speed, apply]);

  return { ready, state, settings, record, apply, startNewGame, updateSettings };
}
