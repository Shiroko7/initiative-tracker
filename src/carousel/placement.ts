import {
  isCarouselVertical,
  PlayerPreferences,
} from "../helpers/playerPreferences";
import {
  CAROUSEL_EDGE_MARGIN,
  CAROUSEL_SIDE_OFFSET,
  CAROUSEL_TOP_OFFSET,
} from "./constants";

interface Size {
  width: number;
  height: number;
}

// How much of a floating carousel must stay on screen
const FLOATING_MIN_VISIBLE = 80;

/** Where a floating carousel's top left corner goes, kept on screen. */
export function floatingCorner(preferences: PlayerPreferences, viewport: Size) {
  return {
    left: Math.min(
      Math.max(0, preferences.carouselFloatingX * viewport.width),
      viewport.width - FLOATING_MIN_VISIBLE,
    ),
    top: Math.min(
      Math.max(0, preferences.carouselFloatingY * viewport.height),
      viewport.height - FLOATING_MIN_VISIBLE,
    ),
  };
}

/** The popover options that place the carousel, before it fits itself. */
export function getCarouselPopoverPlacement(
  preferences: PlayerPreferences,
  viewport: Size,
) {
  const { width, height } = viewport;
  const vertical = isCarouselVertical(preferences);
  const size = vertical
    ? { width: 200, height: Math.min(400, height - CAROUSEL_SIDE_OFFSET * 2) }
    : { width: Math.min(400, width - CAROUSEL_EDGE_MARGIN * 2), height: 120 };

  switch (preferences.carouselPosition) {
    case "TOP":
    case "BOTTOM": {
      const top = preferences.carouselPosition === "TOP";
      const edge = top ? "TOP" : "BOTTOM";
      return {
        ...size,
        anchorPosition: {
          left: width / 2,
          top: top ? CAROUSEL_TOP_OFFSET : height - CAROUSEL_EDGE_MARGIN,
        },
        anchorOrigin: { horizontal: "CENTER", vertical: edge },
        transformOrigin: { horizontal: "CENTER", vertical: edge },
      } as const;
    }
    case "LEFT":
    case "RIGHT": {
      const left = preferences.carouselPosition === "LEFT";
      const horizontal = left ? "LEFT" : "RIGHT";
      return {
        ...size,
        anchorPosition: {
          left: left ? CAROUSEL_SIDE_OFFSET : width - CAROUSEL_EDGE_MARGIN,
          top: height / 2,
        },
        anchorOrigin: { horizontal, vertical: "CENTER" },
        transformOrigin: { horizontal, vertical: "CENTER" },
      } as const;
    }
    case "FLOATING":
      return {
        ...size,
        anchorPosition: floatingCorner(preferences, viewport),
        anchorOrigin: { horizontal: "LEFT", vertical: "TOP" },
        transformOrigin: { horizontal: "LEFT", vertical: "TOP" },
      } as const;
  }
}

/** Where the carousel's top left corner is on screen, given its size. */
export function getCarouselCorner(
  preferences: PlayerPreferences,
  viewport: Size,
  size: Size,
) {
  const { width, height } = viewport;
  switch (preferences.carouselPosition) {
    case "TOP":
      return { left: (width - size.width) / 2, top: CAROUSEL_TOP_OFFSET };
    case "BOTTOM":
      return {
        left: (width - size.width) / 2,
        top: height - CAROUSEL_EDGE_MARGIN - size.height,
      };
    case "LEFT":
      return { left: CAROUSEL_SIDE_OFFSET, top: (height - size.height) / 2 };
    case "RIGHT":
      return {
        left: width - CAROUSEL_EDGE_MARGIN - size.width,
        top: (height - size.height) / 2,
      };
    case "FLOATING":
      return floatingCorner(preferences, viewport);
  }
}
