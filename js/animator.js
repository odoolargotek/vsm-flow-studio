// ===== ANIMATOR ENGINE v2 — VSM Flow Studio =====
// Particles travel along the EXACT same bezier path as the arrows.
// Key fix: use getBoundingClientRect() relative to the SVG element
// to convert DOM positions into SVG coordinate space.

const ANIM = {
  running:    false,
  speed:      1,
  raf:        null,
  lastTs:     null,
  simTime:    0,
  particles:  [],
  procStates: {},
  wipState:   {},
  customerCount: 0,
  totalUnits: 0,
};

const PARTICLE_TRAVEL_SEC = 1.2;  // real seconds to cross an arrow at 1X
const MAX_WIP_VISUAL = 12;

// ── SPEED CONTROL ─────────────────────────────────────────────────
function setAnimSpeed(spd) {
  ANIM.speed = spd;
  document.querySelectorAll('.speed-btn').forEach(b =>
    b.classList.toggle('active', parseInt(b.dataset.speed) === spd)
  );
}

// ── START / STOP / RESET ──────────────────────────────────────────
function startAnimation() {
  if (!validateForAnim()) return;
  if (ANIM.running) return;
  initAnimState();
  ANIM.running = true;
  ANIM.lastTs  = null;
  ANIM.raf     = requestAnimationFrame(animLoop);
  updateAnimUI(true);
  logAnim('▶ Simulación iniciada');
}

function stopAnimation() {
  ANIM.running = false;
  if (ANIM.raf) cancelAnimationFrame(ANIM.raf);
  ANIM.raf = null;
  clearParticles();
  updateAnimUI(false);
  logAnim('⏹ Detenida — ' + ANIM.totalUnits + ' u producidas');
}

function resetAnimation() {
  stopAnimation();
  Object.assign(ANIM, { simTime:0, particles:[], procStates:{}, wipState:{}, customerCount:0, totalUnits:0 });
  clearParticles();
  nodes.forEach(n => resetNodeVisual(n.id));
  const logEl = document.getElementById('anim-log');
  const statsEl = document.getElementById('anim-stats');
  if (logEl) logEl.textContent = 'Presiona ▶ para iniciar.';
  if (statsEl) statsEl.textContent = '';
  updateAnimUI(false);
}

function validateForAnim() {
  if (!getProcessesOrdered().length) { alert('Agrega al menos un proceso al canvas.'); return false; }
  if (!arrows.length) { alert('Conecta los procesos con flechas.'); return false; }
  return true;
}

function initAnimState() {
  ANIM.simTime = 0; ANIM.particles = []; ANIM.customerCount = 0; ANIM.totalUnits = 0;
  ANIM.procStates = {};
  nodes.filter(n => n.type === 'process').forEach(n => {
    ANIM.procStates[n.id] = { busy:false, busyUntil:0, queue:0, produced:0 };
    setNodeState(n.id, 'idle');
  });
  ANIM.wipState = {};
  nodes.filter(n => n.type === 'inventory').forEach(n => {
    ANIM.wipState[n.id] = { count: n.props.units || 0 };
    updateWIPVisual(n.id);
  });
  const firstProc = getProcessesOrdered()[0];
  if (firstProc) ANIM.procStates[firstProc.id].queue = 5;
  nextSupplyAt = 0;
}

// ── MAIN LOOP ─────────────────────────────────────────────────────
function animLoop(ts) {
  if (!ANIM.running) return;
  if (!ANIM.lastTs) ANIM.lastTs = ts;
  const realDelta = Math.min((ts - ANIM.lastTs) / 1000, 0.1); // cap at 100ms
  ANIM.lastTs = ts;
  const vDelta = realDelta * ANIM.speed;
  ANIM.simTime += vDelta;
  tickProcesses(vDelta);
  tickParticles(realDelta);
  tickSupplier(vDelta);
  updateStatsBar();
  ANIM.raf = requestAnimationFrame(animLoop);
}

// ── PROCESS TICK ──────────────────────────────────────────────────
function tickProcesses(vDelta) {
  nodes.filter(n => n.type === 'process').forEach(node => {
    const st = ANIM.procStates[node.id];
    if (!st) return;
    const p = node.props;

    // Uptime: small random chance of being down each tick
    if (!st.busy && Math.random() > ((p.uptime || 90) / 100) * 0.998 + 0.001) {
      setNodeState(node.id, 'down');
      st.downUntil = ANIM.simTime + (p.co || 5);
      return;
    }
    if (st.downUntil && ANIM.simTime < st.downUntil) return;
    if (st.downUntil && ANIM.simTime >= st.downUntil) st.downUntil = 0;

    // Sample CT from distribution
    let ct = p.ct || 30;
    if (p.distType === 'normal') {
      ct = Math.max(1, gaussianRandom(p.ct, p.ctStd || 0));
    } else if (p.distType === 'triangular') {
      ct = sampleTriangular(p.ctMin || p.ct * 0.7, p.ct, p.ctMax || p.ct * 1.5);
    }

    if (st.busy) {
      if (ANIM.simTime >= st.busyUntil) {
        st.busy = false;
        st.produced++;
        ANIM.totalUnits++;
        setNodeState(node.id, 'idle');
        launchParticleFrom(node.id);
      }
    } else {
      if (st.queue > 0) {
        st.queue--;
        st.busy = true;
        st.busyUntil = ANIM.simTime + ct;
        setNodeState(node.id, 'busy');
      } else {
        setNodeState(node.id, 'starved');
      }
    }
  });
}

// ── SUPPLIER TICK ─────────────────────────────────────────────────
let nextSupplyAt = 0;
function tickSupplier(vDelta) {
  if (ANIM.simTime < nextSupplyAt) return;
  const firstProc = getProcessesOrdered()[0];
  if (!firstProc) return;
  const st = ANIM.procStates[firstProc.id];
  if (!st) return;
  st.queue = Math.min((st.queue || 0) + 3, 20);
  nextSupplyAt = ANIM.simTime + (firstProc.props.ct || 30) * 1.5;
  const sup = nodes.find(n => n.type === 'supplier');
  if (sup) pulseNode(sup.id, 'supply');
}

// ── PARTICLES ─────────────────────────────────────────────────────
let particleIdCtr = 0;

function launchParticleFrom(fromNodeId) {
  const outArrows = arrows.filter(a => a.fromId === fromNodeId);
  if (!outArrows.length) {
    // End of line → deliver to customer
    const cust = nodes.find(n => n.type === 'customer');
    if (cust) {
      ANIM.customerCount++;
      pulseNode(cust.id, 'receive');
      updateCustBadge(cust.id);
    }
    return;
  }
  outArrows.forEach(arrow => {
    const toNode = getNode(arrow.toId);
    if (!toNode) return;
    spawnParticle(arrow.fromId, arrow.toId, toNode.type, toNode.id);
  });
}

function spawnParticle(fromId, toId, toType, toNodeId) {
  const pid = 'p' + (particleIdCtr++);
  ANIM.particles.push({ id: pid, fromId, toId, progress: 0, toType, toNodeId });
  // Create SVG circle
  const svg = document.getElementById('arrows-svg');
  if (!svg) return;
  const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  c.setAttribute('id', 'part-' + pid);
  c.setAttribute('r', '7');
  c.setAttribute('fill', '#ffd700');
  c.setAttribute('stroke', '#1a1a1a');
  c.setAttribute('stroke-width', '1.5');
  c.style.filter = 'drop-shadow(0 0 5px rgba(255,215,0,0.9))';
  c.style.pointerEvents = 'none';
  svg.appendChild(c);
}

function tickParticles(realDelta) {
  const travelTime = PARTICLE_TRAVEL_SEC; // real seconds for full path
  const done = [];
  ANIM.particles.forEach(p => {
    p.progress += realDelta / travelTime;
    if (p.progress >= 1) { p.progress = 1; done.push(p); }
    // Move the SVG circle along the bezier
    const pos = getArrowBezierPoint(p.fromId, p.toId, p.progress);
    if (pos) {
      const c = document.getElementById('part-' + p.id);
      if (c) { c.setAttribute('cx', pos.x); c.setAttribute('cy', pos.y); }
    }
  });
  done.forEach(p => {
    document.getElementById('part-' + p.id)?.remove();
    arriveParticle(p);
  });
  ANIM.particles = ANIM.particles.filter(p => p.progress < 1);
}

function arriveParticle(p) {
  const toNode = getNode(p.toNodeId);
  if (!toNode) return;
  if (toNode.type === 'inventory') {
    if (!ANIM.wipState[toNode.id]) ANIM.wipState[toNode.id] = { count: 0 };
    ANIM.wipState[toNode.id].count++;
    updateWIPVisual(toNode.id);
    setTimeout(() => drainWIP(toNode.id), 300);
  } else if (toNode.type === 'process') {
    const st = ANIM.procStates[toNode.id];
    if (st) st.queue = Math.min((st.queue || 0) + 1, 20);
  } else if (toNode.type === 'customer') {
    ANIM.customerCount++;
    pulseNode(toNode.id, 'receive');
    updateCustBadge(toNode.id);
  }
}

function drainWIP(wipId) {
  const ws = ANIM.wipState[wipId];
  if (!ws || ws.count <= 0) return;
  const outArrow = arrows.find(a => a.fromId === wipId);
  if (!outArrow) return;
  ws.count = Math.max(0, ws.count - 1);
  updateWIPVisual(wipId);
  const toNode = getNode(outArrow.toId);
  if (toNode) spawnParticle(outArrow.fromId, outArrow.toId, toNode.type, toNode.id);
}

function clearParticles() {
  document.querySelectorAll('[id^="part-"]').forEach(el => el.remove());
  ANIM.particles = [];
}

// ── BEZIER COORDINATE MAPPING ─────────────────────────────────────
// This is the KEY fix: we read the ACTUAL screen position of each node
// element, then subtract the SVG's own bounding rect to get coordinates
// in SVG space. This matches EXACTLY what renderAllArrows() draws.
function getArrowBezierPoint(fromId, toId, t) {
  const fromEl = document.getElementById(fromId);
  const toEl   = document.getElementById(toId);
  const svg    = document.getElementById('arrows-svg');
  if (!fromEl || !toEl || !svg) return null;

  const svgRect  = svg.getBoundingClientRect();
  const fromRect = fromEl.getBoundingClientRect();
  const toRect   = toEl.getBoundingClientRect();

  // Right-center of source node in SVG space
  const x1 = fromRect.right  - svgRect.left;
  const y1 = fromRect.top + fromRect.height / 2 - svgRect.top;
  // Left-center of target node in SVG space
  const x2 = toRect.left     - svgRect.left;
  const y2 = toRect.top  + toRect.height  / 2 - svgRect.top;

  // Same control points as canvas.js renderAllArrows()
  const dx  = Math.abs(x2 - x1);
  const cx1 = x1 + dx * 0.45;
  const cx2 = x2 - dx * 0.45;

  // Cubic bezier B(t)
  const u = 1 - t;
  const x = u*u*u*x1 + 3*u*u*t*cx1 + 3*u*t*t*cx2 + t*t*t*x2;
  const y = u*u*u*y1 + 3*u*u*t*y1  + 3*u*t*t*y2  + t*t*t*y2;
  return { x, y };
}

// ── GAUSSIAN HELPER ───────────────────────────────────────────────
function gaussianRandom(mean, std) {
  if (!std || std === 0) return mean;
  let u = 0, v = 0;
  while (!u) u = Math.random();
  while (!v) v = Math.random();
  return mean + std * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// ── NODE VISUAL STATES ────────────────────────────────────────────
function setNodeState(nodeId, state) {
  const el = document.getElementById(nodeId);
  if (!el) return;
  el.classList.remove('state-idle','state-busy','state-starved','state-blocked','state-down');
  el.classList.add('state-' + state);
  let dot = el.querySelector('.state-dot');
  if (!dot) { dot = document.createElement('div'); dot.className = 'state-dot'; el.appendChild(dot); }
  const colors = { idle:'#388bfd', busy:'#3fb950', starved:'#d29922', blocked:'#f85149', down:'#6e7681' };
  dot.style.background = colors[state] || '#888';
  let lbl = el.querySelector('.state-label');
  if (!lbl) {
    lbl = document.createElement('div');
    lbl.className = 'state-label';
    (el.querySelector('.node-body') || el).appendChild(lbl);
  }
  const labels = { idle:'⬜ LIBRE', busy:'🟢 PROCESANDO', starved:'🟡 ESPERA', blocked:'🔴 BLOQUEADO', down:'⚫ PARADO' };
  lbl.textContent = labels[state] || state;
}

function resetNodeVisual(nodeId) {
  const el = document.getElementById(nodeId);
  if (!el) return;
  el.classList.remove('state-idle','state-busy','state-starved','state-blocked','state-down');
  el.querySelector('.state-dot')?.remove();
  el.querySelector('.state-label')?.remove();
  el.querySelector('.cust-count')?.remove();
  el.querySelector('.wip-dots')?.remove();
}

function pulseNode(nodeId, type) {
  const el = document.getElementById(nodeId);
  if (!el) return;
  el.classList.remove('pulse-supply','pulse-receive');
  void el.offsetWidth;
  el.classList.add('pulse-' + type);
  setTimeout(() => el.classList.remove('pulse-' + type), 600);
}

function updateCustBadge(custId) {
  const el = document.getElementById(custId);
  if (!el) return;
  let badge = el.querySelector('.cust-count');
  if (!badge) {
    badge = document.createElement('div');
    badge.className = 'cust-count';
    (el.querySelector('.node-body') || el).appendChild(badge);
  }
  badge.textContent = ANIM.customerCount + ' u';
}

function updateWIPVisual(wipId) {
  const el = document.getElementById(wipId);
  if (!el) return;
  const count = ANIM.wipState[wipId]?.count || 0;
  let lbl = el.querySelector('.node-inv-units');
  if (lbl) lbl.textContent = count + ' u';
  let dotsEl = el.querySelector('.wip-dots');
  if (!dotsEl) {
    dotsEl = document.createElement('div');
    dotsEl.className = 'wip-dots';
    (el.querySelector('.node-body') || el).appendChild(dotsEl);
  }
  dotsEl.innerHTML = '';
  const shown = Math.min(count, MAX_WIP_VISUAL);
  for (let i = 0; i < shown; i++) {
    const d = document.createElement('div');
    d.className = 'wip-dot';
    const r = count / MAX_WIP_VISUAL;
    d.style.background = r > 0.8 ? '#f85149' : r > 0.5 ? '#d29922' : '#3fb950';
    dotsEl.appendChild(d);
  }
  if (count > MAX_WIP_VISUAL) {
    const m = document.createElement('div');
    m.className = 'wip-dot-more';
    m.textContent = '+' + (count - MAX_WIP_VISUAL);
    dotsEl.appendChild(m);
  }
  const tri = el.querySelector('.node-triangle');
  if (tri) {
    const r = count / Math.max(1, getNode(wipId)?.props.units || 100);
    tri.style.borderBottomColor = r > 1.5 ? '#f85149' : r > 0.8 ? '#d29922' : '#3fb950';
  }
}

// ── STATS BAR ─────────────────────────────────────────────────────
function updateStatsBar() {
  const el = document.getElementById('anim-stats');
  if (!el) return;
  const m = Math.floor(ANIM.simTime / 60);
  const s = Math.floor(ANIM.simTime % 60);
  const t = m > 0 ? `${m}m ${s}s` : `${s}s`;
  const procs = nodes.filter(n => n.type === 'process');
  const busy = procs.filter(n => ANIM.procStates[n.id]?.busy).length;
  const eff = procs.length ? Math.round((busy / procs.length) * 100) : 0;
  el.textContent = `⏱ ${t}  |  📦 Prod: ${ANIM.totalUnits}  |  🏁 Entregadas: ${ANIM.customerCount}  |  ⚙ Efic: ${eff}%  |  🚀 ${ANIM.speed}X`;
}

function logAnim(msg) {
  const el = document.getElementById('anim-log');
  if (el) el.textContent = msg;
}

function updateAnimUI(running) {
  const s = document.getElementById('btn-anim-start');
  const p = document.getElementById('btn-anim-stop');
  if (s) s.disabled = running;
  if (p) p.disabled = !running;
}
