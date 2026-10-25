import { getPluginId } from "../helpers/getPluginId";

export const CAROUSEL_POPOVER_ID = getPluginId("carousel");
// The open carousel reports in on this channel so it can be reopened if lost
export const CAROUSEL_HEARTBEAT_CHANNEL = getPluginId("carousel/heartbeat");
export const CAROUSEL_HEARTBEAT_INTERVAL = 1000;

// Gap between the carousel and the edge of the screen
export const CAROUSEL_EDGE_MARGIN = 12;
// Keeps the side carousel clear of Owlbear Rodeo's toolbars
export const CAROUSEL_SIDE_OFFSET = 72;
