// ===== VSM SIMULATION ENGINE v3 — VSM Flow Studio =====
// Classic VSM timeline: VA boxes (green) + NVA transport boxes (red) + WIP boxes (yellow)
// Each arrow in the diagram = transport/wait time between nodes (NVA)

const MC_RUNS = 500;

// ─ DISTRIBUTION SAMPLERS ─────────────────────────────────────────
function sampleNormal(mean, std) {
  let u, v;
  do { u = Math.random(); } while (u === 0);
  do { v = Math.random(); } while (v === 0);
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return Math.max(0, mean + z * std);
}

function sampleTriangular(min, mode, max) {
  if (min >= max) return mode;
  const u = Math.random();
  const fc = (mode - min) / (max - min);
  return u < fc
    ? min + Math.sqrt(u * (max - min) * (mode - min))
    : max - Math.sqrt((1 - u) * (max - min) * (max - mode));
}

function sampleCT(props) {
  const dist = props.distType || 'fixed';
  if (dist === 'normal')     return sampleNormal(props.ct, props.ctStd || props.ct * 0.1);
  if (dist === 'triangular') return sampleTriangular(props.ctMin || props.ct*0.7, props.ct, props.ctMax || props.ct*1.5);
  return props.ct;
}

// ─ MAIN SIMULATION ───────────────────────────────────────────────
function runSimulation() {
  const demand         = parseFloat(document.getElementById('demand').value)      || 400;
  const hoursShift     = parseFloat(document.getElementById('hours-shift').value) || 8;
  const shiftsDay      = parseFloat(document.getElementById('shifts').value)      || 1;
  const mcRuns         = parseInt(document.getElementById('mc-runs')?.value)      || MC_RUNS;
  const processes      = getProcessesOrdered();
  const inventories    = getInventoriesOrdered();

  if (!processes.length) {
    setSimLog('⚠ No hay procesos en el canvas.');
    return;
  }

  const availSec   = hoursShift * shiftsDay * 3600;
  const taktTime   = availSec / demand;
  const hasStoch   = processes.some(n => n.props.distType && n.props.distType !== 'fixed');
  const iters      = hasStoch ? mcRuns : 1;

  const ltSamples = [], pceSamples = [], bnCounts = {}, procCTSamples = {};
  processes.forEach(n => { procCTSamples[n.id] = []; });

  for (let i = 0; i < iters; i++) {
    let totalVA = 0, bnCT = 0, bnId = null;
    processes.forEach(node => {
      const ct    = sampleCT(node.props);
      procCTSamples[node.id].push(ct);
      const netCT = ct / ((node.props.uptime || 90) / 100);
      if (node.props.isVA !== false) totalVA += ct;
      if (netCT > bnCT) { bnCT = netCT; bnId = node.id; }
    });
    let wipDays = inventories.reduce((s, inv) => s + (inv.props.units || 0) / demand, 0);
    const procDays = totalVA / availSec;
    const lt = wipDays + procDays;
    ltSamples.push(lt);
    pceSamples.push(lt > 0 ? (procDays / lt) * 100 : 0);
    if (bnId) bnCounts[bnId] = (bnCounts[bnId] || 0) + 1;
  }

  const mean   = arr => arr.reduce((a,b) => a+b, 0) / arr.length;
  const pct    = (arr, p) => { const s=[...arr].sort((a,b)=>a-b); return s[Math.floor(p*s.length)]; };
  const ltMean = mean(ltSamples), lt10 = pct(ltSamples,.10), lt90 = pct(ltSamples,.90);
  const pceMean = mean(pceSamples);
  const bnId   = Object.keys(bnCounts).sort((a,b) => bnCounts[b]-bnCounts[a])[0] || null;
  const bn     = bnId ? getNode(bnId) : null;

  const procResults = processes.map(node => {
    const s = procCTSamples[node.id];
    const ctMean = mean(s), ctP90 = pct(s,.90);
    const netCT  = ctMean / ((node.props.uptime||90)/100);
    return { id:node.id, label:node.props.label, ctMean, ctP90, netCT,
             capacity: availSec*((node.props.uptime||90)/100)/ctMean,
             status: netCT<=taktTime?'ok':'overloaded', isBn: node.id===bnId,
             uptime:node.props.uptime, operators:node.props.operators,
             defectRate:node.props.defectRate, distType:node.props.distType||'fixed' };
  });

  const totalVAFixed = processes.reduce((s,n) => s + (n.props.isVA!==false ? n.props.ct : 0), 0);
  updateKPIs({ taktTime, ltMean, lt10, lt90, totalVA:totalVAFixed, pceMean, dominantBn:bn, availSec, iters, hasStoch });
  updateProcessList(procResults, taktTime);
  buildValueTimeline(processes, inventories, demand, availSec);
  highlightBottleneck(bnId);

  setSimLog([
    `✔ ${hasStoch ? 'Monte Carlo (' + iters + ' iter.)' : 'Determinista'} OK`,
    `Procesos: ${processes.length} | Inventarios: ${inventories.length}`,
    `Takt: ${taktTime.toFixed(1)}s | LT prom: ${ltMean.toFixed(2)}d`,
    hasStoch ? `P10-P90: [${lt10.toFixed(2)} – ${lt90.toFixed(2)}] d` : '',
    `PCE: ${pceMean.toFixed(1)}%`,
    bn ? `Bottleneck: ${bn.props.label}` : ''
  ].filter(Boolean).join('\n'));

  document.getElementById('canvas-hint').style.display = 'none';
}

// ─ KPI CARDS ─────────────────────────────────────────────────────
function updateKPIs({taktTime,ltMean,lt10,lt90,totalVA,pceMean,dominantBn,availSec,iters,hasStoch}) {
  const set = (id, val, sub) => {
    const c = document.getElementById(id); if (!c) return;
    c.querySelector('.kpi-value').textContent = val;
    if (sub !== undefined) c.querySelector('.kpi-sub').textContent = sub;
  };
  set('kpi-takt',  taktTime.toFixed(1), 'seg/unidad');
  set('kpi-lt',    ltMean.toFixed(2),
      hasStoch ? `días | P10:${lt10.toFixed(2)} P90:${lt90.toFixed(2)}` : 'días');
  set('kpi-pt',    totalVA.toFixed(0), 'seg (VA)');
  set('kpi-pce',   pceMean.toFixed(1) + '%',
      pceMean<15?'⚠️ Muy ineficiente':pceMean<35?'⚠ Mejorar':pceMean<60?'✔ Moderado':'★ Óptimo');
  set('kpi-bn',    dominantBn ? dominantBn.props.label : 'Ninguno',
      dominantBn ? `CT neto ≈ ${(dominantBn.props.ct/((dominantBn.props.uptime||90)/100)).toFixed(1)}s` : '');
  set('kpi-avail', availSec.toLocaleString(), 'seg/día');
  let badge = document.getElementById('kpi-mc-badge');
  if (!badge) {
    badge = document.createElement('div'); badge.id='kpi-mc-badge'; badge.className='kpi-mc-badge';
    document.getElementById('kpi-section')?.appendChild(badge);
  }
  badge.textContent = hasStoch ? `🎲 Monte Carlo: ${iters} iter.` : `• Determinista`;
  badge.style.color = hasStoch ? '#d29922' : '#6e7681';
}

// ─ PROCESS LIST ──────────────────────────────────────────────────
function updateProcessList(procResults, taktTime) {
  const c = document.getElementById('process-list'); c.innerHTML = '';
  const dl = {fixed:'Fijo',normal:'Normal',triangular:'Triangular'};
  procResults.forEach(p => {
    const cls = p.status==='ok'?'proc-ok':'proc-bad';
    c.innerHTML += `
      <div class="proc-item ${p.isBn?'is-bn':''}">
        <div class="proc-item-name">${p.label}
          ${p.status!=='ok'?'<span class="proc-item-badge">SOBRECARGADO</span>':''}
          ${p.isBn?'<span class="proc-item-badge" style="background:#d29922">CUELLO</span>':''}
        </div>
        <div class="proc-item-stats">
          CT: <span class="${cls}">${p.ctMean.toFixed(1)}s${p.distType!=='fixed'?` (P90:${p.ctP90.toFixed(1)}s)`:''}</span><br>
          Net CT: <span class="${cls}">${p.netCT.toFixed(1)}s</span> vs Takt: ${taktTime.toFixed(1)}s<br>
          Uptime: ${p.uptime}% | Ops: ${p.operators} | Dist: <em>${dl[p.distType]||p.distType}</em>
        </div>
      </div>`;
  });
}

// ─ VALUE STREAM TIMELINE (the classic VSM sawtooth) ──────────────
//
// Layout: Supplier ─► [NVA transport] ─► Process1 ─► [WIP/NVA] ─► Process2 ─► ... ─► Customer
//
// Rules:
//  • Each PROCESS node  → green VA box  (CT value)
//  • Each INVENTORY node → yellow WIP box (units/demand days)
//  • Each ARROW between nodes → red NVA transport box (uses arrow props or default)
//    (if no inventory exists between two processes, the arrow IS the wait time)
//
// The function walks the arrows graph in left-to-right order.

function buildValueTimeline(processes, inventories, demand, availSec) {
  const svg = document.getElementById('vt-svg');
  if (!svg) return;
  svg.innerHTML = '';

  // Build ordered sequence by walking arrows from supplier/first-process
  const sequence = buildFlowSequence();
  if (!sequence.length) { svg.innerHTML = '<text x="10" y="20" fill="#6e7681" font-size="11">Conecta los nodos para ver el timeline</text>'; return; }

  // Dimensions
  const BOX_H    = 36;   // height of each box
  const BOX_GAP  = 6;    // gap between boxes
  const Y_TOP    = 8;    // top of boxes row
  const Y_ZIGZAG = Y_TOP + BOX_H + 4;  // zigzag line Y
  const Y_LABEL  = Y_ZIGZAG + 18;      // label Y
  const TOTAL_H  = Y_LABEL + 18;

  // Compute widths proportional to time value (min 60px)
  const MIN_W = 60, MAX_W = 160;
  const values = sequence.map(s => s.valueSec || 1);
  const maxVal = Math.max(...values);
  const widths = values.map(v => Math.max(MIN_W, Math.round((v / maxVal) * MAX_W)));

  const totalW = widths.reduce((s,w) => s+w, 0) + (widths.length - 1) * BOX_GAP + 20;
  svg.setAttribute('viewBox', `0 0 ${totalW} ${TOTAL_H}`);
  svg.setAttribute('width', totalW);
  svg.setAttribute('height', TOTAL_H);

  // Draw each segment
  let x = 10;
  const zigZagPoints = [];

  sequence.forEach((seg, i) => {
    const w = widths[i];
    const cx = x + w / 2;

    const colors = {
      va:        { fill:'rgba(63,185,80,.18)',  stroke:'#3fb950', text:'#3fb950' },
      nva:       { fill:'rgba(248,81,73,.18)',  stroke:'#f85149', text:'#f85149' },
      wip:       { fill:'rgba(210,153,34,.18)', stroke:'#d29922', text:'#d29922' },
    };
    const c = colors[seg.type] || colors.nva;

    // Box
    const rect = document.createElementNS('http://www.w3.org/2000/svg','rect');
    rect.setAttribute('x', x); rect.setAttribute('y', Y_TOP);
    rect.setAttribute('width', w); rect.setAttribute('height', BOX_H);
    rect.setAttribute('rx', 4);
    rect.setAttribute('fill', c.fill);
    rect.setAttribute('stroke', c.stroke);
    rect.setAttribute('stroke-width', '1.5');
    svg.appendChild(rect);

    // Type badge (tiny top-left)
    const badge = document.createElementNS('http://www.w3.org/2000/svg','text');
    badge.setAttribute('x', x + 4); badge.setAttribute('y', Y_TOP + 11);
    badge.setAttribute('fill', c.stroke); badge.setAttribute('font-size','7');
    badge.setAttribute('font-family','monospace'); badge.setAttribute('font-weight','700');
    badge.textContent = seg.type.toUpperCase();
    svg.appendChild(badge);

    // Main value label
    const val = document.createElementNS('http://www.w3.org/2000/svg','text');
    val.setAttribute('x', cx); val.setAttribute('y', Y_TOP + 24);
    val.setAttribute('fill', c.text); val.setAttribute('font-size','11');
    val.setAttribute('font-weight','700'); val.setAttribute('text-anchor','middle');
    val.setAttribute('font-family','monospace');
    val.textContent = seg.valueLabel;
    svg.appendChild(val);

    // Name label below box
    const lbl = document.createElementNS('http://www.w3.org/2000/svg','text');
    lbl.setAttribute('x', cx); lbl.setAttribute('y', Y_LABEL);
    lbl.setAttribute('fill', '#6e7681'); lbl.setAttribute('font-size','8');
    lbl.setAttribute('text-anchor','middle'); lbl.setAttribute('font-family','sans-serif');
    // Truncate long labels
    lbl.textContent = seg.label.length > 12 ? seg.label.slice(0,11)+'…' : seg.label;
    svg.appendChild(lbl);

    // Zigzag points: alternate top-center and bottom-center of box
    const zy = (i % 2 === 0) ? Y_TOP : Y_TOP + BOX_H;
    zigZagPoints.push(`${cx},${zy}`);

    x += w + BOX_GAP;
  });

  // Draw zigzag line connecting box midpoints
  if (zigZagPoints.length >= 2) {
    const polyline = document.createElementNS('http://www.w3.org/2000/svg','polyline');
    polyline.setAttribute('points', zigZagPoints.join(' '));
    polyline.setAttribute('fill','none');
    polyline.setAttribute('stroke','#58a6ff');
    polyline.setAttribute('stroke-width','1.5');
    polyline.setAttribute('stroke-dasharray','4,3');
    polyline.setAttribute('opacity','0.6');
    svg.insertBefore(polyline, svg.firstChild); // draw behind boxes
  }

  // Totals bar at top-right
  const vaTotal   = sequence.filter(s=>s.type==='va') .reduce((s,x)=>s+x.valueSec,0);
  const nvaTotal  = sequence.filter(s=>s.type!=='va').reduce((s,x)=>s+x.valueSec,0);
  const pce       = vaTotal+nvaTotal > 0 ? (vaTotal/(vaTotal+nvaTotal)*100).toFixed(1) : '0.0';

  const summary = document.getElementById('vt-summary');
  if (summary) {
    summary.innerHTML =
      `<span style="color:#3fb950">■ VA: ${fmtTime(vaTotal)}</span>` +
      `<span style="color:#f85149">■ NVA: ${fmtTime(nvaTotal)}</span>` +
      `<span style="color:#d29922">■ WIP: incluido en LT</span>` +
      `<span style="color:#58a6ff; font-weight:700">PCE visual: ${pce}%</span>`;
  }
}

// Walk the arrows graph in flow order and build the segment sequence
function buildFlowSequence() {
  if (!arrows.length || !nodes.length) return [];

  // Start from supplier or leftmost node
  let startNode = nodes.find(n => n.type === 'supplier');
  if (!startNode) startNode = nodes.slice().sort((a,b) => a.x - b.x)[0];

  const sequence = [];
  const visited  = new Set();
  let current    = startNode;

  // Add supplier/customer as markers but no time box
  // Walk forward through arrows
  let safety = 0;
  while (current && safety++ < 50) {
    if (visited.has(current.id)) break;
    visited.add(current.id);

    // Add box for current node
    const seg = nodeToSegment(current);
    if (seg) sequence.push(seg);

    // Find next node via outgoing arrow
    const outArrow = arrows.find(a => a.fromId === current.id && !visited.has(a.toId));
    if (!outArrow) break;

    // Add a transport/arrow segment BEFORE the next node
    const nextNode = getNode(outArrow.toId);
    if (nextNode && nextNode.type !== 'inventory') {
      // Arrow itself = transport time (NVA) — use arrow props or default 0.5 days
      const transportSec = (outArrow.transportDays || 0.5) * 8 * 3600; // default 0.5 day
      sequence.push({
        type:       'nva',
        label:      outArrow.type === 'push' ? 'Push' : outArrow.type === 'pull' ? 'Pull' : 'Info',
        valueSec:   transportSec,
        valueLabel: fmtTime(transportSec),
      });
    }

    current = nextNode;
  }

  return sequence.filter(s => s.type !== 'entity'); // drop supplier/customer
}

function nodeToSegment(node) {
  if (node.type === 'process') {
    const ct = node.props.ct;
    return {
      type:       node.props.isVA !== false ? 'va' : 'nva',
      label:      node.props.label,
      valueSec:   ct,
      valueLabel: fmtTime(ct),
    };
  }
  if (node.type === 'inventory') {
    const demand = parseFloat(document.getElementById('demand')?.value) || 400;
    const availSec = (parseFloat(document.getElementById('hours-shift')?.value)||8)
                   * (parseFloat(document.getElementById('shifts')?.value)||1) * 3600;
    const days = (node.props.units || 0) / demand;
    const sec  = days * availSec;
    return {
      type:       'wip',
      label:      node.props.label,
      valueSec:   sec,
      valueLabel: days.toFixed(2) + 'd',
    };
  }
  return null; // supplier, customer, kaizen = no box
}

function fmtTime(sec) {
  if (sec <= 0) return '0s';
  if (sec < 60)    return sec.toFixed(0) + 's';
  if (sec < 3600)  return (sec/60).toFixed(1) + 'm';
  if (sec < 86400) return (sec/3600).toFixed(1) + 'h';
  return (sec/86400).toFixed(2) + 'd';
}

function highlightBottleneck(bnId) {
  document.querySelectorAll('.vsm-node').forEach(el => el.classList.remove('bottleneck'));
  if (bnId) { const el = document.getElementById(bnId); if (el) el.classList.add('bottleneck'); }
}

function setSimLog(text) { document.getElementById('sim-log').textContent = text; }
