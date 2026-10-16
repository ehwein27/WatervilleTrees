// src/lib/utils/itree.js
// i-Tree value calculations — pure functions, no side effects

const COND_MULT = { Good: 1.0, Fair: 0.75, Poor: 0.40, Dead: 0 };

// ── i-Tree STRATUM original coefficients (~2006 national averages) ────────────
export function calcITreeLegacy(dbh, condition) {
  if (!dbh || !condition || condition === 'Dead') return null;
  const d = parseFloat(dbh);
  if (!d || d <= 0) return null;
  const m = COND_MULT[condition] ?? 1.0;
  const carbon    = Math.round(m * 0.04  * Math.pow(d, 2.1));
  const airQual   = Math.round(m * 0.09  * Math.pow(d, 1.85));
  const stormwater= Math.round(m * 0.155 * Math.pow(d, 1.9));
  const energy    = Math.round(m * 0.13  * Math.pow(d, 1.88));
  const total     = carbon + airQual + stormwater + energy;
  return [total, carbon, airQual, stormwater, energy];
}

// ── Updated coefficients — April 2026 ────────────────────────────────────────
// Original coefficients were derived from i-Tree STRATUM (~2006 national
// averages). These updated coefficients reflect:
//
//  Carbon (0.04 → 0.14): EPA 2023 Social Cost of Carbon ($190/ton, up from
//    ~$21/ton in 2006). i-Tree's conservative sequestration model warrants a
//    3.5× multiplier rather than the full ~9× price increase.
//
//  Air quality (0.09 → 0.20): EPA's updated externality values for PM2.5,
//    ozone, NOx, and SO2 have roughly doubled since 2006. Maine's above-average
//    benefit from regional pollution transport (Midwest) justifies a 2.2×
//    multiplier.
//
//  Stormwater (0.155 → 0.25): National stormwater infrastructure costs have
//    risen ~60% since 2006. Maine municipalities face high stormwater costs,
//    supporting a 1.6× multiplier.
//
//  Energy (0.13 → 0.23): Maine electricity rates (~$0.22/kWh) are roughly
//    double the national average (~$0.12/kWh) used in the original STRATUM
//    model. A 1.8× Maine-specific multiplier is applied.
//
// Condition multipliers (Good: 1.0, Fair: 0.75, Poor: 0.40) are unchanged —
// they are structural, not pricing-related.
//
// These remain DBH/condition-only estimates with no species differentiation.
// ─────────────────────────────────────────────────────────────────────────────
export function calcITreeUpdated(dbh, condition) {
  if (!dbh || !condition || condition === 'Dead') return null;
  const d = parseFloat(dbh);
  if (!d || d <= 0) return null;
  const m = COND_MULT[condition] ?? 1.0;
  const carbon    = Math.round(m * 0.14 * Math.pow(d, 2.1));
  const airQual   = Math.round(m * 0.20 * Math.pow(d, 1.85));
  const stormwater= Math.round(m * 0.25 * Math.pow(d, 1.9));
  const energy    = Math.round(m * 0.23 * Math.pow(d, 1.88));
  const total     = carbon + airQual + stormwater + energy;
  return [total, carbon, airQual, stormwater, energy];
}

// Default export — uses updated coefficients so nothing else in the codebase breaks
export function calcITree(dbh, condition) {
  return calcITreeUpdated(dbh, condition);
}

const HIGH_RISK_OBS = new Set([
  'Cavity-stem','Crack-stem','Dead/dying stem','Dieback (severe)',
  'Hanger','Included bark','Seam','Co-dominant stems','Co-dominant stems (2)',
  'Co-dominant stems (4)','Co-dominant stems (11)','Fungi/conks','Rib','Sweep',
  'Overextended branch','Poor branch structure'
]);
const MOD_RISK_OBS = new Set([
  'Cavity-branch','Cavity-suspected','Crack-branch','Dead branches >2',
  'Dieback (moderate)','Girdling roots present (severe)',
  'Girdling roots present (moderate)','Lion tailing','Low live crown ratio',
  'Low vigor','Wound-stem','Wound-root flare','Broken branch(s)',
  'Topping/heading cuts','Sidewalk lifting-major'
]);

// ── Priority Score ─────────────────────────────────────────────────────────────
// A planning and triage score for municipal tree boards. Derived from condition
// and structural observations only. DBH is intentionally excluded — it appears
// as a display column in reports so boards can make their own consequence
// judgments. This is not a formal ISA TRAQ risk assessment.
//
// Scoring is additive internally, then inverted to a 0–100 display scale
// where 100 = no concerns and lower = more urgent attention needed.
// Dead trees should not be passed to this function — handle them separately.

export function priorityScore(tree) {
  if (!tree) return { displayScore: 100, rawScore: 0, factors: [] };

  let raw = 0;
  const factors = [];

  // ── Condition (heaviest factor) ──────────────────────────────────────────────
  if (tree.c === 'Poor') {
    raw += 40;
    factors.push({ txt: 'Condition: Poor', pts: 40 });
  } else if (tree.c === 'Fair') {
    raw += 18;
    factors.push({ txt: 'Condition: Fair', pts: 18 });
  }
  // Good condition adds nothing — tree starts at full health

  // ── Structural observations ───────────────────────────────────────────────────
  // High-risk observations: structural defects with direct failure implications
  let obsRaw = 0;
  (tree.o || []).forEach(o => {
    if (HIGH_RISK_OBS.has(o)) {
      obsRaw += 12;
      factors.push({ txt: o, pts: 12 });
    } else if (MOD_RISK_OBS.has(o)) {
      obsRaw += 6;
      factors.push({ txt: o, pts: 6 });
    }
  });
  // Cap observation contribution at 36 so minor-observation accumulation
  // doesn't overwhelm condition as the primary signal
  const obsContrib = Math.min(obsRaw, 36);
  raw += obsContrib;

  // ── EAB risk ──────────────────────────────────────────────────────────────────
  // Forward-looking flag: ash trees face near-certain mortality without treatment.
  // Lower weight than structural defects since it's a future concern, not present.
  if (isEabRisk(tree)) {
    raw += 12;
    factors.push({ txt: 'EAB risk (ash species)', pts: 12 });
  }

  // ── Age class ─────────────────────────────────────────────────────────────────
  if (tree.a === 'Over-mature') {
    raw += 6;
    factors.push({ txt: 'Over-mature age class', pts: 6 });
  }

  // ── Invert to display scale ───────────────────────────────────────────────────
  // Raw score is 0–94 (40+36+12+6). Cap at 90 before inverting so the
  // display score never reaches 0 (reserved for Dead trees shown separately).
  const cappedRaw = Math.min(raw, 90);
  const displayScore = 100 - cappedRaw;

  return { displayScore, rawScore: cappedRaw, factors };
}

export function priorityLevel(displayScore) {
  if (displayScore <= 40)  return { label: 'Critical', color: '#d04444' };
  if (displayScore <= 65)  return { label: 'High',     color: '#d06828' };
  if (displayScore <= 82)  return { label: 'Moderate', color: '#d4ae30' };
  return                          { label: 'Low',      color: '#5ec254' };
}

// Backward-compat alias — prefer priorityScore() in new code
export const riskScore = priorityScore;
export const riskLevel = priorityLevel;

export function isEabRisk(tree) {
  const name = (tree.n + ' ' + tree.s).toLowerCase();
  return name.includes('ash') || name.includes('fraxinus');
}
