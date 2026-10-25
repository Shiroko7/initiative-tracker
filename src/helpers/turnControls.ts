import OBR from "@owlbear-rodeo/sdk";
import { getPluginId } from "./getPluginId";
import {
  ADVANCED_CONTROLS_METADATA_ID,
  DISPLAY_ROUND_METADATA_ID,
  readBooleanFromMetadata,
  readGroupsFromMetadata,
  readNumberFromMetadata,
  ROUND_COUNT_METADATA_ID,
  SELECT_ACTIVE_ITEM_METADATA_ID,
  SHARED_TURNS_METADATA_ID,
  updateRoundCount,
} from "./metadataHelpers";
import {
  findActiveSlotIndex,
  orderTurnSlots,
  parseInitiativeItems,
} from "./initiativeOrder";
import { broadcastRoundChangeEventMessage } from "./broadcastRoundImplementation";
import { labelItem } from "./findItem";
import isMetadata from "../zipperInitiative/isMetadata";

/**
 * Move the active turn forwards or backwards through the counting initiative,
 * across all groups, updating the round counter when the order wraps.
 * Tokens sharing a turn all become active together.
 * Reads state straight from the scene so it can be used outside the tracker.
 */
export async function advanceTurn(next = true) {
  const [sceneItems, sceneMetadata, roomMetadata] = await Promise.all([
    OBR.scene.items.getItems(),
    OBR.scene.getMetadata(),
    OBR.room.getMetadata(),
  ]);

  const slots = orderTurnSlots(
    parseInitiativeItems(sceneItems, false),
    readGroupsFromMetadata(sceneMetadata),
    readBooleanFromMetadata(roomMetadata, SHARED_TURNS_METADATA_ID, true),
  );
  if (slots.length === 0) return;

  const advancedControls = readBooleanFromMetadata(
    roomMetadata,
    ADVANCED_CONTROLS_METADATA_ID,
  );
  const displayRound = readBooleanFromMetadata(
    roomMetadata,
    DISPLAY_ROUND_METADATA_ID,
  );
  const selectActiveItem = readNumberFromMetadata(
    roomMetadata,
    SELECT_ACTIVE_ITEM_METADATA_ID,
  );
  const roundCount = readNumberFromMetadata(
    sceneMetadata,
    ROUND_COUNT_METADATA_ID,
    1,
  );

  const activeIndex = findActiveSlotIndex(slots);
  let newIndex: number;
  if (activeIndex === -1) {
    // Nobody has the turn yet: start at either end of the order
    newIndex = next ? 0 : slots.length - 1;
  } else {
    newIndex = activeIndex + (next ? 1 : -1);
  }

  if (activeIndex !== -1 && newIndex < 0) {
    newIndex = slots.length - 1;
    if (advancedControls && displayRound && roundCount > 1) {
      const newRoundCount = roundCount - 1;
      updateRoundCount(newRoundCount, () => {});
      broadcastRoundChangeEventMessage(newRoundCount);
    } else {
      broadcastRoundChangeEventMessage(null);
    }
  } else if (newIndex >= slots.length) {
    newIndex = 0;
    if (advancedControls && displayRound) {
      const newRoundCount = roundCount + 1;
      updateRoundCount(newRoundCount, () => {});
      broadcastRoundChangeEventMessage(newRoundCount);
    } else {
      broadcastRoundChangeEventMessage(null);
    }
  }

  const targetIds = slots[newIndex].map((item) => item.id);
  if (selectActiveItem === 1) OBR.player.select(targetIds);
  if (selectActiveItem === 2) labelItem(targetIds[0]);

  await OBR.scene.items.updateItems(
    slots.flat().map((item) => item.id),
    (items) => {
      for (const item of items) {
        const metadata = item.metadata[getPluginId("metadata")];
        if (isMetadata(metadata)) {
          metadata.active = targetIds.includes(item.id);
        }
      }
    },
  );
}
