// ===== CANVAS ENGINE v4 — VSM Flow Studio =====
// Arrows are now clickable: single click = select, dblclick = edit modal, Delete key = delete

let arrowMode    = null;
let connectingFrom = null;
let draggingNode  = null;
let dragOffsetX   = 0, dragOffsetY = 0;

// ─ DRAG FROM TOOLBOX ──────────────────────────────────────────────────
document.querySelectorAll('.tool-item[draggable]').forEach(item => {
  item.addEventListener('dragstart', e => e.dataTransfer.setData('node-type', item.dataset.type));
});

function onDrop(e) {
  e.preventDefault();
  const type = e.dataTransfer.getData('node-type');
  if (!type) return;
  const canvas = document.getElementById('canvas');
  const rect   = canvas.getBoundingClientRect();
  const node   = createNode(type, Math.max(0, e.clientX - rect.left - 65), Math.max(0, e.clientY - rect.top - 35));
  renderNode(node);
  document.getElementById('canvas-hint').style.display = 'none';
  renderAllArrows();
}

// ─ RENDER NODE ──────────────────────────────────────────────────────
function renderNode(node) {
  const canvas = document.getElementById('canvas');
  const el = document.createElement('div');
  el.id        = node.id;
  el.className = `vsm-node node-${node.type}`;
  el.style.left = node.x + 'px';
  el.style.top  = node.y + 'px';
  el.innerHTML  = getNodeHTML(node);
  el.addEventListener('mousedown', e => startDrag(e, node));
  el.addEventListener('dblclick',  e => { e.stopPropagation(); openModal(node.id); });
  bindPorts(el, node.id);
  canvas.appendChild(el);
}

function bindPorts(el, nodeId) {
  el.querySelectorAll('.node-port').forEach(port => {
    port.addEventListener('mousedown', e => e.stopPropagation());
    port.addEventListener('click',     e => { e.stopPropagation(); onPortClick(nodeId); });
  });
}

function getNodeHTML(node) {
  const p = node.props;
  const distBadge = p.distType && p.distType !== 'fixed'
    ? `<div class="node-dist-badge">${p.distType==='normal'?'~N':'~T'}</div>` : '';

  let html = `<button class="node-edit-btn" onclick="event.stopPropagation();openModal('${node.id}')" title="Editar">✎</button>`;
  html += '<div class="node-port port-right"></div>';
  html += '<div class="node-port port-left"></div>';
  html += '<div class="node-port port-bottom"></div>';
  html += '<div class="node-port port-top"></div>';

  if (node.type === 'process') {
    const ops = Array.from({length:Math.max(p.operators||1,1)}).map(()=>'<div class="node-op active"></div>').join('');
    const ctDisplay = p.distType==='normal' ? `${p.ct}s ±${p.ctStd||0}s`
      : p.distType==='triangular' ? `[${p.ctMin||p.ct},${p.ct},${p.ctMax||p.ct}]s` : `${p.ct}s`;
    html += `<div class="node-body">
      <div class="node-title">${p.label}${distBadge}</div>
      <div class="node-stats">CT: <span>${ctDisplay}</span><br>C/O: <span>${p.co}min</span><br>Uptime: <span>${p.uptime}%</span></div>
      <div class="node-ops">${ops}</div>
    </div>`;
  } else if (node.type === 'supplier') {
    html += `<div class="node-body"><div class="node-entity-icon">🏭</div><div class="node-entity-name">${p.label}</div></div>`;
  } else if (node.type === 'customer') {
    html += `<div class="node-body"><div class="node-entity-icon">🏪</div><div class="node-entity-name">${p.label}</div></div>`;
  } else if (node.type === 'inventory') {
    html += `<div class="node-body"><div class="node-triangle"></div><div class="node-inv-label">${p.label}</div><div class="node-inv-units">${p.units} u</div></div>`;
  } else if (node.type === 'kaizen') {
    html += `<div class="node-body">✸</div>`;
  }
  return html;
}

function refreshNodeElement(nodeId) {
  const node = getNode(nodeId); if (!node) return;
  const el   = document.getElementById(nodeId); if (!el) return;
  el.innerHTML = getNodeHTML(node);
  bindPorts(el, nodeId);
  renderAllArrows();
}

// ─ DRAG TO MOVE ─────────────────────────────────────────────────────
function startDrag(e, node) {
  if (e.target.classList.contains('node-port') || e.target.classList.contains('node-edit-btn')) return;
  if (arrowMode) return;
  draggingNode = node;
  const rect   = document.getElementById(node.id).getBoundingClientRect();
  dragOffsetX  = e.clientX - rect.left;
  dragOffsetY  = e.clientY - rect.top;
  document.addEventListener('mousemove', onDragMove);
  document.addEventListener('mouseup',   onDragEnd);
  selectNode(node.id);
  e.preventDefault();
}

function onDragMove(e) {
  if (!draggingNode) return;
  const canvas = document.getElementById('canvas');
  const rect   = canvas.getBoundingClientRect();
  draggingNode.x = Math.max(0, e.clientX - rect.left - dragOffsetX);
  draggingNode.y = Math.max(0, e.clientY - rect.top  - dragOffsetY);
  const el = document.getElementById(draggingNode.id);
  el.style.left = draggingNode.x + 'px';
  el.style.top  = draggingNode.y + 'px';
  renderAllArrows();
}

function onDragEnd() {
  draggingNode = null;
  document.removeEventListener('mousemove', onDragMove);
  document.removeEventListener('mouseup',   onDragEnd);
}

// ─ NODE SELECTION ────────────────────────────────────────────────────
function selectNode(id) {
  deselectArrow();
  document.querySelectorAll('.vsm-node').forEach(el => el.classList.remove('selected'));
  const el = document.getElementById(id);
  if (el) el.classList.add('selected');
  selectedNodeId = id;
}

function onCanvasClick(e) {
  if (e.target === document.getElementById('canvas')) {
    document.querySelectorAll('.vsm-node').forEach(el => el.classList.remove('selected'));
    selectedNodeId = null;
    deselectArrow();
    if (connectingFrom) { connectingFrom = null; setArrowMode(null); showConnectHint(false); }
  }
}

// ─ ARROW SELECTION & EDITING ───────────────────────────────────────────
function selectArrow(arrowId) {
  deselectArrow();
  document.querySelectorAll('.vsm-node').forEach(el => el.classList.remove('selected'));
  selectedNodeId = null;
  selectedArrowId = arrowId;
  const path = document.getElementById('arrow-path-' + arrowId);
  if (path) path.classList.add('arrow-selected');
  showArrowToolbar(arrowId);
}

function deselectArrow() {
  if (selectedArrowId) {
    const path = document.getElementById('arrow-path-' + selectedArrowId);
    if (path) path.classList.remove('arrow-selected');
    selectedArrowId = null;
  }
  document.getElementById('arrow-toolbar')?.remove();
}

function showArrowToolbar(arrowId) {
  document.getElementById('arrow-toolbar')?.remove();
  const arrow  = getArrow(arrowId); if (!arrow) return;
  const midPt  = getArrowMidpoint(arrow.fromId, arrow.toId);
  if (!midPt) return;

  const canvasEl = document.getElementById('canvas');
  const tb = document.createElement('div');
  tb.id = 'arrow-toolbar';
  tb.className = 'arrow-toolbar';
  tb.style.left = (midPt.x - 60) + 'px';
  tb.style.top  = (midPt.y - 36) + 'px';
  tb.innerHTML = `
    <span class="arrow-tb-label">${arrowTypeLabel(arrow.type)} • ${arrow.transportDays||0.5}d</span>
    <button onclick="openArrowModal('${arrowId}')" title="Editar">✎</button>
    <button class="danger" onclick="confirmDeleteArrow('${arrowId}')" title="Eliminar">🗑</button>
  `;
  tb.addEventListener('mousedown', e => e.stopPropagation());
  canvasEl.appendChild(tb);
}

function arrowTypeLabel(type) {
  return type === 'push' ? '⟶ Push' : type === 'pull' ? '⇢ Pull' : '⤳ Info';
}

function getArrowMidpoint(fromId, toId) {
  const fn = getNode(fromId); const tn = getNode(toId); if (!fn || !tn) return null;
  const fEl = document.getElementById(fromId); const tEl = document.getElementById(toId); if (!fEl || !tEl) return null;
  const x1 = fn.x + fEl.offsetWidth, y1 = fn.y + fEl.offsetHeight / 2;
  const x2 = tn.x,                   y2 = tn.y + tEl.offsetHeight / 2;
  const dx = Math.abs(x2 - x1);
  const cx1 = x1 + dx*0.45, cx2 = x2 - dx*0.45;
  const t = 0.5, u = 0.5;
  return {
    x: u*u*u*x1 + 3*u*u*t*cx1 + 3*u*t*t*cx2 + t*t*t*x2,
    y: u*u*u*y1 + 3*u*u*t*y1  + 3*u*t*t*y2  + t*t*t*y2
  };
}

function openArrowModal(arrowId) {
  document.getElementById('arrow-toolbar')?.remove();
  const arrow = getArrow(arrowId); if (!arrow) return;
  const fromNode = getNode(arrow.fromId);
  const toNode   = getNode(arrow.toId);
  const fromLbl  = fromNode?.props?.label || arrow.fromId;
  const toLbl    = toNode?.props?.label   || arrow.toId;

  document.getElementById('modal-title').textContent = `Flecha: ${fromLbl} → ${toLbl}`;
  document.getElementById('modal-body').innerHTML = `
    <div class="prop-group">
      <label>Tipo de flujo</label>
      <select id="arrow-edit-type">
        <option value="push"  ${arrow.type==='push' ?'selected':''}>⟶ Push (flujo empujado)</option>
        <option value="pull"  ${arrow.type==='pull' ?'selected':''}>⇢ Pull (flujo jalado)</option>
        <option value="info"  ${arrow.type==='info' ?'selected':''}>⤳ Flujo de información</option>
      </select>
    </div>
    <div class="prop-group">
      <label>Tiempo de transporte / espera</label>
      <div class="sim-input-row">
        <input type="number" id="arrow-edit-days" value="${arrow.transportDays||0.5}" min="0" step="0.1" style="width:100%">
        <span class="sim-unit">días</span>
      </div>
      <small style="color:var(--text-muted);font-size:9px;margin-top:4px;display:block">
        Este valor aparece como caja NVA (roja) en el Value Stream Timeline.
      </small>
    </div>
    <div class="prop-group" style="margin-top:12px">
      <button onclick="confirmDeleteArrow('${arrowId}')" style="background:rgba(248,81,73,.15);border:1px solid var(--danger);color:var(--danger);padding:6px 14px;border-radius:6px;cursor:pointer;font-size:11px;width:100%">
        🗑 Eliminar esta flecha
      </button>
    </div>
  `;

  const footer = document.querySelector('.modal-footer');
  footer.querySelector('.btn-accent').onclick = () => saveArrowProps(arrowId);
  document.getElementById('modal-overlay').classList.remove('hidden');
}

function saveArrowProps(arrowId) {
  const arrow = getArrow(arrowId); if (!arrow) return;
  arrow.type          = document.getElementById('arrow-edit-type').value;
  arrow.transportDays = parseFloat(document.getElementById('arrow-edit-days').value) || 0.5;
  closeModal();
  renderAllArrows();
}

function confirmDeleteArrow(arrowId) {
  const arrow = getArrow(arrowId); if (!arrow) return;
  const from = getNode(arrow.fromId)?.props?.label || '?';
  const to   = getNode(arrow.toId)?.props?.label   || '?';
  if (confirm(`¿Eliminar flecha ${from} → ${to}?`)) {
    deleteArrow(arrowId);
    closeModal();
    renderAllArrows();
  }
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { setArrowMode(null); connectingFrom = null; showConnectHint(false); deselectArrow(); }
  if ((e.key === 'Delete' || e.key === 'Backspace') && !e.target.matches('input,select,textarea')) {
    if (selectedArrowId) {
      confirmDeleteArrow(selectedArrowId);
    } else if (selectedNodeId) {
      deleteSelected();
    }
  }
});

// ─ ARROW CONNECTION SYSTEM ───────────────────────────────────────────────
function setArrowMode(mode) {
  arrowMode = (arrowMode === mode) ? null : mode;
  clearArrowModeUI();
  if (arrowMode) {
    document.getElementById('btn-' + mode + '-arrow')?.classList.add('active');
    document.getElementById('canvas').style.cursor = 'crosshair';
  } else {
    document.getElementById('canvas').style.cursor = 'default';
    connectingFrom = null;
    showConnectHint(false);
  }
}

function clearArrowModeUI() {
  ['push','pull','info'].forEach(m => document.getElementById('btn-' + m + '-arrow')?.classList.remove('active'));
}

function showConnectHint(active, fromLabel) {
  let hint = document.getElementById('connect-hint');
  if (!hint) {
    hint = document.createElement('div'); hint.id='connect-hint'; hint.className='connect-hint';
    document.querySelector('.canvas-area').appendChild(hint);
  }
  hint.textContent = active ? `⚡ "${fromLabel}" seleccionado — ahora haz click en el nodo DESTINO` : '';
  hint.style.display = active ? 'block' : 'none';
}

function onPortClick(nodeId) {
  if (!arrowMode) setArrowMode('push');
  if (!connectingFrom) {
    connectingFrom = nodeId; selectNode(nodeId);
    showConnectHint(true, getNode(nodeId)?.props.label || nodeId);
  } else {
    if (connectingFrom !== nodeId) { addArrow(connectingFrom, nodeId, arrowMode); renderAllArrows(); }
    connectingFrom = null; setArrowMode(null); showConnectHint(false);
  }
}

document.getElementById('canvas').addEventListener('click', function(e) {
  if (!connectingFrom) return;
  const nodeEl = e.target.closest('.vsm-node');
  if (nodeEl && nodeEl.id && nodeEl.id !== connectingFrom) {
    addArrow(connectingFrom, nodeEl.id, arrowMode);
    renderAllArrows();
    connectingFrom = null; setArrowMode(null); showConnectHint(false);
  }
}, true);

// ─ ARROWS SVG ─────────────────────────────────────────────────────────────────
function renderAllArrows() {
  const svg = document.getElementById('arrows-svg');
  svg.innerHTML = `
    <defs>
      <marker id="arr-push" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="#58a6ff"/></marker>
      <marker id="arr-pull" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="#3fb950"/></marker>
      <marker id="arr-info" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="#d29922"/></marker>
      <marker id="arr-push-sel" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="#fff"/></marker>
      <marker id="arr-pull-sel" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="#fff"/></marker>
      <marker id="arr-info-sel" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="#fff"/></marker>
    </defs>`;

  arrows.forEach(arrow => {
    const fromNode = getNode(arrow.fromId), toNode = getNode(arrow.toId);
    if (!fromNode || !toNode) return;
    const fEl = document.getElementById(arrow.fromId), tEl = document.getElementById(arrow.toId);
    if (!fEl || !tEl) return;

    const x1 = fromNode.x + fEl.offsetWidth,  y1 = fromNode.y + fEl.offsetHeight / 2;
    const x2 = toNode.x,                       y2 = toNode.y   + tEl.offsetHeight / 2;
    const dx = Math.abs(x2 - x1);
    const cx1 = x1 + dx*0.45, cx2 = x2 - dx*0.45;

    const isSelected = arrow.id === selectedArrowId;
    const strokeColor = isSelected ? '#ffffff'
      : arrow.type==='push' ? '#58a6ff' : arrow.type==='pull' ? '#3fb950' : '#d29922';
    const dashArr = arrow.type==='push' ? '' : arrow.type==='pull' ? '8,4' : '4,4';
    const markerSuffix = isSelected ? '-sel' : '';
    const strokeW = isSelected ? 3 : 2;

    const hit = document.createElementNS('http://www.w3.org/2000/svg','path');
    hit.setAttribute('d', `M ${x1} ${y1} C ${cx1} ${y1} ${cx2} ${y2} ${x2} ${y2}`);
    hit.setAttribute('stroke','transparent'); hit.setAttribute('stroke-width','16');
    hit.setAttribute('fill','none'); hit.style.cursor = 'pointer';
    hit.addEventListener('click',    e => { e.stopPropagation(); selectArrow(arrow.id); });
    hit.addEventListener('dblclick', e => { e.stopPropagation(); openArrowModal(arrow.id); });
    svg.appendChild(hit);

    const path = document.createElementNS('http://www.w3.org/2000/svg','path');
    path.setAttribute('id', 'arrow-path-' + arrow.id);
    path.setAttribute('d', `M ${x1} ${y1} C ${cx1} ${y1} ${cx2} ${y2} ${x2} ${y2}`);
    path.setAttribute('stroke', strokeColor); path.setAttribute('stroke-width', strokeW);
    path.setAttribute('fill','none'); path.setAttribute('stroke-dasharray', dashArr);
    path.setAttribute('marker-end', `url(#arr-${arrow.type}${markerSuffix})`);
    path.style.pointerEvents = 'none';
    if (isSelected) path.classList.add('arrow-selected');
    svg.appendChild(path);

    const td = arrow.transportDays;
    if (td && td !== 0.5) {
      const midX = 0.125*x1 + 0.375*cx1 + 0.375*cx2 + 0.125*x2;
      const midY = 0.125*y1 + 0.375*y1  + 0.375*y2  + 0.125*y2;
      const lbl = document.createElementNS('http://www.w3.org/2000/svg','text');
      lbl.setAttribute('x', midX); lbl.setAttribute('y', midY - 8);
      lbl.setAttribute('fill', strokeColor); lbl.setAttribute('font-size','9');
      lbl.setAttribute('text-anchor','middle'); lbl.setAttribute('font-family','monospace');
      lbl.setAttribute('font-weight','700');
      lbl.textContent = td + 'd';
      lbl.style.pointerEvents = 'none';
      svg.appendChild(lbl);
    }
  });

  if (selectedArrowId) showArrowToolbar(selectedArrowId);
}
