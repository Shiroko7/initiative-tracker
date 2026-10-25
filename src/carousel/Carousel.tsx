import { useEffect, useLayoutEffect, useRef, useState } from "react";
import OBR, { Item, Metadata } from "@owlbear-rodeo/sdk";
import IconButton from "@mui/material/IconButton";
import SkipPreviousRoundedIcon from "@mui/icons-material/SkipPreviousRounded";
import SkipNextRoundedIcon from "@mui/icons-material/SkipNextRounded";
import VisibilityOffRounded from "@mui/icons-material/VisibilityOffRounded";
import LoopRoundedIcon from "@mui/icons-material/LoopRounded";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";

import { InitiativeItem } from "../components/InitiativeItem";
import {
  ADVANCED_CONTROLS_METADATA_ID,
  DISPLAY_ROUND_METADATA_ID,
  readBooleanFromMetadata,
  readGroupsFromMetadata,
  readNumberFromMetadata,
  ROUND_COUNT_METADATA_ID,
  SHARED_TURNS_METADATA_ID,
  ZIPPER_INITIATIVE_ENABLED_METADATA_ID,
} from "../helpers/metadataHelpers";
import {
  buildTurnSlots,
  findNextSlot,
  parseInitiativeItems,
  segmentInitiativeItems,
  TurnSlot,
} from "../helpers/initiativeOrder";
import { advanceTurn } from "../helpers/turnControls";
import { buildEntries } from "./carouselEntries";
import { panToItem } from "../helpers/findItem";
import { cn } from "../helpers/utils";
import { usePlayerPreferences } from "../helpers/playerPreferences";
import {
  CAROUSEL_EDGE_MARGIN,
  CAROUSEL_HEARTBEAT_CHANNEL,
  CAROUSEL_HEARTBEAT_INTERVAL,
  CAROUSEL_POPOVER_ID,
  CAROUSEL_SIDE_OFFSET,
} from "./constants";

// Space around the panel so its shadow and glow aren't clipped by the popover
const OUTER_PADDING = 12;
// Padding inside the track, kept when cutting it off after the last visible card
const TRACK_PADDING = 8;
// Portrait cards are taller than they are wide
const CARD_ASPECT = 0.75;
// Share of a card hidden under its neighbour within a shared turn
const SHARED_OVERLAP = 0.4;

export function Carousel() {
  const [role, setRole] = useState<"GM" | "PLAYER">("PLAYER");
  const [roomMetadata, setRoomMetadata] = useState<Metadata>({});
  const [sceneMetadata, setSceneMetadata] = useState<Metadata>({});
  const [sceneItems, setSceneItems] = useState<Item[]>([]);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const preferences = usePlayerPreferences();

  useEffect(() => {
    OBR.player.getRole().then(setRole);
    return OBR.player.onChange((player) => setRole(player.role));
  }, []);

  useEffect(() => {
    OBR.room.getMetadata().then(setRoomMetadata);
    return OBR.room.onMetadataChange(setRoomMetadata);
  }, []);

  useEffect(() => {
    OBR.scene.getMetadata().then(setSceneMetadata);
    return OBR.scene.onMetadataChange(setSceneMetadata);
  }, []);

  useEffect(() => {
    OBR.scene.items.getItems().then(setSceneItems);
    return OBR.scene.items.onChange(setSceneItems);
  }, []);

  // Let the background script know the carousel is still open
  useEffect(() => {
    const reportIn = () =>
      OBR.broadcast.sendMessage(
        CAROUSEL_HEARTBEAT_CHANNEL,
        {},
        { destination: "LOCAL" },
      );
    reportIn();
    const interval = setInterval(reportIn, CAROUSEL_HEARTBEAT_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  // The background script reopens the carousel when the window is resized
  useEffect(() => {
    Promise.all([OBR.viewport.getWidth(), OBR.viewport.getHeight()]).then(
      ([width, height]) => setViewport({ width, height }),
    );
  }, []);

  const vertical = preferences.carouselPosition !== "TOP";
  const collapsed = preferences.carouselCollapsed;
  const showNames = vertical && preferences.carouselShowNames;
  const activeHeight = preferences.carouselCardSize;
  const waitingHeight = Math.round(
    (activeHeight * preferences.carouselWaitingSize) / 100,
  );
  const maxTokens = preferences.carouselMaxTokens;
  const maxWidth = vertical
    ? Math.min(400, viewport.width / 3)
    : viewport.width - CAROUSEL_EDGE_MARGIN * 2;
  const maxHeight = vertical
    ? viewport.height - CAROUSEL_SIDE_OFFSET * 2
    : viewport.height / 2;

  const zipper = readBooleanFromMetadata(
    roomMetadata,
    ZIPPER_INITIATIVE_ENABLED_METADATA_ID,
  );
  const sharedTurns =
    !zipper &&
    readBooleanFromMetadata(roomMetadata, SHARED_TURNS_METADATA_ID, true);
  const showRound = zipper
    ? readBooleanFromMetadata(roomMetadata, DISPLAY_ROUND_METADATA_ID)
    : readBooleanFromMetadata(roomMetadata, ADVANCED_CONTROLS_METADATA_ID) &&
      readBooleanFromMetadata(roomMetadata, DISPLAY_ROUND_METADATA_ID);
  const roundCount = readNumberFromMetadata(
    sceneMetadata,
    ROUND_COUNT_METADATA_ID,
    1,
  );
  const showTurnControls = role === "GM" && !zipper;

  const canSee = (item: InitiativeItem) => role === "GM" || item.visible;
  const groupedSlots = segmentInitiativeItems(
    parseInitiativeItems(sceneItems, zipper),
    readGroupsFromMetadata(sceneMetadata),
  ).flatMap((segment) =>
    buildTurnSlots(segment.items, sharedTurns).map((slot) => ({
      group: segment.group,
      slot,
    })),
  );
  const allSlots = groupedSlots.map(({ slot }) => slot);
  const activeIds = new Set(
    allSlots
      .flat()
      .filter((item) => item.active && canSee(item))
      .map((item) => item.id),
  );
  const nextIds = new Set(
    zipper ? [] : (findNextSlot(allSlots, canSee) ?? []).map((item) => item.id),
  );

  const entries = buildEntries({
    groupedSlots,
    canSee,
    // Checkbox initiative has no fixed order to rotate through
    rotate: !zipper,
    collapsed,
    roundCount,
    showRound,
  });

  // Limit the list to the first few tokens, the rest are a scroll away
  const panelRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const lastSize = useRef({ width: 0, height: 0 });
  const [extent, setExtent] = useState<number>();
  const [overflow, setOverflow] = useState({ start: false, end: false });
  useLayoutEffect(() => {
    const panel = panelRef.current;
    const scroll = scrollRef.current;
    const track = trackRef.current;
    if (!panel || !scroll || !track || viewport.width === 0) return;
    const measure = () => {
      // Cut the list off after the card holding the last allowed token
      let end = vertical ? track.offsetHeight : track.offsetWidth;
      for (const card of track.querySelectorAll<HTMLElement>(
        "[data-tokens-through]",
      )) {
        if (Number(card.dataset.tokensThrough) >= maxTokens) {
          end =
            (vertical
              ? card.offsetTop + card.offsetHeight
              : card.offsetLeft + card.offsetWidth) + TRACK_PADDING;
          break;
        }
      }
      // ...but never past the edge of the screen
      const chrome = vertical
        ? panel.offsetHeight - scroll.offsetHeight
        : panel.offsetWidth - scroll.offsetWidth;
      const limit =
        (vertical ? maxHeight : maxWidth) - chrome - OUTER_PADDING * 2;
      const newExtent = Math.max(0, Math.floor(Math.min(end, limit)));
      setExtent((previous) => (previous === newExtent ? previous : newExtent));

      // Fit the popover to the panel
      const size = {
        width: Math.ceil(
          Math.min(maxWidth, panel.offsetWidth + OUTER_PADDING * 2),
        ),
        height: Math.ceil(
          Math.min(maxHeight, panel.offsetHeight + OUTER_PADDING * 2),
        ),
      };
      if (size.width !== lastSize.current.width)
        OBR.popover.setWidth(CAROUSEL_POPOVER_ID, size.width);
      if (size.height !== lastSize.current.height)
        OBR.popover.setHeight(CAROUSEL_POPOVER_ID, size.height);
      lastSize.current = size;
      updateOverflow();
    };
    const observer = new ResizeObserver(measure);
    observer.observe(track);
    observer.observe(panel);
    measure();
    return () => observer.disconnect();
  }, [maxWidth, maxHeight, maxTokens, vertical, viewport.width]);

  // Fade the end of the list when there are more tokens to scroll to
  const updateOverflow = () => {
    const scroll = scrollRef.current;
    if (!scroll) return;
    const position = vertical ? scroll.scrollTop : scroll.scrollLeft;
    const hidden = vertical
      ? scroll.scrollHeight - scroll.clientHeight
      : scroll.scrollWidth - scroll.clientWidth;
    const start = position > 1;
    const end = position < hidden - 1;
    setOverflow((previous) =>
      previous.start === start && previous.end === end
        ? previous
        : { start, end },
    );
  };

  // The order rotates with the turn: jump back to the start of it
  const activeKey = [...activeIds].join(",");
  useEffect(() => {
    scrollRef.current?.scrollTo({ left: 0, top: 0 });
  }, [activeKey]);

  const fade = `${overflow.start ? "transparent 0, black 24px" : "black 0"}, ${
    overflow.end ? "black calc(100% - 32px), transparent 100%" : "black 100%"
  }`;
  const maskImage = `linear-gradient(${vertical ? "to bottom" : "to right"}, ${fade})`;

  // Browsing the order only scrolls this player's view, it never changes the turn
  const dragScroll = useDragScroll(scrollRef, vertical);
  const scrollBy = (direction: 1 | -1) => {
    const scroll = scrollRef.current;
    if (!scroll) return;
    const page = (vertical ? scroll.clientHeight : scroll.clientWidth) * 0.8;
    scroll.scrollBy(
      vertical ? { top: direction * page } : { left: direction * page },
    );
  };
  const scrollButtons = (["start", "end"] as const).map(
    (edge) =>
      overflow[edge] && (
        <button
          key={edge}
          title={edge === "start" ? "Scroll back" : "Scroll ahead"}
          onClick={() => scrollBy(edge === "start" ? -1 : 1)}
          className={cn(
            "absolute grid place-items-center rounded-full bg-[#1e202c]/90 text-white/80 ring-1 ring-white/20 hover:text-white",
            vertical
              ? {
                  "left-1/2 top-0 -translate-x-1/2": edge === "start",
                  "bottom-0 left-1/2 -translate-x-1/2": edge === "end",
                }
              : {
                  "left-0 top-1/2 -translate-y-1/2": edge === "start",
                  "right-0 top-1/2 -translate-y-1/2": edge === "end",
                },
          )}
          style={{ width: 22, height: 22 }}
        >
          {edge === "start" ? (
            <ChevronLeftRoundedIcon
              sx={{ fontSize: 18, rotate: vertical ? "90deg" : "0deg" }}
            />
          ) : (
            <ChevronRightRoundedIcon
              sx={{ fontSize: 18, rotate: vertical ? "90deg" : "0deg" }}
            />
          )}
        </button>
      ),
  );

  const previousButton = showTurnControls && (
    <IconButton
      size="small"
      title="Previous turn"
      sx={{ color: "inherit" }}
      onClick={() => advanceTurn(false)}
    >
      <SkipPreviousRoundedIcon fontSize="small" />
    </IconButton>
  );
  const nextButton = showTurnControls && (
    <IconButton
      size="small"
      title="Next turn"
      sx={{ color: "inherit" }}
      onClick={() => advanceTurn(true)}
    >
      <SkipNextRoundedIcon fontSize="small" />
    </IconButton>
  );
  const round = showRound && (
    <div className="flex shrink-0 flex-col items-center px-1 leading-none">
      <span className="text-[9px] uppercase tracking-wider text-white/60">
        Round
      </span>
      <span className="text-lg font-bold">{roundCount}</span>
    </div>
  );

  const track = (
    <div
      ref={trackRef}
      className={cn("relative flex w-max gap-1.5", {
        "items-start": !vertical,
        "flex-col items-stretch": vertical,
      })}
      style={{
        padding: TRACK_PADDING,
        // Room for the current turn's card at all times, so the bar keeps
        // its height while the turn moves
        minHeight: vertical ? undefined : activeHeight + 4 + TRACK_PADDING * 2,
      }}
    >
      {entries.map((entry) => {
        if (entry.kind === "slot") {
          const isActive = entry.slot.some((item) => activeIds.has(item.id));
          return (
            <SlotView
              key={entry.key}
              slot={entry.slot}
              tokensThrough={entry.tokenCount}
              height={isActive ? activeHeight : waitingHeight}
              isActive={isActive}
              isPrevious={entry.isPrevious}
              isNext={
                !collapsed && entry.slot.some((item) => nextIds.has(item.id))
              }
              zipper={zipper}
              showName={showNames}
            />
          );
        }
        return (
          <Divider
            key={entry.key}
            label={entry.kind === "round" ? entry.label : entry.name}
            round={entry.kind === "round"}
            vertical={vertical}
            length={waitingHeight}
          />
        );
      })}
    </div>
  );

  return (
    <div
      className={cn("flex h-full", {
        "items-start justify-center": !vertical,
        "items-center justify-start": preferences.carouselPosition === "LEFT",
        "items-center justify-end": preferences.carouselPosition === "RIGHT",
      })}
      style={{ padding: OUTER_PADDING }}
    >
      <div
        ref={panelRef}
        className={cn(
          "flex w-max flex-col rounded-2xl bg-[#1e202c]/90 text-white shadow-lg ring-1 ring-white/10",
          {
            "px-1.5 py-0.5": !vertical,
            "p-1": vertical,
          },
        )}
      >
        {vertical ? (
          <>
            {round && <div className="flex justify-center">{round}</div>}
            <div className="relative">
              <div
                ref={scrollRef}
                className="carousel-scroll overflow-y-auto overflow-x-hidden"
                style={{
                  height: extent,
                  maskImage,
                  WebkitMaskImage: maskImage,
                }}
                onScroll={updateOverflow}
                {...dragScroll}
              >
                {track}
              </div>
              {scrollButtons}
            </div>
            {showTurnControls && (
              <div className="flex justify-center gap-1">
                {previousButton}
                {nextButton}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="flex items-center gap-0.5">
              {previousButton}
              {round}
              <div className="relative">
                <div
                  ref={scrollRef}
                  className="carousel-scroll overflow-x-auto overflow-y-hidden"
                  style={{
                    width: extent,
                    maskImage,
                    WebkitMaskImage: maskImage,
                  }}
                  onScroll={updateOverflow}
                  onWheel={(e) => {
                    if (
                      scrollRef.current &&
                      Math.abs(e.deltaY) > Math.abs(e.deltaX)
                    )
                      scrollRef.current.scrollLeft += e.deltaY;
                  }}
                  {...dragScroll}
                >
                  {track}
                </div>
                {scrollButtons}
              </div>
              {nextButton}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Let mouse users drag the list to scroll it. Touch already scrolls natively.
 * A drag doesn't count as a click, so it won't move the camera.
 */
function useDragScroll(
  scrollRef: React.RefObject<HTMLDivElement>,
  vertical: boolean,
) {
  const drag = useRef<{ start: number; scroll: number; moved: boolean }>();
  return {
    onPointerDown: (e: React.PointerEvent) => {
      const scroll = scrollRef.current;
      if (!scroll || e.pointerType !== "mouse" || e.button !== 0) return;
      drag.current = {
        start: vertical ? e.clientY : e.clientX,
        scroll: vertical ? scroll.scrollTop : scroll.scrollLeft,
        moved: false,
      };
    },
    onPointerMove: (e: React.PointerEvent) => {
      const scroll = scrollRef.current;
      if (!scroll || !drag.current) return;
      const distance = (vertical ? e.clientY : e.clientX) - drag.current.start;
      if (!drag.current.moved && Math.abs(distance) < 5) return;
      if (!drag.current.moved) scroll.setPointerCapture(e.pointerId);
      drag.current.moved = true;
      if (vertical) scroll.scrollTop = drag.current.scroll - distance;
      else scroll.scrollLeft = drag.current.scroll - distance;
    },
    onPointerUp: () => {
      // Clear after the click event that follows has been suppressed
      setTimeout(() => (drag.current = undefined));
    },
    onClickCapture: (e: React.MouseEvent) => {
      if (drag.current?.moved) e.stopPropagation();
    },
  };
}

/** A group name or new round marker between cards. */
function Divider({
  label,
  round,
  vertical,
  length,
}: {
  label: string;
  round: boolean;
  vertical: boolean;
  length: number;
}) {
  const color = round ? "text-[#f5c542]/80" : "text-white/60";
  if (vertical)
    return (
      <div
        className={cn(
          "flex items-center gap-1 text-[9px] uppercase tracking-wider",
          color,
        )}
      >
        {round && <LoopRoundedIcon sx={{ fontSize: 11 }} />}
        <span className="max-w-32 truncate">{label}</span>
        <div className="h-px flex-1 bg-current opacity-40" />
      </div>
    );
  return (
    <div
      className={cn("flex shrink-0 items-center gap-0.5 self-stretch", color)}
      title={label}
    >
      <div className="w-px self-stretch bg-current opacity-40" />
      <span
        className="rotate-180 truncate text-[9px] uppercase leading-none tracking-wider"
        style={{ writingMode: "vertical-rl", maxHeight: length }}
      >
        {label}
      </span>
      {round && <LoopRoundedIcon sx={{ fontSize: 11 }} />}
    </div>
  );
}

type SlotViewProps = {
  slot: TurnSlot;
  tokensThrough: number;
  height: number;
  isActive: boolean;
  isPrevious: boolean;
  isNext: boolean;
  zipper: boolean;
  showName: boolean;
};

/** One turn: a single card, or a stack of cards sharing the turn. */
function SlotView({
  slot,
  tokensThrough,
  height,
  isActive,
  isPrevious,
  isNext,
  zipper,
  showName,
}: SlotViewProps) {
  const width = Math.round(height * CARD_ASPECT);
  const label = slotLabel(slot);

  return (
    <div
      data-tokens-through={tokensThrough}
      className={cn("flex shrink-0 items-center gap-2", {
        "pr-1": showName,
        "opacity-55": isPrevious,
      })}
    >
      <div
        className={cn("relative flex shrink-0 rounded-lg p-[2px]", {
          "bg-[#f5c542] shadow-[0_0_16px_rgba(245,197,66,0.6)]": isActive,
          "bg-[#7ab8ff]": isNext && !isActive,
          "bg-white/20": !isActive && !isNext,
        })}
        title={slot.length > 1 ? `${label} (shared turn)` : label}
      >
        {slot.map((item, index) => (
          <Card
            key={item.id}
            item={item}
            width={width}
            height={height}
            overlap={index > 0 ? width * SHARED_OVERLAP : 0}
            showName={isActive && !showName && slot.length === 1}
            isDone={zipper && !item.ready && !item.active}
          />
        ))}
        {isNext && !isActive && (
          <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 rounded bg-[#7ab8ff] px-1 text-[8px] font-bold leading-tight text-black">
            NEXT
          </span>
        )}
        {slot.length > 1 && (
          <span className="absolute -right-1.5 -top-1.5 rounded-full bg-[#1e202c] px-1 text-[9px] font-bold leading-tight ring-1 ring-white/30">
            ×{slot.length}
          </span>
        )}
      </div>
      {showName && (
        <span
          className={cn("max-w-32 truncate text-xs", {
            "font-semibold text-[#f5c542]": isActive,
            "text-[#7ab8ff]": isNext && !isActive,
            "text-white/80": !isActive && !isNext,
          })}
        >
          {label}
        </span>
      )}
    </div>
  );
}

function Card({
  item,
  width,
  height,
  overlap,
  showName,
  isDone,
}: {
  item: InitiativeItem;
  width: number;
  height: number;
  overlap: number;
  showName: boolean;
  isDone: boolean;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => setImageFailed(false), [item.url]);

  return (
    <button
      title={item.name}
      onClick={() => panToItem(item.id)}
      className={cn(
        "relative grid shrink-0 place-items-center overflow-hidden rounded-md bg-gradient-to-b from-[#3a3e52] to-[#20222e] shadow-[0_0_0_1px_rgba(0,0,0,0.6)] hover:brightness-125",
        { "opacity-40 grayscale": isDone, "opacity-60": !item.visible },
      )}
      style={{ width, height, marginLeft: -overlap }}
    >
      {imageFailed ? (
        <span className="text-sm font-semibold">
          {item.name.slice(0, 2).toUpperCase()}
        </span>
      ) : (
        <img
          className="size-full object-cover"
          src={item.url}
          alt={item.name}
          draggable={false}
          onError={() => setImageFailed(true)}
        />
      )}
      {showName && width >= 40 && (
        <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/85 to-transparent px-1 pb-0.5 pt-3 text-left text-[10px] font-semibold">
          {item.name}
        </span>
      )}
      {!item.visible && (
        <VisibilityOffRounded
          className="absolute right-0.5 top-0.5 rounded-full bg-[#1e202c] p-0.5"
          sx={{ fontSize: 14 }}
        />
      )}
    </button>
  );
}

/** "Goblin ×3" for identical names, otherwise the names joined. */
function slotLabel(slot: InitiativeItem[]) {
  const names = slot.map((item) => item.name);
  if (names.length > 1 && names.every((name) => name === names[0]))
    return `${names[0]} ×${names.length}`;
  return names.join(", ");
}
