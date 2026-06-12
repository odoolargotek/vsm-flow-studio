// ===== CANVAS ENGINE — VSM Flow Studio =====

let arrowMode = null;   // null | 'push' | 'pull' | 'info'
let connectingFrom = null;
let draggingNode = null;
let dragOffsetX = 0, dragOffsetY = 0;

// ── DRAG FROM TOOLBOX ────────────────────────────────────────────
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
  const node = createNode(type, x, y);
  renderNode(node);
  document.getElementById('canvas-hint').style.display = 'none';
}

// ── RENDER NODE ──────────────────────────────────────────────────
function renderNode(node) {
  const canvas = document.getElementById('canvas');
  const el = document.createElement('div');
  el.id = node.id;
  el.className = `vsm-node node-${node.type}`;
  el.style.left = node.x + 'px';
  el.style.top = node.y + 'px';
  el.innerHTML = getNodeHTML(node);

  // Drag to move
  el.addEventListener('mousedown', e => startDrag(e, node));
  // Double-click to edit
  el.addEventListener('dblclick', e => { e.stopPropagation(); openModal(node.id); });

  // Port clicks
  el.querySelectorAll('.node-port').forEach(port => {
    port.addEventListener('click', e => { e.stopPropagation(); onPortClick(node.id); });
  });

  canvas.appendChild(el);
}

function getNodeHTML(node) {
  const p = node.props;
  let html = '<button class="node-edit-btn" onclick="event.stopPropagation(); openModal(\'' + node.id + '\')" title="Editar">✎</button>';
  html += '<div class="node-port port-right"></div>';
  html += '<div class="node-port port-left"></div>';
  html += '<div class="node-port port-bottom"></div>';
  html += '<div class="node-port port-top"></div>';

  if (node.type === 'process') {
    const ops = Array.from({length: Math.max(p.operators||1, 1)}).map((_, i) => `<div class="node-op active"></div>`).join('');
    html += `<div class="node-body">
      <div class="node-title">${p.label}</div>
      <div class="node-stats">
        CT: <span>${p.ct}s</span><br>
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
  el.querySelectorAll('.node-port').forEach(port => {
    port.addEventListener('click', e => { e.stopPropagation(); onPortClick(node.id); });
  });
  renderAllArrows();
}

// ── DRAG TO MOVE ─────────────────────────────────────────────────
function startDrag(e, node) {
  if (e.target.classList.contains('node-port') || e.target.classList.contains('node-edit-btn')) return;
  if (arrowMode) return;
  draggingNode = node;
  const el = document.getElementById(node.id);
  const rect = el.getBoundingClientRect();
  dragOffsetX = e.clientX - rect.left;
  dragOffsetY = e.clientY - rect.top;
  document.addEventListener('mousemove', onDragMove);
  document.addEventListener('mouseup', onDragEnd);
  selectNode(node.id);
  e.preventDefault();
}

function onDragMove(e) {
  if (!draggingNode) return;
  const canvas = document.getElementById('canvas');
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left - dragOffsetX;
  const y = e.clientY - rect.top - dragOffsetY;
  draggingNode.x = Math.max(0, x);
  draggingNode.y = Math.max(0, y);
  const el = document.getElementById(draggingNode.id);
  el.style.left = draggingNode.x + 'px';
  el.style.top = draggingNode.y + 'px';
  renderAllArrows();
}

function onDragEnd() {
  draggingNode = null;
  document.removeEventListener('mousemove', onDragMove);
  document.removeEventListener('mouseup', onDragEnd);
}

// ── SELECTION ────────────────────────────────────────────────────
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
    connectingFrom = null;
    clearArrowModeUI();
  }
}

// ── ARROW MODE ───────────────────────────────────────────────────
function setArrowMode(mode) {
  arrowMode = arrowMode === mode ? null : mode;
  clearArrowModeUI();
  if (arrowMode) {
    const btn = document.getElementById('btn-' + mode + '-arrow');
    if (btn) btn.classList.add('active');
    document.getElementById('canvas').style.cursor = 'crosshair';
  } else {
    document.getElementById('canvas').style.cursor = 'default';
  }
  connectingFrom = null;
}

function clearArrowModeUI() {
  ['push', 'pull', 'info'].forEach(m => {
    const btn = document.getElementById('btn-' + m + '-arrow');
    if (btn) btn.classList.remove('active');
  });
}

function onPortClick(nodeId) {
  if (!arrowMode) {
    setArrowMode('push');
  }
  if (!connectingFrom) {
    connectingFrom = nodeId;
    selectNode(nodeId);
  } else {
    if (connectingFrom !== nodeId) {
      addArrow(connectingFrom, nodeId, arrowMode);
      renderAllArrows();
    }
    connectingFrom = null;
    setArrowMode(null);
  }
}

// ── ARROWS SVG ───────────────────────────────────────────────────
function renderAllArrows() {
  const svg = document.getElementById('arrows-svg');
  svg.innerHTML = '';

  // Define arrowhead markers
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
    const toNode = getNode(arrow.toId);
    if (!fromNode || !toNode) return;

    const fromEl = document.getElementById(arrow.fromId);
    const toEl = document.getElementById(arrow.toId);
    if (!fromEl || !toEl) return;

    const svgRect = svg.getBoundingClientRect();
    const fr = fromEl.getBoundingClientRect();
    const tr = toEl.getBoundingClientRect();

    const x1 = fr.right - svgRect.left;
    const y1 = fr.top + fr.height / 2 - svgRect.top;
    const x2 = tr.left - svgRect.left;
    const y2 = tr.top + tr.height / 2 - svgRect.top;

    const cx1 = x1 + Math.abs(x2 - x1) * 0.4;
    const cx2 = x2 - Math.abs(x2 - x1) * 0.4;

    const cls = `arrow-${arrow.type}-line`;
    const marker = `arr-${arrow.type}`;
    const dash = arrow.type === 'push' ? '' : `stroke-dasharray="${arrow.type === 'pull' ? '8,4' : '4,4'}"`;

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', `M ${x1} ${y1} C ${cx1} ${y1} ${cx2} ${y2} ${x2} ${y2}`);
    path.setAttribute('class', `vsm-arrow ${cls}`);
    path.setAttribute('marker-end', `url(#${marker})`);
    if (dash) path.setAttribute('stroke-dasharray', arrow.type === 'pull' ? '8,4' : '4,4');
    path.setAttribute('stroke-width', '2');
    path.setAttribute('fill', 'none');
    svg.appendChild(path);
  });
}

// ── DELETE ───────────────────────────────────────────────────────
function deleteSelected() {
  if (!selectedNodeId) { alert('Selecciona un nodo primero.'); return; }
  deleteNode(selectedNodeId);
  const el = document.getElementById(selectedNodeId);
  if (el) el.remove();
  selectedNodeId = null;
  renderAllArrows();
}

document.addEventListener('keydown', e => {
  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (document.activeElement.tagName !== 'INPUT' && selectedNodeId) {
      deleteSelected();
    }
  }
  if (e.key === 'Escape') {
    setArrowMode(null);
    connectingFrom = null;
  }
});
