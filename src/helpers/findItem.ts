import OBR, { buildLabel } from "@owlbear-rodeo/sdk";

export async function deselectText() {
  // Deselect the list item text
  window.getSelection()?.removeAllRanges();
}

export async function selectItem(itemId: string) {
  OBR.player.select([itemId]);
}

export async function focusItem(itemId: string) {
  // User may have selected text by double clicking on the initiative item
  deselectText();

  // Select this item
  await selectItem(itemId);

  await panToItem(itemId);
}

// How much of the screen a group of items can take up before zooming out
const FRAME_FILL = 0.7;

/**
 * Center the viewport on one or more items without changing the selection,
 * zooming out if needed so they're all in frame.
 */
export async function panToItem(itemIds: string | string[]) {
  const [bounds, viewportWidth, viewportHeight, viewportScale] =
    await Promise.all([
      OBR.scene.items.getItemBounds(
        typeof itemIds === "string" ? [itemIds] : itemIds,
      ),
      OBR.viewport.getWidth(),
      OBR.viewport.getHeight(),
      OBR.viewport.getScale(),
    ]);

  // Never zoom in, only out far enough to fit everything
  const scale = Math.min(
    viewportScale,
    (viewportWidth * FRAME_FILL) / bounds.width,
    (viewportHeight * FRAME_FILL) / bounds.height,
  );

  // Place the center of the items at the center of the viewport
  await OBR.viewport.animateTo({
    scale,
    position: {
      x: viewportWidth / 2 - bounds.center.x * scale,
      y: viewportHeight / 2 - bounds.center.y * scale,
    },
  });
}

const labelId = "prettySordidActiveLabel";

export async function labelItem(itemId: string) {
  const bounds = await OBR.scene.items.getItemBounds([itemId]);
  const sceneDpi = await OBR.scene.grid.getDpi();
  const items = await OBR.scene.items.getItems((item) => item.id === itemId);
  const item = items[0];

  const label = buildLabel()
    .id(labelId)
    .position({
      x: bounds.center.x,
      y: bounds.min.y - sceneDpi / 30,
    })
    .style({
      backgroundColor: "#3D4051",
      backgroundOpacity: 0.7,
      cornerRadius: 8,
      pointerDirection: "DOWN",
      pointerWidth: (sceneDpi / 150) * 8,
      pointerHeight: (sceneDpi / 150) * 8,
    })
    .maxViewScale(1.5)
    .minViewScale(0.8)
    .backgroundOpacity(1)
    .plainText("Your Turn!")
    .attachedTo(itemId)
    .visible(item.visible)
    .locked(true)
    .build();

  OBR.scene.items.addItems([label]);
}

export async function removeLabel() {
  OBR.scene.local.deleteItems([labelId]);
}
