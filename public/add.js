const form = document.getElementById('form');
const errorBox = document.getElementById('error');

function showError(msgs) {
  errorBox.textContent = Array.isArray(msgs) ? msgs.join(' • ') : String(msgs || '');
}

function readNumber(id) {
  const el = document.getElementById(id);
  const v = el.value.trim();
  if (v === '') return NaN;
  return Number(v);
}

function validate() {
  const errs = [];
  const name = document.getElementById('name').value.trim();
  const office = document.getElementById('office').value.trim();
  const pollingMarginPct = readNumber('pollingMarginPct');
  const daysToElection = readNumber('daysToElection');
  const cashOnHandUSD = readNumber('cashOnHandUSD');
  const alignmentScore = readNumber('alignmentScore');
  const isIncumbent = document.getElementById('isIncumbent').checked;

  if (!name) errs.push('Name is required');
  if (!office) errs.push('Office is required');
  if (!Number.isFinite(pollingMarginPct) || pollingMarginPct < -50 || pollingMarginPct > 50) errs.push('Polling margin must be between -50 and 50');
  if (!Number.isInteger(daysToElection) || daysToElection < 0) errs.push('Days to election must be an integer ≥ 0');
  if (!Number.isFinite(cashOnHandUSD) || cashOnHandUSD < 0) errs.push('Cash on hand must be ≥ 0');
  if (!Number.isFinite(alignmentScore) || alignmentScore < 0 || alignmentScore > 1) errs.push('Alignment must be in [0,1]');

  return { errs, payload: { name, office, pollingMarginPct, daysToElection, cashOnHandUSD, alignmentScore, isIncumbent } };
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  showError('');
  const { errs, payload } = validate();
  if (errs.length) { showError(errs); return; }
  try {
    const res = await fetch('/api/candidates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (!res.ok || !json.ok) {
      showError(json.errors || json.error || 'Failed to save');
      return;
    }
    // Redirect home so the candidate appears in the list
    window.location.href = '/';
  } catch (err) {
    showError(err.message || 'Network error');
  }
});
