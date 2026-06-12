// ===== VSM REPORT v2 — Process Simulator-style Dashboard =====

let _lastReport = null;
let _scenarios  = {};
let _baselineKey = null;

function saveReportData(data) {
  _lastReport = data;
  if (!_baselineKey) {
    _baselineKey = 'Baseline';
    _scenarios['Baseline'] = JSON.parse(JSON.stringify(data));
  } else {
    const n = Object.keys(_scenarios).length;
    const key = 'Scenario' + n;
    _scenarios[key] = JSON.parse(JSON.stringify(data));
  }
}

function openReport() {
  if (!_lastReport) {
    alert('⚠ Primero presiona ▶ CALCULAR para generar los datos.');
    return;
  }
  document.getElementById('report-body').innerHTML = buildDashboardHTML(_lastReport);
  document.getElementById('report-overlay').classList.remove('hidden');
}

function closeReport(e) {
  if (e && e.target !== document.getElementById('report-overlay')) return;
  document.getElementById('report-overlay').classList.add('hidden');
}

// ─ MAIN ────────────────────────────────────────────────────────────
function buildDashboardHTML(d) {
  return `<div class="db-root">
    ${buildScoreboard(d)}
    ${buildEntityStates()}
    ${buildActivityStates(d)}
    ${buildResourceStates(d)}
    ${buildWIPStates(d)}
    ${buildProcessDetail(d)}
    ${buildOpportunities(d)}
  </div>`;
}

// ─ 1. SCOREBOARD ────────────────────────────────────────────────────
function buildScoreboard(d) {
  const scRows = Object.entries(_scenarios).map(([name, sd]) => `
    <tr class="${name===_baselineKey?'sc-baseline':'sc-scenario'}">
      <td>${name===_baselineKey?'🟦':'🟩'} ${name}</td>
      <td class="sc-num">${sd.ltMean.toFixed(3)} d</td>
      <td class="sc-num">${sd.taktTime.toFixed(1)} s</td>
      <td class="sc-num">${sd.pceMean.toFixed(1)}%</td>
      <td class="sc-num">${fmtTime(sd.totalVASec)}</td>
      <td class="sc-num">${sd.demand} u/d</td>
      <td class="sc-num ${sd.pceMean>=35?'sc-ok':'sc-warn'}">${sd.pceMean>=60?'★ Óptimo':sd.pceMean>=35?'✔ Moderado':sd.pceMean>=15?'⚠ Mejorar':'🔴 Crítico'}</td>
    </tr>`).join('');

  return `
  <div class="db-panel" id="db-scoreboard">
    <div class="db-panel-title">🏆 Scoreboard — Comparativo de Escenarios</div>
    <table class="db-table sc-table">
      <thead><tr>
        <th>Escenario</th><th>Lead Time</th><th>Takt Time</th>
        <th>PCE %</th><th>Tiempo VA</th><th>Demanda</th><th>Estado</th>
      </tr></thead>
      <tbody>${scRows}</tbody>
    </table>
    <div class="db-note">ℹ️ Cada CALCULAR guarda un nuevo escenario automáticamente para comparar.</div>
  </div>`;
}

// ─ 2. ENTITY STATES ────────────────────────────────────────────────
function buildEntityStates() {
  const rows = Object.entries(_scenarios).map(([name, sd]) => {
    const wipSec = sd.wipDays * sd.availSec;
    const tot    = sd.totalVASec + sd.totalNVASec + wipSec;
    const va     = tot>0 ? sd.totalVASec/tot*100 : 0;
    const nva    = tot>0 ? sd.totalNVASec/tot*100 : 0;
    const wip    = tot>0 ? wipSec/tot*100 : 0;
    return `
    <div class="db-bar-row">
      <div class="db-bar-label">Work Unit <span class="sc-tag">(${name})</span></div>
      <div class="db-bar-track">
        <div class="db-bar-seg seg-va"  style="width:${va.toFixed(1)}%"  title="VA ${va.toFixed(1)}%"></div>
        <div class="db-bar-seg seg-nva" style="width:${nva.toFixed(1)}%" title="NVA ${nva.toFixed(1)}%"></div>
        <div class="db-bar-seg seg-wip" style="width:${wip.toFixed(1)}%" title="WIP ${wip.toFixed(1)}%"></div>
      </div>
      <div class="db-bar-nums">
        <span class="seg-va-txt">■ VA ${va.toFixed(1)}%</span>
        <span class="seg-nva-txt">■ NVA ${nva.toFixed(1)}%</span>
        <span class="seg-wip-txt">■ WIP ${wip.toFixed(1)}%</span>
      </div>
    </div>`;
  }).join('');

  return `
  <div class="db-panel">
    <div class="db-panel-title">📦 Entity States — Distribución de Tiempo (Work Unit)</div>
    <div class="db-legend">
      <span class="seg-va-txt">■ Valor Agregado (VA)</span>
      <span class="seg-nva-txt">■ No VA (Transporte/Espera)</span>
      <span class="seg-wip-txt">■ WIP (Inventario en espera)</span>
    </div>
    ${rows}
  </div>`;
}

// ─ 3. SINGLE CAPACITY ACTIVITY STATES ─────────────────────────────
function buildActivityStates(d) {
  const allLabels = d.procResults.map(p => p.label);
  const allSc     = Object.entries(_scenarios);

  const rows = allLabels.map(lbl => {
    return allSc.map(([name, sd]) => {
      const p = sd.procResults.find(x => x.label === lbl);
      if (!p) return '';
      const opPct   = p.uptime;
      const downPct = 100 - p.uptime;
      const sat     = p.netCT / sd.taktTime * 100;
      const waitPct = Math.max(0, Math.min(sat - opPct, 30));
      const idlePct = Math.max(0, 100 - opPct - downPct - waitPct);
      const adjOp   = Math.min(opPct, 100 - downPct - waitPct);
      const isBn    = p.isBn ? ' db-bar-bn' : '';
      return `
      <div class="db-bar-row${isBn}">
        <div class="db-bar-label">${lbl} <span class="sc-tag">(${name})</span>${p.isBn?' <span class="db-badge db-badge-red">CUELLO</span>':''}</div>
        <div class="db-bar-track">
          <div class="db-bar-seg seg-op"   style="width:${adjOp.toFixed(1)}%"   title="Operando ${adjOp.toFixed(1)}%"></div>
          <div class="db-bar-seg seg-idle" style="width:${idlePct.toFixed(1)}%" title="Idle ${idlePct.toFixed(1)}%"></div>
          <div class="db-bar-seg seg-wait" style="width:${waitPct.toFixed(1)}%" title="Waiting ${waitPct.toFixed(1)}%"></div>
          <div class="db-bar-seg seg-down" style="width:${downPct.toFixed(1)}%" title="Down ${downPct.toFixed(1)}%"></div>
        </div>
        <div class="db-bar-pct ${sat>100?'sc-warn':''}">${sat.toFixed(0)}% sat.</div>
      </div>`;
    }).join('');
  }).join('');

  return `
  <div class="db-panel">
    <div class="db-panel-title">⚙️ Single Capacity Activity States — Uso por Proceso</div>
    <div class="db-legend">
      <span class="seg-op-txt">■ % Operando</span>
      <span class="seg-idle-txt">■ % Idle</span>
      <span class="seg-wait-txt">■ % Waiting</span>
      <span class="seg-down-txt">■ % Down</span>
    </div>
    ${rows}
  </div>`;
}

// ─ 4. RESOURCE STATES ──────────────────────────────────────────────
function buildResourceStates(d) {
  const totalOps = d.procResults.reduce((s, p) => s + (p.operators||1), 0);
  if (!totalOps) return '';

  const rows = d.procResults.map(p => {
    const util = Math.min(100, p.netCT / d.taktTime * 100);
    const idle = Math.max(0, 100 - util);
    return `
    <div class="db-bar-row">
      <div class="db-bar-label">${p.label} <span class="sc-tag">(${p.operators} op.)</span></div>
      <div class="db-bar-track">
        <div class="db-bar-seg seg-op"   style="width:${util.toFixed(1)}%" title="Utilización ${util.toFixed(1)}%"></div>
        <div class="db-bar-seg seg-idle" style="width:${idle.toFixed(1)}%" title="Libre ${idle.toFixed(1)}%"></div>
      </div>
      <div class="db-bar-pct">${util.toFixed(0)}%</div>
    </div>`;
  }).join('');

  return `
  <div class="db-panel">
    <div class="db-panel-title">👷 Resource States — Utilización de Operadores</div>
    <div class="db-legend">
      <span class="seg-op-txt">■ % Utilizando</span>
      <span class="seg-idle-txt">■ % Libre</span>
    </div>
    ${rows}
  </div>`;
}

// ─ 5. WIP BUFFER STATES ────────────────────────────────────────────
function buildWIPStates(d) {
  if (!d.wipStats.length) return '';
  const allSc = Object.entries(_scenarios);

  const rows = d.wipStats.map(w => {
    return allSc.map(([name, sd]) => {
      const wsd = sd.wipStats.find(x => x.label === w.label);
      if (!wsd) return '';
      const allUnits = allSc.map(([,s]) => (s.wipStats.find(x=>x.label===w.label)||{units:0}).units);
      const maxU     = Math.max(...allUnits, 1);
      const fullPct  = wsd.units / maxU * 100;
      const emptyPct = 100 - fullPct;
      return `
      <div class="db-bar-row">
        <div class="db-bar-label">${w.label} Input Buffer <span class="sc-tag">(${name})</span></div>
        <div class="db-bar-track">
          <div class="db-bar-seg seg-idle" style="width:${emptyPct.toFixed(1)}%" title="Vacío ${emptyPct.toFixed(1)}%"></div>
          <div class="db-bar-seg seg-wip"  style="width:${fullPct.toFixed(1)}%"  title="Ocupado ${fullPct.toFixed(1)}%"></div>
        </div>
        <div class="db-bar-pct">${wsd.units} u / ${wsd.days.toFixed(2)}d</div>
      </div>`;
    }).join('');
  }).join('');

  return `
  <div class="db-panel">
    <div class="db-panel-title">📊 Multiple Capacity Activity States — Buffers WIP</div>
    <div class="db-legend">
      <span class="seg-idle-txt">■ Vacío</span>
      <span class="seg-wip-txt">■ Ocupado (WIP)</span>
    </div>
    ${rows}
  </div>`;
}

// ─ 6. PROCESS DETAIL ───────────────────────────────────────────────
function buildProcessDetail(d) {
  const rows = d.procResults.map(p => {
    const sat      = p.netCT / d.taktTime * 100;
    const satClass = sat > 100 ? 'sc-warn' : sat > 80 ? 'sc-warn80' : 'sc-ok';
    const batchBadge = p.batchSize > 1 ? `<span class="db-badge db-badge-blue">×${p.batchSize} lote</span>` : '';
    const bnBadge    = p.isBn ? '<span class="db-badge db-badge-red">🔴 CUELLO</span>' : '';
    return `
    <tr>
      <td>${p.label} ${bnBadge}${batchBadge}</td>
      <td class="sc-num">${p.ctMean.toFixed(1)} s${p.distType!=='fixed'?`<br><small style="color:var(--text-muted)">P90: ${p.ctP90.toFixed(1)}s</small>`:''}</td>
      <td class="sc-num">${p.netCT.toFixed(1)} s</td>
      <td class="sc-num"><span class="${satClass}" style="font-weight:700">${sat.toFixed(0)}%</span></td>
      <td class="sc-num">${Math.floor(p.capacity)} u/d</td>
      <td class="sc-num">${p.uptime}%</td>
      <td class="sc-num">${p.operators}</td>
      <td class="sc-num">${p.defectRate}%</td>
      <td class="sc-num">${p.isVA ? '<span class="sc-ok">✅ VA</span>' : '<span class="sc-warn">❌ NVA</span>'}</td>
    </tr>`;
  }).join('');

  return `
  <div class="db-panel">
    <div class="db-panel-title">📄 Detalle de Procesos</div>
    <table class="db-table">
      <thead><tr>
        <th>Proceso</th><th>CT Medio</th><th>CT Neto</th><th>Saturación</th>
        <th>Capacidad</th><th>Uptime</th><th>Ops.</th><th>Defectos</th><th>Tipo</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

// ─ 7. OPPORTUNITIES ────────────────────────────────────────────────
function buildOpportunities(d) {
  const fp  = v => v.toFixed(1) + '%';
  const opps = [];

  if (d.pceMean < 15)       opps.push({ icon:'🔴', cls:'opp-critical', text:`PCE crítico (${fp(d.pceMean)}). El ${fp(100-d.pceMean)} del tiempo es desperdicio puro.` });
  else if (d.pceMean < 35)  opps.push({ icon:'⚠️', cls:'opp-warn',     text:`PCE bajo (${fp(d.pceMean)}). Objetivo recomendado: >35%.` });
  else                       opps.push({ icon:'✅', cls:'opp-ok',       text:`PCE aceptable (${fp(d.pceMean)}). Busca mejoras incrementales.` });

  d.procResults.filter(p => p.netCT > d.taktTime).forEach(p =>
    opps.push({ icon:'🔴', cls:'opp-critical', text:`Sobrecarga: "${p.label}" CT neto ${p.netCT.toFixed(1)}s > Takt ${d.taktTime.toFixed(1)}s.` })
  );
  d.arrowStats.filter(a => a.days >= 1).forEach(a =>
    opps.push({ icon:'⏳', cls:'opp-warn', text:`Transporte largo: ${a.from}→${a.to} tarda ${a.days.toFixed(1)} días (NVA).` })
  );
  d.wipStats.filter(w => w.days >= 2).forEach(w =>
    opps.push({ icon:'📦', cls:'opp-warn', text:`WIP alto en "${w.label}": ${w.units} u = ${w.days.toFixed(1)} días.` })
  );
  d.procResults.filter(p => p.defectRate > 2).forEach(p =>
    opps.push({ icon:'⚠️', cls:'opp-warn', text:`Defectos en "${p.label}": ${p.defectRate}%.` })
  );
  if (opps.every(o => o.cls === 'opp-ok'))
    opps.push({ icon:'⭐', cls:'opp-ok', text:'¡No se detectaron desperdicios críticos! Excelente VSM.' });

  return `
  <div class="db-panel">
    <div class="db-panel-title">💡 Oportunidades de Mejora Lean</div>
    <div class="db-opps">
      ${opps.map(o => `<div class="db-opp ${o.cls}"><span class="db-opp-icon">${o.icon}</span><span>${o.text}</span></div>`).join('')}
    </div>
  </div>`;
}

// ─ CSV EXPORT ──────────────────────────────────────────────────────
function exportReportCSV() {
  if (!_lastReport) return;
  const rows = [];
  const q = v => `"${String(v).replace(/"/g,'""')}"`;

  rows.push(['SECCION','ESCENARIO','INDICADOR','VALOR','UNIDAD','NOTAS']);

  Object.entries(_scenarios).forEach(([name, sd]) => {
    rows.push(['Flujo Global', name, 'Lead Time Promedio', sd.ltMean.toFixed(4),   'dias', '']);
    if (sd.hasStoch) {
      rows.push(['Flujo Global', name, 'Lead Time P10', sd.lt10.toFixed(4), 'dias', 'MC']);
      rows.push(['Flujo Global', name, 'Lead Time P90', sd.lt90.toFixed(4), 'dias', 'MC']);
    }
    rows.push(['Flujo Global', name, 'Takt Time',        sd.taktTime.toFixed(4),  'seg',   '']);
    rows.push(['Flujo Global', name, 'Tiempo VA Total',  sd.totalVASec.toFixed(2),'seg',   '']);
    rows.push(['Flujo Global', name, 'Tiempo NVA Total', sd.totalNVASec.toFixed(2),'seg',  '']);
    rows.push(['Flujo Global', name, 'PCE Ratio',        sd.pceMean.toFixed(2),   '%',     '']);
    rows.push(['Flujo Global', name, 'Demanda',          sd.demand,               'u/dia', '']);

    sd.procResults.forEach(p => {
      const sat = (p.netCT/sd.taktTime*100).toFixed(1);
      rows.push(['Proceso', name, `${p.label} - CT Medio`,   p.ctMean.toFixed(4),    'seg',   p.distType]);
      rows.push(['Proceso', name, `${p.label} - CT Neto`,    p.netCT.toFixed(4),     'seg',   '']);
      rows.push(['Proceso', name, `${p.label} - Saturacion`, sat,                    '%',     p.netCT>sd.taktTime?'SOBRECARGADO':'OK']);
      rows.push(['Proceso', name, `${p.label} - Capacidad`,  Math.floor(p.capacity), 'u/dia', '']);
      rows.push(['Proceso', name, `${p.label} - Uptime`,     p.uptime,               '%',     '']);
      rows.push(['Proceso', name, `${p.label} - Operadores`, p.operators,            '#',     '']);
      rows.push(['Proceso', name, `${p.label} - Defectos`,   p.defectRate,           '%',     '']);
      rows.push(['Proceso', name, `${p.label} - Tipo`,       p.isVA?'VA':'NVA',      '',      p.isBn?'CUELLO':'']);
    });

    sd.wipStats.forEach(w => {
      rows.push(['WIP', name, `${w.label} - Unidades`, w.units,            'u',    '']);
      rows.push(['WIP', name, `${w.label} - Dias`,     w.days.toFixed(4), 'dias', '']);
    });
  });

  const csv  = rows.map(r => r.map(q).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = `vsm-dashboard-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
}
