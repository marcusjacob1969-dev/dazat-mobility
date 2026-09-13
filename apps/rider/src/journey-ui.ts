import { presentCoreJourneyForSurface, type JourneyUiPresentation } from '@dazat/design-system';

export function presentRiderJourney(input: {
  nextAction: string;
  interruptionReason?: string | null;
  journeyStatus?: string | null;
}): JourneyUiPresentation {
  return presentCoreJourneyForSurface({ ...input, surface: 'RIDER' });
}
