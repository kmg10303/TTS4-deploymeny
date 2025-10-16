// Scoring and marginal effect per dollar implementation
// All factors normalized to [0,1] where higher is better

export const defaultWeights = {
  closeness: 0.35,      // prefer races near 0 margin
  urgency: 0.25,        // sooner elections prioritized
  saturation: 0.2,      // diminishing returns when well-funded
  alignment: 0.15,      // voter alignment importance
  challenger: 0.05      // small bonus to challengers
};

export const defaultParams = {
  // Closeness bell curve around margin=0 (in percentage points)
  closenessSigma: 7.5, // higher = wider window of competitiveness

  // Urgency curve: 1 / (1 + days/D0)
  urgencyD0: 120,      // half-urgency around 120 days out

  // Funding saturation: 1 / (1 + cash/scale)
  saturationScale: 2_000_000, // $ at which effect halves

  // Conversion from dollars to polling-margin movement (pp per $1)
  betaMarginPerDollar: 2.0e-7, // 0.02 pp per $100k before saturation

  // Mapping from margin to probability of win
  probSigma: 6.0 // pp scale: higher = smoother probability curve
};

function sigmoid(x) { return 1 / (1 + Math.exp(-x)); }

// Bell-shaped closeness score centered at margin=0
function closenessScore(marginPct, sigma) {
  const z = marginPct / sigma;
  return Math.exp(-0.5 * z * z); // in (0,1]
}

// Urgency increases as days shrink
function urgencyScore(daysToElection, D0) {
  if (daysToElection == null) return 0.5;
  return 1 / (1 + Math.max(0, daysToElection) / D0);
}

// Saturation penalizes large cash-on-hand or total spend
function saturationScore(cash, scale) {
  if (cash == null) return 0.7;
  return 1 / (1 + Math.max(0, cash) / scale);
}

// Small bonus if not incumbent
function challengerBonus(isIncumbent) {
  return isIncumbent ? 0.6 : 1.0; // reduce if incumbent
}

// Map polling margin to probability of win
function probOfWin(marginPct, probSigma) {
  return sigmoid(marginPct / probSigma);
}

// Derivative dP/dMargin for MEPD
function dProb_dMargin(marginPct, probSigma) {
  const x = marginPct / probSigma;
  const s = sigmoid(x);
  return (s * (1 - s)) / probSigma; // per percentage point
}

// Delta margin per dollar with diminishing returns
function dMarginPerDollar(cash, beta, scale) {
  return beta / (1 + Math.max(0, cash) / scale);
}

export function computeScores(candidates, weights = defaultWeights, params = defaultParams, voter = {}) {
  const w = { ...defaultWeights, ...weights };
  const p = { ...defaultParams, ...params };
  const alignDefault = voter.alignmentDefault ?? 0.7; // if not provided per-candidate

  return candidates.map(c => {
    const margin = c.pollingMarginPct; // candidate - opponent (pp)
    const days = c.daysToElection;
    const cash = c.cashOnHandUSD ?? c.totalRaisedUSD ?? 0;
    const align = c.alignmentScore ?? voter.alignmentOverride?.[c.id] ?? alignDefault;

    const fClose = closenessScore(margin, p.closenessSigma);
    const fUrg = urgencyScore(days, p.urgencyD0);
    const fSat = saturationScore(cash, p.saturationScale);
    const fAlign = Math.max(0, Math.min(1, align));
    const fChal = challengerBonus(!!c.isIncumbent);

    // Composite score via weighted geometric mean to reward balance
    const eps = 1e-6;
    const parts = [
      Math.pow(Math.max(fClose, eps), w.closeness),
      Math.pow(Math.max(fUrg, eps), w.urgency),
      Math.pow(Math.max(fSat, eps), w.saturation),
      Math.pow(Math.max(fAlign, eps), w.alignment),
      Math.pow(Math.max(fChal, eps), w.challenger)
    ];
    const composite = parts.reduce((a,b) => a * b, 1);

    // Marginal Effect Per Dollar (MEPD): dP/d$
    const dP_dM = dProb_dMargin(margin, p.probSigma); // per pp
    const dM_d$ = dMarginPerDollar(cash, p.betaMarginPerDollar, p.saturationScale); // pp per $
    const mepd = dP_dM * dM_d$; // probability points per $

    const prob = probOfWin(margin, p.probSigma);

    return {
      ...c,
      factors: {
        closeness: fClose,
        urgency: fUrg,
        saturation: fSat,
        alignment: fAlign,
        challenger: fChal
      },
      composite,
      probabilityOfWin: prob,
      mepd,
    };
  }).sort((a, b) => b.composite - a.composite);
}
