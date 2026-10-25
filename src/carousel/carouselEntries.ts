import { InitiativeItem } from "../components/InitiativeItem";
import { TurnSlot } from "../helpers/initiativeOrder";
import { InitiativeGroup } from "../helpers/metadataHelpers";

export type Entry =
  | {
      kind: "slot";
      key: string;
      slot: TurnSlot;
      tokenCount: number;
      isPrevious: boolean;
    }
  | { kind: "group"; key: string; name: string }
  | { kind: "round"; key: string; label: string };

/**
 * Lay out the turns starting from whoever went last, then whoever has the
 * turn, wrapping around to the start of the order with a round marker.
 */
export function buildEntries({
  groupedSlots,
  canSee,
  rotate,
  collapsed,
  roundCount,
  showRound,
}: {
  groupedSlots: { group: InitiativeGroup; slot: TurnSlot }[];
  canSee: (item: InitiativeItem) => boolean;
  rotate: boolean;
  collapsed: boolean;
  roundCount: number;
  showRound: boolean;
}): Entry[] {
  const activeIndex = groupedSlots.findIndex(({ slot }) =>
    slot.some((item) => item.active),
  );

  // Start one turn back, at the last turn this player could see
  let previousIndex = -1;
  if (rotate && !collapsed && activeIndex !== -1) {
    for (let offset = 1; offset < groupedSlots.length; offset++) {
      const index =
        (activeIndex - offset + groupedSlots.length) % groupedSlots.length;
      if (groupedSlots[index].slot.some(canSee)) {
        previousIndex = index;
        break;
      }
    }
  }
  const start = previousIndex !== -1 ? previousIndex : Math.max(activeIndex, 0);
  const offset = rotate ? start : 0;
  const rotated = [
    ...groupedSlots.slice(offset),
    ...groupedSlots.slice(0, offset),
  ];

  // Turns after the marker are the current round if the active turn wrapped,
  // e.g. the previous turn was the last one of the last round
  const markerRound = activeIndex < offset ? roundCount : roundCount + 1;
  const roundLabel = showRound ? `Round ${markerRound}` : "New round";

  // Only show what this player can see, and only the current turn if collapsed
  const visible = rotated
    .map(({ group, slot }, index) => ({
      group,
      slot: slot.filter(canSee),
      isActive: slot.some((item) => item.active),
      isPrevious: index === 0 && previousIndex !== -1,
      wrapped: offset > 0 && index >= rotated.length - offset,
    }))
    .filter(({ slot, isActive }) => slot.length > 0 && (!collapsed || isActive));
  const showGroups =
    !collapsed && new Set(visible.map(({ group }) => group.id)).size > 1;

  const entries: Entry[] = [];
  let tokenCount = 0;
  let previousGroupId: number | undefined;
  let previousWrapped = false;
  for (const { group, slot, wrapped, isPrevious } of visible) {
    if (wrapped && !previousWrapped) {
      entries.push({ kind: "round", key: "round", label: roundLabel });
      previousGroupId = undefined;
    }
    if (showGroups && group.id !== previousGroupId)
      entries.push({
        kind: "group",
        key: `group-${group.id}-${wrapped}`,
        name: group.name,
      });
    tokenCount += slot.length;
    entries.push({
      kind: "slot",
      key: slot[0].id,
      slot,
      tokenCount,
      isPrevious,
    });
    previousGroupId = group.id;
    previousWrapped = wrapped;
  }
  return entries;
}
