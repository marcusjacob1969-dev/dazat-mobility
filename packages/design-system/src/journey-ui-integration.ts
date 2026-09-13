import { mapCoreJourneyToUiState, type JourneyUiState } from './journey-ui.js';

export type JourneyUiSurface = 'RIDER' | 'DRIVER' | 'CONTROL_ROOM';

export type JourneyUiPresentation = JourneyUiState & {
  surface: JourneyUiSurface;
  operationalHint: string;
};

/**
 * Creates the shared presentation contract consumed by each operational surface.
 * It does not own journey state, permissions, pricing, dispatch or mutations.
 */
export function presentCoreJourneyForSurface(input: {
  surface: JourneyUiSurface;
  nextAction: string;
  interruptionReason?: string | null;
  journeyStatus?: string | null;
}): JourneyUiPresentation {
  const state = mapCoreJourneyToUiState(input);
  const operationalHint = state.phase === 'SUPPORT_REQUIRED'
    ? input.surface === 'CONTROL_ROOM' ? 'Review the active support case.' : 'Use the governed support path.'
    : state.phase === 'IN_JOURNEY'
      ? input.surface === 'DRIVER' ? 'Continue the protected journey.' : 'Safety controls remain available.'
      : state.phase === 'DISPATCHING'
        ? input.surface === 'CONTROL_ROOM' ? 'Monitor eligible-driver dispatch.' : 'Wait for an eligible driver.'
        : state.label;

  return { ...state, surface: input.surface, operationalHint };
}
