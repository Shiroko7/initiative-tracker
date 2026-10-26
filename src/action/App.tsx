import { useEffect, useState } from "react";

import OBR, { Metadata, Player } from "@owlbear-rodeo/sdk";
import { InitiativeHeader } from "../components/InitiativeHeader";
import { InitiativeTracker } from "../classicInitiative/InitiativeTracker";
import {
  readBooleanFromMetadata,
  ZIPPER_INITIATIVE_ENABLED_METADATA_ID,
} from "../helpers/metadataHelpers";
import { ZipperInitiative } from "../zipperInitiative/ZipperInitiative";
import { getPluginId } from "../helpers/getPluginId";
import addThemeToBody from "../helpers/addThemeToBody";
import { useTheme } from "@mui/material";
import {
  linkTurn,
  removeFromInitiative,
  unlinkTurn,
} from "../helpers/linkedTurns";

const addIcon = new URL("../assets/add.svg#icon", import.meta.url).toString();
const removeIcon = new URL(
  "../assets/remove.svg#icon",
  import.meta.url,
).toString();
const linkIcon = new URL("../assets/link.svg#icon", import.meta.url).toString();
const unlinkIcon = new URL(
  "../assets/unlink.svg#icon",
  import.meta.url,
).toString();

const TOKEN_FILTER = [
  { key: "layer", value: "CHARACTER", coordinator: "||" },
  { key: "layer", value: "MOUNT" },
  { key: "type", value: "IMAGE" },
] as const;

export function App() {
  const [sceneReady, setSceneReady] = useState(false);
  const [zipperInitiativeEnabled, setZipperInitiativeEnabled] = useState(false);
  const [role, setRole] = useState<"GM" | "PLAYER">("PLAYER");

  const theme = useTheme();

  addThemeToBody(theme.palette.mode);

  useEffect(() => {
    OBR.scene.isReady().then(setSceneReady);
    return OBR.scene.onReadyChange(setSceneReady);
  }, []);

  useEffect(() => {
    const handlePlayerChange = (player: Player) => {
      setRole(player.role);
    };
    OBR.player.getRole().then(setRole);
    return OBR.player.onChange(handlePlayerChange);
  }, []);

  useEffect(() => {
    const handleRoomMetadataChange = (roomMetadata: Metadata) => {
      setZipperInitiativeEnabled(
        readBooleanFromMetadata(
          roomMetadata,
          ZIPPER_INITIATIVE_ENABLED_METADATA_ID,
          zipperInitiativeEnabled,
        ),
      );
    };
    OBR.room.getMetadata().then(handleRoomMetadataChange);
    return OBR.room.onMetadataChange(handleRoomMetadataChange);
  }, []);

  useEffect(() => {
    OBR.onReady(() => {
      OBR.contextMenu.create({
        icons: [
          {
            icon: addIcon,
            label: "Add to Initiative",
            filter: {
              every: [
                ...TOKEN_FILTER,
                {
                  key: ["metadata", getPluginId("metadata")],
                  value: undefined,
                },
              ],
              permissions: ["UPDATE"],
            },
          },
          {
            icon: removeIcon,
            label: "Remove from Initiative",
            filter: {
              every: [...TOKEN_FILTER],
              permissions: ["UPDATE"],
            },
          },
        ],
        id: getPluginId("menu/toggle"),
        onClick(context) {
          // Check whether to add the items to initiative or remove them
          const addToInitiative = context.items.every(
            (item) => item.metadata[getPluginId("metadata")] === undefined,
          );
          if (!addToInitiative) {
            removeFromInitiative(context.items.map((item) => item.id));
            return;
          }
          OBR.scene.items.updateItems(context.items, (items) => {
            let count = 0;
            for (const item of items) {
              item.metadata[getPluginId("metadata")] = {
                count: `${count}`,
                active: false,
                group: 0,
              };
              count += 1;
            }
          });
        },
      });
      OBR.contextMenu.create({
        icons: [
          {
            icon: linkIcon,
            label: "Share One Turn",
            filter: {
              min: 2,
              every: [...TOKEN_FILTER],
              permissions: ["UPDATE"],
            },
          },
        ],
        id: getPluginId("menu/link"),
        onClick(context) {
          linkTurn(context.items.map((item) => item.id));
        },
      });
      OBR.contextMenu.create({
        icons: [
          {
            icon: unlinkIcon,
            label: "Take Own Turn",
            filter: {
              every: [
                ...TOKEN_FILTER,
                {
                  key: ["metadata", getPluginId("metadata"), "linkedTo"],
                  value: undefined,
                  operator: "!=",
                },
              ],
              permissions: ["UPDATE"],
            },
          },
        ],
        id: getPluginId("menu/unlink"),
        onClick(context) {
          unlinkTurn(context.items.map((item) => item.id));
        },
      });
    });
  }, [role]);

  // Show a basic header when the scene isn't ready
  if (!sceneReady) {
    return (
      <InitiativeHeader subtitle="Open a scene to use the initiative tracker" />
    );
  }

  if (zipperInitiativeEnabled) return <ZipperInitiative role={role} />;

  return <InitiativeTracker role={role} />;
}
