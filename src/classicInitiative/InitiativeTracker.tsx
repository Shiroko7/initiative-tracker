import { useEffect, useState } from "react";

import Stack from "@mui/material/Stack";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import Box from "@mui/material/Box";

import SkipPreviousRoundedIcon from "@mui/icons-material/SkipPreviousRounded";
import SkipNextRounded from "@mui/icons-material/SkipNextRounded";

import OBR, { isImage, Item, Metadata } from "@owlbear-rodeo/sdk";

import { InitiativeItem } from "../components/InitiativeItem";

import { InitiativeListItem } from "./InitiativeListItem";
import { getPluginId } from "../helpers/getPluginId";
import { InitiativeHeader } from "../components/InitiativeHeader";
import { isPlainObject } from "../helpers/isPlainObject";
import { sortFromOrder, sortList, useOrder } from "./sceneOrder";
import { Icon, useTheme } from "@mui/material";
import {
  ADVANCED_CONTROLS_METADATA_ID,
  DISABLE_NOTIFICATION_METADATA_ID,
  DISPLAY_ROUND_METADATA_ID,
  readBooleanFromMetadata,
  readNumberFromMetadata,
  ROUND_COUNT_METADATA_ID,
  SELECT_ACTIVE_ITEM_METADATA_ID,
  SORT_ASCENDING_METADATA_ID,
  updateRoundCount,
} from "../helpers/metadataHelpers";
import SortAscendingIcon from "../assets/SortAscendingIcon";
import SortDescendingIcon from "../assets/SortDescendingIcon";
import SettingsButton from "../settings/SettingsButton";
import { labelItem, selectItem } from "../helpers/findItem";
import useSelection from "../helpers/useSelection";
import HeightMonitor from "../components/HeightMonitor";
import { RoundControl } from "../components/RoundControl";
import { broadcastRoundChangeEventMessage } from "../helpers/broadcastRoundImplementation";

/** Check that the item metadata is in the correct format */
function isMetadata(
  metadata: unknown,
): metadata is { count: string; active: boolean } {
  return (
    isPlainObject(metadata) &&
    typeof metadata.count === "string" &&
    typeof metadata.active === "boolean"
  );
}

export function InitiativeTracker({ role }: { role: "PLAYER" | "GM" }) {
  // General settings
  const [selectActiveItem, setSelectActiveItem] = useState(0);

  // Classic initiative settings
  const [sortAscending, setSortAscending] = useState(false);
  const [advancedControls, setAdvancedControls] = useState(false);
  const [displayRound, setDisplayRound] = useState(false);
  const [disableNotifications, setDisableNotifications] = useState(false);

  // Initiative
  const [initiativeItems, setInitiativeItems] = useState<InitiativeItem[]>([]);
  const [roundCount, setRoundCount] = useState(1);

  const selection = useSelection();

  useEffect(() => {
    const handleSceneMetadataChange = (sceneMetadata: Metadata) => {
      setRoundCount(
        readNumberFromMetadata(
          sceneMetadata,
          ROUND_COUNT_METADATA_ID,
          roundCount,
        ),
      );
    };
    OBR.scene.getMetadata().then(handleSceneMetadataChange);
    return OBR.scene.onMetadataChange(handleSceneMetadataChange);
  }, []);

  useEffect(() => {
    const handleRoomMetadataChange = (roomMetadata: Metadata) => {
      setSortAscending(
        readBooleanFromMetadata(
          roomMetadata,
          SORT_ASCENDING_METADATA_ID,
          sortAscending,
        ),
      );
      setAdvancedControls(
        readBooleanFromMetadata(
          roomMetadata,
          ADVANCED_CONTROLS_METADATA_ID,
          advancedControls,
        ),
      );
      setDisplayRound(
        readBooleanFromMetadata(
          roomMetadata,
          DISPLAY_ROUND_METADATA_ID,
          displayRound,
        ),
      );
      setDisableNotifications(
        readBooleanFromMetadata(
          roomMetadata,
          DISABLE_NOTIFICATION_METADATA_ID,
          disableNotifications,
        ),
      );
      setSelectActiveItem(
        readNumberFromMetadata(
          roomMetadata,
          SELECT_ACTIVE_ITEM_METADATA_ID,
          selectActiveItem,
        ),
      );
    };
    OBR.room.getMetadata().then(handleRoomMetadataChange);
    return OBR.room.onMetadataChange(handleRoomMetadataChange);
  }, []);

  useEffect(() => {
    const handleItemsChange = async (items: Item[]) => {
      const initiativeItems: InitiativeItem[] = [];
      for (const item of items) {
        if (isImage(item)) {
          const metadata = item.metadata[getPluginId("metadata")];
          if (isMetadata(metadata)) {
            initiativeItems.push({
              id: item.id,
              count: metadata.count,
              url: item.image.url,
              name: item.text.plainText || item.name,
              active: metadata.active,
              visible: item.visible,
              // Unused properties
              ready: true,
              group: 0,
              groupIndex: 0,
            });
          }
        }
      }
      setInitiativeItems(initiativeItems);
    };

    OBR.scene.items.getItems().then(handleItemsChange);
    return OBR.scene.items.onChange(handleItemsChange);
  }, []);

  function handleSortClick() {
    // Sort items and write order to the scene
    const sorted = sortList(initiativeItems, sortAscending);

    // Increment round if the last item is selected and the last item is not the first item
    if (initiativeItems.length > 1) {
      const index = sorted.findIndex((initiative) => initiative.active);
      const lastItem = index >= sorted.length - 1;
      if (lastItem) {
        const newRoundCount = roundCount + 1;
        updateRoundCount(newRoundCount, setRoundCount);
        broadcastRoundChangeEventMessage(newRoundCount);
      }
    }

    // Focus first item
    const nextIndex = 0;

    // Set local items immediately
    setInitiativeItems(
      sorted.map((item, index) => {
        const active = index === 0;
        if (selectActiveItem === 1 && active) selectItem(item.id);
        if (selectActiveItem === 2 && active) labelItem(item.id);
        return {
          ...item,
          active,
        };
      }),
    );

    // Update the scene items with the new active status
    OBR.scene.items.updateItems(
      sorted.map((init) => init.id),
      (items) => {
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          const metadata = item.metadata[getPluginId("metadata")];
          if (isMetadata(metadata)) {
            metadata.active = i === nextIndex;
          }
        }
      },
    );
  }

  function handleDirectionClick(next = true) {
    // Get the next index to activate
    const sorted = sortFromOrder(initiativeItems, order);
    let newIndex =
      sorted.findIndex((initiative) => initiative.active) + (next ? 1 : -1);

    if (newIndex < 0) {
      newIndex = sorted.length + newIndex;
      if (roundCount > 1) {
        if (advancedControls && displayRound) {
          const newRoundCount = roundCount - 1;
          updateRoundCount(newRoundCount, setRoundCount);
          broadcastRoundChangeEventMessage(newRoundCount);
        } else {
          broadcastRoundChangeEventMessage(null);
        }
      }
    } else if (newIndex >= sorted.length) {
      newIndex = newIndex % sorted.length;
      if (advancedControls && displayRound) {
        const newRoundCount = roundCount + 1;
        updateRoundCount(newRoundCount, setRoundCount);
        broadcastRoundChangeEventMessage(newRoundCount);
      } else {
        broadcastRoundChangeEventMessage(null);
      }
    }

    // Set local items immediately
    setInitiativeItems(
      sorted.map((item, index) => {
        const active = index === newIndex;
        if (selectActiveItem === 1 && active) selectItem(item.id);
        if (selectActiveItem === 2 && active) labelItem(item.id);
        return {
          ...item,
          active,
        };
      }),
    );

    // Update the scene items with the new active status
    OBR.scene.items.updateItems(
      sorted.map((init) => init.id),
      (items) => {
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          const metadata = item.metadata[getPluginId("metadata")];
          if (isMetadata(metadata)) {
            metadata.active = i === newIndex;
          }
        }
      },
    );
  }

  function handleInitiativeCountChange(id: string, newCount: string) {
    // Set local items immediately
    setInitiativeItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          return {
            ...item,
            count: newCount,
          };
        } else {
          return item;
        }
      }),
    );
    // Sync changes over the network
    OBR.scene.items.updateItems([id], (items) => {
      for (const item of items) {
        const metadata = item.metadata[getPluginId("metadata")];
        if (isMetadata(metadata)) {
          metadata.count = newCount;
        }
      }
    });
  }

  const order = useOrder();
  const sortedInitiativeItems = sortFromOrder(initiativeItems, order);

  const themeIsDark = useTheme().palette.mode === "dark";

  return (
    <Stack height="100vh">
      <InitiativeHeader
        subtitle={
          initiativeItems.length === 0
            ? "Select a character to start initiative"
            : undefined
        }
        action={
          <>
            {role === "GM" && <SettingsButton></SettingsButton>}
            <IconButton onClick={handleSortClick}>
              <Icon>
                {sortAscending ? (
                  <SortAscendingIcon darkMode={themeIsDark}></SortAscendingIcon>
                ) : (
                  <SortDescendingIcon
                    darkMode={themeIsDark}
                  ></SortDescendingIcon>
                )}
              </Icon>
            </IconButton>
            {!advancedControls && (
              <IconButton
                aria-label="next"
                onClick={() => handleDirectionClick()}
                disabled={initiativeItems.length === 0}
              >
                <SkipNextRounded />
              </IconButton>
            )}
          </>
        }
      />

      <Box sx={{ overflowY: "auto" }}>
        <HeightMonitor
          onChange={(height) =>
            OBR.action.setHeight(height + 64 + 2 + (advancedControls ? 56 : 0))
          }
        >
          <List>
            {sortedInitiativeItems.map((item) => (
              <InitiativeListItem
                key={item.id}
                item={item}
                darkMode={themeIsDark}
                onCountChange={(newCount) => {
                  handleInitiativeCountChange(item.id, newCount);
                }}
                showHidden={role === "GM"}
                selected={selection.includes(item.id)}
              />
            ))}
          </List>
        </HeightMonitor>
      </Box>

      {advancedControls && (
        <Box
          sx={{
            p: 1,
            display: "flex",
            justifyContent: "space-evenly",
            gap: 1,
          }}
        >
          <Box
            sx={{
              outline: 1,
              outlineStyle: "solid",
              outlineColor: themeIsDark
                ? "rgba(255,255,255,0.1)"
                : "rgba(0, 0, 0, 0.12)",
              // background: "rgba(0,0,0,0.15)",
              m: 0,
              borderRadius: 9999,
              display: "inline-flex",
            }}
          >
            <IconButton
              aria-label="previous"
              onClick={() => handleDirectionClick(false)}
              disabled={initiativeItems.length === 0}
            >
              <SkipPreviousRoundedIcon />
            </IconButton>
            {displayRound && (
              <RoundControl
                playerRole={role}
                roundCount={roundCount}
                setRoundCount={setRoundCount}
                disableNotifications={disableNotifications}
              />
            )}
            <IconButton
              aria-label="next"
              onClick={() => handleDirectionClick()}
              disabled={initiativeItems.length === 0}
            >
              <SkipNextRounded />
            </IconButton>
          </Box>
        </Box>
      )}
    </Stack>
  );
}
