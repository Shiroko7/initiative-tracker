/*
  # Round Message Protocol

  This file describes messages describes ways that Pretty Sordid and Draw Steel Tools can be controlled using the Owlbear Rodeo Broadcast API.

  Destination for the broadcast API should always be set to "LOCAL", this is not the default.
*/

/*
  Pretty Sordid will emit a round change event message containing a round number or null value when the initiative loops over or is reset, depending on the Initiative Style setting. Null represents the round counter being disabled.

  Draw Steel Tools will open a popover to handle this event unless that behaviour has been disabled by the user in settings. The round number will be saved to local storage so it can be used by Draw Steel Tools either way.
*/
export const ROUND_CHANGE_EVENT_CHANNEL = "general.initiative.roundChange";
export type RoundChangeData = { roundNumber: number | null };

/*
  Draw Steel Tools will emit a set round message when the round is changed by the malice calculator. This is rebroadcast as a round change event by Pretty Sordid to sync any other extensions. Other tools that can edit the round may be added in the future and these will also emit set round messages.
*/
export const SET_ROUND_CHANNEL = "general.initiative.setRound";
export type SetRoundData = { roundNumber: number };
