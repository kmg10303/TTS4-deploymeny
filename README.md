# Impact Score Prototype

A minimal full-stack prototype to compute and display an "impact score" for political donations, focusing on underdog and upcoming races and exposing the marginal effect per dollar (MEPD).

## Run locally

1. Install Node 18+
2. Install deps:
   
   ```bash
   npm install
   ```
3. Start server:
   
   ```bash
   npm run start
   ```
4. Open http://localhost:3000 on mobile or desktop.

## API

- `GET /api/candidates`
  - Query params (optional, numbers):
    - Weights: `closeness, urgency, saturation, alignment, challenger`
    - Params: `closenessSigma, urgencyD0, saturationScale, betaMarginPerDollar, probSigma`
    - Voter: `alignmentDefault`

Response includes `composite`, `probabilityOfWin`, and `mepd` per candidate.

## Algorithm overview

- **Closeness**: Bell curve around polling margin 0; penalizes very safe and very hopeless races.
- **Urgency**: 1/(1 + days/D0); nearer elections prioritized.
- **Saturation**: 1/(1 + cash/scale); lower-funded campaigns get more credit.
- **Alignment**: Voter alignment score in [0,1].
- **Challenger**: Incumbents slightly down-weighted.

Composite uses a weighted geometric mean to reward balanced candidates across factors.

### Marginal Effect Per Dollar (MEPD)

We approximate: `MEPD = (dP/dMargin) * (dMargin/d$)`

- `P(margin) = sigmoid(margin / probSigma)`
- `dMargin/d$ = betaMarginPerDollar / (1 + cash/scale)` (diminishing returns)

Units: probability points per $1. UI shows pp per $100.

## Notes

- Sample data in `server/data/candidates.json`. Replace with real feeds later.
- All parameters are configurable via query to support tuning during iteration.
- UI is mobile-first with large buttons and adjustable text size for accessibility.
