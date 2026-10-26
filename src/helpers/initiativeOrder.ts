import { isImage, Item } from "@owlbear-rodeo/sdk";
import { InitiativeItem } from "../components/InitiativeItem";
import { InitiativeGroup } from "./metadataHelpers";
import { getPluginId } from "./getPluginId";
import isMetadata from "../zipperInitiative/isMetadata";

/** Build initiative items from scene items. Zipper initiative defaults tokens to group 1. */
export function parseInitiativeItems(
  items: Item[],
  zipperInitiative: boolean,
): InitiativeItem[] {
  const initiativeItems: InitiativeItem[] = [];
  for (const item of items) {
    if (!isImage(item)) continue;
    const metadata = item.metadata[getPluginId("metadata")];
    if (!isMetadata(metadata)) continue;
    initiativeItems.push({
      id: item.id,
      name: item.text.plainText || item.name,
      url: item.image.url,
      visible: item.visible,
      active: metadata.active,
      count: metadata.count,
      ready: metadata.ready !== undefined ? metadata.ready : true,
      group:
        metadata.group !== undefined ? metadata.group : zipperInitiative ? 1 : 0,
      groupIndex: metadata.groupIndex !== undefined ? metadata.groupIndex : -1,
      // Checkbox initiative has no turns to share
      linkedTo: zipperInitiative ? undefined : metadata.linkedTo,
    });
  }
  return initiativeItems;
}

export interface InitiativeSegment {
  group: InitiativeGroup;
  items: InitiativeItem[];
}

/**
 * Split items into their groups in turn order.
 * Items whose group ID isn't in the groups list fall into the first group,
 * matching how the trackers display them.
 */
export function segmentInitiativeItems(
  items: InitiativeItem[],
  groups: InitiativeGroup[],
): InitiativeSegment[] {
  const knownGroupIds = new Set(groups.map((g) => g.id));
  const position = (item: InitiativeItem) =>
    item.groupIndex < 0 ? Number.MAX_SAFE_INTEGER : item.groupIndex;
  return groups.map((group, index) => ({
    group,
    items: items
      .filter(
        (item) =>
          item.group === group.id ||
          (index === 0 && !knownGroupIds.has(item.group)),
      )
      .sort((a, b) => position(a) - position(b)),
  }));
}

/** Tokens that act at the same time, because they share an initiative roll. */
export type TurnSlot = InitiativeItem[];

function sharesInitiative(a: InitiativeItem, b: InitiativeItem) {
  const countA = parseFloat(a.count);
  const countB = parseFloat(b.count);
  return !Number.isNaN(countA) && countA === countB;
}

/**
 * Split one group's ordered items into turns. With shared turns enabled,
 * neighbouring tokens with the same initiative take one turn together.
 */
export function buildTurnSlots(
  items: InitiativeItem[],
  sharedTurns: boolean,
): TurnSlot[] {
  const slots: TurnSlot[] = [];
  for (const item of items) {
    const previous = slots[slots.length - 1]?.[0];
    if (sharedTurns && previous && sharesInitiative(previous, item))
      slots[slots.length - 1].push(item);
    else slots.push([item]);
  }
  return slots;
}

/**
 * Separate tokens linked to another token's turn from the tokens that have a
 * turn of their own. A link only counts while the token it points to is in
 * initiative and has a turn of its own, otherwise the token acts by itself.
 */
export function splitLinkedItems(items: InitiativeItem[]) {
  const byId = new Map(items.map((item) => [item.id, item]));
  const leaderOf = (item: InitiativeItem) => {
    if (item.linkedTo === undefined || item.linkedTo === item.id) return;
    const leader = byId.get(item.linkedTo);
    if (!leader) return;
    if (leader.linkedTo !== undefined && byId.has(leader.linkedTo)) return;
    return leader;
  };

  const leaders: InitiativeItem[] = [];
  const linked = new Map<string, InitiativeItem[]>();
  for (const item of items) {
    const leader = leaderOf(item);
    if (!leader) leaders.push(item);
    else linked.set(leader.id, [...(linked.get(leader.id) ?? []), item]);
  }
  return { leaders, linked };
}

/** Turn slots across all groups, in turn order, with the group of each. */
export function orderGroupedTurnSlots(
  items: InitiativeItem[],
  groups: InitiativeGroup[],
  sharedTurns: boolean,
): { group: InitiativeGroup; slot: TurnSlot }[] {
  const { leaders, linked } = splitLinkedItems(items);
  return segmentInitiativeItems(leaders, groups).flatMap((segment) =>
    buildTurnSlots(segment.items, sharedTurns).map((slot) => ({
      group: segment.group,
      // Linked tokens act on the turn of the token they're linked to
      slot: slot.flatMap((item) => [item, ...(linked.get(item.id) ?? [])]),
    })),
  );
}

/** Turn slots across all groups, in turn order. */
export function orderTurnSlots(
  items: InitiativeItem[],
  groups: InitiativeGroup[],
  sharedTurns: boolean,
): TurnSlot[] {
  return orderGroupedTurnSlots(items, groups, sharedTurns).map(
    ({ slot }) => slot,
  );
}

export function findActiveSlotIndex(slots: TurnSlot[]) {
  return slots.findIndex((slot) => slot.some((item) => item.active));
}

/**
 * Find the turn that goes after the active one, wrapping around.
 * Items rejected by the filter are left out (e.g. hidden tokens for players),
 * and turns left empty by it are skipped.
 */
export function findNextSlot(
  slots: TurnSlot[],
  filter: (item: InitiativeItem) => boolean = () => true,
): TurnSlot | undefined {
  const activeIndex = findActiveSlotIndex(slots);
  if (activeIndex === -1) return undefined;
  for (let offset = 1; offset < slots.length; offset++) {
    const candidate = slots[(activeIndex + offset) % slots.length].filter(
      filter,
    );
    if (candidate.length > 0) return candidate;
  }
  return undefined;
}
