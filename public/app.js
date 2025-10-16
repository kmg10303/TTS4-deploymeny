const list = document.getElementById('list');
const textScale = document.getElementById('textScale');
const refreshBtn = document.getElementById('refreshBtn');
const sortImpact = document.getElementById('sortImpact');
const sortSoon = document.getElementById('sortSoon');
const sortMEPD = document.getElementById('sortMEPD');
const alignmentDefault = document.getElementById('alignmentDefault');

let data = [];

function fmtPct(x) { return (x * 100).toFixed(2) + '%'; }
function fmtMoney(x) { return '$' + Math.round(x).toLocaleString(); }

function card(c) {
  const mepdPct = c.mepd; // probability points per $
  const mepdPer100 = mepdPct * 100; // per $100
  const bar = Math.max(3, Math.min(100, Math.round(c.composite * 100)));
  return `
    <div class="card" role="button" tabindex="0">
      <div class="row">
        <div>
          <div class="metric">${c.name}</div>
          <div class="badge">${c.office}</div>
        </div>
        <div class="metric">${(c.composite*100).toFixed(1)}<span class="badge"> score</span></div>
      </div>
      <div class="row">
        <div class="badge">Margin: ${c.pollingMarginPct.toFixed(1)} pp</div>
        <div class="badge">Election: ${c.daysToElection} days</div>
        <div class="badge">Cash: ${fmtMoney(c.cashOnHandUSD||0)}</div>
      </div>
      <div class="progress" aria-label="Impact score">
        <span style="width:${bar}%"></span>
      </div>
      <div class="row">
        <div class="badge">Prob win: ${fmtPct(c.probabilityOfWin)}</div>
        <div class="badge">MEPD: ${(mepdPer100).toFixed(3)} pp / $100</div>
      </div>
    </div>
  `;
}

async function fetchData() {
  const url = new URL('/api/candidates', window.location.origin);
  url.searchParams.set('alignmentDefault', alignmentDefault.value);
  const res = await fetch(url);
  const json = await res.json();
  data = json.candidates;
  render();
}

function render() {
  document.documentElement.style.fontSize = textScale.value + 'rem';
  list.innerHTML = data.map(card).join('');
}

refreshBtn.addEventListener('click', fetchData);
textScale.addEventListener('input', render);
sortImpact.addEventListener('click', () => { data.sort((a,b) => b.composite - a.composite); render(); });
sortSoon.addEventListener('click', () => { data.sort((a,b) => (a.daysToElection ?? 9999) - (b.daysToElection ?? 9999)); render(); });
sortMEPD.addEventListener('click', () => { data.sort((a,b) => b.mepd - a.mepd); render(); });

fetchData();
