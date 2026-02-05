import { Button, IconButton, Popover } from "@mui/material";
import { updateRoundCount } from "../helpers/metadataHelpers";
import React from "react";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import OBR from "@owlbear-rodeo/sdk";
import { broadcastRoundChangeEventMessage } from "../helpers/broadcastRoundImplementation";

export function RoundControl({
  roundCount,
  setRoundCount,
  playerRole,
  disableNotifications,
}: {
  roundCount: number;
  setRoundCount: (value: React.SetStateAction<number>) => void;
  playerRole: "PLAYER" | "GM";
  disableNotifications: boolean;
}) {
  const [anchorEl, setAnchorEl] = React.useState<HTMLButtonElement | null>(
    null,
  );

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const open = Boolean(anchorEl);
  const id = open ? "simple-popover" : undefined;

  return (
    <>
      <Button
        color="primary"
        sx={{ pl: 1, pr: 1, pb: 0.4, borderRadius: 9999 }}
        disabled={playerRole === "PLAYER"}
        onClick={handleClick}
      >
        Round {roundCount}
      </Button>
      <Popover
        id={id}
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: "top",
          horizontal: "center",
        }}
        transformOrigin={{ vertical: "bottom", horizontal: "center" }}
        slotProps={{ paper: { sx: { borderRadius: 9999 } } }}
      >
        <div className="flex items-stretch gap-2 p-1">
          <IconButton
            aria-label="previous"
            onClick={() => {
              const newRoundNumber = roundCount > 1 ? roundCount - 1 : 1;
              updateRoundCount(newRoundNumber, setRoundCount);
              broadcastRoundChangeEventMessage(newRoundNumber);
            }}
          >
            <ChevronLeftRoundedIcon />
          </IconButton>
          <Button
            variant="text"
            sx={{ borderRadius: 9999 }}
            disabled={playerRole === "PLAYER"}
            onClick={() => {
              const newRoundNumber = 1;
              updateRoundCount(newRoundNumber, setRoundCount);
              broadcastRoundChangeEventMessage(newRoundNumber);
              if (!disableNotifications)
                OBR.notification.show(
                  "Round counter reset. Use Undo to restore the counter.",
                  "INFO",
                );
            }}
          >
            Reset
          </Button>
          <IconButton
            aria-label="previous"
            onClick={() => {
              const newRoundNumber = roundCount + 1;
              updateRoundCount(newRoundNumber, setRoundCount);
              broadcastRoundChangeEventMessage(newRoundNumber);
            }}
          >
            <ChevronRightRoundedIcon />
          </IconButton>
        </div>
      </Popover>
    </>
  );
}
