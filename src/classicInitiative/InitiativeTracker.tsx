import { useEffect, useState } from "react";

import Stack from "@mui/material/Stack";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import Box from "@mui/material/Box";

import SkipPreviousRoundedIcon from "@mui/icons-material/SkipPreviousRounded";
import SkipNextRounded from "@mui/icons-material/SkipNextRounded";
import ModeEditRoundedIcon from "@mui/icons-material/ModeEditRounded";
import EditOffRoundedIcon from "@mui/icons-material/EditOffRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import UndoRoundedIcon from "@mui/icons-material/UndoRounded";

import OBR, { isImage, Item, Metadata } from "@owlbear-rodeo/sdk";

import { InitiativeItem } from "../components/InitiativeItem";

import { InitiativeListItem } from "./InitiativeListItem";
import { getPluginId } from "../helpers/getPluginId";
import { InitiativeHeader } from "../components/InitiativeHeader";
import { Icon, Typography, useTheme } from "@mui/material";
import {
  ADVANCED_CONTROLS_METADATA_ID,
  DEFAULT_INITIATIVE_GROUPS,
  DISABLE_NOTIFICATION_METADATA_ID,
  DISPLAY_ROUND_METADATA_ID,
  GROUPS_METADATA_ID,
  InitiativeGroup,
  readBooleanFromMetadata,
  readGroupsFromMetadata,
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
import { EditableGroupHeading } from "../components/EditableGroupHeading";
import writeGroupDataToItems from "../zipperInitiative/writeGroupDataToItems";
import isMetadata from "../zipperInitiative/isMetadata";

import {
  closestCenter,
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, useSortable } from "@dnd-kit/sortable";
import { restrictToFirstScrollableAncestor } from "@dnd-kit/modifiers";
import { CSS } from "@dnd-kit/utilities";

const DIVIDER_PREFIX = "GROUP_DIVIDER_";
const getGroupDividerId = (groupId: number) => `${DIVIDER_PREFIX}${groupId}`;
const isDivider = (id: string) =>
  typeof id === "string" && id.startsWith(DIVIDER_PREFIX);
const getDividerGroupId = (id: string) =>
  parseInt(id.slice(DIVIDER_PREFIX.length));

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
  const [groups, setGroups] = useState<InitiativeGroup[]>(
    DEFAULT_INITIATIVE_GROUPS,
  );
  const [editMode, setEditMode] = useState(false);
  const [mergeHistory, setMergeHistory] = useState<
    Array<{
      groups: InitiativeGroup[];
      items: Array<{ id: string; group: number; groupIndex: number }>;
    }>
  >([]);

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
      setGroups(readGroupsFromMetadata(sceneMetadata));
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
      const newItems: InitiativeItem[] = [];
      for (const item of items) {
        if (isImage(item)) {
          const metadata = item.metadata[getPluginId("metadata")];
          if (isMetadata(metadata)) {
            newItems.push({
              id: item.id,
              count: metadata.count,
              url: item.image.url,
              name: item.text.plainText || item.name,
              active: metadata.active,
              visible: item.visible,
              ready: true,
              group: metadata.group !== undefined ? metadata.group : 0,
              groupIndex:
                metadata.groupIndex !== undefined ? metadata.groupIndex : -1,
            });
          }
        }
      }
      guaranteeMinimumGroupIndices(newItems);
      setInitiativeItems(newItems);
    };

    OBR.scene.items.getItems().then(handleItemsChange);
    return OBR.scene.items.onChange(handleItemsChange);
  }, []);

  function guaranteeMinimumGroupIndices(items: InitiativeItem[]) {
    items.sort(
      (a, b) =>
        (a.groupIndex === -1 ? items.length : a.groupIndex) -
        (b.groupIndex === -1 ? items.length : b.groupIndex),
    );
    items.sort((a, b) => a.group - b.group);
    const groupCounts = new Map<number, number>();
    for (let i = 0; i < items.length; i++) {
      const group = items[i].group;
      if (!groupCounts.has(group)) {
        groupCounts.set(group, 0);
        items[i].groupIndex = 0;
      } else {
        const count = groupCounts.get(group)! + 1;
        groupCounts.set(group, count);
        items[i].groupIndex = count;
      }
    }
  }

  function saveGroupsToScene(newGroups: InitiativeGroup[]) {
    OBR.scene.setMetadata({
      [getPluginId(GROUPS_METADATA_ID)]: newGroups,
    });
  }

  function handleCreateGroup() {
    // Skip any ID already used by a defined group OR by any item in OBR,
    // so new groups never accidentally inherit orphaned tokens.
    const usedIds = new Set([
      ...groups.map((g) => g.id),
      ...initiativeItems.map((i) => i.group),
    ]);
    let newId = 0;
    while (usedIds.has(newId)) newId++;
    const letter = String.fromCharCode(65 + groups.length); // A, B, C...
    const newGroup: InitiativeGroup = {
      id: newId,
      name: `Group ${letter}`,
    };
    const newGroups = [...groups, newGroup];
    setGroups(newGroups);
    saveGroupsToScene(newGroups);
  }

  function handleRenameGroup(groupId: number, newName: string) {
    const newGroups = groups.map((g) =>
      g.id === groupId ? { ...g, name: newName } : g,
    );
    setGroups(newGroups);
    saveGroupsToScene(newGroups);
  }

  function handleMergeGroup(sourceId: number, targetId: number) {
    setMergeHistory((prev) => [
      ...prev,
      {
        groups: [...groups],
        items: initiativeItems.map((i) => ({
          id: i.id,
          group: i.group,
          groupIndex: i.groupIndex,
        })),
      },
    ]);
    const newItems = initiativeItems.map((item) =>
      item.group === sourceId
        ? { ...item, group: targetId, groupIndex: -1 }
        : item,
    );
    guaranteeMinimumGroupIndices(newItems);
    setInitiativeItems(newItems);
    writeGroupDataToItems(newItems);
    const newGroups = groups.filter((g) => g.id !== sourceId);
    setGroups(newGroups);
    saveGroupsToScene(newGroups);
  }

  function handleUndoMerge() {
    const last = mergeHistory[mergeHistory.length - 1];
    if (!last) return;
    setMergeHistory((prev) => prev.slice(0, -1));
    setGroups(last.groups);
    saveGroupsToScene(last.groups);
    const newItems = initiativeItems.map((item) => {
      const saved = last.items.find((i) => i.id === item.id);
      return saved
        ? { ...item, group: saved.group, groupIndex: saved.groupIndex }
        : item;
    });
    setInitiativeItems(newItems);
    writeGroupDataToItems(newItems);
  }

  function handleDeleteGroup(groupId: number) {
    if (groups.length <= 1) return;
    const targetGroupId = groups.find((g) => g.id !== groupId)!.id;
    const affected = initiativeItems.filter((item) => item.group === groupId);
    if (affected.length > 0) {
      const newItems = initiativeItems.map((item) =>
        item.group === groupId
          ? { ...item, group: targetGroupId, groupIndex: -1 }
          : item,
      );
      guaranteeMinimumGroupIndices(newItems);
      setInitiativeItems(newItems);
      writeGroupDataToItems(newItems);
    }
    const newGroups = groups.filter((g) => g.id !== groupId);
    setGroups(newGroups);
    saveGroupsToScene(newGroups);
  }

  // Sort each group independently by count value, first item in first group becomes active
  function handleSortClick() {
    const newItems = initiativeItems.map((item) => ({ ...item }));

    for (const group of groups) {
      const groupItems = newItems.filter((item) => item.group === group.id);
      groupItems.sort(
        sortAscending
          ? (a, b) => parseFloat(a.count) - parseFloat(b.count)
          : (a, b) => parseFloat(b.count) - parseFloat(a.count),
      );
      groupItems.forEach((item, index) => {
        const found = newItems.find((i) => i.id === item.id)!;
        found.groupIndex = index;
      });
    }

    // Flat ordered list across all groups
    const ordered = flatOrdered(newItems);

    // Increment round if active item was last
    if (initiativeItems.length > 1) {
      const activeIndex = ordered.findIndex((item) => item.active);
      if (activeIndex >= ordered.length - 1) {
        const newRoundCount = roundCount + 1;
        updateRoundCount(newRoundCount, setRoundCount);
        broadcastRoundChangeEventMessage(newRoundCount);
      }
    }

    const updatedItems = newItems.map((item) => {
      const isFirst = ordered[0]?.id === item.id;
      if (selectActiveItem === 1 && isFirst) selectItem(item.id);
      if (selectActiveItem === 2 && isFirst) labelItem(item.id);
      return { ...item, active: isFirst };
    });

    setInitiativeItems(updatedItems);

    OBR.scene.items.updateItems(
      updatedItems.map((i) => i.id),
      (items) => {
        for (const sceneItem of items) {
          const found = updatedItems.find((i) => i.id === sceneItem.id);
          if (!found) continue;
          const metadata = sceneItem.metadata[getPluginId("metadata")];
          if (isMetadata(metadata)) {
            metadata.active = found.active;
            metadata.group = found.group;
            metadata.groupIndex = found.groupIndex;
            sceneItem.metadata[getPluginId("metadata")] = metadata;
          }
        }
      },
    );
  }

  function flatOrdered(items: InitiativeItem[]) {
    return groups.flatMap((group) =>
      items
        .filter((item) => item.group === group.id)
        .sort((a, b) => a.groupIndex - b.groupIndex),
    );
  }

  function handleDirectionClick(next = true) {
    const ordered = flatOrdered(initiativeItems);
    let newIndex =
      ordered.findIndex((item) => item.active) + (next ? 1 : -1);

    if (newIndex < 0) {
      newIndex = ordered.length + newIndex;
      if (advancedControls && displayRound && roundCount > 1) {
        const newRoundCount = roundCount - 1;
        updateRoundCount(newRoundCount, setRoundCount);
        broadcastRoundChangeEventMessage(newRoundCount);
      } else {
        broadcastRoundChangeEventMessage(null);
      }
    } else if (newIndex >= ordered.length) {
      newIndex = newIndex % ordered.length;
      if (advancedControls && displayRound) {
        const newRoundCount = roundCount + 1;
        updateRoundCount(newRoundCount, setRoundCount);
        broadcastRoundChangeEventMessage(newRoundCount);
      } else {
        broadcastRoundChangeEventMessage(null);
      }
    }

    const targetId = ordered[newIndex]?.id;

    setInitiativeItems((prev) =>
      prev.map((item) => {
        const active = item.id === targetId;
        if (selectActiveItem === 1 && active) selectItem(item.id);
        if (selectActiveItem === 2 && active) labelItem(item.id);
        return { ...item, active };
      }),
    );

    OBR.scene.items.updateItems(
      initiativeItems.map((i) => i.id),
      (items) => {
        for (const item of items) {
          const metadata = item.metadata[getPluginId("metadata")];
          if (isMetadata(metadata)) {
            metadata.active = item.id === targetId;
          }
        }
      },
    );
  }

  function handleInitiativeCountChange(id: string, newCount: string) {
    setInitiativeItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, count: newCount } : item)),
    );
    OBR.scene.items.updateItems([id], (items) => {
      for (const item of items) {
        const metadata = item.metadata[getPluginId("metadata")];
        if (isMetadata(metadata)) {
          metadata.count = newCount;
        }
      }
    });
  }

  // Build per-group item lists and flat sortable list
  // Items whose group ID isn't in the groups list fall into the first group
  const knownGroupIds = new Set(groups.map((g) => g.id));
  const groupedItems = groups.map((group, index) => ({
    group,
    items: initiativeItems
      .filter(
        (item) =>
          item.group === group.id ||
          (index === 0 && !knownGroupIds.has(item.group)),
      )
      .sort((a, b) => a.groupIndex - b.groupIndex),
  }));

  // Every group gets a divider (including the first) so headers are draggable
  const sortableItems: string[] = [];
  for (let i = 0; i < groupedItems.length; i++) {
    sortableItems.push(getGroupDividerId(groupedItems[i].group.id));
    sortableItems.push(...groupedItems[i].items.map((item) => item.id));
  }

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: { y: 10 } },
    }),
  );

  const themeIsDark = useTheme().palette.mode === "dark";

  return (
    <DndContext
      sensors={sensors}
      modifiers={[restrictToFirstScrollableAncestor]}
      collisionDetection={closestCenter}
      onDragEnd={(event) => {
        const { active, over } = event;
        if (!over?.id || active.id === over.id) return;

        const activeId = active.id as string;
        const overId = over.id as string;

        // ── Group header drag → reorder groups ──────────────────────────
        if (isDivider(activeId)) {
          const sourceGroupId = getDividerGroupId(activeId);
          const targetGroupId = isDivider(overId)
            ? getDividerGroupId(overId)
            : initiativeItems.find((i) => i.id === overId)?.group;
          if (targetGroupId === undefined || sourceGroupId === targetGroupId)
            return;
          const sourceIdx = groups.findIndex((g) => g.id === sourceGroupId);
          const targetIdx = groups.findIndex((g) => g.id === targetGroupId);
          const newGroups = arrayMove(groups, sourceIdx, targetIdx);
          setGroups(newGroups);
          saveGroupsToScene(newGroups);
          return;
        }

        // ── Token drag ───────────────────────────────────────────────────
        const activeItem = initiativeItems.find((i) => i.id === activeId);
        if (!activeItem) return;

        const activeIndex = sortableItems.findIndex((id) => id === activeId);
        const overIndex = sortableItems.findIndex((id) => id === overId);
        const newItems = [...initiativeItems];

        if (isDivider(overId)) {
          const targetGroupId = getDividerGroupId(overId);
          const targetGroupArrayIdx = groups.findIndex(
            (g) => g.id === targetGroupId,
          );
          if (activeIndex < overIndex) {
            // Token is above this divider → move into this group at the start
            activeItem.group = targetGroupId;
            activeItem.groupIndex = -2;
          } else if (targetGroupArrayIdx === 0) {
            // Token is below the first group's divider → move to top of first group
            activeItem.group = targetGroupId;
            activeItem.groupIndex = -2;
          } else {
            const prevGroupId = groups[targetGroupArrayIdx - 1].id;
            const prevCount = initiativeItems.filter(
              (i) => i.group === prevGroupId && i.id !== activeItem.id,
            ).length;
            activeItem.group = prevGroupId;
            activeItem.groupIndex = prevCount;
          }
        } else {
          const overItem = initiativeItems.find((i) => i.id === over.id);
          if (!overItem) return;

          const overGroupIndex = overItem.groupIndex;
          if (overItem.group === activeItem.group) {
            newItems.forEach((item) => {
              if (item.id !== activeItem.id && item.group === overItem.group) {
                if (
                  item.groupIndex > activeItem.groupIndex &&
                  item.groupIndex <= overGroupIndex
                ) {
                  item.groupIndex--;
                } else if (
                  item.groupIndex >= overGroupIndex &&
                  item.groupIndex < activeItem.groupIndex
                ) {
                  item.groupIndex++;
                }
              }
            });
            activeItem.groupIndex = overGroupIndex;
          } else {
            newItems.forEach((item) => {
              if (item.id !== activeItem.id && item.group === overItem.group) {
                if (item.groupIndex > overGroupIndex) item.groupIndex++;
              }
            });
            activeItem.group = overItem.group;
            if (activeIndex < overIndex) {
              activeItem.groupIndex = overGroupIndex + 1;
            } else {
              activeItem.groupIndex = overGroupIndex;
              overItem.groupIndex++;
            }
          }
        }

        guaranteeMinimumGroupIndices(newItems);
        setInitiativeItems(newItems);
        writeGroupDataToItems(newItems);
      }}
    >
      <SortableContext items={sortableItems}>
        <Stack height="100vh">
          <InitiativeHeader
            subtitle={
              initiativeItems.length === 0
                ? "Select a character to start initiative"
                : undefined
            }
            action={
              <>
                {role === "GM" && <SettingsButton />}

                {role === "GM" && editMode && (
                  <IconButton
                    size="small"
                    onClick={handleCreateGroup}
                    title="Add group"
                  >
                    <AddRoundedIcon />
                  </IconButton>
                )}
                {role === "GM" && editMode && mergeHistory.length > 0 && (
                  <IconButton
                    size="small"
                    onClick={handleUndoMerge}
                    title="Undo merge"
                  >
                    <UndoRoundedIcon />
                  </IconButton>
                )}

                {editMode ? (
                  <IconButton onClick={() => setEditMode(false)}>
                    <EditOffRoundedIcon />
                  </IconButton>
                ) : (
                  <IconButton onClick={() => setEditMode(true)}>
                    <ModeEditRoundedIcon />
                  </IconButton>
                )}

                <IconButton onClick={handleSortClick}>
                  <Icon>
                    {sortAscending ? (
                      <SortAscendingIcon darkMode={themeIsDark} />
                    ) : (
                      <SortDescendingIcon darkMode={themeIsDark} />
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
                OBR.action.setHeight(
                  66 + Math.max(64, height) + (advancedControls ? 56 : 0),
                )
              }
            >
              {groupedItems.map(({ group, items }) => {
                const showHint =
                  items.length === 0 ||
                  (items.filter((i) => i.visible).length === 0 &&
                    role !== "GM");

                const otherGroups = groups.filter((g) => g.id !== group.id);

                return (
                  <div key={group.id}>
                    <SortableWrapper
                      groupId={group.id}
                      editMode={editMode && role === "GM"}
                    >
                      {(dragHandleListeners) => (
                        <EditableGroupHeading
                          groupName={group.name}
                          groupId={group.id}
                          editMode={editMode && role === "GM"}
                          onRename={handleRenameGroup}
                          onDelete={
                            groups.length > 1
                              ? () => handleDeleteGroup(group.id)
                              : undefined
                          }
                          onMerge={
                            otherGroups.length > 0
                              ? (targetId) => handleMergeGroup(group.id, targetId)
                              : undefined
                          }
                          otherGroups={otherGroups}
                          dragHandleListeners={dragHandleListeners}
                        />
                      )}
                    </SortableWrapper>
                    <List>
                      {items.map((item) => (
                        <InitiativeListItem
                          key={item.id}
                          item={item}
                          darkMode={themeIsDark}
                          onCountChange={(newCount) =>
                            handleInitiativeCountChange(item.id, newCount)
                          }
                          showHidden={role === "GM"}
                          selected={selection.includes(item.id)}
                          edit={editMode}
                        />
                      ))}
                    </List>
                    {showHint && (
                      <Typography
                        variant="caption"
                        sx={{
                          px: 2,
                          py: 1,
                          display: "inline-block",
                          color: "text.secondary",
                        }}
                      >
                        {items.length === 0
                          ? `${group.name} is empty`
                          : "All hidden"}
                      </Typography>
                    )}
                  </div>
                );
              })}
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
      </SortableContext>
    </DndContext>
  );
}

const SortableWrapper = ({
  groupId,
  editMode,
  children,
}: {
  groupId: number;
  editMode: boolean;
  children: (dragHandleListeners: Record<string, unknown>) => React.ReactNode;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: getGroupDividerId(groupId) });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
    >
      {children(editMode ? (listeners ?? {}) : {})}
    </div>
  );
};
