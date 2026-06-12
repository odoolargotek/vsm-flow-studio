// ===== CANVAS ENGINE v4.4 — Gate node + Resource display =====

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
    const resBadge = p.resourceName
      ? `<div class="node-resource-badge" title="Recurso: ${p.resourceName}">👤 ${p.resourceName}${p.resourceCT ? ' · '+p.resourceCT+'s' : ''}</div>` : '';
    html += `<div class="node-body">
      <div class="node-title">${p.label}${distBadge}</div>
      <div class="node-stats">CT: <span>${ctDisplay}</span><br>C/O: <span>${p.co}min</span><br>Uptime: <span>${p.uptime}%</span></div>
      ${resBadge}
      <div class="node-ops">${ops}</div>
    </div>`;
  } else if (node.type === 'gate') {
    // Show split percentages for outgoing arrows
    const outs = arrows.filter(a => a.fromId === node.id);
    const splitLines = outs.length
      ? outs.map(a => {
          const toLbl = getNode(a.toId)?.props?.label || a.toId;
          return `<div class="gate-split-line">→ ${toLbl}: <b>${a.splitPct||0}%</b></div>`;
        }).join('')
      : '<div class="gate-split-hint">Conecta salidas</div>';
    html += `<div class="node-body gate-body">
      <div class="gate-icon">🔀</div>
      <div class="node-title">${p.label}</div>
      <div class="gate-splits">${splitLines}</div>
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

// Refresh all gate nodes (needed when arrows change)
function refreshAllGates() {
  nodes.filter(n => n.type === 'gate').forEach(n => refreshNodeElement(n.id));
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

// ─ PORT CLICK ───────────────────────────────────────────────────────────
function onPortClick(nodeId) {
  if (!arrowMode) setArrowMode('push');

  if (!connectingFrom) {
    connectingFrom = nodeId;
    selectNode(nodeId);
    showConnectHint(true, getNode(nodeId)?.props.label || nodeId);
    return;
  }

  if (connectingFrom === nodeId) {
    cancelArrowMode();
    return;
  }

  addArrow(connectingFrom, nodeId, arrowMode);
  renderAllArrows();
  refreshAllGates();
  cancelArrowMode();
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
  const fromNode = getNode(arrow.fromId);
  const isGateOut = fromNode && fromNode.type === 'gate';

  const tb = document.createElement('div');
  tb.id = 'arrow-toolbar';
  tb.className = 'arrow-toolbar';
  tb.style.left = (mid.x - 60) + 'px';
  tb.style.top  = (mid.y - 40) + 'px';
  const pctLabel = isGateOut ? ` · ${arrow.splitPct||0}%` : '';
  tb.innerHTML = `
    <span class="arrow-tb-label">${arrowTypeLabel(arrow.type)} • ${arrow.transportDays||0.5}d${pctLabel}</span>
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
  const fromNode = getNode(arrow.fromId);
  const isGateOut = fromNode && fromNode.type === 'gate';

  // For gate outputs, collect sibling arrows to show all pcts
  const gateOutsHtml = isGateOut ? (() => {
    const siblings = arrows.filter(a => a.fromId === arrow.fromId);
    return `
      <hr class="prop-divider">
      <div class="prop-section-title">🔀 % Distribución del Gate</div>
      <div style="font-size:10px;color:var(--text-muted);margin-bottom:8px">La suma de todos los % debe ser 100. Ajusta manualmente.</div>
      ${siblings.map(s => {
        const sLbl = getNode(s.toId)?.props?.label || s.toId;
        const isThis = s.id === arrowId;
        return `<div class="prop-row" style="align-items:center;gap:8px">
          <div class="prop-group" style="flex:2">
            <label style="font-weight:${isThis?700:400};color:${isThis?'var(--accent)':'inherit'}">
              → ${sLbl}${isThis?' (esta)':''}
            </label>
          </div>
          <div class="prop-group" style="flex:1">
            <input type="number" id="gate-pct-${s.id}" value="${s.splitPct||0}" min="0" max="100"
              oninput="updateGatePctPreview()">
          </div>
          <span style="color:var(--text-muted);font-size:11px">%</span>
        </div>`;
      }).join('')}
      <div id="gate-pct-total" style="font-size:11px;margin-top:4px;"></div>`;
  })() : '';

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
    </div>
    ${gateOutsHtml}
    <div class="prop-group" style="margin-top:12px">
      <button onclick="confirmDeleteArrow('${arrowId}')" style="background:rgba(248,81,73,.15);border:1px solid var(--danger);color:var(--danger);padding:6px 14px;border-radius:6px;cursor:pointer;font-size:11px;width:100%">
        🗑 Eliminar esta flecha
      </button>
    </div>`;

  if (isGateOut) setTimeout(updateGatePctPreview, 50);
  document.querySelector('.modal-footer .btn-accent').onclick = () => saveArrowProps(arrowId, isGateOut);
  document.getElementById('modal-overlay').classList.remove('hidden');
}

function updateGatePctPreview() {
  const total = arrows
    .filter(a => {
      const inp = document.getElementById('gate-pct-'+a.id);
      return inp !== null;
    })
    .reduce((sum, a) => {
      const inp = document.getElementById('gate-pct-'+a.id);
      return sum + (parseFloat(inp?.value)||0);
    }, 0);
  const el = document.getElementById('gate-pct-total');
  if (el) {
    el.textContent = `Total: ${total.toFixed(0)}%`;
    el.style.color = Math.abs(total - 100) < 0.01 ? 'var(--success,#3fb950)' : 'var(--danger,#f85149)';
  }
}

function saveArrowProps(arrowId, isGateOut) {
  const arrow=getArrow(arrowId); if(!arrow) return;
  arrow.type          = document.getElementById('arrow-edit-type').value;
  arrow.transportDays = parseFloat(document.getElementById('arrow-edit-days').value)||0.5;
  if (isGateOut) {
    // Save all sibling gate % values
    arrows.filter(a => a.fromId === arrow.fromId).forEach(a => {
      const inp = document.getElementById('gate-pct-'+a.id);
      if (inp) a.splitPct = parseFloat(inp.value)||0;
    });
    refreshAllGates();
  }
  closeModal();
  renderAllArrows();
}

function confirmDeleteArrow(arrowId) {
  const arrow=getArrow(arrowId); if(!arrow) return;
  const from=getNode(arrow.fromId)?.props?.label||'?';
  const to  =getNode(arrow.toId)?.props?.label  ||'?';
  if(confirm(`¿Eliminar flecha ${from} → ${to}?`)) {
    const fromId = arrow.fromId;
    deleteArrow(arrowId); closeModal(); renderAllArrows();
    if (getNode(fromId)?.type === 'gate') { autoBalanceGate(fromId); refreshAllGates(); renderAllArrows(); }
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
      <marker id="arr-gate"     markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0,10 3.5,0 7" fill="#bc8cff"/></marker>
      <marker id="arr-push-sel" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0,10 3.5,0 7" fill="#ffffff"/></marker>
      <marker id="arr-pull-sel" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0,10 3.5,0 7" fill="#ffffff"/></marker>
      <marker id="arr-info-sel" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0,10 3.5,0 7" fill="#ffffff"/></marker>
      <marker id="arr-gate-sel" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0,10 3.5,0 7" fill="#ffffff"/></marker>
    </defs>`;

  arrows.forEach(arrow => {
    const fn=getNode(arrow.fromId), tn=getNode(arrow.toId); if(!fn||!tn) return;
    const fEl=document.getElementById(arrow.fromId), tEl=document.getElementById(arrow.toId); if(!fEl||!tEl) return;

    const x1=fn.x+fEl.offsetWidth, y1=fn.y+fEl.offsetHeight/2;
    const x2=tn.x,                 y2=tn.y+tEl.offsetHeight/2;
    const dx=Math.abs(x2-x1), cx1=x1+dx*0.45, cx2=x2-dx*0.45;
    const d=`M ${x1} ${y1} C ${cx1} ${y1} ${cx2} ${y2} ${x2} ${y2}`;

    const isGateOut = fn.type === 'gate';
    const isSel  = arrow.id===selectedArrowId;
    const baseColor = isGateOut ? '#bc8cff' : arrow.type==='push'?'#58a6ff':arrow.type==='pull'?'#3fb950':'#d29922';
    const stroke = isSel ? '#ffffff' : baseColor;
    const dash   = arrow.type==='push'?'':arrow.type==='pull'?'8,4':'4,4';
    const markerKey = isGateOut ? 'gate' : arrow.type;
    const mkSfx  = isSel?'-sel':'';

    const hit = document.createElementNS('http://www.w3.org/2000/svg','path');
    hit.setAttribute('d', d); hit.setAttribute('stroke','rgba(255,255,255,0.01)');
    hit.setAttribute('stroke-width','18'); hit.setAttribute('fill','none');
    hit.style.cursor = 'pointer'; hit.style.pointerEvents = 'stroke';
    hit.addEventListener('click',    ev => { ev.stopPropagation(); if (!connectingFrom) selectArrow(arrow.id); });
    hit.addEventListener('dblclick', ev => { ev.stopPropagation(); if (!connectingFrom) openArrowModal(arrow.id); });
    svg.appendChild(hit);

    const path = document.createElementNS('http://www.w3.org/2000/svg','path');
    path.setAttribute('id','arrow-path-'+arrow.id);
    path.setAttribute('d', d); path.setAttribute('stroke', stroke);
    path.setAttribute('stroke-width', isSel?3:2); path.setAttribute('fill','none');
    path.setAttribute('stroke-dasharray', dash);
    path.setAttribute('marker-end',`url(#arr-${markerKey}${mkSfx})`);
    path.style.pointerEvents = 'none';
    svg.appendChild(path);

    // Label: transport days OR gate %
    let labelText = null;
    if (isGateOut && arrow.splitPct != null) {
      labelText = arrow.splitPct + '%';
    } else if (arrow.transportDays && arrow.transportDays !== 0.5) {
      labelText = arrow.transportDays + 'd';
    }
    if (labelText) {
      const mx=0.125*x1+0.375*cx1+0.375*cx2+0.125*x2;
      const my=0.125*y1+0.375*y1 +0.375*y2 +0.125*y2;
      const lbl=document.createElementNS('http://www.w3.org/2000/svg','text');
      lbl.setAttribute('x',mx); lbl.setAttribute('y',my-8);
      lbl.setAttribute('fill', isGateOut ? '#bc8cff' : stroke);
      lbl.setAttribute('font-size','10'); lbl.setAttribute('text-anchor','middle');
      lbl.setAttribute('font-family','monospace'); lbl.setAttribute('font-weight','700');
      lbl.textContent = labelText; lbl.style.pointerEvents='none';
      svg.appendChild(lbl);
    }
  });

  if (selectedArrowId) showArrowToolbar(selectedArrowId);
}
