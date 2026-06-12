// ===== CANVAS ENGINE v2 — VSM Flow Studio =====
// Fix: arrows use canvas-relative positions (not viewport getBoundingClientRect)

let arrowMode = null;
let connectingFrom = null;   // nodeId waiting for target
let draggingNode = null;
let dragOffsetX = 0, dragOffsetY = 0;

// ─ DRAG FROM TOOLBOX ─────────────────────────────────────────────
document.querySelectorAll('.tool-item[draggable]').forEach(item => {
  item.addEventListener('dragstart', e => {
    e.dataTransfer.setData('node-type', item.dataset.type);
  });
});

function onDrop(e) {
  e.preventDefault();
  const type = e.dataTransfer.getData('node-type');
  if (!type) return;
  const canvas = document.getElementById('canvas');
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left - 65;
  const y = e.clientY - rect.top - 35;
  const node = createNode(type, Math.max(0, x), Math.max(0, y));
  renderNode(node);
  document.getElementById('canvas-hint').style.display = 'none';
  renderAllArrows();
}

// ─ RENDER NODE ──────────────────────────────────────────────────
function renderNode(node) {
  const canvas = document.getElementById('canvas');
  const el = document.createElement('div');
  el.id = node.id;
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
    port.addEventListener('mousedown', e => { e.stopPropagation(); });
    port.addEventListener('click', e => { e.stopPropagation(); onPortClick(nodeId); });
  });
}

function getNodeHTML(node) {
  const p = node.props;
  const distBadge = p.distType && p.distType !== 'fixed'
    ? `<div class="node-dist-badge">${p.distType === 'normal' ? '~N' : '~T'}</div>` : '';

  let html = `<button class="node-edit-btn" onclick="event.stopPropagation();openModal('${node.id}')" title="Editar">✎</button>`;
  html += '<div class="node-port port-right" title="Conectar desde aquí"></div>';
  html += '<div class="node-port port-left"  title="Conectar desde aquí"></div>';
  html += '<div class="node-port port-bottom" title="Conectar desde aquí"></div>';
  html += '<div class="node-port port-top"   title="Conectar desde aquí"></div>';

  if (node.type === 'process') {
    const ops = Array.from({length: Math.max(p.operators||1,1)}).map(() => '<div class="node-op active"></div>').join('');
    const ctDisplay = p.distType === 'normal'
      ? `${p.ct}s ±${p.ctStd||0}s`
      : p.distType === 'triangular'
      ? `[${p.ctMin||p.ct},${p.ct},${p.ctMax||p.ct}]s`
      : `${p.ct}s`;
    html += `<div class="node-body">
      <div class="node-title">${p.label}${distBadge}</div>
      <div class="node-stats">
        CT: <span>${ctDisplay}</span><br>
        C/O: <span>${p.co}min</span><br>
        Uptime: <span>${p.uptime}%</span>
      </div>
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
  const node = getNode(nodeId);
  if (!node) return;
  const el = document.getElementById(nodeId);
  if (!el) return;
  el.innerHTML = getNodeHTML(node);
  bindPorts(el, nodeId);
  renderAllArrows();
}

// ─ DRAG TO MOVE ────────────────────────────────────────────────
function startDrag(e, node) {
  if (e.target.classList.contains('node-port') ||
      e.target.classList.contains('node-edit-btn')) return;
  if (arrowMode) return;
  draggingNode = node;
  const el = document.getElementById(node.id);
  const rect = el.getBoundingClientRect();
  dragOffsetX = e.clientX - rect.left;
  dragOffsetY = e.clientY - rect.top;
  document.addEventListener('mousemove', onDragMove);
  document.addEventListener('mouseup',   onDragEnd);
  selectNode(node.id);
  e.preventDefault();
}

function onDragMove(e) {
  if (!draggingNode) return;
  const canvas = document.getElementById('canvas');
  const rect = canvas.getBoundingClientRect();
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

// ─ SELECTION ────────────────────────────────────────────────────
function selectNode(id) {
  document.querySelectorAll('.vsm-node').forEach(el => el.classList.remove('selected'));
  const el = document.getElementById(id);
  if (el) el.classList.add('selected');
  selectedNodeId = id;
}

function onCanvasClick(e) {
  if (e.target === document.getElementById('canvas')) {
    document.querySelectorAll('.vsm-node').forEach(el => el.classList.remove('selected'));
    selectedNodeId = null;
    if (connectingFrom) {
      // Cancel pending connection
      connectingFrom = null;
      setArrowMode(null);
      showConnectHint(false);
    }
  }
}

// ─ ARROW CONNECTION SYSTEM ───────────────────────────────────────
function setArrowMode(mode) {
  arrowMode = (arrowMode === mode) ? null : mode;
  clearArrowModeUI();
  if (arrowMode) {
    const btn = document.getElementById('btn-' + mode + '-arrow');
    if (btn) btn.classList.add('active');
    document.getElementById('canvas').style.cursor = 'crosshair';
  } else {
    document.getElementById('canvas').style.cursor = 'default';
    connectingFrom = null;
    showConnectHint(false);
  }
}

function clearArrowModeUI() {
  ['push','pull','info'].forEach(m => {
    const btn = document.getElementById('btn-' + m + '-arrow');
    if (btn) btn.classList.remove('active');
  });
}

function showConnectHint(active, fromLabel) {
  let hint = document.getElementById('connect-hint');
  if (!hint) {
    hint = document.createElement('div');
    hint.id = 'connect-hint';
    hint.className = 'connect-hint';
    document.querySelector('.canvas-area').appendChild(hint);
  }
  if (active) {
    hint.textContent = `⚡ "${fromLabel}" seleccionado — ahora haz click en el nodo DESTINO`;
    hint.style.display = 'block';
  } else {
    hint.style.display = 'none';
  }
}

function onPortClick(nodeId) {
  // Auto-activate push mode if none selected
  if (!arrowMode) setArrowMode('push');

  if (!connectingFrom) {
    // First click: pick source
    connectingFrom = nodeId;
    selectNode(nodeId);
    const node = getNode(nodeId);
    showConnectHint(true, node ? node.props.label : nodeId);
  } else {
    // Second click: pick target
    if (connectingFrom !== nodeId) {
      addArrow(connectingFrom, nodeId, arrowMode);
      renderAllArrows();
    }
    connectingFrom = null;
    setArrowMode(null);
    showConnectHint(false);
  }
}

// Also allow clicking the node BODY as target when connectingFrom is set
document.getElementById('canvas').addEventListener('click', function(e) {
  if (!connectingFrom) return;
  const nodeEl = e.target.closest('.vsm-node');
  if (nodeEl && nodeEl.id && nodeEl.id !== connectingFrom) {
    addArrow(connectingFrom, nodeEl.id, arrowMode);
    renderAllArrows();
    connectingFrom = null;
    setArrowMode(null);
    showConnectHint(false);
  }
}, true);

// ─ ARROWS SVG (canvas-relative coordinates) ─────────────────────
// KEY FIX: use node.x/node.y (canvas-relative) NOT getBoundingClientRect()
function renderAllArrows() {
  const svg = document.getElementById('arrows-svg');

  svg.innerHTML = `
    <defs>
      <marker id="arr-push" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
        <polygon points="0 0, 10 3.5, 0 7" fill="#58a6ff"/>
      </marker>
      <marker id="arr-pull" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
        <polygon points="0 0, 10 3.5, 0 7" fill="#3fb950"/>
      </marker>
      <marker id="arr-info" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
        <polygon points="0 0, 10 3.5, 0 7" fill="#d29922"/>
      </marker>
    </defs>`;

  arrows.forEach(arrow => {
    const fromNode = getNode(arrow.fromId);
    const toNode   = getNode(arrow.toId);
    if (!fromNode || !toNode) return;

    const fromEl = document.getElementById(arrow.fromId);
    const toEl   = document.getElementById(arrow.toId);
    if (!fromEl || !toEl) return;

    // Use canvas-relative position + element size
    const fw = fromEl.offsetWidth;
    const fh = fromEl.offsetHeight;
    const tw = toEl.offsetWidth;
    const th = toEl.offsetHeight;

    // Start: right-center of source, End: left-center of target
    const x1 = fromNode.x + fw;
    const y1 = fromNode.y + fh / 2;
    const x2 = toNode.x;
    const y2 = toNode.y + th / 2;

    // Bezier control points
    const dx = Math.abs(x2 - x1);
    const cx1 = x1 + dx * 0.45;
    const cx2 = x2 - dx * 0.45;

    const strokeColor = arrow.type === 'push' ? '#58a6ff' : arrow.type === 'pull' ? '#3fb950' : '#d29922';
    const dashArr     = arrow.type === 'push' ? '' : arrow.type === 'pull' ? '8,4' : '4,4';
    const marker      = `arr-${arrow.type}`;

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', `M ${x1} ${y1} C ${cx1} ${y1} ${cx2} ${y2} ${x2} ${y2}`);
    path.setAttribute('stroke', strokeColor);
    path.setAttribute('stroke-width', '2.5');
    path.setAttribute('fill', 'none');
    path.setAttribute('marker-end', `url(#${marker})`);
    if (dashArr) path.setAttribute('stroke-dasharray', dashArr);
    svg.appendChild(path);

    // Arrow type label on midpoint
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2 - 8;
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', mx);
    label.setAttribute('y', my);
    label.setAttribute('fill', strokeColor);
    label.setAttribute('font-size', '9');
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('font-family', 'monospace');
    label.textContent = arrow.type.toUpperCase();
    svg.appendChild(label);
  });
}

// ─ DELETE ───────────────────────────────────────────────────────
function deleteSelected() {
  if (!selectedNodeId) { alert('Selecciona un nodo primero (click sobre él).'); return; }
  deleteNode(selectedNodeId);
  const el = document.getElementById(selectedNodeId);
  if (el) el.remove();
  selectedNodeId = null;
  renderAllArrows();
}

document.addEventListener('keydown', e => {
  if ((e.key === 'Delete' || e.key === 'Backspace') &&
      document.activeElement.tagName !== 'INPUT' &&
      document.activeElement.tagName !== 'SELECT') {
    if (selectedNodeId) deleteSelected();
  }
  if (e.key === 'Escape') {
    setArrowMode(null);
    connectingFrom = null;
    showConnectHint(false);
  }
});
