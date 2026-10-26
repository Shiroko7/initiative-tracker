import ListItem from "@mui/material/ListItem";
import Input from "@mui/material/Input";
import ListItemIcon from "@mui/material/ListItemIcon";
import CloseIcon from "@mui/icons-material/Close";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import VisibilityOffRounded from "@mui/icons-material/VisibilityOffRounded";
import LinkOffRoundedIcon from "@mui/icons-material/LinkOffRounded";

import { InitiativeItem } from "../components/InitiativeItem";
import { IconButton } from "@mui/material";
import { Box } from "@mui/system";
import { useState } from "react";
import TokenImage from "../components/TokenImage";
import { focusItem } from "../helpers/findItem";
import { cn } from "../helpers/utils";
import { removeFromInitiative, unlinkTurn } from "../helpers/linkedTurns";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type InitiativeListItemProps = {
  item: InitiativeItem;
  /** Tokens taking this token's turn along with it */
  linkedItems: InitiativeItem[];
  onCountChange: (count: string) => void;
  showHidden: boolean;
  darkMode: boolean;
  selected: boolean;
  edit: boolean;
};

export function InitiativeListItem({
  item,
  linkedItems,
  onCountChange,
  showHidden,
  darkMode,
  selected,
  edit,
}: InitiativeListItemProps) {
  const [inputHasFocus, setInputHasFocus] = useState(false);
  const [inputHasHover, setInputHasHover] = useState(false);

  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: item.id });

  if (!item.visible && !showHidden) {
    return null;
  }

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const shownLinkedItems = linkedItems.filter(
    (linked) => linked.visible || showHidden,
  );

  const handleFocus = (target: HTMLInputElement) => {
    target.select();
  };

  return (
    <ListItem
      ref={setNodeRef}
      style={{ ...style, cursor: "pointer" }}
      {...attributes}
      key={item.id}
      secondaryAction={
        edit ? (
          <button
            style={{ touchAction: "none" }}
            {...listeners}
            className="flex size-[42px] items-center justify-center bg-transparent"
          >
            <DragIndicatorIcon />
          </button>
        ) : (
          <Input
            disableUnderline
            sx={{ width: 48 }}
            onFocus={(evt) => {
              setInputHasFocus(true);
              handleFocus(evt.target as HTMLInputElement);
            }}
            onBlur={() => setInputHasFocus(false)}
            onMouseEnter={() => setInputHasHover(true)}
            onMouseLeave={() => setInputHasHover(false)}
            inputProps={{
              sx: { textAlign: "center", pt: "5px" },
              style: {
                borderRadius: 8,
                backgroundColor: inputHasFocus
                  ? darkMode
                    ? "rgba(0,0,0,0.4)"
                    : "rgba(255,255,255,0.24)"
                  : inputHasHover
                    ? darkMode
                      ? "rgba(0,0,0,0.15)"
                      : "rgba(255,255,255,0.12)"
                    : "rgba(0,0,0,0)",
                transition: ".1s",
              },
            }}
            value={item.count}
            onChange={(e) => onCountChange(e.target.value)}
            onDoubleClick={(e) => e.stopPropagation()}
          />
        )
      }
      divider
      selected={item.active}
      sx={{ padding: 1, pl: "12px", pr: "64px" }}
      onDoubleClick={() => focusItem(item.id)}
    >
      <Box
        component={"div"}
        className={cn("grid grid-cols-[30px_1fr] items-center gap-2", {
          "grid-cols-[30px_20px_1fr]": !item.visible && showHidden,
        })}
      >
        <IconButton
          sx={{ paddingX: 0, paddingY: 0, height: 30, width: 30 }}
          onClick={() => removeFromInitiative([item.id])}
          tabIndex={-1}
          onDoubleClick={(e) => e.stopPropagation()}
        >
          <div className="group grid place-items-center">
            <div className="col-start-1 row-start-1 group-hover:opacity-0">
              <TokenImage src={item.url} outline={selected} />
            </div>
            <CloseIcon
              className="col-start-1 row-start-1 opacity-0 group-hover:opacity-100"
              sx={{ height: 30, width: 30 }}
            />
          </div>
        </IconButton>

        {!item.visible && showHidden && (
          <ListItemIcon sx={{ minWidth: "20px", opacity: "0.5" }}>
            <VisibilityOffRounded fontSize="small" />
          </ListItemIcon>
        )}
        <Box
          component="div"
          sx={{
            color: !item.visible && showHidden ? "text.disabled" : "text.primary",
            pb: "2px",
          }}
        >
          {item.name}
          {shownLinkedItems.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {shownLinkedItems.map((linked) => (
                <button
                  key={linked.id}
                  title={`${linked.name} (click to give its own turn)`}
                  className={cn(
                    "group grid size-6 place-items-center rounded bg-transparent p-0",
                    { "opacity-50": !linked.visible },
                  )}
                  tabIndex={-1}
                  onClick={(e) => {
                    e.stopPropagation();
                    unlinkTurn([linked.id]);
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    focusItem(linked.id);
                  }}
                >
                  <img
                    className="col-start-1 row-start-1 size-6 object-scale-down group-hover:opacity-0"
                    src={linked.url}
                  />
                  <LinkOffRoundedIcon
                    className="col-start-1 row-start-1 opacity-0 group-hover:opacity-100"
                    sx={{ height: 20, width: 20 }}
                  />
                </button>
              ))}
            </div>
          )}
        </Box>
      </Box>
    </ListItem>
  );
}
