import OBR from "@owlbear-rodeo/sdk";
import { useEffect, useState } from "react";
import { getPluginId } from "./getPluginId";

/*
  Display preferences belong to each player rather than the room. They are
  saved in this device's local storage and broadcast to the extension's other
  windows on this client (background, carousel, popovers) so they apply live.
*/

export type CarouselPosition = "TOP" | "BOTTOM" | "LEFT" | "RIGHT" | "FLOATING";
const CAROUSEL_POSITIONS: CarouselPosition[] = [
  "TOP",
  "BOTTOM",
  "LEFT",
  "RIGHT",
  "FLOATING",
];

// Allowed range of each numeric preference
export const PREFERENCE_LIMITS = {
  // Height of the current turn's card, in pixels
  carouselCardSize: { min: 40, max: 200 },
  // Size of the waiting cards, as a percentage of the current turn's card
  carouselWaitingSize: { min: 30, max: 100 },
  // Tokens shown before the rest have to be scrolled to
  carouselMaxTokens: { min: 1, max: 50 },
} as const;

export interface PlayerPreferences {
  carouselEnabled: boolean;
  carouselPosition: CarouselPosition;
  // Where a floating carousel's top left corner sits, as a share of the screen
  carouselFloatingX: number;
  carouselFloatingY: number;
  carouselFloatingVertical: boolean;
  carouselCardSize: number;
  carouselWaitingSize: number;
  carouselMaxTokens: number;
  carouselCollapsed: boolean;
  carouselShowNames: boolean;
  cameraFollow: boolean;
  currentTurnMarker: boolean;
  nextTurnMarker: boolean;
  markerLabels: boolean;
}

export const DEFAULT_PLAYER_PREFERENCES: PlayerPreferences = {
  carouselEnabled: true,
  carouselPosition: "TOP",
  carouselFloatingX: 0.3,
  carouselFloatingY: 0.15,
  carouselFloatingVertical: false,
  carouselCardSize: 88,
  carouselWaitingSize: 60,
  carouselMaxTokens: 10,
  carouselCollapsed: false,
  carouselShowNames: true,
  cameraFollow: true,
  currentTurnMarker: true,
  nextTurnMarker: true,
  markerLabels: true,
};

const STORAGE_KEY = getPluginId("playerPreferences");
const CHANNEL = getPluginId("playerPreferences");

let cached: PlayerPreferences | undefined;
// Listeners in this window, which may not receive its own broadcasts
const localListeners = new Set<(preferences: PlayerPreferences) => void>();

export function readPlayerPreferences(): PlayerPreferences {
  if (cached) return cached;
  let stored: Partial<PlayerPreferences> = {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) stored = JSON.parse(raw);
  } catch {
    // Storage unavailable or corrupt, fall back to defaults
  }
  cached = sanitize(stored);
  return cached;
}

export function writePlayerPreferences(changes: Partial<PlayerPreferences>) {
  const preferences = sanitize({ ...readPlayerPreferences(), ...changes });
  cached = preferences;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // Preferences still apply for this session through the broadcast
  }
  localListeners.forEach((listener) => listener(preferences));
  OBR.broadcast.sendMessage(CHANNEL, preferences, { destination: "LOCAL" });
}

/** Subscribe to preference changes made in any of this client's windows. */
export function onPlayerPreferencesChange(
  callback: (preferences: PlayerPreferences) => void,
) {
  localListeners.add(callback);
  const unsubscribe = OBR.broadcast.onMessage(CHANNEL, (event) => {
    cached = sanitize(event.data as Partial<PlayerPreferences>);
    callback(cached);
  });
  return () => {
    localListeners.delete(callback);
    unsubscribe();
  };
}

export function usePlayerPreferences() {
  const [preferences, setPreferences] = useState(readPlayerPreferences);
  useEffect(() => onPlayerPreferencesChange(setPreferences), []);
  return preferences;
}

function sanitize(value: Partial<PlayerPreferences>): PlayerPreferences {
  const preferences = { ...DEFAULT_PLAYER_PREFERENCES };
  if (typeof value !== "object" || value === null) return preferences;
  for (const key of Object.keys(preferences) as (keyof PlayerPreferences)[]) {
    if (typeof value[key] === typeof preferences[key])
      (preferences as Record<string, unknown>)[key] = value[key];
  }
  if (!CAROUSEL_POSITIONS.includes(preferences.carouselPosition))
    preferences.carouselPosition = DEFAULT_PLAYER_PREFERENCES.carouselPosition;
  for (const name of ["carouselFloatingX", "carouselFloatingY"] as const) {
    preferences[name] = Number.isFinite(preferences[name])
      ? Math.min(1, Math.max(0, preferences[name]))
      : DEFAULT_PLAYER_PREFERENCES[name];
  }
  for (const [key, { min, max }] of Object.entries(PREFERENCE_LIMITS)) {
    const name = key as keyof typeof PREFERENCE_LIMITS;
    preferences[name] = Number.isFinite(preferences[name])
      ? Math.round(Math.min(max, Math.max(min, preferences[name])))
      : DEFAULT_PLAYER_PREFERENCES[name];
  }
  return preferences;
}

/** Side positions show a scrolling list, the others a bar. */
export function isCarouselVertical(preferences: PlayerPreferences) {
  const position = preferences.carouselPosition;
  return (
    position === "LEFT" ||
    position === "RIGHT" ||
    (position === "FLOATING" && preferences.carouselFloatingVertical)
  );
}

const PREFERENCES_POPOVER_ID = getPluginId("preferences");

export async function openPlayerPreferences() {
  const [width, height] = await Promise.all([
    OBR.viewport.getWidth(),
    OBR.viewport.getHeight(),
  ]);
  OBR.popover.open({
    id: PREFERENCES_POPOVER_ID,
    url: "/src/preferences/preferences.html",
    width: 360,
    height: Math.min(620, height - 32),
    anchorReference: "POSITION",
    anchorPosition: { left: width / 2, top: height / 2 },
    anchorOrigin: { horizontal: "CENTER", vertical: "CENTER" },
    transformOrigin: { horizontal: "CENTER", vertical: "CENTER" },
  });
}
