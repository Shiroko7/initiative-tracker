import { IconButton } from "@mui/material";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import { openPlayerPreferences } from "../helpers/playerPreferences";

export default function PreferencesButton({
  size,
}: {
  size?: "small" | "medium";
}): JSX.Element {
  return (
    <IconButton
      size={size}
      title="My display preferences"
      sx={{ color: "inherit" }}
      onClick={openPlayerPreferences}
    >
      <TuneRoundedIcon fontSize={size} />
    </IconButton>
  );
}
