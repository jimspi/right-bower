import type { GameState } from "@/lib/euchre";

export type Speed = "slow" | "normal" | "fast";
export type CardSize = "small" | "medium" | "large";

export interface AppSettings {
  stickTheDealer: boolean;
  speed: Speed;
  sound: boolean;
  haptics: boolean;
  cardSize: CardSize;
  fourColor: boolean;
}

export interface LifetimeRecord {
  won: number;
  lost: number;
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  stickTheDealer: false,
  speed: "normal",
  sound: false,
  haptics: true,
  cardSize: "medium",
  fourColor: false,
};

const KEYS = { game: "rb:game:v1", settings: "rb:settings:v1", record: "rb:record:v1" };

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: ignore */
  }
}

function validGame(g: GameState | null): g is GameState {
  return (
    !!g &&
    Array.isArray(g.hands) &&
    g.hands.length === 4 &&
    Array.isArray(g.scores) &&
    typeof g.phase === "string" &&
    !!g.upcard
  );
}

export const loadGame = (): GameState | null => {
  const g = read<GameState>(KEYS.game);
  return validGame(g) ? g : null;
};
export const saveGame = (g: GameState) => write(KEYS.game, g);

export const loadSettings = (): AppSettings => ({
  ...DEFAULT_APP_SETTINGS,
  ...(read<Partial<AppSettings>>(KEYS.settings) ?? {}),
});
export const saveSettings = (s: AppSettings) => write(KEYS.settings, s);

export const loadRecord = (): LifetimeRecord => ({ won: 0, lost: 0, ...(read<LifetimeRecord>(KEYS.record) ?? {}) });
export const saveRecord = (r: LifetimeRecord) => write(KEYS.record, r);
