import OBR, { Item, Metadata } from "@owlbear-rodeo/sdk";
import { getPluginId } from "./getPluginId";
import { removeLabel } from "./findItem";
import { isPlainObject } from "./isPlainObject";
import {
  CLEARED_INITIATIVE_METADATA_ID,
  PREVIOUS_STACK_METADATA_ID,
  readStringArrayFromMetadata,
} from "./metadataHelpers";
import isMetadata from "../zipperInitiative/isMetadata";

const METADATA_KEY = getPluginId("metadata");
const CLEARED_KEY = getPluginId(CLEARED_INITIATIVE_METADATA_ID);
const PREVIOUS_STACK_KEY = getPluginId(PREVIOUS_STACK_METADATA_ID);

// How long a cleared initiative can be brought back
const UNDO_DURATION = 2 * 60 * 60 * 1000;

export type ClearMode = "ZERO" | "REMOVE";

/** What the initiative looked like before it was cleared. */
export interface ClearedInitiative {
  mode: ClearMode;
  clearedAt: number;
  // Each token's initiative metadata, by token ID
  items: Record<string, unknown>;
  previousStack: string[];
}

const isInInitiative = (item: Item) => isMetadata(item.metadata[METADATA_KEY]);

export function readClearedInitiative(
  sceneMetadata: Metadata,
): ClearedInitiative | undefined {
  const value = sceneMetadata[CLEARED_KEY];
  if (
    !isPlainObject(value) ||
    (value.mode !== "ZERO" && value.mode !== "REMOVE") ||
    typeof value.clearedAt !== "number" ||
    !isPlainObject(value.items) ||
    !Array.isArray(value.previousStack)
  )
    return undefined;
  return value as unknown as ClearedInitiative;
}

/** Milliseconds left to undo, zero or less once it's too late. */
export function undoTimeLeft(cleared: ClearedInitiative) {
  return cleared.clearedAt + UNDO_DURATION - Date.now();
}

/**
 * Set every token's initiative to 0, or take every token out of initiative.
 * Groups, order and shared turns stay when setting to 0. Replaces anything
 * that could still be undone.
 */
export async function clearInitiative(mode: ClearMode) {
  const [items, sceneMetadata] = await Promise.all([
    OBR.scene.items.getItems(isInInitiative),
    OBR.scene.getMetadata(),
  ]);
  if (items.length === 0) return;

  const cleared: ClearedInitiative = {
    mode,
    clearedAt: Date.now(),
    items: Object.fromEntries(
      items.map((item) => [item.id, item.metadata[METADATA_KEY]]),
    ),
    previousStack: readStringArrayFromMetadata(
      sceneMetadata,
      PREVIOUS_STACK_METADATA_ID,
    ),
  };
  // Saved first so the initiative is never lost if this can't be written
  await OBR.scene.setMetadata({
    [CLEARED_KEY]: cleared,
    [PREVIOUS_STACK_KEY]: [],
  });

  await OBR.scene.items.updateItems(
    items.map((item) => item.id),
    (items) => {
      for (const item of items) {
        const metadata = item.metadata[METADATA_KEY];
        if (mode === "REMOVE") {
          delete item.metadata[METADATA_KEY];
        } else if (isMetadata(metadata)) {
          metadata.count = "0";
          metadata.active = false;
        }
      }
    },
  );
  removeLabel();
}

/**
 * Put back the initiative from before it was cleared. Tokens deleted since then
 * stay gone, and tokens added since then stay in initiative.
 */
export async function undoClearInitiative() {
  const cleared = readClearedInitiative(await OBR.scene.getMetadata());
  if (!cleared || undoTimeLeft(cleared) <= 0) return;

  const savedHasTurn = Object.values(cleared.items).some(
    (metadata) => isMetadata(metadata) && metadata.active,
  );
  await OBR.scene.items.updateItems(
    (item) => item.id in cleared.items || isInInitiative(item),
    (items) => {
      for (const item of items) {
        const metadata = item.metadata[METADATA_KEY];
        if (item.id in cleared.items) {
          item.metadata[METADATA_KEY] = cleared.items[item.id];
        } else if (savedHasTurn && isMetadata(metadata)) {
          // The turn goes back to whoever had it
          metadata.active = false;
        }
      }
    },
  );
  await OBR.scene.setMetadata({
    [CLEARED_KEY]: undefined,
    [PREVIOUS_STACK_KEY]: cleared.previousStack,
  });
}

/** Give up on undoing, so the saved initiative doesn't stay in the scene. */
export async function forgetClearedInitiative() {
  await OBR.scene.setMetadata({ [CLEARED_KEY]: undefined });
}
