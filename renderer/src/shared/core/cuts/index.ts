// Re-export legacy core (1:1) for React UI.
// Keep the JS files untouched; later we can split/refactor safely behind this barrel.

export {
  calculateCuts,
  normalizeOrders,
  bestPatternForL,
  capLeftoverDonors,
  capOgonekDonors,
} from "./calc.js";

export { inferTypeKey, pickTypeCandidateFromRow } from "./type.js";
