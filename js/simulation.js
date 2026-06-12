// ===== VSM SIMULATION ENGINE — VSM Flow Studio =====
// Implements standard Lean Six Sigma VSM calculations

function runSimulation() {
  const demand = parseFloat(document.getElementById('demand').value) || 400;
  const hoursShift = parseFloat(document.getElementById('hours-shift').value) || 8;
  const shiftsDay = parseFloat(document.getElementById('shifts').value) || 1;

  const processes = getProcessesOrdered();
  const inventories = getInventoriesOrdered();

  if (processes.length === 0) {
    setSimLog('⚠ No hay procesos en el canvas.\nAgrega al menos un nodo de Proceso.');
    return;
  }

  // ── 1. TAKT TIME ──────────────────────────────────
  // Takt Time = Available Time / Customer Demand
  const availableTimeSec = hoursShift * shiftsDay * 3600;
  const taktTime = availableTimeSec / demand;  // seg/unidad

  // ── 2. PER-PROCESS CALCULATIONS ───────────────────
  let totalProcessTime = 0;   // Value-Added time (seg)
  let bottleneck = null;
  let bottleneckCT = 0;
  const procResults = [];

  processes.forEach(node => {
    const p = node.props;
    const avail = (p.hoursShift || 8) * (p.shifts || 1) * 3600 * ((p.uptime || 90) / 100);
    // Net Cycle Time adjusted by uptime
    const netCT = p.ct / ((p.uptime || 90) / 100);
    // Capacity: units/day this process can produce
    const capacity = avail / p.ct;
    // Value-added time
    if (p.isVA) totalProcessTime += p.ct;

    const isBottleneck = netCT > bottleneckCT;
    if (isBottleneck) {
      bottleneckCT = netCT;
      bottleneck = node;
    }

    // Takt vs Capacity check
    const status = netCT <= taktTime ? 'ok' : 'overloaded';

    procResults.push({
      id: node.id,
      label: p.label,
      ct: p.ct,
      netCT: netCT.toFixed(1),
      capacity: capacity.toFixed(0),
      uptime: p.uptime,
      operators: p.operators,
      defectRate: p.defectRate,
      status
    });
  });

  // ── 3. LEAD TIME ──────────────────────────────────
  // Lead Time = Σ WIP days + Σ Process CT
  // WIP days = WIP units / Daily demand
  let wipLeadTime = 0;
  inventories.forEach(inv => {
    const wipDays = (inv.props.units || 0) / demand;
    wipLeadTime += wipDays;  // days
  });
  const processLeadTimeDays = totalProcessTime / availableTimeSec;
  const totalLeadTime = wipLeadTime + processLeadTimeDays;

  // ── 4. PCE — Process Cycle Efficiency ─────────────
  // PCE = Process Time (VA) / Lead Time × 100
  const pce = totalLeadTime > 0 ? (processLeadTimeDays / totalLeadTime) * 100 : 0;

  // ── 5. UPDATE UI ──────────────────────────────────
  updateKPIs({
    taktTime,
    totalLeadTime,
    totalProcessTime,
    pce,
    bottleneck,
    availableTimeSec
  });

  updateProcessList(procResults, taktTime);
  updateTimeline(processes, inventories, demand, availableTimeSec);
  highlightBottleneck(bottleneck ? bottleneck.id : null);

  const logLines = [
    `✔ Simulación completada`,
    `Procesos: ${processes.length} | WIP: ${inventories.length}`,
    `Demanda: ${demand} u/día`,
    `Tiempo disponible: ${availableTimeSec.toLocaleString()} seg/día`,
    `─────────────────────`,
    `Takt Time: ${taktTime.toFixed(1)} seg`,
    `Lead Time: ${totalLeadTime.toFixed(2)} días`,
    `PCE: ${pce.toFixed(1)}%`,
    bottleneck ? `Bottleneck: ${bottleneck.props.label}` : ''
  ].join('\n');
  setSimLog(logLines);

  // Hide canvas hint
  document.getElementById('canvas-hint').style.display = 'none';
}

function updateKPIs({ taktTime, totalLeadTime, totalProcessTime, pce, bottleneck, availableTimeSec }) {
  const set = (id, val, sub) => {
    const card = document.getElementById(id);
    card.querySelector('.kpi-value').textContent = val;
    if (sub) card.querySelector('.kpi-sub').textContent = sub;
  };
  set('kpi-takt', taktTime.toFixed(1), 'seg/unidad');
  set('kpi-lt', totalLeadTime.toFixed(2), 'días');
  set('kpi-pt', totalProcessTime.toFixed(0), 'seg (VA)');
  set('kpi-pce', pce.toFixed(1) + '%', pce < 20 ? '⚠ Mejorar flujo' : pce < 50 ? 'Flujo moderado' : '✔ Buen flujo');
  set('kpi-bn', bottleneck ? bottleneck.props.label : 'Ninguno', bottleneck ? `CT neto: ${(bottleneck.props.ct / (bottleneck.props.uptime / 100)).toFixed(1)} seg` : '');
  set('kpi-avail', availableTimeSec.toLocaleString(), 'seg/día');
}

function updateProcessList(procResults, taktTime) {
  const container = document.getElementById('process-list');
  container.innerHTML = '';
  procResults.forEach(p => {
    const cls = p.status === 'ok' ? 'proc-ok' : 'proc-bad';
    const badge = p.status !== 'ok' ? '<span class="proc-item-badge">SOBRECARGADO</span>' : '';
    const isBn = (parseFloat(p.netCT) === Math.max(...procResults.map(x => parseFloat(x.netCT))));
    container.innerHTML += `
      <div class="proc-item ${isBn ? 'is-bn' : ''}">
        <div class="proc-item-name">${p.label}${badge}</div>
        <div class="proc-item-stats">
          CT: <span class="${cls}">${p.ct}s</span> | Net CT: <span class="${cls}">${p.netCT}s</span><br>
          Uptime: ${p.uptime}% | Ops: ${p.operators}<br>
          Capacidad: ${p.capacity} u/día<br>
          Defectos: ${p.defectRate}%
        </div>
      </div>`;
  });
}

function updateTimeline(processes, inventories, demand, availableTimeSec) {
  const container = document.getElementById('timeline-content');
  container.innerHTML = '';
  // Interleave: for each process, check if there's an inventory to the left
  const allItems = [];

  // Simple approach: sort all by x and alternate
  const allElements = [
    ...processes.map(n => ({ ...n, tlType: 'process' })),
    ...inventories.map(n => ({ ...n, tlType: 'inventory' }))
  ].sort((a, b) => a.x - b.x);

  allElements.forEach((item, i) => {
    if (item.tlType === 'inventory') {
      const days = (item.props.units / demand).toFixed(2);
      container.innerHTML += `
        <div class="tl-item">
          <div class="tl-bar wip">${days}d</div>
          <div class="tl-name">${item.props.label}</div>
        </div>
        <div class="tl-sep"></div>`;
    } else {
      const ctSec = item.props.ct;
      const ctDisplay = ctSec >= 60 ? (ctSec/60).toFixed(1)+'m' : ctSec+'s';
      container.innerHTML += `
        <div class="tl-item">
          <div class="tl-bar ${item.props.isVA ? 'va' : 'nva'}">${ctDisplay}</div>
          <div class="tl-name">${item.props.label}</div>
        </div>
        ${i < allElements.length - 1 ? '<div class="tl-sep"></div>' : ''}`;
    }
  });
}

function highlightBottleneck(bnId) {
  document.querySelectorAll('.vsm-node').forEach(el => {
    el.classList.remove('bottleneck');
  });
  if (bnId) {
    const el = document.getElementById(bnId);
    if (el) el.classList.add('bottleneck');
  }
}

function setSimLog(text) {
  document.getElementById('sim-log').textContent = text;
}
