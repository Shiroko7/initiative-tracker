import { useEffect, useReducer, useState } from "react";

import { Button, IconButton, Switch, Typography } from "@mui/material";
import { Box } from "@mui/system";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import UndoRoundedIcon from "@mui/icons-material/UndoRounded";

import OBR, { Metadata } from "@owlbear-rodeo/sdk";

import {
  clearInitiative,
  ClearedInitiative,
  forgetClearedInitiative,
  readClearedInitiative,
  undoClearInitiative,
  undoTimeLeft,
} from "../helpers/clearInitiative";
import { removeLabel } from "../helpers/findItem";
import { getPluginId } from "../helpers/getPluginId";
import { IN_COMBAT_METADATA_ID } from "../helpers/metadataHelpers";

const smallButtonSx = {
  minWidth: 0,
  py: 0,
  px: 1,
  fontSize: "0.65rem",
  textTransform: "none",
};

function setInCombat(inCombat: boolean) {
  OBR.scene.setMetadata({
    [getPluginId(IN_COMBAT_METADATA_ID)]: inCombat,
  });
  if (!inCombat) removeLabel();
}

function formatTimeLeft(milliseconds: number) {
  const totalMinutes = Math.ceil(milliseconds / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
}

/** The cleared initiative that can still be undone, if there is one. */
function useClearedInitiative() {
  const [cleared, setCleared] = useState<ClearedInitiative>();
  // The time left is worked out when rendering, so just render again regularly
  const [, rerender] = useReducer((count: number) => count + 1, 0);

  useEffect(() => {
    const handleSceneMetadataChange = (sceneMetadata: Metadata) => {
      setCleared(readClearedInitiative(sceneMetadata));
    };
    OBR.scene.getMetadata().then(handleSceneMetadataChange);
    return OBR.scene.onMetadataChange(handleSceneMetadataChange);
  }, []);

  useEffect(() => {
    if (!cleared) return;
    const interval = setInterval(rerender, 30000);
    return () => clearInterval(interval);
  }, [cleared]);

  const timeLeft = cleared ? undoTimeLeft(cleared) : 0;
  const expired = cleared !== undefined && timeLeft <= 0;

  useEffect(() => {
    if (expired) forgetClearedInitiative();
  }, [expired]);

  return cleared && !expired ? { mode: cleared.mode, timeLeft } : undefined;
}

export function InitiativeToolbar({
  role,
  inCombat,
  hasItems,
  canSetToZero,
}: {
  role: "PLAYER" | "GM";
  inCombat: boolean;
  hasItems: boolean;
  canSetToZero: boolean;
}) {
  if (role !== "GM") return <CombatStatus inCombat={inCombat} sx={{ px: 2 }} />;
  return (
    <GMToolbar
      inCombat={inCombat}
      hasItems={hasItems}
      canSetToZero={canSetToZero}
    />
  );
}

function CombatStatus({
  inCombat,
  sx,
}: {
  inCombat: boolean;
  sx?: Record<string, unknown>;
}) {
  return (
    <Typography
      variant="caption"
      sx={{
        display: "block",
        whiteSpace: "nowrap",
        color: inCombat ? "primary.main" : "text.secondary",
        ...sx,
      }}
    >
      {inCombat ? "In combat" : "Out of combat"}
    </Typography>
  );
}

function GMToolbar({
  inCombat,
  hasItems,
  canSetToZero,
}: {
  inCombat: boolean;
  hasItems: boolean;
  canSetToZero: boolean;
}) {
  const undo = useClearedInitiative();

  return (
    <>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.5,
          pl: 1,
          pr: 1,
          pt: 0.5,
        }}
      >
        <Switch
          size="small"
          checked={inCombat}
          onChange={(_e, value) => setInCombat(value)}
          inputProps={{ "aria-label": "In combat" }}
        />
        <CombatStatus inCombat={inCombat} sx={{ flex: 1 }} />
        {hasItems && canSetToZero && (
          <Button
            size="small"
            variant="outlined"
            sx={smallButtonSx}
            title="Set every token's initiative to 0"
            onClick={() => clearInitiative("ZERO")}
          >
            Set all to 0
          </Button>
        )}
        {hasItems && (
          <Button
            size="small"
            variant="outlined"
            sx={smallButtonSx}
            title="Remove every token from initiative"
            onClick={() => clearInitiative("REMOVE")}
          >
            Remove all
          </Button>
        )}
      </Box>

      {undo && (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 0.5,
            pl: 2,
            pr: 1,
          }}
        >
          <Typography
            variant="caption"
            sx={{ color: "text.secondary", flex: 1 }}
          >
            {undo.mode === "ZERO" ? "All set to 0" : "All removed"} ·{" "}
            {formatTimeLeft(undo.timeLeft)} to undo
          </Typography>
          <Button
            size="small"
            sx={smallButtonSx}
            startIcon={<UndoRoundedIcon fontSize="small" />}
            onClick={undoClearInitiative}
          >
            Undo
          </Button>
          <IconButton
            size="small"
            onClick={forgetClearedInitiative}
            title="Dismiss"
          >
            <CloseRoundedIcon fontSize="small" />
          </IconButton>
        </Box>
      )}
    </>
  );
}
