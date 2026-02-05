import OBR from "@owlbear-rodeo/sdk";
import { getPluginId } from "../helpers/getPluginId";
import { PREVIOUS_STACK_METADATA_ID } from "../helpers/metadataHelpers";

export function writePreviousStackToScene(previousStack: string[]) {
  OBR.scene.setMetadata({
    [getPluginId(PREVIOUS_STACK_METADATA_ID)]: previousStack,
  });
}
