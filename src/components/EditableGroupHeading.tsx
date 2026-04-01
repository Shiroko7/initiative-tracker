import { useEffect, useState } from "react";
import { Button, Divider, IconButton, TextField, Typography } from "@mui/material";
import { Box } from "@mui/system";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import EditNoteRoundedIcon from "@mui/icons-material/EditNoteRounded";
import CallMergeRoundedIcon from "@mui/icons-material/CallMergeRounded";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import { InitiativeGroup } from "../helpers/metadataHelpers";

export type EditableGroupHeadingProps = {
  groupName: string;
  groupId: number;
  editMode: boolean;
  onRename: (id: number, name: string) => void;
  onDelete?: () => void;
  onMerge?: (targetId: number) => void;
  otherGroups?: InitiativeGroup[];
  // Listeners from useSortable — applied to the drag handle
  dragHandleListeners?: Record<string, unknown>;
};

export function EditableGroupHeading({
  groupName,
  groupId,
  editMode,
  onRename,
  onDelete,
  onMerge,
  otherGroups,
  dragHandleListeners,
}: EditableGroupHeadingProps) {
  const [editing, setEditing] = useState(false);
  const [merging, setMerging] = useState(false);
  const [nameInput, setNameInput] = useState(groupName);

  useEffect(() => {
    setNameInput(groupName);
  }, [groupName]);

  useEffect(() => {
    if (!editMode) setMerging(false);
  }, [editMode]);

  const handleCommit = () => {
    const trimmed = nameInput.trim();
    if (trimmed && trimmed !== groupName) onRename(groupId, trimmed);
    else setNameInput(groupName);
    setEditing(false);
  };

  const showDragHandle =
    editMode && dragHandleListeners && Object.keys(dragHandleListeners).length > 0;

  return (
    <div
      style={{
        minHeight: 46,
        display: "flex",
        flexDirection: "column",
        justifyContent: "end",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          paddingLeft: showDragHandle ? 4 : 16,
          paddingRight: 4,
          paddingBottom: 2,
          minHeight: 32,
          gap: 4,
        }}
      >
        {/* Drag handle — only visible in edit mode */}
        {showDragHandle && (
          <button
            style={{
              touchAction: "none",
              background: "transparent",
              border: "none",
              padding: "0 2px",
              cursor: "grab",
              display: "flex",
              alignItems: "center",
              color: "inherit",
              opacity: 0.4,
            }}
            {...(dragHandleListeners as React.HTMLAttributes<HTMLButtonElement>)}
          >
            <DragIndicatorIcon fontSize="small" />
          </button>
        )}

        {merging ? (
          <>
            <Typography
              variant="caption"
              sx={{ color: "text.secondary", whiteSpace: "nowrap" }}
            >
              Merge into:
            </Typography>
            {otherGroups?.map((g) => (
              <Button
                key={g.id}
                size="small"
                variant="outlined"
                sx={{
                  minWidth: 0,
                  py: 0,
                  px: 1,
                  fontSize: "0.65rem",
                  textTransform: "none",
                }}
                onClick={() => {
                  onMerge?.(g.id);
                  setMerging(false);
                }}
              >
                {g.name}
              </Button>
            ))}
            <IconButton size="small" onClick={() => setMerging(false)} title="Cancel">
              <CloseRoundedIcon fontSize="small" />
            </IconButton>
          </>
        ) : editing ? (
          <TextField
            autoFocus
            variant="standard"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onBlur={handleCommit}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCommit();
              if (e.key === "Escape") {
                setNameInput(groupName);
                setEditing(false);
              }
            }}
            inputProps={{
              style: {
                fontSize: "0.75rem",
                textTransform: "uppercase",
                letterSpacing: "0.08333em",
                padding: 0,
              },
            }}
            sx={{ flex: 1 }}
            size="small"
          />
        ) : (
          <>
            <Typography
              variant="overline"
              sx={{ color: "text.secondary", lineHeight: 1, flex: 1 }}
            >
              {groupName}
            </Typography>

            {editMode && (
              <Box sx={{ display: "flex" }}>
                <IconButton
                  size="small"
                  onClick={() => setEditing(true)}
                  title="Rename group"
                >
                  <EditNoteRoundedIcon fontSize="small" />
                </IconButton>
                {onMerge && otherGroups && otherGroups.length > 0 && (
                  <IconButton
                    size="small"
                    onClick={() => setMerging(true)}
                    title="Merge group"
                  >
                    <CallMergeRoundedIcon fontSize="small" />
                  </IconButton>
                )}
                {onDelete && (
                  <IconButton size="small" onClick={onDelete} title="Delete group">
                    <CloseRoundedIcon fontSize="small" />
                  </IconButton>
                )}
              </Box>
            )}
          </>
        )}
      </div>
      <Divider variant="fullWidth" />
    </div>
  );
}
