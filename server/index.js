import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { computeScores, defaultWeights, defaultParams } from './score.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

const DATA_PATH = path.join(__dirname, 'data', 'candidates.json');

function parseWeights(q) {
  const w = { ...defaultWeights };
  for (const k of Object.keys(w)) {
    if (q[k] != null && !Number.isNaN(parseFloat(q[k]))) {
      w[k] = parseFloat(q[k]);
    }
  }
  return w;
}

function parseParams(q) {
  const p = { ...defaultParams };
  for (const k of Object.keys(p)) {
    if (q[k] != null && !Number.isNaN(parseFloat(q[k]))) {
      p[k] = parseFloat(q[k]);
    }
  }
  return p;
}

app.get('/api/candidates', async (req, res) => {
  try {
    const raw = await fs.readFile(DATA_PATH, 'utf-8');
    const candidates = JSON.parse(raw);

    const weights = parseWeights(req.query);
    const params = parseParams(req.query);

    const voter = { alignmentDefault: req.query.alignmentDefault ? parseFloat(req.query.alignmentDefault) : undefined };

    const scored = computeScores(candidates, weights, params, voter);
    res.json({
      ok: true,
      count: scored.length,
      weights, params,
      candidates: scored
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Helpers for validation and ID generation
function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function validateCandidate(body) {
  const errs = [];
  const out = {};

  // Required strings
  if (!body.name || typeof body.name !== 'string') errs.push('name is required');
  else out.name = body.name.trim();
  if (!body.office || typeof body.office !== 'string') errs.push('office is required');
  else out.office = body.office.trim();

  // Optional id or generate
  if (body.id && typeof body.id === 'string') out.id = body.id.trim();
  else out.id = `${slugify(out.name || 'candidate')}-${Date.now()}`;

  // Booleans
  out.isIncumbent = Boolean(body.isIncumbent);

  // Numbers with ranges
  function num(n) { return typeof n === 'string' ? Number(n) : n; }
  const margin = num(body.pollingMarginPct);
  if (!Number.isFinite(margin) || margin < -50 || margin > 50) errs.push('pollingMarginPct must be between -50 and 50');
  else out.pollingMarginPct = margin;

  const days = num(body.daysToElection);
  if (!Number.isFinite(days) || days < 0 || !Number.isInteger(days)) errs.push('daysToElection must be an integer >= 0');
  else out.daysToElection = days;

  const cash = num(body.cashOnHandUSD);
  if (!Number.isFinite(cash) || cash < 0) errs.push('cashOnHandUSD must be a number >= 0');
  else out.cashOnHandUSD = cash;

  const align = num(body.alignmentScore);
  if (!Number.isFinite(align) || align < 0 || align > 1) errs.push('alignmentScore must be in [0,1]');
  else out.alignmentScore = align;

  return { errs, out };
}

// Create candidate: validate, persist, and return scored candidate
app.post('/api/candidates', async (req, res) => {
  try {
    const { errs, out } = validateCandidate(req.body || {});
    if (errs.length) return res.status(400).json({ ok: false, errors: errs });

    // Load existing
    const raw = await fs.readFile(DATA_PATH, 'utf-8').catch(async err => {
      if (err.code === 'ENOENT') { await fs.mkdir(path.dirname(DATA_PATH), { recursive: true }); await fs.writeFile(DATA_PATH, '[]'); return '[]'; }
      throw err;
    });
    const arr = JSON.parse(raw);

    // Prevent duplicate IDs
    if (arr.some(c => c.id === out.id)) {
      out.id = `${out.id}-${Date.now()}`;
    }

    arr.push(out);
    await fs.writeFile(DATA_PATH, JSON.stringify(arr, null, 2));

    const weights = parseWeights(req.query || {});
    const params = parseParams(req.query || {});
    const voter = {};
    const [scored] = computeScores([out], weights, params, voter);
    return res.status(201).json({ ok: true, candidate: scored });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Healthcheck
app.get('/api/health', (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Impact Score prototype listening on http://localhost:${PORT}`);
});
