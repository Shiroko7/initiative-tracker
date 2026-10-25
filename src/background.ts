import OBR, { Item, Metadata } from "@owlbear-rodeo/sdk";
import {
  readBooleanFromMetadata,
  readGroupsFromMetadata,
  SHARED_TURNS_METADATA_ID,
  ZIPPER_INITIATIVE_ENABLED_METADATA_ID,
} from "./helpers/metadataHelpers";
import {
  findActiveSlotIndex,
  findNextSlot,
  orderTurnSlots,
  parseInitiativeItems,
} from "./helpers/initiativeOrder";
import {
  clearTurnMarkers,
  setTurnMarkers,
  TurnMarkerRequest,
} from "./helpers/turnMarkers";
import { panToItem } from "./helpers/findItem";
import {
  onPlayerPreferencesChange,
  PlayerPreferences,
  readPlayerPreferences,
} from "./helpers/playerPreferences";
import {
  CAROUSEL_EDGE_MARGIN,
  CAROUSEL_HEARTBEAT_CHANNEL,
  CAROUSEL_HEARTBEAT_INTERVAL,
  CAROUSEL_POPOVER_ID,
  CAROUSEL_SIDE_OFFSET,
} from "./carousel/constants";

/*
  Runs on every client for the lifetime of the room. Each client manages its
  own carousel popover, turn markers (local items) and camera, following that
  player's own display preferences, so players get these features even when
  the initiative action popover is closed.
*/

interface State {
  sceneReady: boolean;
  role: "GM" | "PLAYER";
  roomMetadata: Metadata;
  sceneMetadata: Metadata;
  items: Item[];
  preferences: PlayerPreferences;
}

const state: State = {
  sceneReady: false,
  role: "PLAYER",
  roomMetadata: {},
  sceneMetadata: {},
  items: [],
  preferences: readPlayerPreferences(),
};

// Identifies how the open carousel was placed, empty when closed
let carouselPlacement = "";
// When the carousel was last opened or last reported that it's open
let carouselSeenAt = 0;
let lastActiveKey: string | undefined;
let lastMarkerKey = "";
let markerQueue: Promise<void> = Promise.resolve();
let sceneUnsubscribers: (() => void)[] = [];
let viewportSize = { width: 0, height: 0 };

OBR.onReady(async () => {
  // Subscribe before loading anything, so a failed load can't leave the
  // script deaf to the changes that would fix it
  OBR.player.onChange((player) => {
    if (player.role === state.role) return;
    state.role = player.role;
    update();
  });
  OBR.room.onMetadataChange((metadata) => {
    state.roomMetadata = metadata;
    update();
  });
  onPlayerPreferencesChange((preferences) => {
    state.preferences = preferences;
    update();
  });
  OBR.scene.onReadyChange(handleSceneReadyChange);

  // The carousel can fail to open or get closed by Owlbear Rodeo, so reopen
  // it if it should be showing but has stopped reporting in
  OBR.broadcast.onMessage(CAROUSEL_HEARTBEAT_CHANNEL, () => {
    carouselSeenAt = Date.now();
  });
  // The SDK has no resize event, so also check for the window changing size
  // to keep the carousel placed against the right edges
  setInterval(async () => {
    viewportSize = await getViewportSize();
    if (
      carouselPlacement !== "" &&
      Date.now() - carouselSeenAt > CAROUSEL_HEARTBEAT_INTERVAL * 5
    )
      carouselPlacement = "";
    update();
  }, CAROUSEL_HEARTBEAT_INTERVAL);

  const [role, roomMetadata] = await Promise.all([
    OBR.player.getRole(),
    OBR.room.getMetadata(),
  ]);
  state.role = role;
  state.roomMetadata = roomMetadata;
  viewportSize = await getViewportSize();
  handleSceneReadyChange(await OBR.scene.isReady());
});

/** The viewport size, or the last known size while the scene is still loading. */
async function getViewportSize() {
  try {
    const [width, height] = await Promise.all([
      OBR.viewport.getWidth(),
      OBR.viewport.getHeight(),
    ]);
    return { width, height };
  } catch {
    return viewportSize;
  }
}

// Increases with every scene load so a slow or failed one can't win a race
let sceneLoad = 0;

async function handleSceneReadyChange(ready: boolean) {
  const load = ++sceneLoad;
  sceneUnsubscribers.forEach((unsubscribe) => unsubscribe());
  sceneUnsubscribers = [];
  state.sceneReady = ready;
  lastActiveKey = undefined;
  lastMarkerKey = "";

  if (!ready) {
    state.items = [];
    state.sceneMetadata = {};
    update();
    return;
  }

  let items: Item[];
  let sceneMetadata: Metadata;
  try {
    [items, sceneMetadata] = await Promise.all([
      OBR.scene.items.getItems(),
      OBR.scene.getMetadata(),
    ]);
  } catch {
    // Right after a page refresh the scene can report ready before it has
    // loaded ("No scene found"), so try again shortly
    if (load !== sceneLoad) return;
    state.sceneReady = false;
    setTimeout(async () => {
      if (load !== sceneLoad) return;
      try {
        handleSceneReadyChange(await OBR.scene.isReady());
      } catch {
        handleSceneReadyChange(true);
      }
    }, 1000);
    return;
  }
  if (load !== sceneLoad) return;
  state.items = items;
  state.sceneMetadata = sceneMetadata;
  // Don't move the camera to whoever already had the turn when the scene loads
  lastActiveKey = getTurnState().activeKey;

  sceneUnsubscribers.push(
    OBR.scene.items.onChange((items) => {
      state.items = items;
      update();
    }),
    OBR.scene.onMetadataChange((metadata) => {
      state.sceneMetadata = metadata;
      update();
    }),
  );
  update();
}

function getTurnState() {
  const zipper = readBooleanFromMetadata(
    state.roomMetadata,
    ZIPPER_INITIATIVE_ENABLED_METADATA_ID,
  );
  const slots = orderTurnSlots(
    parseInitiativeItems(state.items, zipper),
    readGroupsFromMetadata(state.sceneMetadata),
    !zipper &&
      readBooleanFromMetadata(state.roomMetadata, SHARED_TURNS_METADATA_ID, true),
  );
  const canSee = (item: { visible: boolean }) =>
    state.role === "GM" || item.visible;

  // Checkbox initiative can have anyone acting, regardless of turn slots
  const active = zipper
    ? slots.flat().filter((item) => item.active)
    : (slots[findActiveSlotIndex(slots)] ?? []);
  // Checkbox initiative has no fixed order, so there is no "next" turn
  const next = zipper ? undefined : findNextSlot(slots, canSee);

  return {
    visibleCount: slots.flat().filter(canSee).length,
    activeKey: active.map((item) => item.id).join(","),
    activeIds: active.filter(canSee).map((item) => item.id),
    nextIds: (next ?? []).map((item) => item.id),
  };
}

function update() {
  const turn = getTurnState();
  updateCarousel(turn.visibleCount > 0);
  updateCamera(turn.activeKey, turn.activeIds);
  updateMarkers(turn.activeIds, turn.nextIds);
}

function updateCarousel(hasItems: boolean) {
  const { carouselEnabled, carouselPosition } = state.preferences;
  const shouldShow = state.sceneReady && hasItems && carouselEnabled;
  const { width, height } = viewportSize;
  // Wait until the page has a size to place the carousel against
  if (shouldShow && (width <= 0 || height <= 0)) return;
  const placement = shouldShow
    ? `${carouselPosition}:${width}x${height}`
    : "";

  if (placement === carouselPlacement) return;
  carouselPlacement = placement;

  if (!shouldShow) {
    OBR.popover.close(CAROUSEL_POPOVER_ID);
    return;
  }
  carouselSeenAt = Date.now();

  // The carousel resizes itself to fit its tokens once it has rendered
  const common = {
    id: CAROUSEL_POPOVER_ID,
    url: "/src/carousel/carousel.html",
    anchorReference: "POSITION",
    hidePaper: true,
    disableClickAway: true,
    marginThreshold: 0,
  } as const;
  if (carouselPosition === "TOP") {
    OBR.popover.open({
      ...common,
      width: Math.min(400, width - CAROUSEL_EDGE_MARGIN * 2),
      height: 120,
      anchorPosition: { left: width / 2, top: CAROUSEL_EDGE_MARGIN },
      anchorOrigin: { horizontal: "CENTER", vertical: "TOP" },
      transformOrigin: { horizontal: "CENTER", vertical: "TOP" },
    });
  } else {
    const left = carouselPosition === "LEFT";
    OBR.popover.open({
      ...common,
      width: 200,
      height: Math.min(400, height - CAROUSEL_SIDE_OFFSET * 2),
      anchorPosition: {
        left: left
          ? CAROUSEL_SIDE_OFFSET
          : width - CAROUSEL_EDGE_MARGIN,
        top: height / 2,
      },
      anchorOrigin: { horizontal: left ? "LEFT" : "RIGHT", vertical: "CENTER" },
      transformOrigin: {
        horizontal: left ? "LEFT" : "RIGHT",
        vertical: "CENTER",
      },
    });
  }
}

/**
 * @param activeKey every item holding the turn, even ones this client can't see
 * @param visibleActiveIds the active items this client can see
 */
function updateCamera(activeKey: string, visibleActiveIds: string[]) {
  if (activeKey === lastActiveKey) return;
  lastActiveKey = activeKey;
  if (visibleActiveIds.length === 0 || !state.preferences.cameraFollow) return;
  panToItem(visibleActiveIds);
}

function updateMarkers(activeIds: string[], nextIds: string[]) {
  const { currentTurnMarker, nextTurnMarker, markerLabels } = state.preferences;

  const requests: TurnMarkerRequest[] = [];
  if (state.sceneReady && currentTurnMarker)
    for (const itemId of activeIds) requests.push({ itemId, kind: "CURRENT" });
  if (state.sceneReady && nextTurnMarker)
    for (const itemId of nextIds) requests.push({ itemId, kind: "NEXT" });

  const key = JSON.stringify([requests, markerLabels]);
  if (key === lastMarkerKey) return;
  lastMarkerKey = key;

  // Serialize marker updates so quick turn changes can't interleave
  const sceneReady = state.sceneReady;
  markerQueue = markerQueue
    .then(() => {
      if (!sceneReady) return;
      return requests.length > 0
        ? setTurnMarkers(requests, markerLabels)
        : clearTurnMarkers();
    })
    .catch((error) => console.error("Failed to update turn markers", error));
}
