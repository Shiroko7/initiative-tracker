import OBR, { Item } from "@owlbear-rodeo/sdk";
import { getPluginId } from "./getPluginId";
import isMetadata from "../zipperInitiative/isMetadata";

const METADATA_KEY = getPluginId("metadata");

function readMetadata(item: Item) {
  const metadata = item.metadata[METADATA_KEY];
  return isMetadata(metadata) ? metadata : undefined;
}

const isInInitiative = (item: Item) => readMetadata(item) !== undefined;

/**
 * Link tokens so they all act on one initiative turn, e.g. a pack of minions
 * that only rolled once. The turn belongs to a selected token that already
 * has its own initiative, preferring one with a roll, and the others are
 * added to initiative if needed.
 */
export async function linkTurn(itemIds: string[]) {
  const selected = new Set(itemIds);
  await OBR.scene.items.updateItems(
    (item) => selected.has(item.id) || isInInitiative(item),
    (items) => {
      const picked = items.filter((item) => selected.has(item.id));
      if (picked.length < 2) return;

      const candidates = picked.filter(
        (item) => readMetadata(item)?.linkedTo === undefined,
      );
      const leader =
        candidates.find((item) => {
          const metadata = readMetadata(item);
          return metadata && !Number.isNaN(parseFloat(metadata.count));
        }) ??
        candidates[0] ??
        picked[0];

      let leaderMetadata = readMetadata(leader);
      if (!leaderMetadata) {
        leaderMetadata = {
          count: "0",
          active: false,
          ready: undefined,
          group: 0,
          groupIndex: undefined,
        };
        leader.metadata[METADATA_KEY] = leaderMetadata;
      }
      delete leaderMetadata.linkedTo;

      // Tokens linked to a token that's now joining this turn come along too
      const followerIds = new Set(
        picked.filter((item) => item !== leader).map((item) => item.id),
      );
      for (const item of items) {
        const linkedTo = readMetadata(item)?.linkedTo;
        if (
          !followerIds.has(item.id) &&
          !(linkedTo !== undefined && followerIds.has(linkedTo))
        )
          continue;
        // Copy the turn so the token keeps its place if it's ever unlinked
        item.metadata[METADATA_KEY] = {
          count: leaderMetadata.count,
          active: leaderMetadata.active,
          group: leaderMetadata.group,
          groupIndex: leaderMetadata.groupIndex,
          linkedTo: leader.id,
        };
      }
    },
  );
}

/** Give linked tokens their own turn, right after the turn they shared. */
export async function unlinkTurn(itemIds: string[]) {
  const selected = new Set(itemIds);
  await OBR.scene.items.updateItems(isInInitiative, (items) => {
    const byId = new Map(items.map((item) => [item.id, item]));
    for (const item of items) {
      const metadata = readMetadata(item);
      if (!selected.has(item.id) || metadata?.linkedTo === undefined) continue;
      const leader = byId.get(metadata.linkedTo);
      const leaderMetadata = leader && readMetadata(leader);
      delete metadata.linkedTo;
      metadata.active = false;
      if (!leaderMetadata) continue;
      metadata.count = leaderMetadata.count;
      metadata.group = leaderMetadata.group;
      metadata.groupIndex =
        leaderMetadata.groupIndex !== undefined &&
        leaderMetadata.groupIndex >= 0
          ? leaderMetadata.groupIndex + 0.5
          : -1;
    }
  });
}

/**
 * Take tokens out of initiative. When a token with linked tokens is removed,
 * the first of them takes over its turn so the rest keep acting together.
 */
export async function removeFromInitiative(itemIds: string[]) {
  const removed = new Set(itemIds);
  await OBR.scene.items.updateItems(isInInitiative, (items) => {
    const byId = new Map(items.map((item) => [item.id, item]));
    const successors = new Map<string, string>();
    for (const item of items) {
      const metadata = readMetadata(item);
      if (removed.has(item.id) || metadata?.linkedTo === undefined) continue;
      if (!removed.has(metadata.linkedTo)) continue;

      const successor = successors.get(metadata.linkedTo);
      if (successor !== undefined) {
        metadata.linkedTo = successor;
        continue;
      }
      const leader = byId.get(metadata.linkedTo);
      const leaderMetadata = leader && readMetadata(leader);
      successors.set(metadata.linkedTo, item.id);
      delete metadata.linkedTo;
      if (!leaderMetadata) continue;
      metadata.count = leaderMetadata.count;
      metadata.active = leaderMetadata.active;
      metadata.group = leaderMetadata.group;
      metadata.groupIndex = leaderMetadata.groupIndex;
    }
    for (const item of items)
      if (removed.has(item.id)) delete item.metadata[METADATA_KEY];
  });
}
