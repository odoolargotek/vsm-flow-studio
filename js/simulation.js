// ===== SIMULATION ENGINE v3.1 — Gate + Resource utilization — VSM Flow Studio =====

const scenarios = [];

function runSimulation() {
  const procs = getProcessesOrdered();
  if (!procs.length) { alert('Agrega al menos un proceso al canvas.'); return; }

  const demand      = parseFloat(document.getElementById('sim-demand').value) || 400;
  const hoursDay    = parseFloat(document.getElementById('sim-hours').value)  || 8;
  const taktTime    = (hoursDay * 3600) / demand;

  const procData = procs.map(node => {
    const p          = node.props;
    const ct         = sampleCT(p);
    const uptime     = (p.uptime || 90) / 100;
    const shifts     = p.shifts    || 1;
    const hours      = p.hoursShift || 8;
    const ops        = p.operators  || 1;
    const batchSize  = p.batchSize  || 1;
    const defRate    = (p.defectRate || 0) / 100;
    const coSec      = (p.co || 0) * 60;
    const availSec   = hours * shifts * 3600 * uptime;
    const netCT      = ct / uptime;
    const capacity   = availSec / ct;
    const saturation = (netCT / taktTime) * 100;
    const batchDelay = (batchSize - 1) * ct;
    const resCT      = (p.resourceName && p.resourceCT > 0) ? p.resourceCT : ct;
    const resUtil    = (resCT / ct) * 100;
    return { node, p, ct, netCT, capacity, saturation, batchDelay, defRate, coSec, availSec, ops, batchSize, resCT, resUtil };
  });

  const bottleneck    = procData.reduce((a,b) => a.netCT > b.netCT ? a : b);
  const totalVA       = procData.filter(d => d.p.isVA !== false).reduce((s,d) => s + d.ct, 0);
  const totalBatch    = procData.reduce((s,d) => s + d.batchDelay, 0);

  const transportTotal = arrows.reduce((s,a) => {
    if (a.fromId && a.toId && a.transportDays != null) {
      const fromNode = getNode(a.fromId);
      const pct = (fromNode && fromNode.type === 'gate' && a.splitPct != null)
        ? (a.splitPct / 100) : 1;
      return s + a.transportDays * pct;
    }
    return s;
  }, 0);
  const processTotalSec = procData.reduce((s,d) => s + d.netCT, 0);
  const leadTimeSec     = processTotalSec + totalBatch + transportTotal * 8 * 3600;
  const leadTimeDays    = leadTimeSec / (8 * 3600);
  const pce             = totalVA > 0 ? (totalVA / leadTimeSec) * 100 : 0;

  const invNodes    = getInventoriesOrdered();
  const totalWIP    = invNodes.reduce((s,n) => s + (n.props.units || 0), 0);

  setKPI('kpi-takt',  taktTime.toFixed(1) + ' s',  taktTime < 30 ? 'warn' : '');
  setKPI('kpi-lt',    leadTimeDays.toFixed(3) + ' d', '');
  setKPI('kpi-pt',    (processTotalSec/3600).toFixed(2) + ' h', '');
  setKPI('kpi-pce',   pce.toFixed(1) + ' %',  pce < 10 ? 'warn' : pce < 25 ? 'ok' : 'good');
  setKPI('kpi-bn',    bottleneck.p.label,  'warn');
  setKPI('kpi-avail', (bottleneck.capacity).toFixed(0) + ' u/d', '');

  const pl = document.getElementById('process-list');
  pl.innerHTML = '';
  procData.forEach(d => {
    const satClass = d.saturation > 100 ? 'sat-over' : d.saturation > 80 ? 'sat-warn' : 'sat-ok';
    const isBN     = d.node.id === bottleneck.node.id;
    const batchBadge = d.batchSize > 1 ? `<span class="proc-badge batch-badge">LOTE ×${d.batchSize}</span>` : '';
    const resBadge   = d.p.resourceName
      ? `<span class="proc-badge res-badge" title="CT recurso: ${d.resCT}s">👤 ${d.p.resourceName} ${d.resUtil.toFixed(0)}%</span>` : '';
    const row = document.createElement('div');
    row.className = 'proc-row' + (isBN ? ' bottleneck' : '');
    row.innerHTML = `
      <div class="proc-name">${d.p.label} ${isBN?'<span class="bn-badge">CUELLO</span>':''} ${batchBadge} ${resBadge}</div>
      <div class="proc-metrics">
        <span>CT: ${d.ct.toFixed(1)}s</span>
        <span>Cap: ${d.capacity.toFixed(0)} u/d</span>
        <span class="${satClass}">Sat: ${d.saturation.toFixed(0)}%</span>
        ${d.p.resourceName ? `<span style="color:#bc8cff">Rec: ${d.resUtil.toFixed(0)}%</span>` : ''}
      </div>`;
    pl.appendChild(row);
  });

  buildTimeline(procData, transportTotal, leadTimeSec);

  scenarios.push({
    label: `Escenario ${scenarios.length + 1}`,
    takt: taktTime, lt: leadTimeDays, pce,
    va: totalVA, demand, procData
  });

  buildReport(procData, { taktTime, leadTimeDays, pce, totalVA, demand, bottleneck, scenarios });

  document.getElementById('sim-log').textContent =
    `✔ Calculado — LT: ${leadTimeDays.toFixed(3)}d | Takt: ${taktTime.toFixed(1)}s | PCE: ${pce.toFixed(1)}% | Lote delay total: ${(totalBatch/3600).toFixed(2)}h`;
}

function sampleCT(p) {
  if (p.distType === 'normal') {
    const std = p.ctStd || 0;
    if (std === 0) return p.ct;
    let u = 0;
    for (let i=0; i<6; i++) u += Math.random();
    return Math.max(1, p.ct + (u - 3) * std);
  }
  if (p.distType === 'triangular') {
    const a = p.ctMin || p.ct * 0.7, b = p.ctMax || p.ct * 1.5, c = p.ct;
    const F = (c - a) / (b - a);
    const r = Math.random();
    return r < F
      ? a + Math.sqrt(r * (b - a) * (c - a))
      : b - Math.sqrt((1 - r) * (b - a) * (b - c));
  }
  return p.ct;
}

function setKPI(id, val, cls) {
  const card = document.getElementById(id); if (!card) return;
  const v = card.querySelector('.kpi-value');
  v.textContent = val;
  v.className = 'kpi-value' + (cls ? ' ' + cls : '');
}

// TIMELINE — una fila por proceso/transporte con label + barra
function buildTimeline(procData, transportTotal, leadTimeSec) {
  const container = document.getElementById('timeline-content');
  container.innerHTML = '';
  const totalSec = leadTimeSec || 1;

  procData.forEach((d, i) => {
    // Transporte previo a este proceso
    const transportArrow = arrows.find(a => a.toId === d.node.id && getNode(a.fromId)?.type !== 'gate');
    const transDays = transportArrow ? (transportArrow.transportDays || 0) : (i === 0 ? 0 : 0);
    const transSec  = transDays * 8 * 3600;

    if (transSec > 0) {
      const row = document.createElement('div');
      row.className = 'tl-row';
      const w = Math.max(2, (transSec / totalSec) * 100);
      row.innerHTML = `
        <div class="tl-row-label">→ ${transDays}d</div>
        <div class="tl-row-bar">
          <div class="tl-seg tl-nva" style="width:${w}%" title="Transporte: ${transDays}d"></div>
        </div>`;
      container.appendChild(row);
    }

    // Lote delay
    if (d.batchDelay > 0) {
      const row = document.createElement('div');
      row.className = 'tl-row';
      const w = Math.max(2, (d.batchDelay / totalSec) * 100);
      row.innerHTML = `
        <div class="tl-row-label">×${d.batchSize} lote</div>
        <div class="tl-row-bar">
          <div class="tl-seg tl-batch" style="width:${w}%" title="Lote delay: ${d.batchDelay.toFixed(0)}s"></div>
        </div>`;
      container.appendChild(row);
    }

    // Proceso
    const row = document.createElement('div');
    row.className = 'tl-row';
    const w = Math.max(2, (d.netCT / totalSec) * 100);
    const cls = d.p.isVA !== false ? 'tl-va' : 'tl-nva-proc';
    const label = d.p.label.substring(0, 10);
    row.innerHTML = `
      <div class="tl-row-label" title="${d.p.label}">${label}</div>
      <div class="tl-row-bar">
        <div class="tl-seg ${cls}" style="width:${w}%" title="${d.p.label}: CT ${d.ct.toFixed(1)}s | Sat ${d.saturation.toFixed(0)}%">
          <span class="tl-label">${d.netCT.toFixed(0)}s ${d.saturation.toFixed(0)}%</span>
        </div>
      </div>`;
    container.appendChild(row);
  });
}
