import { cinematicProfile } from './cinematic-profiles.js';
// Compatibility URLs resolve through the same themed cinematic profiles.
export const TRANSITION_ART = Object.freeze({
  retreat:cinematicProfile('retreat').art,
  door:cinematicProfile('door').art,
  altar:cinematicProfile('altar').art,
  shop:cinematicProfile('shop').art,
  emergencyExit:cinematicProfile('emergencyExit').art,
  event:cinematicProfile('event').art,
  loading:cinematicProfile('loading').art,
});
