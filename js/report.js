// ===== VSM REPORT v1 — Full stats popup + CSV export =====

let _lastReport = null; // saved after each runSimulation()

// Called by simulation.js after every run to store data
function saveReportData(data) {
  _lastReport = data;
}

function openReport() {
  if (!_lastReport) {
    alert('⚠ Primero presiona ▶ CALCULAR para generar los datos.');
    return;
  }
  document.getElementById('report-body').innerHTML = buildReportHTML(_lastReport);
  document.getElementById('report-overlay').classList.remove('hidden');
}

function closeReport(e) {
  if (e && e.target !== document.getElementById('report-overlay')) return;
  document.getElementById('report-overlay').classList.add('hidden');
}

// ─ BUILD HTML ────────────────────────────────────────────────────
function buildReportHTML(d) {
  const pct = v => v.toFixed(1) + '%';
  const sec = v => fmtTime(v);
  const days = v => v.toFixed(3) + ' d';
  const eff  = v => v >= 60 ? '★ Óptimo' : v >= 35 ? '✔ Moderado' : v >= 15 ? '⚠ Mejorar' : '⚠️ Crítico';

  // ---- 1. FLUJO GLOBAL ----
  const global = `
  <div class="rpt-section">
    <div class="rpt-title">🌊 Flujo Global</div>
    <div class="rpt-grid">
      <div class="rpt-card va">
        <div class="rpt-card-label">Lead Time Promedio</div>
        <div class="rpt-card-value">${days(d.ltMean)}</div>
        ${d.hasStoch ? `<div class="rpt-card-sub">P10: ${days(d.lt10)} | P90: ${days(d.lt90)}</div>` : ''}
      </div>
      <div class="rpt-card">
        <div class="rpt-card-label">Takt Time</div>
        <div class="rpt-card-value">${d.taktTime.toFixed(1)} s</div>
        <div class="rpt-card-sub">Ritmo de demanda</div>
      </div>
      <div class="rpt-card va">
        <div class="rpt-card-label">Tiempo VA Total</div>
        <div class="rpt-card-value">${sec(d.totalVASec)}</div>
        <div class="rpt-card-sub">Suma CT procesos VA</div>
      </div>
      <div class="rpt-card nva">
        <div class="rpt-card-label">Tiempo NVA Total</div>
        <div class="rpt-card-value">${sec(d.totalNVASec)}</div>
        <div class="rpt-card-sub">Transporte + espera</div>
      </div>
      <div class="rpt-card wip">
        <div class="rpt-card-label">Tiempo en WIP</div>
        <div class="rpt-card-value">${days(d.wipDays)}</div>
        <div class="rpt-card-sub">Inventario acumulado</div>
      </div>
      <div class="rpt-card ${d.pceMean >= 35 ? 'va' : 'nva'}">
        <div class="rpt-card-label">PCE Ratio</div>
        <div class="rpt-card-value">${pct(d.pceMean)}</div>
        <div class="rpt-card-sub">${eff(d.pceMean)}</div>
      </div>
      <div class="rpt-card">
        <div class="rpt-card-label">Tiempo Disponible</div>
        <div class="rpt-card-value">${d.availSec.toLocaleString()} s</div>
        <div class="rpt-card-sub">${(d.availSec/3600).toFixed(1)} h/día</div>
      </div>
      <div class="rpt-card">
        <div class="rpt-card-label">Demanda Cliente</div>
        <div class="rpt-card-value">${d.demand} u/d</div>
        <div class="rpt-card-sub">Unidades por día</div>
      </div>
    </div>
  </div>`;

  // ---- 2. TRANSPORTE / NVA POR FLECHA ----
  const arrowRows = d.arrowStats.map(a => `
    <tr>
      <td>${a.from} → ${a.to}</td>
      <td><span class="rpt-badge ${a.type}">${a.type.toUpperCase()}</span></td>
      <td>${a.days.toFixed(2)} d</td>
      <td>${sec(a.sec)}</td>
      <td>${d.ltMean > 0 ? pct(a.sec / (d.ltMean * d.availSec) * 100) : '—'}</td>
    </tr>`).join('');

  const transport = `
  <div class="rpt-section">
    <div class="rpt-title">🚚 Transporte & Espera entre Nodos (NVA)</div>
    <table class="rpt-table">
      <thead><tr><th>Tramo</th><th>Tipo</th><th>Tiempo (días)</th><th>Tiempo</th><th>% del LT</th></tr></thead>
      <tbody>${arrowRows || '<tr><td colspan="5" style="color:var(--text-muted)">Sin flechas configuradas</td></tr>'}</tbody>
    </table>
  </div>`;

  // ---- 3. WIP / INVENTARIOS ----
  const wipRows = d.wipStats.map(w => `
    <tr>
      <td>${w.label}</td>
      <td>${w.units.toLocaleString()} u</td>
      <td>${w.days.toFixed(3)} d</td>
      <td>${sec(w.sec)}</td>
      <td>${d.ltMean > 0 ? pct(w.sec / (d.ltMean * d.availSec) * 100) : '—'}</td>
    </tr>`).join('');

  const wipSection = `
  <div class="rpt-section">
    <div class="rpt-title">📦 Inventario en Proceso (WIP)</div>
    <table class="rpt-table">
      <thead><tr><th>Inventario</th><th>Unidades</th><th>Días</th><th>Tiempo</th><th>% del LT</th></tr></thead>
      <tbody>${wipRows || '<tr><td colspan="5" style="color:var(--text-muted)">Sin inventarios</td></tr>'}</tbody>
    </table>
  </div>`;

  // ---- 4. PROCESOS DETALLE ----
  const procRows = d.procResults.map(p => {
    const saturation = (p.netCT / d.taktTime * 100);
    const satClass   = saturation > 100 ? 'nva' : saturation > 80 ? 'wip' : 'va';
    return `
    <tr>
      <td>${p.label}${p.isBn ? ' 🔴' : ''}</td>
      <td>${p.ctMean.toFixed(1)} s${p.distType !== 'fixed' ? ` <em style="color:var(--text-muted);font-size:9px">(P90: ${p.ctP90.toFixed(1)}s)</em>` : ''}</td>
      <td>${p.netCT.toFixed(1)} s</td>
      <td><span class="rpt-badge ${satClass}">${saturation.toFixed(0)}%</span></td>
      <td>${Math.floor(p.capacity)} u/d</td>
      <td>${p.uptime}%</td>
      <td>${p.operators}</td>
      <td>${p.defectRate}%</td>
      <td>${p.isVA ? '✅ VA' : '❌ NVA'}</td>
    </tr>`;
  }).join('');

  const procSection = `
  <div class="rpt-section">
    <div class="rpt-title">⚙️ Procesos — Detalle</div>
    <table class="rpt-table">
      <thead><tr><th>Proceso</th><th>CT Medio</th><th>CT Neto</th><th>Saturación</th><th>Capacidad</th><th>Uptime</th><th>Ops</th><th>Defectos</th><th>Tipo</th></tr></thead>
      <tbody>${procRows}</tbody>
    </table>
  </div>`;

  // ---- 5. OPORTUNIDADES DE MEJORA ----
  const opps = [];
  if (d.pceMean < 15) opps.push({ icon:'🔴', text:`PCE crítico (${pct(d.pceMean)}). El ${pct(100-d.pceMean)} del tiempo es desperdicio.` });
  else if (d.pceMean < 35) opps.push({ icon:'⚠', text:`PCE bajo (${pct(d.pceMean)}). Objetivo recomendado: >35%.` });
  d.arrowStats.filter(a => a.days >= 1).forEach(a =>
    opps.push({ icon:'⏳', text:`Transporte largo: ${a.from}→${a.to} tarda ${a.days.toFixed(1)} días (NVA).` })
  );
  d.wipStats.filter(w => w.days >= 2).forEach(w =>
    opps.push({ icon:'📦', text:`WIP alto en "${w.label}": ${w.units} u = ${w.days.toFixed(1)} días acumulados.` })
  );
  d.procResults.filter(p => p.netCT > d.taktTime).forEach(p =>
    opps.push({ icon:'🔴', text:`Sobrecarga en "${p.label}": CT neto ${p.netCT.toFixed(1)}s > Takt ${d.taktTime.toFixed(1)}s.` })
  );
  d.procResults.filter(p => p.defectRate > 2).forEach(p =>
    opps.push({ icon:'⚠️', text:`Tasa de defectos alta en "${p.label}": ${p.defectRate}%.` })
  );
  if (!opps.length) opps.push({ icon:'✅', text:'No se detectaron desperdicios críticos. ¡Excelente VSM!' });

  const oppSection = `
  <div class="rpt-section">
    <div class="rpt-title">💡 Oportunidades de Mejora</div>
    <ul class="rpt-opps">
      ${opps.map(o => `<li><span class="rpt-opp-icon">${o.icon}</span>${o.text}</li>`).join('')}
    </ul>
  </div>`;

  return global + transport + wipSection + procSection + oppSection;
}

// ─ CSV EXPORT ────────────────────────────────────────────────────
function exportReportCSV() {
  if (!_lastReport) return;
  const d = _lastReport;
  const rows = [];
  const q = v => `"${String(v).replace(/"/g,'""')}"`;

  rows.push(['SECCION','INDICADOR','VALOR','UNIDAD','NOTAS']);

  // Global
  rows.push(['Flujo Global','Lead Time Promedio', d.ltMean.toFixed(4), 'dias', '']);
  if (d.hasStoch) {
    rows.push(['Flujo Global','Lead Time P10', d.lt10.toFixed(4), 'dias', 'Monte Carlo']);
    rows.push(['Flujo Global','Lead Time P90', d.lt90.toFixed(4), 'dias', 'Monte Carlo']);
  }
  rows.push(['Flujo Global','Takt Time', d.taktTime.toFixed(4), 'seg', '']);
  rows.push(['Flujo Global','Tiempo VA Total', d.totalVASec.toFixed(2), 'seg', 'Suma CT procesos VA']);
  rows.push(['Flujo Global','Tiempo NVA Total', d.totalNVASec.toFixed(2), 'seg', 'Transporte + espera']);
  rows.push(['Flujo Global','Tiempo WIP Total', (d.wipDays * d.availSec).toFixed(2), 'seg', '']);
  rows.push(['Flujo Global','Tiempo WIP Total', d.wipDays.toFixed(4), 'dias', '']);
  rows.push(['Flujo Global','PCE Ratio', d.pceMean.toFixed(2), '%', 'Process Cycle Efficiency']);
  rows.push(['Flujo Global','Tiempo Disponible', d.availSec.toFixed(0), 'seg/dia', '']);
  rows.push(['Flujo Global','Demanda', d.demand, 'u/dia', '']);

  // Arrows / Transport
  d.arrowStats.forEach(a => {
    rows.push(['Transporte NVA', `${a.from} -> ${a.to}`, a.days.toFixed(4), 'dias', a.type]);
    rows.push(['Transporte NVA', `${a.from} -> ${a.to}`, a.sec.toFixed(2), 'seg', a.type]);
  });

  // WIP
  d.wipStats.forEach(w => {
    rows.push(['WIP / Inventario', w.label + ' - Unidades', w.units, 'u', '']);
    rows.push(['WIP / Inventario', w.label + ' - Dias',    w.days.toFixed(4), 'dias', '']);
    rows.push(['WIP / Inventario', w.label + ' - Tiempo',  w.sec.toFixed(2), 'seg', '']);
  });

  // Procesos
  d.procResults.forEach(p => {
    const pref = 'Proceso - ' + p.label;
    rows.push(['Procesos', pref + ' - CT Medio',    p.ctMean.toFixed(4),    'seg', p.distType]);
    rows.push(['Procesos', pref + ' - CT P90',      p.ctP90.toFixed(4),     'seg', p.distType !== 'fixed' ? 'MC' : 'N/A']);
    rows.push(['Procesos', pref + ' - CT Neto',     p.netCT.toFixed(4),     'seg', 'ajustado uptime']);
    rows.push(['Procesos', pref + ' - Capacidad',   Math.floor(p.capacity), 'u/dia', '']);
    rows.push(['Procesos', pref + ' - Saturacion',  (p.netCT / d.taktTime * 100).toFixed(1), '%', p.netCT > d.taktTime ? 'SOBRECARGADO' : 'OK']);
    rows.push(['Procesos', pref + ' - Uptime',      p.uptime,               '%', '']);
    rows.push(['Procesos', pref + ' - Operadores',  p.operators,            '#', '']);
    rows.push(['Procesos', pref + ' - Defectos',    p.defectRate,           '%', '']);
    rows.push(['Procesos', pref + ' - Tipo',        p.isVA ? 'VA' : 'NVA',  '', p.isBn ? 'CUELLO DE BOTELLA' : '']);
  });

  const csv = rows.map(r => r.map(q).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `vsm-report-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
}
