// ===== UI — Modal, Save, Load — VSM Flow Studio =====

// ── MODAL ────────────────────────────────────────────────────────
function openModal(nodeId) {
  const node = getNode(nodeId);
  if (!node) return;
  editingNodeId = nodeId;
  document.getElementById('modal-title').textContent = 'Editar: ' + (node.props.label || node.type);
  document.getElementById('modal-body').innerHTML = buildModalForm(node);
  document.getElementById('modal-overlay').classList.remove('hidden');
  recalcModalPreview();
}

function buildModalForm(node) {
  const p = node.props;
  if (node.type === 'process') {
    return `
      <div class="prop-group">
        <label>Nombre del proceso</label>
        <input type="text" id="prop-label" value="${p.label}">
      </div>
      <div class="prop-row">
        <div class="prop-group">
          <label>Cycle Time (seg)</label>
          <input type="number" id="prop-ct" value="${p.ct}" min="0" oninput="recalcModalPreview()">
        </div>
        <div class="prop-group">
          <label>Changeover (min)</label>
          <input type="number" id="prop-co" value="${p.co}" min="0">
        </div>
      </div>
      <div class="prop-row">
        <div class="prop-group">
          <label>Uptime (%)</label>
          <input type="number" id="prop-uptime" value="${p.uptime}" min="1" max="100" oninput="recalcModalPreview()">
        </div>
        <div class="prop-group">
          <label># Operadores</label>
          <input type="number" id="prop-ops" value="${p.operators}" min="1">
        </div>
      </div>
      <div class="prop-row">
        <div class="prop-group">
          <label>Turnos/día</label>
          <input type="number" id="prop-shifts" value="${p.shifts}" min="1" max="3" oninput="recalcModalPreview()">
        </div>
        <div class="prop-group">
          <label>Horas/turno</label>
          <input type="number" id="prop-hours" value="${p.hoursShift}" min="1" max="24" oninput="recalcModalPreview()">
        </div>
      </div>
      <div class="prop-row">
        <div class="prop-group">
          <label>Defect Rate (%)</label>
          <input type="number" id="prop-defect" value="${p.defectRate}" min="0" max="100">
        </div>
        <div class="prop-group">
          <label>¿Agrega valor?</label>
          <select id="prop-va">
            <option value="true" ${p.isVA ? 'selected' : ''}>Sí (VA)</option>
            <option value="false" ${!p.isVA ? 'selected' : ''}>No (NVA)</option>
          </select>
        </div>
      </div>
      <hr class="prop-divider">
      <div class="prop-calc" id="modal-calc"></div>`;
  } else if (node.type === 'inventory') {
    return `
      <div class="prop-group">
        <label>Etiqueta</label>
        <input type="text" id="prop-label" value="${p.label}">
      </div>
      <div class="prop-group">
        <label>Unidades en inventario</label>
        <input type="number" id="prop-units" value="${p.units}" min="0">
      </div>`;
  } else {
    return `
      <div class="prop-group">
        <label>Nombre</label>
        <input type="text" id="prop-label" value="${p.label}">
      </div>`;
  }
}

function recalcModalPreview() {
  const calc = document.getElementById('modal-calc');
  if (!calc) return;
  const ct = parseFloat(document.getElementById('prop-ct')?.value) || 0;
  const uptime = parseFloat(document.getElementById('prop-uptime')?.value) || 90;
  const shifts = parseFloat(document.getElementById('prop-shifts')?.value) || 1;
  const hours = parseFloat(document.getElementById('prop-hours')?.value) || 8;
  const availSec = hours * shifts * 3600 * (uptime / 100);
  const netCT = ct > 0 ? (ct / (uptime / 100)).toFixed(1) : '—';
  const capacity = ct > 0 ? Math.floor(availSec / ct) : '—';
  calc.innerHTML = `
    Tiempo disponible: <span>${availSec.toLocaleString()} seg/día</span><br>
    CT neto (ajustado): <span>${netCT} seg</span><br>
    Capacidad estimada: <span>${capacity} u/día</span>`;
}

function saveNodeProps() {
  const node = getNode(editingNodeId);
  if (!node) return;
  node.props.label = document.getElementById('prop-label')?.value || node.props.label;
  if (node.type === 'process') {
    node.props.ct = parseFloat(document.getElementById('prop-ct')?.value) || 0;
    node.props.co = parseFloat(document.getElementById('prop-co')?.value) || 0;
    node.props.uptime = parseFloat(document.getElementById('prop-uptime')?.value) || 90;
    node.props.operators = parseInt(document.getElementById('prop-ops')?.value) || 1;
    node.props.shifts = parseInt(document.getElementById('prop-shifts')?.value) || 1;
    node.props.hoursShift = parseFloat(document.getElementById('prop-hours')?.value) || 8;
    node.props.defectRate = parseFloat(document.getElementById('prop-defect')?.value) || 0;
    node.props.isVA = document.getElementById('prop-va')?.value === 'true';
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

// ── SAVE / LOAD ───────────────────────────────────────────────────
function saveDiagram() {
  const data = { nodes, arrows, nodeIdCounter, arrowIdCounter };
  localStorage.setItem('vsm-flow-studio-diagram', JSON.stringify(data));
  alert('✔ Diagrama guardado en el navegador.');
}

function loadDiagram() {
  const raw = localStorage.getItem('vsm-flow-studio-diagram');
  if (!raw) { alert('No hay diagrama guardado.'); return; }
  newDiagram();
  const data = JSON.parse(raw);
  nodes = data.nodes || [];
  arrows = data.arrows || [];
  nodeIdCounter = data.nodeIdCounter || 1;
  arrowIdCounter = data.arrowIdCounter || 1;
  nodes.forEach(n => renderNode(n));
  renderAllArrows();
  document.getElementById('canvas-hint').style.display = 'none';
  alert('✔ Diagrama cargado.');
}

function newDiagram() {
  nodes = []; arrows = [];
  nodeIdCounter = 1; arrowIdCounter = 1;
  document.getElementById('canvas').innerHTML = '';
  document.getElementById('arrows-svg').innerHTML = '';
  document.getElementById('canvas-hint').style.display = '';
  document.getElementById('timeline-content').innerHTML = '';
  document.getElementById('process-list').innerHTML = '';
  document.getElementById('sim-log').textContent = 'Agrega procesos al canvas y presiona CALCULAR.';
  ['kpi-takt','kpi-lt','kpi-pt','kpi-pce','kpi-bn','kpi-avail'].forEach(id => {
    document.getElementById(id).querySelector('.kpi-value').textContent = '—';
  });
}

function exportJSON() {
  const data = { nodes, arrows };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'vsm-diagram.json';
  a.click();
}
