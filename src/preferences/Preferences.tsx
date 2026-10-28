import {
  Button,
  Divider,
  MenuItem,
  Select,
  Slider,
  Switch,
  Typography,
} from "@mui/material";
import { useTheme } from "@mui/material";
import OBR from "@owlbear-rodeo/sdk";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import IconButton from "@mui/material/IconButton";

import "../tailwind.css";
import addThemeToBody from "../helpers/addThemeToBody";
import { getPluginId } from "../helpers/getPluginId";
import {
  CarouselPosition,
  DEFAULT_PLAYER_PREFERENCES,
  PlayerPreferences,
  PREFERENCE_LIMITS,
  usePlayerPreferences,
  writePlayerPreferences,
} from "../helpers/playerPreferences";
import { SettingsRow, SubSettingsRow } from "../settings/SettingsRows";

export default function Preferences(): JSX.Element {
  const preferences = usePlayerPreferences();
  addThemeToBody(useTheme().palette.mode);

  return (
    <div className="h-full w-full rounded-2xl bg-gray-200/20 py-2 pr-0.5 text-black/[0.87] outline -outline-offset-2 outline-secondary dark:bg-gray-800 dark:text-white dark:outline-secondary-dark">
      <div className="h-full overflow-y-auto p-4 pr-1.5 pt-0">
        <div className="flex items-center justify-between gap-2 pb-2 pt-2">
          <div>
            <h1 className="text-2xl font-light">Display</h1>
            <p className="text-xs text-gray-400">
              <i>Only affects what you see, on this device</i>
            </p>
          </div>
          <IconButton
            title="Close"
            sx={{ color: "inherit" }}
            onClick={() => OBR.popover.close(getPluginId("preferences"))}
          >
            <CloseRoundedIcon />
          </IconButton>
        </div>
        <Divider />

        <div className="mb-1 mt-4">
          <Typography>Turn Carousel</Typography>
        </div>
        <div className="flex flex-col gap-2">
          <SettingsRow
            label="Show Carousel"
            description="Show the turn order on screen"
            action={
              <Switch
                color="secondary"
                checked={preferences.carouselEnabled}
                onChange={(_e, value) =>
                  writePlayerPreferences({ carouselEnabled: value })
                }
              />
            }
            last={preferences.carouselEnabled}
          >
            <SubSettingsRow
              label="Position"
              description="Or drag the carousel by its handle to float it anywhere"
              action={
                <Select
                  color="secondary"
                  value={preferences.carouselPosition}
                  onChange={(e) =>
                    writePlayerPreferences({
                      carouselPosition: e.target.value as CarouselPosition,
                    })
                  }
                  sx={{ height: 36, borderRadius: "6px" }}
                >
                  <MenuItem value="TOP">Top</MenuItem>
                  <MenuItem value="BOTTOM">Bottom</MenuItem>
                  <MenuItem value="LEFT">Left</MenuItem>
                  <MenuItem value="RIGHT">Right</MenuItem>
                  <MenuItem value="FLOATING">Floating</MenuItem>
                </Select>
              }
              collapseElement={!preferences.carouselEnabled}
            />
            <SubSettingsRow
              label="Vertical List"
              description="Show the floating carousel as a scrolling list"
              action={
                <Switch
                  color="secondary"
                  checked={preferences.carouselFloatingVertical}
                  onChange={(_e, value) =>
                    writePlayerPreferences({ carouselFloatingVertical: value })
                  }
                />
              }
              collapseElement={
                !preferences.carouselEnabled ||
                preferences.carouselPosition !== "FLOATING"
              }
            />
            <SubSettingsRow
              label="Visible Tokens"
              description={`Show ${preferences.carouselMaxTokens} at a time, scroll for the rest`}
              action={
                <PreferenceSlider
                  name="carouselMaxTokens"
                  value={preferences.carouselMaxTokens}
                />
              }
              collapseElement={!preferences.carouselEnabled}
            />
            <SubSettingsRow
              label="Current Turn Size"
              description={`The active card is ${preferences.carouselCardSize}px tall`}
              action={
                <PreferenceSlider
                  name="carouselCardSize"
                  value={preferences.carouselCardSize}
                  unit="px"
                />
              }
              collapseElement={!preferences.carouselEnabled}
            />
            <SubSettingsRow
              label="Waiting Size"
              description={`Other cards are ${preferences.carouselWaitingSize}% of the active card`}
              action={
                <PreferenceSlider
                  name="carouselWaitingSize"
                  value={preferences.carouselWaitingSize}
                  unit="%"
                />
              }
              collapseElement={!preferences.carouselEnabled}
            />
            <SubSettingsRow
              label="Current Turn Only"
              description="Hide everyone except whoever has the turn"
              action={
                <Switch
                  color="secondary"
                  checked={preferences.carouselCollapsed}
                  onChange={(_e, value) =>
                    writePlayerPreferences({ carouselCollapsed: value })
                  }
                />
              }
              collapseElement={!preferences.carouselEnabled}
            />
            <SubSettingsRow
              label="Show Names"
              description="Names beside portraits in the side list"
              action={
                <Switch
                  color="secondary"
                  checked={preferences.carouselShowNames}
                  onChange={(_e, value) =>
                    writePlayerPreferences({ carouselShowNames: value })
                  }
                />
              }
              collapseElement={!preferences.carouselEnabled}
              last
            />
          </SettingsRow>
        </div>

        <div className="mb-1 mt-4">
          <Typography>Turn Changes</Typography>
        </div>
        <div className="flex flex-col gap-2">
          <SettingsRow
            label="Camera Follow"
            description="Move your camera to whoever has the turn"
            action={
              <Switch
                color="secondary"
                checked={preferences.cameraFollow}
                onChange={(_e, value) =>
                  writePlayerPreferences({ cameraFollow: value })
                }
              />
            }
          />
          <SettingsRow
            label="Current Turn Marker"
            description="Ring under the tokens whose turn it is"
            action={
              <Switch
                color="secondary"
                checked={preferences.currentTurnMarker}
                onChange={(_e, value) =>
                  writePlayerPreferences({ currentTurnMarker: value })
                }
              />
            }
          />
          <SettingsRow
            label="Up Next Marker"
            description="Ring under the tokens that go next"
            action={
              <Switch
                color="secondary"
                checked={preferences.nextTurnMarker}
                onChange={(_e, value) =>
                  writePlayerPreferences({ nextTurnMarker: value })
                }
              />
            }
          />
          <SettingsRow
            label="Marker Labels"
            description="Text label above each turn marker"
            action={
              <Switch
                color="secondary"
                checked={preferences.markerLabels}
                onChange={(_e, value) =>
                  writePlayerPreferences({ markerLabels: value })
                }
              />
            }
          />
        </div>

        <div className="mt-4 flex justify-end">
          <Button
            color="secondary"
            variant="outlined"
            size="small"
            onClick={() => writePlayerPreferences(DEFAULT_PLAYER_PREFERENCES)}
          >
            Reset to Defaults
          </Button>
        </div>
      </div>
    </div>
  );
}

function PreferenceSlider({
  name,
  value,
  unit = "",
}: {
  name: keyof typeof PREFERENCE_LIMITS;
  value: number;
  unit?: string;
}): JSX.Element {
  return (
    <Slider
      color="secondary"
      size="small"
      min={PREFERENCE_LIMITS[name].min}
      max={PREFERENCE_LIMITS[name].max}
      value={value}
      valueLabelDisplay="auto"
      valueLabelFormat={(value) => `${value}${unit}`}
      onChange={(_e, value) =>
        writePlayerPreferences({
          [name]: value as number,
        } satisfies Partial<PlayerPreferences>)
      }
      sx={{ width: 120, mr: 1 }}
    />
  );
}
