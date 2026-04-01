import { useEffect, useState } from "react";

import Stack from "@mui/material/Stack";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import Box from "@mui/material/Box";

import LoopRoundedIcon from "@mui/icons-material/LoopRounded";
import ModeEditRoundedIcon from "@mui/icons-material/ModeEditRounded";
import EditOffRoundedIcon from "@mui/icons-material/EditOffRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import UndoRoundedIcon from "@mui/icons-material/UndoRounded";

import OBR, { isImage, Item, Metadata } from "@owlbear-rodeo/sdk";

import { InitiativeItem } from "../components/InitiativeItem";

import { getPluginId } from "../helpers/getPluginId";
import { InitiativeHeader } from "../components/InitiativeHeader";
import { Typography } from "@mui/material";
import { EditableGroupHeading } from "../components/EditableGroupHeading";
import {
  DISABLE_NOTIFICATION_METADATA_ID,
  DISPLAY_ROUND_METADATA_ID,
  GROUPS_METADATA_ID,
  InitiativeGroup,
  DEFAULT_INITIATIVE_GROUPS,
  PREVIOUS_STACK_METADATA_ID,
  readBooleanFromMetadata,
  readGroupsFromMetadata,
  readNumberFromMetadata,
  readStringArrayFromMetadata,
  ROUND_COUNT_METADATA_ID,
  SELECT_ACTIVE_ITEM_METADATA_ID,
  updateRoundCount,
} from "../helpers/metadataHelpers";
import SettingsButton from "../settings/SettingsButton";
import { InitiativeListItem } from "./InitiativeListItem";

import { labelItem, removeLabel, selectItem } from "../helpers/findItem";
import { writePreviousStackToScene } from "./previousStack";
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
import isMetadata from "./isMetadata";
import writeGroupDataToItems from "./writeGroupDataToItems";
import useSelection from "../helpers/useSelection";
import HeightMonitor from "../components/HeightMonitor";
import { RoundControl } from "../components/RoundControl";
import { broadcastRoundChangeEventMessage } from "../helpers/broadcastRoundImplementation";

const DIVIDER_PREFIX = "GROUP_DIVIDER_";
const getGroupDividerId = (groupId: number) => `${DIVIDER_PREFIX}${groupId}`;
const isDivider = (id: string) =>
  typeof id === "string" && id.startsWith(DIVIDER_PREFIX);
const getDividerGroupId = (id: string) =>
  parseInt(id.slice(DIVIDER_PREFIX.length));

export function ZipperInitiative({ role }: { role: "PLAYER" | "GM" }) {
  const [initiativeItems, setInitiativeItems] = useState<InitiativeItem[]>([]);
  const [previousStack, setPreviousStack] = useState<string[]>([]);
  const [groups, setGroups] = useState<InitiativeGroup[]>(
    DEFAULT_INITIATIVE_GROUPS,
  );

  const [roundCount, setRoundCount] = useState(1);
  const [displayRound, setDisplayRound] = useState(false);
  const [disableNotifications, setDisableNotifications] = useState(false);
  const [selectActiveItem, setSelectActiveItem] = useState(0);

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
      setPreviousStack(
        readStringArrayFromMetadata(sceneMetadata, PREVIOUS_STACK_METADATA_ID),
      );
      setGroups(readGroupsFromMetadata(sceneMetadata));
    };
    OBR.scene.getMetadata().then(handleSceneMetadataChange);
    return OBR.scene.onMetadataChange(handleSceneMetadataChange);
  }, []);

  useEffect(() => {
    const handleRoomMetadataChange = (roomMetadata: Metadata) => {
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
    const handleItems = async (items: Item[]) => {
      const newInitiativeItems: InitiativeItem[] = [];
      for (const item of items) {
        if (isImage(item)) {
          const metadata = item.metadata[getPluginId("metadata")];
          if (isMetadata(metadata)) {
            newInitiativeItems.push({
              id: item.id,
              name: item.text.plainText || item.name,
              url: item.image.url,
              visible: item.visible,
              active: metadata.active,
              count: metadata.count,
              ready: metadata.ready !== undefined ? metadata.ready : true,
              group: metadata.group !== undefined ? metadata.group : 1,
              groupIndex:
                metadata.groupIndex !== undefined ? metadata.groupIndex : -1,
            });
          }
        }
      }

      guaranteeMinimumGroupIndices(newInitiativeItems);
      setInitiativeItems(newInitiativeItems);
    };

    OBR.scene.items.getItems().then(handleItems);
    return OBR.scene.items.onChange(handleItems);
  }, []);

  function guaranteeMinimumGroupIndices(
    newInitiativeItems: InitiativeItem[],
  ) {
    newInitiativeItems.sort(
      (a, b) =>
        (a.groupIndex === -1 ? newInitiativeItems.length : a.groupIndex) -
        (b.groupIndex === -1 ? newInitiativeItems.length : b.groupIndex),
    );
    newInitiativeItems.sort((a, b) => a.group - b.group);
    const groupCounts = new Map<number, number>();
    for (let i = 0; i < newInitiativeItems.length; i++) {
      const group = newInitiativeItems[i].group;
      if (!groupCounts.has(group)) {
        groupCounts.set(group, 0);
        newInitiativeItems[i].groupIndex = 0;
      } else {
        const groupCount = groupCounts.get(group);
        if (groupCount === undefined) throw "Error bad group";
        const newGroupCount = groupCount + 1;
        groupCounts.set(group, newGroupCount);
        newInitiativeItems[i].groupIndex = newGroupCount;
      }
    }
  }

  function saveGroupsToScene(newGroups: InitiativeGroup[]) {
    OBR.scene.setMetadata({
      [getPluginId(GROUPS_METADATA_ID)]: newGroups,
    });
  }

  function handleCreateGroup() {
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
    const newInitiativeItems = initiativeItems.map((item) =>
      item.group === sourceId
        ? { ...item, group: targetId, groupIndex: -1 }
        : item,
    );
    guaranteeMinimumGroupIndices(newInitiativeItems);
    setInitiativeItems(newInitiativeItems);
    writeGroupDataToItems(newInitiativeItems);
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
    const newInitiativeItems = initiativeItems.map((item) => {
      const saved = last.items.find((i) => i.id === item.id);
      return saved
        ? { ...item, group: saved.group, groupIndex: saved.groupIndex }
        : item;
    });
    setInitiativeItems(newInitiativeItems);
    writeGroupDataToItems(newInitiativeItems);
  }

  function handleDeleteGroup(groupId: number) {
    if (groups.length <= 1) return;
    const targetGroupId = groups.find((g) => g.id !== groupId)!.id;

    const affected = initiativeItems.filter((item) => item.group === groupId);
    if (affected.length > 0) {
      const newInitiativeItems = initiativeItems.map((item) =>
        item.group === groupId
          ? { ...item, group: targetGroupId, groupIndex: -1 }
          : item,
      );
      guaranteeMinimumGroupIndices(newInitiativeItems);
      setInitiativeItems(newInitiativeItems);
      writeGroupDataToItems(newInitiativeItems);
    }

    const newGroups = groups.filter((g) => g.id !== groupId);
    setGroups(newGroups);
    saveGroupsToScene(newGroups);
  }

  function handleReadyChange(id: string, ready: boolean, previousId: string) {
    const isNewActive = !ready;
    setInitiativeItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          if (selectActiveItem === 1 && isNewActive) selectItem(item.id);
          if (selectActiveItem === 2 && isNewActive) labelItem(item.id);
          return { ...item, ready: ready, active: isNewActive };
        } else {
          return { ...item, active: false };
        }
      }),
    );

    if (isNewActive) {
      const newPreviousStack = [...previousStack, id];
      setPreviousStack(newPreviousStack);
      writePreviousStackToScene(newPreviousStack);
    } else {
      const newPreviousStack = previousStack.slice(0, -1);
      setPreviousStack(newPreviousStack);
      writePreviousStackToScene(newPreviousStack);
      if (newPreviousStack.length === 0) removeLabel();
      setInitiativeItems((prev) =>
        prev.map((item) => {
          if (item.id === previousId) {
            if (selectActiveItem === 1) selectItem(item.id);
            if (selectActiveItem === 2) labelItem(item.id);
            return { ...item, active: true };
          } else return { ...item };
        }),
      );
    }

    OBR.scene.items.updateItems(
      initiativeItems.map((item) => item.id),
      (items) => {
        for (const item of items) {
          const metadata = item.metadata[getPluginId("metadata")];
          if (isMetadata(metadata)) {
            if (item.id === id) {
              metadata.ready = ready;
              metadata.active = isNewActive;
            } else if (!isNewActive && item.id === previousId) {
              metadata.active = true;
            } else {
              metadata.active = false;
            }
          }
        }
      },
    );
  }

  const roundFinished =
    initiativeItems.filter((item) => item.ready).length === 0;
  const lastItem = initiativeItems.filter((item) => item.ready).length <= 1;

  function handleResetClicked() {
    if (roundFinished || (lastItem && initiativeItems.length > 1)) {
      if (displayRound) {
        const newRoundCount = roundCount + 1;
        updateRoundCount(newRoundCount, setRoundCount);
        broadcastRoundChangeEventMessage(newRoundCount);
      } else {
        broadcastRoundChangeEventMessage(null);
      }
    }

    setPreviousStack([]);
    writePreviousStackToScene([]);

    setInitiativeItems(
      initiativeItems.map((item) => ({
        ...item,
        ready: true,
        active: false,
      })),
    );

    OBR.scene.items.updateItems(
      initiativeItems.map((init) => init.id),
      (items) => {
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          const metadata = item.metadata[getPluginId("metadata")];
          if (isMetadata(metadata)) {
            metadata.ready = true;
            metadata.active = false;
          }
        }
      },
    );

    if (selectActiveItem == 2) removeLabel();
  }

  // Build per-group item lists sorted by groupIndex
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
        const activeItem = initiativeItems.find((item) => item.id === activeId);
        if (activeItem === undefined) return;

        const activeIndex = sortableItems.findIndex((id) => id === activeId);
        const overIndex = sortableItems.findIndex((id) => id === overId);
        const newInitiativeItems = [...initiativeItems];

        if (isDivider(overId)) {
          const targetGroupId = getDividerGroupId(overId);
          const targetGroupArrayIdx = groups.findIndex(
            (g) => g.id === targetGroupId,
          );

          if (activeIndex < overIndex) {
            activeItem.group = targetGroupId;
            activeItem.groupIndex = -2;
          } else if (targetGroupArrayIdx === 0) {
            activeItem.group = targetGroupId;
            activeItem.groupIndex = -2;
          } else {
            const prevGroupId = groups[targetGroupArrayIdx - 1].id;
            const prevGroupCount = initiativeItems.filter(
              (item) => item.group === prevGroupId && item.id !== activeItem.id,
            ).length;
            activeItem.group = prevGroupId;
            activeItem.groupIndex = prevGroupCount;
          }
        } else {
          const overItem = initiativeItems.find((item) => item.id === over.id);
          if (overItem === undefined) return;

          const overGroupIndex = overItem.groupIndex;
          if (overItem.group === activeItem.group) {
            // Same group reorder
            newInitiativeItems.forEach((item) => {
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
            // Cross-group move
            newInitiativeItems.forEach((item) => {
              if (item.id !== activeItem.id && item.group === overItem.group) {
                if (item.groupIndex > overGroupIndex) {
                  item.groupIndex++;
                }
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

        guaranteeMinimumGroupIndices(newInitiativeItems);
        setInitiativeItems(newInitiativeItems);
        writeGroupDataToItems(newInitiativeItems);
      }}
    >
      <SortableContext items={sortableItems}>
        <Stack height="100vh">
          <InitiativeHeader
            action={
              <>
                {role === "GM" && <SettingsButton />}

                {role === "GM" && editMode && (
                  <IconButton
                    onClick={handleCreateGroup}
                    title="Add group"
                    size="small"
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
                <IconButton
                  onClick={handleResetClicked}
                  disabled={role === "PLAYER" && !roundFinished}
                >
                  <LoopRoundedIcon
                    color={roundFinished ? "primary" : undefined}
                  />
                </IconButton>
              </>
            }
          />

          <Box sx={{ overflowY: "auto", overflowX: "clip" }}>
            <HeightMonitor
              onChange={(height) =>
                OBR.action.setHeight(height + 64 + 2 + (displayRound ? 54 : 0))
              }
            >
              {groupedItems.map(({ group, items }) => {
                const allHidden =
                  items.filter((item) => item.visible).length === 0;
                const isEmpty = items.length === 0;
                const showHint = isEmpty || (allHidden && role !== "GM");

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
                              ? (targetId) =>
                                  handleMergeGroup(group.id, targetId)
                              : undefined
                          }
                          otherGroups={otherGroups}
                          dragHandleListeners={dragHandleListeners}
                        />
                      )}
                    </SortableWrapper>

                    <List sx={{ py: 0 }}>
                      {items.map((item) => (
                        <InitiativeListItem
                          key={item.id}
                          item={item}
                          onReadyChange={(ready) => {
                            handleReadyChange(
                              item.id,
                              ready,
                              previousStack.length > 1
                                ? (previousStack.at(
                                    previousStack.length - 2,
                                  ) as string)
                                : "",
                            );
                          }}
                          showHidden={role === "GM"}
                          edit={editMode}
                          selected={selection.includes(item.id)}
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
                        {isEmpty ? `${group.name} is empty` : "All hidden"}
                      </Typography>
                    )}
                  </div>
                );
              })}
            </HeightMonitor>
          </Box>

          {displayRound && (
            <div className="grid place-items-center py-2">
              <RoundControl
                roundCount={roundCount}
                setRoundCount={setRoundCount}
                playerRole={role}
                disableNotifications={disableNotifications}
              />
            </div>
          )}
        </Stack>
      </SortableContext>
    </DndContext>
  );
}

// Wraps a group heading in a sortable container so items can be dragged over it
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

