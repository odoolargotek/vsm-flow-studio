// ===== UI v3 — Gate modal + Resource fields — VSM Flow Studio =====

// ─ MODAL ───────────────────────────────────────────────────────
function openModal(nodeId) {
  const node = getNode(nodeId);
  if (!node) return;
  editingNodeId = nodeId;
  document.getElementById('modal-title').textContent = 'Editar: ' + (node.props.label || node.type);
  document.getElementById('modal-body').innerHTML = buildModalForm(node);
  document.getElementById('modal-overlay').classList.remove('hidden');
  if (node.type === 'process') {
    updateDistFields();
    recalcModalPreview();
  }
}

function buildModalForm(node) {
  const p = node.props;

  // ── PROCESS ──
  if (node.type === 'process') {
    const batchSize   = p.batchSize    != null ? p.batchSize    : 1;
    const resourceCT  = p.resourceCT   != null ? p.resourceCT  : 0;
    const resourceName = p.resourceName || '';
    return `
      <div class="prop-group">
        <label>Nombre del proceso</label>
        <input type="text" id="prop-label" value="${p.label}">
      </div>
      <div class="prop-group">
        <label>¿Agrega valor? (VA/NVA)</label>
        <select id="prop-va">
          <option value="true"  ${p.isVA!==false?'selected':''}>Sí — Agrega Valor (VA)</option>
          <option value="false" ${p.isVA===false?'selected':''}>No — No Agrega Valor (NVA)</option>
        </select>
      </div>

      <hr class="prop-divider">
      <div class="prop-section-title">⏱ CYCLE TIME — Distribución</div>
      <div class="prop-group">
        <label>Tipo de distribución</label>
        <select id="prop-dist" onchange="updateDistFields()">
          <option value="fixed"      ${(!p.distType||p.distType==='fixed')?'selected':''}>Fijo (determinista)</option>
          <option value="normal"     ${p.distType==='normal'?'selected':''}>Normal (μ, σ)</option>
          <option value="triangular" ${p.distType==='triangular'?'selected':''}>Triangular (min, moda, max)</option>
        </select>
      </div>
      <div class="prop-row">
        <div class="prop-group">
          <label id="label-ct">CT Promedio / Moda (seg)</label>
          <input type="number" id="prop-ct" value="${p.ct||30}" min="0" step="0.5" oninput="recalcModalPreview()">
        </div>
        <div class="prop-group" id="field-std">
          <label>σ Desv. Est. (seg)</label>
          <input type="number" id="prop-ctStd" value="${p.ctStd||3}" min="0" step="0.5" oninput="recalcModalPreview()">
        </div>
      </div>
      <div class="prop-row" id="field-tri" style="display:none">
        <div class="prop-group">
          <label>CT Mínimo (seg)</label>
          <input type="number" id="prop-ctMin" value="${p.ctMin||Math.round((p.ct||30)*0.7)}" min="0" oninput="recalcModalPreview()">
        </div>
        <div class="prop-group">
          <label>CT Máximo (seg)</label>
          <input type="number" id="prop-ctMax" value="${p.ctMax||Math.round((p.ct||30)*1.5)}" min="0" oninput="recalcModalPreview()">
        </div>
      </div>

      <hr class="prop-divider">
      <div class="prop-section-title">⚙ PROCESO</div>
      <div class="prop-row">
        <div class="prop-group">
          <label>Changeover C/O (min)</label>
          <input type="number" id="prop-co" value="${p.co||0}" min="0">
        </div>
        <div class="prop-group">
          <label>Uptime (%)</label>
          <input type="number" id="prop-uptime" value="${p.uptime||90}" min="1" max="100" oninput="recalcModalPreview()">
        </div>
      </div>
      <div class="prop-row">
        <div class="prop-group">
          <label># Operadores</label>
          <input type="number" id="prop-ops" value="${p.operators||1}" min="1">
        </div>
        <div class="prop-group">
          <label>Defect Rate (%)</label>
          <input type="number" id="prop-defect" value="${p.defectRate||0}" min="0" max="100">
        </div>
      </div>
      <div class="prop-row">
        <div class="prop-group">
          <label>Turnos/día</label>
          <input type="number" id="prop-shifts" value="${p.shifts||1}" min="1" max="3" oninput="recalcModalPreview()">
        </div>
        <div class="prop-group">
          <label>Horas/turno</label>
          <input type="number" id="prop-hours" value="${p.hoursShift||8}" min="1" max="24" oninput="recalcModalPreview()">
        </div>
      </div>

      <hr class="prop-divider">
      <div class="prop-section-title">👤 RECURSO (Persona / Máquina)</div>
      <div style="font-size:10px;color:var(--text-muted);margin-bottom:8px">Opcional. Si se asigna un recurso, su CT se usa para calcular la utilización real del operador/máquina.</div>
      <div class="prop-group">
        <label>Nombre del recurso</label>
        <input type="text" id="prop-resource-name" placeholder="Ej: Juan / Torno CNC" value="${resourceName}">
      </div>
      <div class="prop-row">
        <div class="prop-group">
          <label>CT del Recurso (seg)</label>
          <input type="number" id="prop-resource-ct" value="${resourceCT}" min="0" step="0.5" oninput="recalcModalPreview()"
            placeholder="0 = igual al CT del proceso">
        </div>
        <div class="prop-group" style="align-self:flex-end;padding-bottom:4px;">
          <small style="color:var(--c-muted)">Tiempo que el recurso está activo por unidad. Puede ser menor al CT del proceso.</small>
        </div>
      </div>

      <hr class="prop-divider">
      <div class="prop-section-title">📦 LOTE</div>
      <div class="prop-row">
        <div class="prop-group">
          <label>Tamaño de Lote (u/lote)</label>
          <input type="number" id="prop-batch" value="${batchSize}" min="1" step="1" oninput="recalcModalPreview()"
            style="font-size:1.1rem;font-weight:700;">
        </div>
        <div class="prop-group" style="align-self:flex-end;padding-bottom:4px;">
          <small style="color:var(--c-muted)">Unidades que deben completarse antes de pasar al siguiente proceso.</small>
        </div>
      </div>

      <hr class="prop-divider">
      <div class="prop-calc" id="modal-calc"></div>`;
  }

  // ── GATE ──
  if (node.type === 'gate') {
    const outs = arrows.filter(a => a.fromId === node.id);
    const totalPct = outs.reduce((s,a) => s + (a.splitPct||0), 0);
    const pctColor = Math.abs(totalPct - 100) < 0.01 ? 'var(--success,#3fb950)' : 'var(--danger,#f85149)';
    const pctRows = outs.length ? outs.map(a => {
      const lbl = getNode(a.toId)?.props?.label || a.toId;
      return `<div class="prop-row" style="align-items:center;gap:8px">
        <div class="prop-group" style="flex:2"><label>→ ${lbl}</label></div>
        <div class="prop-group" style="flex:1">
          <input type="number" id="gpct-${a.id}" value="${a.splitPct||0}" min="0" max="100"
            oninput="recalcGatePreview('${node.id}')">
        </div>
        <span style="color:var(--text-muted);font-size:11px">%</span>
      </div>`;
    }).join('') : `<div style="color:var(--text-muted);font-size:11px">No hay salidas conectadas aún. Conecta flechas desde este Gate.</div>`;
    return `
      <div class="prop-group">
        <label>Nombre del Gate</label>
        <input type="text" id="prop-label" value="${p.label}">
      </div>
      <hr class="prop-divider">
      <div class="prop-section-title">🔀 Distribución de Flujo</div>
      <div style="font-size:10px;color:var(--text-muted);margin-bottom:10px">Define qué porcentaje del flujo va a cada salida. La suma debe ser 100%.</div>
      ${pctRows}
      <div id="gate-total-preview" style="font-size:11px;margin-top:8px;color:${pctColor}">
        Total: ${totalPct.toFixed(0)}%
      </div>`;
  }

  // ── INVENTORY ──
  if (node.type === 'inventory') {
    return `
      <div class="prop-group"><label>Etiqueta</label><input type="text" id="prop-label" value="${p.label}"></div>
      <div class="prop-group"><label>Unidades en inventario (WIP)</label><input type="number" id="prop-units" value="${p.units||100}" min="0"></div>`;
  }

  // ── DEFAULT ──
  return `<div class="prop-group"><label>Nombre</label><input type="text" id="prop-label" value="${p.label}"></div>`;
}

function recalcGatePreview(gateId) {
  const outs = arrows.filter(a => a.fromId === gateId);
  const total = outs.reduce((s,a) => {
    const inp = document.getElementById('gpct-'+a.id);
    return s + (parseFloat(inp?.value)||0);
  }, 0);
  const el = document.getElementById('gate-total-preview');
  if (el) {
    el.textContent = `Total: ${total.toFixed(0)}%`;
    el.style.color = Math.abs(total-100) < 0.01 ? 'var(--success,#3fb950)' : 'var(--danger,#f85149)';
  }
}

function updateDistFields() {
  const dist = document.getElementById('prop-dist')?.value;
  const fieldStd = document.getElementById('field-std');
  const fieldTri = document.getElementById('field-tri');
  const labelCT  = document.getElementById('label-ct');
  if (!fieldStd || !fieldTri) return;
  if (dist === 'normal') {
    fieldStd.style.display = '';
    fieldTri.style.display = 'none';
    if (labelCT) labelCT.textContent = 'μ Media / CT promedio (seg)';
  } else if (dist === 'triangular') {
    fieldStd.style.display = 'none';
    fieldTri.style.display = '';
    if (labelCT) labelCT.textContent = 'CT Moda / más probable (seg)';
  } else {
    fieldStd.style.display = 'none';
    fieldTri.style.display = 'none';
    if (labelCT) labelCT.textContent = 'CT Fijo (seg)';
  }
  recalcModalPreview();
}

function recalcModalPreview() {
  const calc = document.getElementById('modal-calc');
  if (!calc) return;
  const ct           = parseFloat(document.getElementById('prop-ct')?.value)           || 0;
  const uptime       = parseFloat(document.getElementById('prop-uptime')?.value)        || 90;
  const shifts       = parseFloat(document.getElementById('prop-shifts')?.value)        || 1;
  const hours        = parseFloat(document.getElementById('prop-hours')?.value)         || 8;
  const dist         = document.getElementById('prop-dist')?.value || 'fixed';
  const std          = parseFloat(document.getElementById('prop-ctStd')?.value)         || 0;
  const ctMin        = parseFloat(document.getElementById('prop-ctMin')?.value)         || 0;
  const ctMax        = parseFloat(document.getElementById('prop-ctMax')?.value)         || ct;
  const batchSize    = parseInt(document.getElementById('prop-batch')?.value)           || 1;
  const resourceCT   = parseFloat(document.getElementById('prop-resource-ct')?.value)  || 0;
  const resourceName = document.getElementById('prop-resource-name')?.value || '';

  const availSec  = hours * shifts * 3600 * (uptime / 100);
  const netCT     = ct > 0 ? (ct / (uptime / 100)).toFixed(1) : '—';
  const capacity  = ct > 0 ? Math.floor(availSec / ct) : '—';
  const batchDelay = batchSize > 1 && ct > 0
    ? `<br>Retardo de lote: <span>${((batchSize - 1) * ct).toFixed(0)}s ≈ ${((batchSize - 1) * ct / 3600).toFixed(2)}h</span>`
    : '';

  const effResCT = resourceCT > 0 ? resourceCT : ct;
  const resUtil  = ct > 0 && resourceName
    ? `<br>Utilización recurso: <span>${((effResCT / ct) * 100).toFixed(0)}% del tiempo de ciclo</span>`
    : '';

  let distInfo = '';
  if (dist === 'normal') {
    distInfo = `<br>Rango ~95%: <span>${(ct - 2*std).toFixed(1)}s – ${(ct + 2*std).toFixed(1)}s</span>`;
  } else if (dist === 'triangular') {
    const triMean = ((ctMin + ct + ctMax) / 3).toFixed(1);
    distInfo = `<br>Media triangular: <span>${triMean}s</span>`;
  }

  calc.innerHTML = `
    Tiempo disponible: <span>${availSec.toLocaleString(undefined,{maximumFractionDigits:0})} seg/día</span><br>
    CT neto (ajustado uptime): <span>${netCT}s</span><br>
    Capacidad estimada: <span>${capacity} u/día</span>${distInfo}${batchDelay}${resUtil}`;
}

function saveNodeProps() {
  const node = getNode(editingNodeId);
  if (!node) return;
  node.props.label = document.getElementById('prop-label')?.value || node.props.label;

  if (node.type === 'process') {
    node.props.ct           = parseFloat(document.getElementById('prop-ct')?.value)     || 0;
    node.props.co           = parseFloat(document.getElementById('prop-co')?.value)     || 0;
    node.props.uptime       = parseFloat(document.getElementById('prop-uptime')?.value) || 90;
    node.props.operators    = parseInt(document.getElementById('prop-ops')?.value)      || 1;
    node.props.shifts       = parseInt(document.getElementById('prop-shifts')?.value)   || 1;
    node.props.hoursShift   = parseFloat(document.getElementById('prop-hours')?.value)  || 8;
    node.props.defectRate   = parseFloat(document.getElementById('prop-defect')?.value) || 0;
    node.props.isVA         = document.getElementById('prop-va')?.value === 'true';
    node.props.distType     = document.getElementById('prop-dist')?.value || 'fixed';
    node.props.ctStd        = parseFloat(document.getElementById('prop-ctStd')?.value)  || 0;
    node.props.ctMin        = parseFloat(document.getElementById('prop-ctMin')?.value)  || 0;
    node.props.ctMax        = parseFloat(document.getElementById('prop-ctMax')?.value)  || 0;
    node.props.batchSize    = parseInt(document.getElementById('prop-batch')?.value)    || 1;
    node.props.resourceName = document.getElementById('prop-resource-name')?.value || '';
    node.props.resourceCT   = parseFloat(document.getElementById('prop-resource-ct')?.value) || 0;
  }

  if (node.type === 'gate') {
    const outs = arrows.filter(a => a.fromId === node.id);
    outs.forEach(a => {
      const inp = document.getElementById('gpct-'+a.id);
      if (inp) a.splitPct = parseFloat(inp.value) || 0;
    });
    refreshAllGates();
    renderAllArrows();
  }

  if (node.type === 'inventory') {
    node.props.units = parseInt(document.getElementById('prop-units')?.value) || 0;
  }

  refreshNodeElement(editingNodeId);
  closeModal();
}

function closeModal(e) {
  if (e && e.target !== document.getElementById('modal-overlay')) return;
  document.getElementById('modal-overlay').classList.add('hidden');
  editingNodeId = null;
}

// ─ SAVE / LOAD ─────────────────────────────────────────────────
function saveDiagram() {
  const data = { nodes, arrows, nodeIdCounter, arrowIdCounter };
  localStorage.setItem('vsm-flow-studio-diagram', JSON.stringify(data));
  alert('✔ Diagrama guardado.');
}

function loadDiagram() {
  const raw = localStorage.getItem('vsm-flow-studio-diagram');
  if (!raw) { alert('No hay diagrama guardado.'); return; }
  newDiagram();
  const data = JSON.parse(raw);
  nodes = data.nodes || [];
  arrows = data.arrows || [];
  nodeIdCounter  = data.nodeIdCounter  || 1;
  arrowIdCounter = data.arrowIdCounter || 1;
  nodes.forEach(n => renderNode(n));
  renderAllArrows();
  document.getElementById('canvas-hint').style.display = 'none';
}

function newDiagram() {
  nodes = []; arrows = [];
  nodeIdCounter = 1; arrowIdCounter = 1;
  selectedNodeId = null;
  connectingFrom = null;
  document.getElementById('canvas').innerHTML = '';
  document.getElementById('arrows-svg').innerHTML = '';
  document.getElementById('canvas-hint').style.display = '';
  document.getElementById('timeline-content').innerHTML = '';
  document.getElementById('process-list').innerHTML = '';
  document.getElementById('sim-log').textContent = 'Agrega procesos al canvas y presiona CALCULAR.';
  ['kpi-takt','kpi-lt','kpi-pt','kpi-pce','kpi-bn','kpi-avail'].forEach(id => {
    const card = document.getElementById(id);
    if (card) card.querySelector('.kpi-value').textContent = '—';
  });
  const hint = document.getElementById('connect-hint');
  if (hint) hint.style.display = 'none';
}

function exportJSON() {
  const blob = new Blob([JSON.stringify({nodes, arrows}, null, 2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'vsm-diagram.json';
  a.click();
}
