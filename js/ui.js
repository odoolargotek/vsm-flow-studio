// ===== UI v2 — Modal + Distribuciones + Save/Load — VSM Flow Studio =====

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
  if (node.type === 'process') {
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
      <div class="prop-calc" id="modal-calc"></div>`;
  } else if (node.type === 'inventory') {
    return `
      <div class="prop-group"><label>Etiqueta</label><input type="text" id="prop-label" value="${p.label}"></div>
      <div class="prop-group"><label>Unidades en inventario (WIP)</label><input type="number" id="prop-units" value="${p.units||100}" min="0"></div>`;
  } else {
    return `<div class="prop-group"><label>Nombre</label><input type="text" id="prop-label" value="${p.label}"></div>`;
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
  const ct      = parseFloat(document.getElementById('prop-ct')?.value)     || 0;
  const uptime  = parseFloat(document.getElementById('prop-uptime')?.value)  || 90;
  const shifts  = parseFloat(document.getElementById('prop-shifts')?.value)  || 1;
  const hours   = parseFloat(document.getElementById('prop-hours')?.value)   || 8;
  const dist    = document.getElementById('prop-dist')?.value || 'fixed';
  const std     = parseFloat(document.getElementById('prop-ctStd')?.value)   || 0;
  const ctMin   = parseFloat(document.getElementById('prop-ctMin')?.value)   || 0;
  const ctMax   = parseFloat(document.getElementById('prop-ctMax')?.value)   || ct;

  const availSec  = hours * shifts * 3600 * (uptime / 100);
  const netCT     = ct > 0 ? (ct / (uptime / 100)).toFixed(1) : '—';
  const capacity  = ct > 0 ? Math.floor(availSec / ct) : '—';

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
    Capacidad estimada: <span>${capacity} u/día</span>${distInfo}`;
}

function saveNodeProps() {
  const node = getNode(editingNodeId);
  if (!node) return;
  node.props.label = document.getElementById('prop-label')?.value || node.props.label;
  if (node.type === 'process') {
    node.props.ct          = parseFloat(document.getElementById('prop-ct')?.value)     || 0;
    node.props.co          = parseFloat(document.getElementById('prop-co')?.value)     || 0;
    node.props.uptime      = parseFloat(document.getElementById('prop-uptime')?.value) || 90;
    node.props.operators   = parseInt(document.getElementById('prop-ops')?.value)      || 1;
    node.props.shifts      = parseInt(document.getElementById('prop-shifts')?.value)   || 1;
    node.props.hoursShift  = parseFloat(document.getElementById('prop-hours')?.value)  || 8;
    node.props.defectRate  = parseFloat(document.getElementById('prop-defect')?.value) || 0;
    node.props.isVA        = document.getElementById('prop-va')?.value === 'true';
    node.props.distType    = document.getElementById('prop-dist')?.value || 'fixed';
    node.props.ctStd       = parseFloat(document.getElementById('prop-ctStd')?.value)  || 0;
    node.props.ctMin       = parseFloat(document.getElementById('prop-ctMin')?.value)  || 0;
    node.props.ctMax       = parseFloat(document.getElementById('prop-ctMax')?.value)  || 0;
  } else if (node.type === 'inventory') {
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
