import { presentCoreJourneyForSurface, type JourneyUiPresentation } from '@dazat/design-system';

export function presentControlRoomJourney(input: {
  nextAction: string;
  interruptionReason?: string | null;
  journeyStatus?: string | null;
}): JourneyUiPresentation {
  return presentCoreJourneyForSurface({ ...input, surface: 'CONTROL_ROOM' });
}
