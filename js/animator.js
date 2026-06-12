// ===== ANIMATOR ENGINE v1 — VSM Flow Studio =====
// Discrete-event animation: units travel arrows as particles,
// accumulate in WIP triangles, processes show busy/idle/blocked states.

const ANIM = {
  running:    false,
  speed:      1,           // multiplier: 1,5,10,20,30
  raf:        null,        // requestAnimationFrame handle
  lastTs:     null,
  simTime:    0,           // virtual seconds elapsed
  particles:  [],          // moving units on arrows
  procStates: {},          // nodeId -> { busy, busyUntil, queue, produced, blocked }
  wipState:   {},          // nodeId -> { count }
  customerCount: 0,
  totalUnits: 0,
  tickLog:    [],
};

const PARTICLE_TRAVEL_SEC = 1.5;   // real time (sec) to cross an arrow at speed 1x
const MAX_WIP_VISUAL = 12;         // max dots shown in triangle

// ── SPEED CONTROL ─────────────────────────────────────────────────
function setAnimSpeed(spd) {
  ANIM.speed = spd;
  document.querySelectorAll('.speed-btn').forEach(b => {
    b.classList.toggle('active', parseInt(b.dataset.speed) === spd);
  });
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
  logAnim('▶ Simulación animada iniciada');
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
  ANIM.simTime = 0;
  ANIM.particles = [];
  ANIM.procStates = {};
  ANIM.wipState   = {};
  ANIM.customerCount = 0;
  ANIM.totalUnits    = 0;
  ANIM.tickLog = [];
  clearParticles();
  // Reset all node visuals
  nodes.forEach(n => {
    resetNodeVisual(n.id);
  });
  document.getElementById('anim-log').textContent = 'Presiona ▶ para iniciar.';
  document.getElementById('anim-stats').textContent = '';
  updateAnimUI(false);
}

function validateForAnim() {
  const procs = getProcessesOrdered();
  if (procs.length === 0) {
    alert('Agrega al menos un proceso al canvas antes de animar.');
    return false;
  }
  if (arrows.length === 0) {
    alert('Conecta los procesos con flechas antes de animar.');
    return false;
  }
  return true;
}

function initAnimState() {
  ANIM.simTime = 0;
  ANIM.particles = [];
  ANIM.customerCount = 0;
  ANIM.totalUnits = 0;

  // Init process states
  ANIM.procStates = {};
  nodes.filter(n => n.type === 'process').forEach(n => {
    ANIM.procStates[n.id] = {
      busy: false,
      busyUntil: 0,
      queue: 0,
      produced: 0,
      blocked: false,
    };
    setNodeState(n.id, 'idle');
  });

  // Init WIP states from props
  ANIM.wipState = {};
  nodes.filter(n => n.type === 'inventory').forEach(n => {
    ANIM.wipState[n.id] = { count: n.props.units || 0 };
    updateWIPVisual(n.id);
  });

  // Supplier: seed first units into the first process queue
  const firstProc = getProcessesOrdered()[0];
  if (firstProc) {
    ANIM.procStates[firstProc.id].queue = 5;
  }
}

// ── MAIN LOOP ─────────────────────────────────────────────────────
function animLoop(ts) {
  if (!ANIM.running) return;
  if (!ANIM.lastTs) ANIM.lastTs = ts;

  const realDelta = (ts - ANIM.lastTs) / 1000;   // real seconds
  ANIM.lastTs = ts;

  const virtualDelta = realDelta * ANIM.speed;    // virtual seconds
  ANIM.simTime += virtualDelta;

  tickProcesses(virtualDelta);
  tickParticles(realDelta);          // particles use real time for smooth visuals
  tickSupplier(virtualDelta);
  updateStatsBar();

  ANIM.raf = requestAnimationFrame(animLoop);
}

// ── PROCESS TICK ──────────────────────────────────────────────────
function tickProcesses(vDelta) {
  const demand = parseFloat(document.getElementById('demand')?.value) || 400;
  const hoursShift = parseFloat(document.getElementById('hours-shift')?.value) || 8;
  const shifts = parseFloat(document.getElementById('shifts')?.value) || 1;
  const availSec = hoursShift * shifts * 3600;
  const takt = availSec / demand;

  nodes.filter(n => n.type === 'process').forEach(node => {
    const st = ANIM.procStates[node.id];
    if (!st) return;

    const p = node.props;
    // Sample CT (use mean for animation)
    let ct = p.ct;
    if (p.distType === 'normal')     ct = Math.max(1, p.ct + (Math.random()-0.5)*2*(p.ctStd||0));
    if (p.distType === 'triangular') ct = sampleTriangular(p.ctMin||p.ct*0.7, p.ct, p.ctMax||p.ct*1.5);

    // Uptime failure check
    const uptime = (p.uptime || 90) / 100;
    const isDown = Math.random() > uptime && !st.busy;
    if (isDown) {
      setNodeState(node.id, 'down');
      return;
    }

    if (st.busy) {
      if (ANIM.simTime >= st.busyUntil) {
        // Unit finished → send to next node
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
  // Check if there's a supplier connected
  const hasSupplier = arrows.some(a => {
    const fn = getNode(a.fromId);
    return fn && fn.type === 'supplier' && a.toId === firstProc.id;
  }) || true; // default: always supply

  if (hasSupplier) {
    ANIM.procStates[firstProc.id].queue = Math.min(
      (ANIM.procStates[firstProc.id].queue || 0) + 3, 20
    );
    nextSupplyAt = ANIM.simTime + (firstProc.props.ct * 2);
    // Pulse supplier node
    const supplierNode = nodes.find(n => n.type === 'supplier');
    if (supplierNode) pulseNode(supplierNode.id, 'supply');
  }
}

// ── PARTICLES ─────────────────────────────────────────────────────
let particleIdCtr = 0;

function launchParticleFrom(fromNodeId) {
  // Find outgoing arrows from this node
  const outArrows = arrows.filter(a => a.fromId === fromNodeId);
  if (outArrows.length === 0) {
    // End of line → customer
    const custNode = nodes.find(n => n.type === 'customer');
    if (custNode) {
      ANIM.customerCount++;
      pulseNode(custNode.id, 'receive');
      const el = document.getElementById(custNode.id);
      if (el) {
        const badge = el.querySelector('.cust-count') || (() => {
          const b = document.createElement('div');
          b.className = 'cust-count';
          el.querySelector('.node-body')?.appendChild(b);
          return b;
        })();
        badge.textContent = ANIM.customerCount + ' u';
      }
    }
    return;
  }

  outArrows.forEach(arrow => {
    const toNode = getNode(arrow.toId);
    if (!toNode) return;

    const pid = 'p' + (particleIdCtr++);
    const particle = {
      id: pid,
      arrowFromId: arrow.fromId,
      arrowToId:   arrow.toId,
      progress: 0,       // 0..1 along bezier
      speed: 1 / (PARTICLE_TRAVEL_SEC / ANIM.speed), // progress per real-second
      toType: toNode.type,
      toId:   toNode.id,
    };
    ANIM.particles.push(particle);
    spawnParticleEl(pid);
  });
}

function tickParticles(realDelta) {
  const done = [];
  ANIM.particles.forEach(p => {
    p.progress += realDelta * p.speed * ANIM.speed;
    if (p.progress >= 1) {
      p.progress = 1;
      done.push(p);
    }
    moveParticleEl(p);
  });
  done.forEach(p => arriveParticle(p));
  ANIM.particles = ANIM.particles.filter(p => p.progress < 1);
}

function arriveParticle(p) {
  removeParticleEl(p.id);
  const toNode = getNode(p.toId);
  if (!toNode) return;

  if (toNode.type === 'inventory') {
    // Accumulate in WIP
    if (!ANIM.wipState[toNode.id]) ANIM.wipState[toNode.id] = { count: 0 };
    ANIM.wipState[toNode.id].count++;
    updateWIPVisual(toNode.id);
    // Then forward from WIP to next process
    setTimeout(() => drainWIP(toNode.id), 200 / ANIM.speed);

  } else if (toNode.type === 'process') {
    const st = ANIM.procStates[toNode.id];
    if (st) { st.queue = Math.min((st.queue||0) + 1, 20); }

  } else if (toNode.type === 'customer') {
    ANIM.customerCount++;
    pulseNode(toNode.id, 'receive');
    const el = document.getElementById(toNode.id);
    if (el) {
      let badge = el.querySelector('.cust-count');
      if (!badge) {
        badge = document.createElement('div');
        badge.className = 'cust-count';
        el.querySelector('.node-body')?.appendChild(badge);
      }
      badge.textContent = ANIM.customerCount + ' u';
    }
  }
}

function drainWIP(wipId) {
  const wipState = ANIM.wipState[wipId];
  if (!wipState || wipState.count <= 0) return;
  // Find outgoing arrow from this WIP
  const outArrow = arrows.find(a => a.fromId === wipId);
  if (!outArrow) return;
  wipState.count = Math.max(0, wipState.count - 1);
  updateWIPVisual(wipId);
  // Launch particle toward next node
  const toNode = getNode(outArrow.toId);
  if (!toNode) return;
  const pid = 'p' + (particleIdCtr++);
  const particle = {
    id: pid,
    arrowFromId: outArrow.fromId,
    arrowToId:   outArrow.toId,
    progress: 0,
    speed: 1 / (PARTICLE_TRAVEL_SEC / ANIM.speed),
    toType: toNode.type,
    toId:   toNode.id,
  };
  ANIM.particles.push(particle);
  spawnParticleEl(pid);
}

// ── PARTICLE DOM ELEMENTS ─────────────────────────────────────────
function spawnParticleEl(pid) {
  const svg = document.getElementById('arrows-svg');
  const circle = document.createElementNS('http://www.w3.org/2000/svg','circle');
  circle.setAttribute('id', 'part-' + pid);
  circle.setAttribute('r', '6');
  circle.setAttribute('fill', '#ffd700');
  circle.setAttribute('stroke', '#000');
  circle.setAttribute('stroke-width', '1');
  circle.setAttribute('opacity', '0.92');
  circle.style.filter = 'drop-shadow(0 0 4px #ffd700)';
  svg.appendChild(circle);
}

function moveParticleEl(p) {
  const circle = document.getElementById('part-' + p.id);
  if (!circle) return;
  const pos = getBezierPoint(p.arrowFromId, p.arrowToId, p.progress);
  if (!pos) return;
  circle.setAttribute('cx', pos.x);
  circle.setAttribute('cy', pos.y);
}

function removeParticleEl(pid) {
  const el = document.getElementById('part-' + pid);
  if (el) el.remove();
}

function clearParticles() {
  ANIM.particles.forEach(p => removeParticleEl(p.id));
  ANIM.particles = [];
  // Also clear any leftover particle elements
  document.querySelectorAll('[id^="part-"]').forEach(el => el.remove());
}

// ── BEZIER MATH ───────────────────────────────────────────────────
// Returns {x, y} point at t along the cubic bezier used by renderAllArrows()
function getBezierPoint(fromId, toId, t) {
  const fromNode = getNode(fromId);
  const toNode   = getNode(toId);
  if (!fromNode || !toNode) return null;

  const fromEl = document.getElementById(fromId);
  const toEl   = document.getElementById(toId);
  if (!fromEl || !toEl) return null;

  const fw = fromEl.offsetWidth;  const fh = fromEl.offsetHeight;
  const tw = toEl.offsetWidth;    const th = toEl.offsetHeight;

  const x1 = fromNode.x + fw;      const y1 = fromNode.y + fh / 2;
  const x2 = toNode.x;             const y2 = toNode.y + th / 2;
  const dx = Math.abs(x2 - x1);
  const cx1 = x1 + dx * 0.45;    const cx2 = x2 - dx * 0.45;

  // Cubic bezier formula: B(t) = (1-t)^3*P0 + 3(1-t)^2*t*P1 + 3(1-t)*t^2*P2 + t^3*P3
  const u = 1 - t;
  const x = u*u*u*x1 + 3*u*u*t*cx1 + 3*u*t*t*cx2 + t*t*t*x2;
  const y = u*u*u*y1 + 3*u*u*t*y1  + 3*u*t*t*y2  + t*t*t*y2;
  return { x, y };
}

// ── NODE VISUAL STATES ────────────────────────────────────────────
const STATE_COLORS = {
  idle:    '#388bfd',   // blue
  busy:    '#3fb950',   // green
  starved: '#d29922',   // yellow — waiting for input
  blocked: '#f85149',   // red — output blocked
  down:    '#6e7681',   // gray — downtime
  supply:  '#1f6feb',
  receive: '#3fb950',
};

function setNodeState(nodeId, state) {
  const el = document.getElementById(nodeId);
  if (!el) return;
  el.classList.remove('state-idle','state-busy','state-starved','state-blocked','state-down');
  el.classList.add('state-' + state);

  // Update state indicator dot
  let dot = el.querySelector('.state-dot');
  if (!dot) {
    dot = document.createElement('div');
    dot.className = 'state-dot';
    el.appendChild(dot);
  }
  dot.style.background = STATE_COLORS[state] || '#888';
  dot.title = state.toUpperCase();

  // Update state label inside node body
  let lbl = el.querySelector('.state-label');
  if (!lbl) {
    lbl = document.createElement('div');
    lbl.className = 'state-label';
    const body = el.querySelector('.node-body');
    if (body) body.appendChild(lbl);
  }
  const stateEmoji = { idle:'⬜ LIBRE', busy:'🟢 PROCESANDO', starved:'🟡 ESPERA', blocked:'🔴 BLOQUEADO', down:'⚫ PARADO' };
  lbl.textContent = stateEmoji[state] || state;
}

function resetNodeVisual(nodeId) {
  const el = document.getElementById(nodeId);
  if (!el) return;
  el.classList.remove('state-idle','state-busy','state-starved','state-blocked','state-down');
  el.querySelector('.state-dot')?.remove();
  el.querySelector('.state-label')?.remove();
  el.querySelector('.cust-count')?.remove();
}

function pulseNode(nodeId, type) {
  const el = document.getElementById(nodeId);
  if (!el) return;
  el.classList.remove('pulse-supply','pulse-receive');
  void el.offsetWidth; // reflow
  el.classList.add('pulse-' + type);
  setTimeout(() => el.classList.remove('pulse-' + type, 'pulse-supply', 'pulse-receive'), 500);
}

function updateWIPVisual(wipId) {
  const el = document.getElementById(wipId);
  if (!el) return;
  const count = ANIM.wipState[wipId]?.count || 0;

  // Update count label
  let lbl = el.querySelector('.node-inv-units');
  if (lbl) lbl.textContent = count + ' u';

  // Draw dot stack inside triangle
  let dotsEl = el.querySelector('.wip-dots');
  if (!dotsEl) {
    dotsEl = document.createElement('div');
    dotsEl.className = 'wip-dots';
    el.querySelector('.node-body')?.appendChild(dotsEl);
  }
  const shown = Math.min(count, MAX_WIP_VISUAL);
  dotsEl.innerHTML = '';
  for (let i = 0; i < shown; i++) {
    const dot = document.createElement('div');
    dot.className = 'wip-dot';
    const ratio = count / MAX_WIP_VISUAL;
    dot.style.background = ratio > 0.8 ? '#f85149' : ratio > 0.5 ? '#d29922' : '#3fb950';
    dotsEl.appendChild(dot);
  }
  if (count > MAX_WIP_VISUAL) {
    const more = document.createElement('div');
    more.className = 'wip-dot-more';
    more.textContent = '+' + (count - MAX_WIP_VISUAL);
    dotsEl.appendChild(more);
  }

  // Color the triangle
  const tri = el.querySelector('.node-triangle');
  if (tri) {
    const ratio = count / Math.max(1, (getNode(wipId)?.props.units || 100));
    const color = ratio > 1.5 ? '#f85149' : ratio > 0.8 ? '#d29922' : '#3fb950';
    tri.style.borderBottomColor = color;
  }
}

// ── STATS BAR ─────────────────────────────────────────────────────
function updateStatsBar() {
  const el = document.getElementById('anim-stats');
  if (!el) return;
  const mins = Math.floor(ANIM.simTime / 60);
  const secs = Math.floor(ANIM.simTime % 60);
  const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

  const procs = nodes.filter(n => n.type === 'process');
  const busyCount = procs.filter(n => ANIM.procStates[n.id]?.busy).length;
  const eff = procs.length > 0 ? Math.round((busyCount / procs.length) * 100) : 0;

  el.textContent =
    `⏱ T: ${timeStr}  |  📦 Producidas: ${ANIM.totalUnits}  |  🏁 Entregadas: ${ANIM.customerCount}  |  ⚙ Eficiencia: ${eff}%  |  🚀 ${ANIM.speed}X`;
}

// ── LOG ───────────────────────────────────────────────────────────
function logAnim(msg) {
  const el = document.getElementById('anim-log');
  if (el) el.textContent = msg;
}

// ── UI HELPERS ────────────────────────────────────────────────────
function updateAnimUI(running) {
  const btnStart = document.getElementById('btn-anim-start');
  const btnStop  = document.getElementById('btn-anim-stop');
  if (btnStart) btnStart.disabled = running;
  if (btnStop)  btnStop.disabled  = !running;
}
