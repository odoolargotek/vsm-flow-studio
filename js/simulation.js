// ===== VSM SIMULATION ENGINE v2 — VSM Flow Studio =====
// Supports: Fixed CT | Normal distribution | Triangular distribution
// Monte Carlo: N=500 iterations for stochastic runs

const MC_RUNS = 500;

// ─ PROBABILITY DISTRIBUTION SAMPLERS ─────────────────────────────

// Box-Muller transform → Normal(mean, std)
function sampleNormal(mean, std) {
  let u, v;
  do { u = Math.random(); } while (u === 0);
  do { v = Math.random(); } while (v === 0);
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return Math.max(0, mean + z * std);
}

// Triangular(min, mode, max) — inverse CDF method
function sampleTriangular(min, mode, max) {
  if (min >= max) return mode;
  const u = Math.random();
  const fc = (mode - min) / (max - min);
  if (u < fc) {
    return min + Math.sqrt(u * (max - min) * (mode - min));
  } else {
    return max - Math.sqrt((1 - u) * (max - min) * (max - mode));
  }
}

// Get a single CT sample based on node distribution config
function sampleCT(props) {
  const dist = props.distType || 'fixed';
  if (dist === 'normal') {
    return sampleNormal(props.ct, props.ctStd || props.ct * 0.1);
  } else if (dist === 'triangular') {
    const lo  = props.ctMin  || props.ct * 0.7;
    const hi  = props.ctMax  || props.ct * 1.5;
    return sampleTriangular(lo, props.ct, hi);
  }
  return props.ct;  // fixed
}

// ─ MAIN SIMULATION ──────────────────────────────────────────────────
function runSimulation() {
  const demand      = parseFloat(document.getElementById('demand').value)      || 400;
  const hoursShift  = parseFloat(document.getElementById('hours-shift').value) || 8;
  const shiftsDay   = parseFloat(document.getElementById('shifts').value)      || 1;
  const mcRuns      = parseInt(document.getElementById('mc-runs')?.value)      || MC_RUNS;

  const processes   = getProcessesOrdered();
  const inventories = getInventoriesOrdered();

  if (processes.length === 0) {
    setSimLog('⚠ No hay procesos en el canvas.\nAgrega al menos un nodo Proceso.');
    return;
  }

  const availableTimeSec = hoursShift * shiftsDay * 3600;

  // ─ 1. TAKT TIME (deterministic) ─────────────────────────────
  const taktTime = availableTimeSec / demand;

  // ─ 2. DETERMINE IF STOCHASTIC RUN NEEDED ──────────────────────
  const hasStochastic = processes.some(n =>
    n.props.distType && n.props.distType !== 'fixed');

  // ─ 3. MONTE CARLO LOOP ────────────────────────────────────────
  const iters = hasStochastic ? mcRuns : 1;

  const ltSamples  = [];
  const pceSamples = [];
  const bnCounts   = {};    // bottleneck frequency
  const procCTSamples = {}; // per-process CT samples
  processes.forEach(n => { procCTSamples[n.id] = []; });

  for (let i = 0; i < iters; i++) {
    let totalVA = 0;
    let bottleneckCT = 0;
    let bottleneckId = null;

    processes.forEach(node => {
      const p = node.props;
      const ct = sampleCT(p);
      procCTSamples[node.id].push(ct);
      const avail  = (p.hoursShift||8) * (p.shifts||1) * 3600 * ((p.uptime||90)/100);
      const netCT  = ct / ((p.uptime||90)/100);
      if (p.isVA !== false) totalVA += ct;
      if (netCT > bottleneckCT) {
        bottleneckCT = netCT;
        bottleneckId = node.id;
      }
    });

    // WIP Lead Time
    let wipDays = 0;
    inventories.forEach(inv => { wipDays += (inv.props.units||0) / demand; });
    const processLTDays = totalVA / availableTimeSec;
    const totalLT = wipDays + processLTDays;
    const pce = totalLT > 0 ? (processLTDays / totalLT) * 100 : 0;

    ltSamples.push(totalLT);
    pceSamples.push(pce);
    if (bottleneckId) bnCounts[bottleneckId] = (bnCounts[bottleneckId]||0) + 1;
  }

  // ─ 4. AGGREGATE RESULTS ──────────────────────────────────────────
  const mean  = arr => arr.reduce((a,b) => a+b, 0) / arr.length;
  const pct   = (arr, p) => { const s=[...arr].sort((a,b)=>a-b); return s[Math.floor(p*s.length)]; };

  const ltMean  = mean(ltSamples);
  const lt10    = pct(ltSamples, 0.10);
  const lt90    = pct(ltSamples, 0.90);
  const pceMean = mean(pceSamples);

  // Dominant bottleneck
  const dominantBnId = Object.keys(bnCounts).sort((a,b) => bnCounts[b]-bnCounts[a])[0] || null;
  const dominantBn   = dominantBnId ? getNode(dominantBnId) : null;

  // Per-process stats
  const procResults = processes.map(node => {
    const samples = procCTSamples[node.id];
    const ctMean  = mean(samples);
    const ctP90   = pct(samples, 0.90);
    const netCT   = ctMean / ((node.props.uptime||90)/100);
    const capacity = availableTimeSec * ((node.props.uptime||90)/100) / ctMean;
    const status   = netCT <= taktTime ? 'ok' : 'overloaded';
    const isBn     = node.id === dominantBnId;
    return { id: node.id, label: node.props.label, ctMean, ctP90, netCT, capacity, status, isBn,
             uptime: node.props.uptime, operators: node.props.operators,
             defectRate: node.props.defectRate, distType: node.props.distType||'fixed' };
  });

  // ─ 5. UPDATE UI ───────────────────────────────────────────────
  const totalVAFixed = processes.reduce((s,n) => s + (n.props.isVA!==false ? n.props.ct:0), 0);

  updateKPIs({
    taktTime, ltMean, lt10, lt90, totalVA: totalVAFixed,
    pceMean, dominantBn, availableTimeSec, iters, hasStochastic
  });
  updateProcessList(procResults, taktTime);
  updateTimeline(processes, inventories, demand, availableTimeSec);
  highlightBottleneck(dominantBnId);

  const logLines = [
    `✔ Simulación ${hasStochastic ? 'Monté Carlo (' + iters + ' iter.)' : 'determinista'} OK`,
    `Procesos: ${processes.length} | Inventarios: ${inventories.length}`,
    `Demanda: ${demand} u/día | Takt: ${taktTime.toFixed(1)}s`,
    `──────────────────────`,
    `Lead Time prom: ${ltMean.toFixed(2)} días`,
    hasStochastic ? `P10-P90: [${lt10.toFixed(2)} – ${lt90.toFixed(2)}] días` : '',
    `PCE prom: ${pceMean.toFixed(1)}%`,
    dominantBn ? `Bottleneck: ${dominantBn.props.label}` : ''
  ].filter(Boolean).join('\n');
  setSimLog(logLines);

  document.getElementById('canvas-hint').style.display = 'none';
}

// ─ KPI CARDS ─────────────────────────────────────────────────────
function updateKPIs({taktTime, ltMean, lt10, lt90, totalVA, pceMean, dominantBn, availableTimeSec, iters, hasStochastic}) {
  const set = (id, val, sub) => {
    const card = document.getElementById(id);
    if (!card) return;
    card.querySelector('.kpi-value').textContent = val;
    if (sub !== undefined) card.querySelector('.kpi-sub').textContent = sub;
  };
  set('kpi-takt',  taktTime.toFixed(1), 'seg/unidad');
  set('kpi-lt',    ltMean.toFixed(2),
      hasStochastic ? `días | P10:${lt10.toFixed(2)} P90:${lt90.toFixed(2)}` : 'días');
  set('kpi-pt',    totalVA.toFixed(0), 'seg (VA fijo)');
  set('kpi-pce',   pceMean.toFixed(1) + '%',
      pceMean < 15  ? '⚠️ Flujo muy ineficiente' :
      pceMean < 35  ? '⚠ Mejorar flujo' :
      pceMean < 60  ? '✔ Flujo moderado' : '★ Flujo óptimo');
  set('kpi-bn',
      dominantBn ? dominantBn.props.label : 'Ninguno',
      dominantBn ? `CT neto ≈ ${(dominantBn.props.ct/((dominantBn.props.uptime||90)/100)).toFixed(1)}s` : '');
  set('kpi-avail', availableTimeSec.toLocaleString(), 'seg/día');

  // MC runs badge
  let badge = document.getElementById('kpi-mc-badge');
  if (!badge) {
    badge = document.createElement('div');
    badge.id = 'kpi-mc-badge';
    badge.className = 'kpi-mc-badge';
    document.getElementById('kpi-section')?.appendChild(badge);
  }
  badge.textContent = hasStochastic
    ? `🎲 Monté Carlo: ${iters} iteraciones`
    : `• Modo determinista`;
  badge.style.color = hasStochastic ? '#d29922' : '#6e7681';
}

// ─ PROCESS LIST ─────────────────────────────────────────────────
function updateProcessList(procResults, taktTime) {
  const container = document.getElementById('process-list');
  container.innerHTML = '';
  const distLabel = { fixed: 'Fijo', normal: 'Normal', triangular: 'Triangular' };
  procResults.forEach(p => {
    const cls   = p.status === 'ok' ? 'proc-ok' : 'proc-bad';
    const badge = p.status !== 'ok' ? '<span class="proc-item-badge">SOBRECARGADO</span>' : '';
    const bnBadge = p.isBn ? '<span class="proc-item-badge" style="background:#d29922">CUELLO 🔴</span>' : '';
    const ctLabel = p.distType !== 'fixed'
      ? `${p.ctMean.toFixed(1)}s <small>(P90: ${p.ctP90.toFixed(1)}s)</small>`
      : `${p.ctMean.toFixed(1)}s`;
    container.innerHTML += `
      <div class="proc-item ${p.isBn ? 'is-bn' : ''}">
        <div class="proc-item-name">${p.label}${badge}${bnBadge}</div>
        <div class="proc-item-stats">
          CT: <span class="${cls}">${ctLabel}</span><br>
          Net CT: <span class="${cls}">${p.netCT.toFixed(1)}s</span> vs Takt: ${taktTime.toFixed(1)}s<br>
          Uptime: ${p.uptime}% | Ops: ${p.operators} | Defectos: ${p.defectRate}%<br>
          Capacidad: ${p.capacity.toFixed(0)} u/día<br>
          Distribución: <em>${distLabel[p.distType]||p.distType}</em>
        </div>
      </div>`;
  });
}

// ─ TIMELINE ─────────────────────────────────────────────────────
function updateTimeline(processes, inventories, demand, availableTimeSec) {
  const container = document.getElementById('timeline-content');
  container.innerHTML = '';
  const all = [
    ...processes.map(n => ({ ...n, tlType: 'process' })),
    ...inventories.map(n => ({ ...n, tlType: 'inventory' }))
  ].sort((a,b) => a.x - b.x);

  all.forEach((item, i) => {
    const sep = i < all.length - 1 ? '<div class="tl-sep"></div>' : '';
    if (item.tlType === 'inventory') {
      const days = (item.props.units / demand).toFixed(2);
      container.innerHTML += `
        <div class="tl-item"><div class="tl-bar wip">${days}d</div><div class="tl-name">${item.props.label}</div></div>${sep}`;
    } else {
      const ct = item.props.ct;
      const label = ct >= 60 ? (ct/60).toFixed(1)+'m' : ct+'s';
      const va = item.props.isVA !== false;
      container.innerHTML += `
        <div class="tl-item"><div class="tl-bar ${va?'va':'nva'}">${label}</div><div class="tl-name">${item.props.label}</div></div>${sep}`;
    }
  });
}

function highlightBottleneck(bnId) {
  document.querySelectorAll('.vsm-node').forEach(el => el.classList.remove('bottleneck'));
  if (bnId) { const el = document.getElementById(bnId); if (el) el.classList.add('bottleneck'); }
}

function setSimLog(text) {
  document.getElementById('sim-log').textContent = text;
}
