import ListItem from "@mui/material/ListItem";
import Input from "@mui/material/Input";
import ListItemIcon from "@mui/material/ListItemIcon";
import CloseIcon from "@mui/icons-material/Close";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import VisibilityOffRounded from "@mui/icons-material/VisibilityOffRounded";

import OBR from "@owlbear-rodeo/sdk";

import { InitiativeItem } from "../components/InitiativeItem";
import { IconButton } from "@mui/material";
import { Box } from "@mui/system";
import { useState } from "react";
import { getPluginId } from "../helpers/getPluginId";
import TokenImage from "../components/TokenImage";
import { focusItem } from "../helpers/findItem";
import { cn } from "../helpers/utils";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type InitiativeListItemProps = {
  item: InitiativeItem;
  onCountChange: (count: string) => void;
  showHidden: boolean;
  darkMode: boolean;
  selected: boolean;
  edit: boolean;
};

export function InitiativeListItem({
  item,
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
          onClick={() => removeFromInitiative(item.id)}
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
        </Box>
      </Box>
    </ListItem>
  );
}

function removeFromInitiative(itemId: string) {
  OBR.scene.items.getItems([itemId]).then((items) => {
    OBR.scene.items.updateItems(items, (items) => {
      for (const item of items) {
        delete item.metadata[getPluginId("metadata")];
      }
    });
  });
}
