import OBR, { buildLabel, buildShape, Item } from "@owlbear-rodeo/sdk";
import { getPluginId } from "./getPluginId";

const MARKER_METADATA_KEY = getPluginId("turnMarker");

export type TurnMarkerKind = "CURRENT" | "NEXT";

const MARKER_STYLES: Record<
  TurnMarkerKind,
  { color: string; label: string; dash: number[] }
> = {
  CURRENT: { color: "#f5c542", label: "Current Turn", dash: [] },
  NEXT: { color: "#7ab8ff", label: "Up Next", dash: [8, 8] },
};

export interface TurnMarkerRequest {
  itemId: string;
  kind: TurnMarkerKind;
}

/**
 * Replace this client's turn markers. Markers are local items, so each
 * player draws their own and nothing is written to the shared scene.
 */
export async function setTurnMarkers(
  requests: TurnMarkerRequest[],
  showLabels: boolean,
) {
  const markers: Item[] = [];
  if (requests.length > 0) {
    const dpi = await OBR.scene.grid.getDpi();
    for (const request of requests) {
      markers.push(...(await buildMarker(request, showLabels, dpi)));
    }
  }
  await clearTurnMarkers();
  if (markers.length > 0) await OBR.scene.local.addItems(markers);
}

export async function clearTurnMarkers() {
  const existing = await OBR.scene.local.getItems(
    (item) => item.metadata[MARKER_METADATA_KEY] !== undefined,
  );
  if (existing.length > 0)
    await OBR.scene.local.deleteItems(existing.map((item) => item.id));
}

async function buildMarker(
  { itemId, kind }: TurnMarkerRequest,
  showLabels: boolean,
  dpi: number,
): Promise<Item[]> {
  const style = MARKER_STYLES[kind];
  const bounds = await OBR.scene.items.getItemBounds([itemId]);
  const diameter = Math.max(bounds.width, bounds.height) * 1.12;
  const metadata = { [MARKER_METADATA_KEY]: kind };

  // A ring drawn beneath the token, like a selection circle
  const ring = buildShape()
    .shapeType("CIRCLE")
    .width(diameter)
    .height(diameter)
    .position(bounds.center)
    .strokeColor(style.color)
    .strokeWidth(dpi / 18)
    .strokeOpacity(kind === "CURRENT" ? 1 : 0.85)
    .strokeDash(style.dash)
    .fillColor(style.color)
    .fillOpacity(kind === "CURRENT" ? 0.25 : 0.1)
    .layer("PROP")
    .attachedTo(itemId)
    .disableAttachmentBehavior(["ROTATION", "LOCKED"])
    .locked(true)
    .disableHit(true)
    .metadata(metadata)
    .build();

  if (!showLabels) return [ring];

  const label = buildLabel()
    .plainText(style.label)
    .position({ x: bounds.center.x, y: bounds.min.y - dpi / 30 })
    .style({
      backgroundColor: kind === "CURRENT" ? "#3D4051" : "#2B3A55",
      backgroundOpacity: 0.85,
      cornerRadius: 8,
      pointerDirection: "DOWN",
      pointerWidth: (dpi / 150) * 8,
      pointerHeight: (dpi / 150) * 8,
    })
    .fillColor(style.color)
    .maxViewScale(1.5)
    .minViewScale(0.8)
    .attachedTo(itemId)
    .disableAttachmentBehavior(["ROTATION", "LOCKED"])
    .locked(true)
    .disableHit(true)
    .metadata(metadata)
    .build();

  return [ring, label];
}
