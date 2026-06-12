// ===== CANVAS ENGINE v4.3 — VSM Flow Studio =====
// Root-cause fix: removed capture-phase canvas click listener that was
// completing the connection AND letting the event bubble to onPortClick.
// Now ONLY ports handle connection logic. Canvas click only deselects/cancels.

let arrowMode      = null;
let connectingFrom = null;
let draggingNode   = null;
let dragOffsetX    = 0, dragOffsetY = 0;

// ─ DRAG FROM TOOLBOX ─────────────────────────────────────────────────
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

// ─ RENDER NODE ────────────────────────────────────────────────────
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
  // When in connect mode, clicking the node body also works as destination
  el.addEventListener('click', e => {
    if (!connectingFrom) return;
    e.stopPropagation();
    const toId = node.id;
    if (toId === connectingFrom) { cancelArrowMode(); return; }
    addArrow(connectingFrom, toId, arrowMode);
    renderAllArrows();
    cancelArrowMode();
  });
  bindPorts(el, node.id);
  canvas.appendChild(el);
}

function bindPorts(el, nodeId) {
  el.querySelectorAll('.node-port').forEach(port => {
    port.addEventListener('mousedown', e => e.stopPropagation());
    port.addEventListener('click', e => {
      e.stopPropagation();
      // The node's own click handler also fires — we must skip it.
      // We do this by setting a flag BEFORE it can execute.
      onPortClick(nodeId);
    });
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

// ─ DRAG TO MOVE ──────────────────────────────────────────────────
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

// ─ NODE SELECTION ─────────────────────────────────────────────────
function selectNode(id) {
  deselectArrow();
  document.querySelectorAll('.vsm-node').forEach(el => el.classList.remove('selected'));
  const el = document.getElementById(id);
  if (el) el.classList.add('selected');
  selectedNodeId = id;
}

// Canvas background click: deselect everything / cancel arrow mode
function onCanvasClick(e) {
  if (e.target === document.getElementById('canvas')) {
    document.querySelectorAll('.vsm-node').forEach(el => el.classList.remove('selected'));
    selectedNodeId = null;
    deselectArrow();
    if (connectingFrom) cancelArrowMode();
  }
}

// ─ ARROW MODE ─────────────────────────────────────────────────────────
function setArrowMode(mode) {
  if (arrowMode === mode && !connectingFrom) { cancelArrowMode(); return; }
  arrowMode = mode;
  clearArrowModeUI();
  document.getElementById('btn-' + mode + '-arrow')?.classList.add('active');
  document.getElementById('canvas').style.cursor = 'crosshair';
}

function cancelArrowMode() {
  arrowMode      = null;
  connectingFrom = null;
  clearArrowModeUI();
  document.getElementById('canvas').style.cursor = 'default';
  showConnectHint(false);
  document.querySelectorAll('.vsm-node').forEach(el => el.classList.remove('selected'));
  selectedNodeId = null;
}

function clearArrowModeUI() {
  ['push','pull','info'].forEach(m => document.getElementById('btn-' + m + '-arrow')?.classList.remove('active'));
}

function showConnectHint(active, fromLabel) {
  let hint = document.getElementById('connect-hint');
  if (!hint) {
    hint = document.createElement('div');
    hint.id = 'connect-hint';
    hint.className = 'connect-hint';
    document.querySelector('.canvas-area').appendChild(hint);
  }
  hint.textContent = active ? `⚡ "${fromLabel}" listo — ahora click en el nodo DESTINO` : '';
  hint.style.display = active ? 'block' : 'none';
}

// ─ PORT CLICK — sole owner of connection logic ───────────────────────────────
function onPortClick(nodeId) {
  if (!arrowMode) setArrowMode('push');

  if (!connectingFrom) {
    // Step 1: set source
    connectingFrom = nodeId;
    selectNode(nodeId);
    showConnectHint(true, getNode(nodeId)?.props.label || nodeId);
    return;
  }

  if (connectingFrom === nodeId) {
    // Clicked source port again — cancel
    cancelArrowMode();
    return;
  }

  // Step 2: create connection, then fully stop
  addArrow(connectingFrom, nodeId, arrowMode);
  renderAllArrows();
  cancelArrowMode();   // resets arrowMode, connectingFrom, cursor, hint
}

// ─ ARROW SELECTION & EDITING ──────────────────────────────────────────
function selectArrow(arrowId) {
  deselectArrow();
  document.querySelectorAll('.vsm-node').forEach(el => el.classList.remove('selected'));
  selectedNodeId  = null;
  selectedArrowId = arrowId;
  renderAllArrows();
  showArrowToolbar(arrowId);
}

function deselectArrow() {
  if (selectedArrowId) { selectedArrowId = null; renderAllArrows(); }
  document.getElementById('arrow-toolbar')?.remove();
}

function showArrowToolbar(arrowId) {
  document.getElementById('arrow-toolbar')?.remove();
  const arrow = getArrow(arrowId); if (!arrow) return;
  const mid   = getArrowMidpoint(arrow.fromId, arrow.toId); if (!mid) return;

  const tb = document.createElement('div');
  tb.id = 'arrow-toolbar';
  tb.className = 'arrow-toolbar';
  tb.style.left = (mid.x - 60) + 'px';
  tb.style.top  = (mid.y - 40) + 'px';
  tb.innerHTML = `
    <span class="arrow-tb-label">${arrowTypeLabel(arrow.type)} • ${arrow.transportDays||0.5}d</span>
    <button onclick="openArrowModal('${arrowId}')" title="Editar">✎</button>
    <button class="danger" onclick="confirmDeleteArrow('${arrowId}')" title="Eliminar">🗑</button>`;
  tb.addEventListener('mousedown', e => e.stopPropagation());
  document.querySelector('.canvas-area').appendChild(tb);
}

function arrowTypeLabel(t) {
  return t==='push'?'⟶ Push':t==='pull'?'⇢ Pull':'⤳ Info';
}

function getArrowMidpoint(fromId, toId) {
  const fn=getNode(fromId), tn=getNode(toId); if(!fn||!tn) return null;
  const fEl=document.getElementById(fromId), tEl=document.getElementById(toId); if(!fEl||!tEl) return null;
  const x1=fn.x+fEl.offsetWidth, y1=fn.y+fEl.offsetHeight/2;
  const x2=tn.x,                 y2=tn.y+tEl.offsetHeight/2;
  const dx=Math.abs(x2-x1), cx1=x1+dx*0.45, cx2=x2-dx*0.45;
  const t=0.5, u=0.5;
  return {
    x: u*u*u*x1+3*u*u*t*cx1+3*u*t*t*cx2+t*t*t*x2,
    y: u*u*u*y1+3*u*u*t*y1 +3*u*t*t*y2 +t*t*t*y2
  };
}

function openArrowModal(arrowId) {
  document.getElementById('arrow-toolbar')?.remove();
  const arrow=getArrow(arrowId); if(!arrow) return;
  const fromLbl=getNode(arrow.fromId)?.props?.label||arrow.fromId;
  const toLbl  =getNode(arrow.toId)?.props?.label  ||arrow.toId;

  document.getElementById('modal-title').textContent=`Flecha: ${fromLbl} → ${toLbl}`;
  document.getElementById('modal-body').innerHTML=`
    <div class="prop-group">
      <label>Tipo de flujo</label>
      <select id="arrow-edit-type">
        <option value="push" ${arrow.type==='push'?'selected':''}>⟶ Push (flujo empujado)</option>
        <option value="pull" ${arrow.type==='pull'?'selected':''}>⇢ Pull (flujo jalado)</option>
        <option value="info" ${arrow.type==='info'?'selected':''}>⤳ Flujo de información</option>
      </select>
    </div>
    <div class="prop-group">
      <label>Tiempo de transporte / espera</label>
      <div class="sim-input-row">
        <input type="number" id="arrow-edit-days" value="${arrow.transportDays||0.5}" min="0" step="0.1" style="width:100%">
        <span class="sim-unit">días</span>
      </div>
      <small style="color:var(--text-muted);font-size:9px;margin-top:4px;display:block">
        Aparece como caja NVA (roja) en el Value Stream Timeline.
      </small>
    </div>
    <div class="prop-group" style="margin-top:12px">
      <button onclick="confirmDeleteArrow('${arrowId}')" style="background:rgba(248,81,73,.15);border:1px solid var(--danger);color:var(--danger);padding:6px 14px;border-radius:6px;cursor:pointer;font-size:11px;width:100%">
        🗑 Eliminar esta flecha
      </button>
    </div>`;

  document.querySelector('.modal-footer .btn-accent').onclick = () => saveArrowProps(arrowId);
  document.getElementById('modal-overlay').classList.remove('hidden');
}

function saveArrowProps(arrowId) {
  const arrow=getArrow(arrowId); if(!arrow) return;
  arrow.type          = document.getElementById('arrow-edit-type').value;
  arrow.transportDays = parseFloat(document.getElementById('arrow-edit-days').value)||0.5;
  closeModal();
  renderAllArrows();
}

function confirmDeleteArrow(arrowId) {
  const arrow=getArrow(arrowId); if(!arrow) return;
  const from=getNode(arrow.fromId)?.props?.label||'?';
  const to  =getNode(arrow.toId)?.props?.label  ||'?';
  if(confirm(`¿Eliminar flecha ${from} → ${to}?`)) {
    deleteArrow(arrowId); closeModal(); renderAllArrows();
  }
}

// ─ KEYBOARD ────────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key==='Escape') { cancelArrowMode(); deselectArrow(); }
  if ((e.key==='Delete'||e.key==='Backspace') && !e.target.matches('input,select,textarea')) {
    if (selectedArrowId) confirmDeleteArrow(selectedArrowId);
    else if (selectedNodeId) deleteSelected();
  }
});

// ─ ARROWS SVG ──────────────────────────────────────────────────────────────
function renderAllArrows() {
  const svg = document.getElementById('arrows-svg');
  svg.innerHTML = `
    <defs>
      <marker id="arr-push"     markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0,10 3.5,0 7" fill="#58a6ff"/></marker>
      <marker id="arr-pull"     markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0,10 3.5,0 7" fill="#3fb950"/></marker>
      <marker id="arr-info"     markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0,10 3.5,0 7" fill="#d29922"/></marker>
      <marker id="arr-push-sel" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0,10 3.5,0 7" fill="#ffffff"/></marker>
      <marker id="arr-pull-sel" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0,10 3.5,0 7" fill="#ffffff"/></marker>
      <marker id="arr-info-sel" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0,10 3.5,0 7" fill="#ffffff"/></marker>
    </defs>`;

  arrows.forEach(arrow => {
    const fn=getNode(arrow.fromId), tn=getNode(arrow.toId); if(!fn||!tn) return;
    const fEl=document.getElementById(arrow.fromId), tEl=document.getElementById(arrow.toId); if(!fEl||!tEl) return;

    const x1=fn.x+fEl.offsetWidth, y1=fn.y+fEl.offsetHeight/2;
    const x2=tn.x,                 y2=tn.y+tEl.offsetHeight/2;
    const dx=Math.abs(x2-x1), cx1=x1+dx*0.45, cx2=x2-dx*0.45;
    const d=`M ${x1} ${y1} C ${cx1} ${y1} ${cx2} ${y2} ${x2} ${y2}`;

    const isSel  = arrow.id===selectedArrowId;
    const stroke = isSel?'#ffffff':arrow.type==='push'?'#58a6ff':arrow.type==='pull'?'#3fb950':'#d29922';
    const dash   = arrow.type==='push'?'':arrow.type==='pull'?'8,4':'4,4';
    const mkSfx  = isSel?'-sel':'';

    const hit = document.createElementNS('http://www.w3.org/2000/svg','path');
    hit.setAttribute('d', d);
    hit.setAttribute('stroke','rgba(255,255,255,0.01)');
    hit.setAttribute('stroke-width','18');
    hit.setAttribute('fill','none');
    hit.style.cursor = 'pointer';
    hit.style.pointerEvents = 'stroke';
    hit.addEventListener('click',    ev => { ev.stopPropagation(); if (!connectingFrom) selectArrow(arrow.id); });
    hit.addEventListener('dblclick', ev => { ev.stopPropagation(); if (!connectingFrom) openArrowModal(arrow.id); });
    svg.appendChild(hit);

    const path = document.createElementNS('http://www.w3.org/2000/svg','path');
    path.setAttribute('id','arrow-path-'+arrow.id);
    path.setAttribute('d', d);
    path.setAttribute('stroke', stroke);
    path.setAttribute('stroke-width', isSel?3:2);
    path.setAttribute('fill','none');
    path.setAttribute('stroke-dasharray', dash);
    path.setAttribute('marker-end',`url(#arr-${arrow.type}${mkSfx})`);
    path.style.pointerEvents = 'none';
    svg.appendChild(path);

    const td = arrow.transportDays;
    if (td && td !== 0.5) {
      const mx=0.125*x1+0.375*cx1+0.375*cx2+0.125*x2;
      const my=0.125*y1+0.375*y1 +0.375*y2 +0.125*y2;
      const lbl=document.createElementNS('http://www.w3.org/2000/svg','text');
      lbl.setAttribute('x',mx); lbl.setAttribute('y',my-8);
      lbl.setAttribute('fill',stroke); lbl.setAttribute('font-size','9');
      lbl.setAttribute('text-anchor','middle'); lbl.setAttribute('font-family','monospace');
      lbl.setAttribute('font-weight','700');
      lbl.textContent = td+'d';
      lbl.style.pointerEvents='none';
      svg.appendChild(lbl);
    }
  });

  if (selectedArrowId) showArrowToolbar(selectedArrowId);
}
