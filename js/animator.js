// ===== ANIMATOR ENGINE v3 — VSM Flow Studio =====
// Particles follow arrows EXACTLY (same coordinate system as renderAllArrows)
// Visual inbox: units stack up as dots in a tray BEFORE each process node.

const ANIM = {
  running: false, speed: 1,
  raf: null, lastTs: null, simTime: 0,
  particles: [], procStates: {}, wipState: {},
  customerCount: 0, totalUnits: 0,
};

const PARTICLE_TRAVEL_SEC = 1.2;  // real seconds at 1X
const MAX_INBOX = 10;             // max dots shown in tray
const MAX_WIP_VISUAL = 12;

// ─ SPEED ──────────────────────────────────────────────────────────
function setAnimSpeed(spd) {
  ANIM.speed = spd;
  document.querySelectorAll('.speed-btn').forEach(b =>
    b.classList.toggle('active', parseInt(b.dataset.speed) === spd)
  );
}

// ─ START / STOP / RESET ───────────────────────────────────────────
function startAnimation() {
  if (!validateForAnim()) return;
  if (ANIM.running) return;
  initAnimState();
  ANIM.running = true; ANIM.lastTs = null;
  ANIM.raf = requestAnimationFrame(animLoop);
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
  Object.assign(ANIM, {simTime:0,particles:[],procStates:{},wipState:{},customerCount:0,totalUnits:0});
  nodes.forEach(n => resetNodeVisual(n.id));
  const l = document.getElementById('anim-log');   if (l) l.textContent = 'Presiona ▶ para iniciar.';
  const s = document.getElementById('anim-stats'); if (s) s.textContent = '';
  updateAnimUI(false);
  nextSupplyAt = 0;
}

function validateForAnim() {
  if (!getProcessesOrdered().length) { alert('Agrega al menos un proceso.'); return false; }
  if (!arrows.length) { alert('Conecta los nodos con flechas.'); return false; }
  return true;
}

function initAnimState() {
  ANIM.simTime = 0; ANIM.particles = []; ANIM.customerCount = 0; ANIM.totalUnits = 0;
  ANIM.procStates = {};
  nodes.filter(n => n.type === 'process').forEach(n => {
    ANIM.procStates[n.id] = { busy:false, busyUntil:0, queue:0, produced:0, downUntil:0 };
    setNodeState(n.id, 'idle');
    renderInbox(n.id, 0);
  });
  ANIM.wipState = {};
  nodes.filter(n => n.type === 'inventory').forEach(n => {
    ANIM.wipState[n.id] = { count: n.props.units || 0 };
    updateWIPVisual(n.id);
  });
  const first = getProcessesOrdered()[0];
  if (first) { ANIM.procStates[first.id].queue = 5; renderInbox(first.id, 5); }
  nextSupplyAt = 0;
}

// ─ MAIN LOOP ────────────────────────────────────────────────────────
function animLoop(ts) {
  if (!ANIM.running) return;
  if (!ANIM.lastTs) ANIM.lastTs = ts;
  const realDelta = Math.min((ts - ANIM.lastTs) / 1000, 0.1);
  ANIM.lastTs = ts;
  const vDelta = realDelta * ANIM.speed;
  ANIM.simTime += vDelta;
  tickProcesses();
  tickParticles(realDelta);
  tickSupplier();
  updateStatsBar();
  ANIM.raf = requestAnimationFrame(animLoop);
}

// ─ PROCESS TICK ────────────────────────────────────────────────────
function tickProcesses() {
  nodes.filter(n => n.type === 'process').forEach(node => {
    const st = ANIM.procStates[node.id];
    if (!st) return;
    const p = node.props;
    // Downtime recovery
    if (st.downUntil > 0) {
      if (ANIM.simTime < st.downUntil) return;
      st.downUntil = 0;
    }
    // Sample CT
    let ct = p.ct || 30;
    if (p.distType === 'normal')     ct = Math.max(1, gaussianRandom(p.ct, p.ctStd || 0));
    if (p.distType === 'triangular') ct = sampleTriangular(p.ctMin || p.ct*0.7, p.ct, p.ctMax || p.ct*1.5);

    if (st.busy) {
      if (ANIM.simTime >= st.busyUntil) {
        st.busy = false; st.produced++; ANIM.totalUnits++;
        setNodeState(node.id, 'idle');
        launchParticleFrom(node.id);
        // Random downtime
        if (Math.random() > (p.uptime || 90) / 100) {
          st.downUntil = ANIM.simTime + Math.random() * (p.co || 5) * 2;
          setNodeState(node.id, 'down');
        }
      }
    } else {
      if (st.queue > 0) {
        st.queue--;
        renderInbox(node.id, st.queue);
        st.busy = true;
        st.busyUntil = ANIM.simTime + ct;
        setNodeState(node.id, 'busy');
      } else {
        setNodeState(node.id, 'starved');
      }
    }
  });
}

// ─ SUPPLIER TICK ──────────────────────────────────────────────────
let nextSupplyAt = 0;
function tickSupplier() {
  if (ANIM.simTime < nextSupplyAt) return;
  const first = getProcessesOrdered()[0];
  if (!first) return;
  const st = ANIM.procStates[first.id];
  if (!st) return;
  const add = 3;
  st.queue = Math.min((st.queue || 0) + add, 20);
  renderInbox(first.id, st.queue);
  nextSupplyAt = ANIM.simTime + (first.props.ct || 30) * 1.5;
  const sup = nodes.find(n => n.type === 'supplier');
  if (sup) pulseNode(sup.id, 'supply');
}

// ─ PARTICLES ─────────────────────────────────────────────────────────
let particleIdCtr = 0;

function launchParticleFrom(fromId) {
  const out = arrows.filter(a => a.fromId === fromId);
  if (!out.length) {
    // deliver to customer
    const cust = nodes.find(n => n.type === 'customer');
    if (cust) { ANIM.customerCount++; pulseNode(cust.id,'receive'); updateCustBadge(cust.id); }
    return;
  }
  out.forEach(a => {
    const to = getNode(a.toId);
    if (to) spawnParticle(a.fromId, a.toId, to.type, to.id);
  });
}

function spawnParticle(fromId, toId, toType, toNodeId) {
  const pid = 'p' + (particleIdCtr++);
  ANIM.particles.push({ id:pid, fromId, toId, progress:0, toType, toNodeId });
  const svg = document.getElementById('arrows-svg');
  if (!svg) return;
  const c = document.createElementNS('http://www.w3.org/2000/svg','circle');
  c.setAttribute('id', 'part-' + pid);
  c.setAttribute('r','7');
  c.setAttribute('fill','#ffd700');
  c.setAttribute('stroke','#1a1a1a');
  c.setAttribute('stroke-width','1.5');
  c.style.filter = 'drop-shadow(0 0 6px rgba(255,215,0,1))';
  c.style.pointerEvents = 'none';
  svg.appendChild(c);
}

function tickParticles(realDelta) {
  const done = [];
  ANIM.particles.forEach(p => {
    p.progress += realDelta / PARTICLE_TRAVEL_SEC;
    if (p.progress >= 1) { p.progress = 1; done.push(p); }
    const pos = bezierPoint(p.fromId, p.toId, p.progress);
    if (pos) {
      const c = document.getElementById('part-' + p.id);
      if (c) { c.setAttribute('cx', pos.x); c.setAttribute('cy', pos.y); }
    }
  });
  done.forEach(p => { document.getElementById('part-' + p.id)?.remove(); arriveParticle(p); });
  ANIM.particles = ANIM.particles.filter(p => p.progress < 1);
}

function arriveParticle(p) {
  const to = getNode(p.toNodeId);
  if (!to) return;
  if (to.type === 'inventory') {
    if (!ANIM.wipState[to.id]) ANIM.wipState[to.id] = { count:0 };
    ANIM.wipState[to.id].count++;
    updateWIPVisual(to.id);
    setTimeout(() => drainWIP(to.id), 250);
  } else if (to.type === 'process') {
    const st = ANIM.procStates[to.id];
    if (st) { st.queue = Math.min((st.queue||0)+1, 20); renderInbox(to.id, st.queue); }
  } else if (to.type === 'customer') {
    ANIM.customerCount++; pulseNode(to.id,'receive'); updateCustBadge(to.id);
  }
}

function drainWIP(wipId) {
  const ws = ANIM.wipState[wipId];
  if (!ws || ws.count <= 0) return;
  const a = arrows.find(a => a.fromId === wipId);
  if (!a) return;
  ws.count = Math.max(0, ws.count - 1);
  updateWIPVisual(wipId);
  const to = getNode(a.toId);
  if (to) spawnParticle(a.fromId, a.toId, to.type, to.id);
}

function clearParticles() {
  document.querySelectorAll('[id^="part-"]').forEach(el => el.remove());
  ANIM.particles = [];
}

// ─ BEZIER — CANVAS-RELATIVE (same as renderAllArrows) ─────────────────────
// The SVG sits over the canvas div with position:absolute top:0 left:0
// renderAllArrows uses node.x + offsetWidth as coordinates.
// We do the same so particles are pixel-perfect on the arrows.
function bezierPoint(fromId, toId, t) {
  const fn = getNode(fromId); const tn = getNode(toId);
  if (!fn || !tn) return null;
  const fEl = document.getElementById(fromId);
  const tEl = document.getElementById(toId);
  if (!fEl || !tEl) return null;

  const x1 = fn.x + fEl.offsetWidth;         // right edge of source
  const y1 = fn.y + fEl.offsetHeight / 2;    // vertical center of source
  const x2 = tn.x;                            // left edge of target
  const y2 = tn.y + tEl.offsetHeight / 2;    // vertical center of target

  const dx  = Math.abs(x2 - x1);
  const cx1 = x1 + dx * 0.45;
  const cx2 = x2 - dx * 0.45;

  // Cubic bezier — control points share Y with their endpoint (same as canvas.js)
  // M x1 y1  C cx1 y1  cx2 y2  x2 y2
  const u = 1 - t;
  const x = u*u*u*x1 + 3*u*u*t*cx1 + 3*u*t*t*cx2 + t*t*t*x2;
  const y = u*u*u*y1 + 3*u*u*t*y1  + 3*u*t*t*y2  + t*t*t*y2;
  return { x, y };
}

// ─ INBOX TRAY (bandeja de entrada) ───────────────────────────────────────
function renderInbox(nodeId, count) {
  const el = document.getElementById(nodeId);
  if (!el) return;

  // Create or get the tray element (sits BELOW the node)
  let tray = document.getElementById('inbox-' + nodeId);
  if (!tray) {
    tray = document.createElement('div');
    tray.id = 'inbox-' + nodeId;
    tray.className = 'inbox-tray';
    el.appendChild(tray);
  }

  tray.innerHTML = '';

  if (count <= 0) {
    tray.style.display = 'none';
    return;
  }
  tray.style.display = 'flex';

  // Color scale: green → yellow → red
  const ratio = count / MAX_INBOX;
  const color = ratio >= 0.8 ? '#f85149' : ratio >= 0.5 ? '#d29922' : '#3fb950';

  const shown = Math.min(count, MAX_INBOX);
  for (let i = 0; i < shown; i++) {
    const dot = document.createElement('div');
    dot.className = 'inbox-dot';
    dot.style.background = color;
    // Animate in: the last dot (newest) gets a pop
    if (i === shown - 1) dot.classList.add('inbox-dot-new');
    tray.appendChild(dot);
  }

  // Overflow badge
  if (count > MAX_INBOX) {
    const badge = document.createElement('div');
    badge.className = 'inbox-overflow';
    badge.textContent = '+' + (count - MAX_INBOX);
    tray.appendChild(badge);
  }

  // Count label
  const lbl = document.createElement('div');
  lbl.className = 'inbox-count';
  lbl.textContent = count + 'u';
  lbl.style.color = color;
  tray.appendChild(lbl);
}

// ─ WIP VISUAL ─────────────────────────────────────────────────────────
function updateWIPVisual(wipId) {
  const el = document.getElementById(wipId);
  if (!el) return;
  const count = ANIM.wipState[wipId]?.count || 0;
  let lbl = el.querySelector('.node-inv-units');
  if (lbl) lbl.textContent = count + ' u';
  let dots = el.querySelector('.wip-dots');
  if (!dots) {
    dots = document.createElement('div');
    dots.className = 'wip-dots';
    (el.querySelector('.node-body') || el).appendChild(dots);
  }
  dots.innerHTML = '';
  const shown = Math.min(count, MAX_WIP_VISUAL);
  const ratio = count / MAX_WIP_VISUAL;
  const color = ratio >= 0.8 ? '#f85149' : ratio >= 0.5 ? '#d29922' : '#3fb950';
  for (let i = 0; i < shown; i++) {
    const d = document.createElement('div');
    d.className = 'wip-dot';
    d.style.background = color;
    dots.appendChild(d);
  }
  if (count > MAX_WIP_VISUAL) {
    const m = document.createElement('div'); m.className = 'wip-dot-more';
    m.textContent = '+' + (count - MAX_WIP_VISUAL); dots.appendChild(m);
  }
  const tri = el.querySelector('.node-triangle');
  if (tri) {
    const r = count / Math.max(1, getNode(wipId)?.props.units || 100);
    tri.style.borderBottomColor = r > 1.5 ? '#f85149' : r > 0.8 ? '#d29922' : '#3fb950';
  }
}

// ─ NODE STATES ────────────────────────────────────────────────────────
function setNodeState(nodeId, state) {
  const el = document.getElementById(nodeId);
  if (!el) return;
  el.classList.remove('state-idle','state-busy','state-starved','state-blocked','state-down');
  el.classList.add('state-' + state);
  let dot = el.querySelector('.state-dot');
  if (!dot) { dot = document.createElement('div'); dot.className='state-dot'; el.appendChild(dot); }
  dot.style.background = {idle:'#388bfd',busy:'#3fb950',starved:'#d29922',blocked:'#f85149',down:'#6e7681'}[state]||'#888';
  let lbl = el.querySelector('.state-label');
  if (!lbl) { lbl=document.createElement('div'); lbl.className='state-label'; (el.querySelector('.node-body')||el).appendChild(lbl); }
  lbl.textContent = {idle:'⬜ LIBRE',busy:'🟢 PROCESANDO',starved:'🟡 ESPERA',blocked:'🔴 BLOQUEADO',down:'⚫ PARADO'}[state]||state;
}

function resetNodeVisual(nodeId) {
  const el = document.getElementById(nodeId);
  if (!el) return;
  el.classList.remove('state-idle','state-busy','state-starved','state-blocked','state-down');
  ['state-dot','state-label','cust-count','wip-dots'].forEach(c => el.querySelector('.' + c)?.remove());
  document.getElementById('inbox-' + nodeId)?.remove();
}

function pulseNode(nodeId, type) {
  const el = document.getElementById(nodeId);
  if (!el) return;
  el.classList.remove('pulse-supply','pulse-receive');
  void el.offsetWidth;
  el.classList.add('pulse-' + type);
  setTimeout(() => el.classList.remove('pulse-supply','pulse-receive'), 600);
}

function updateCustBadge(id) {
  const el = document.getElementById(id); if (!el) return;
  let b = el.querySelector('.cust-count');
  if (!b) { b=document.createElement('div'); b.className='cust-count'; (el.querySelector('.node-body')||el).appendChild(b); }
  b.textContent = ANIM.customerCount + ' u';
}

// ─ HELPERS ───────────────────────────────────────────────────────────
function gaussianRandom(mean, std) {
  if (!std) return mean;
  let u=0,v=0; while(!u)u=Math.random(); while(!v)v=Math.random();
  return mean + std * Math.sqrt(-2*Math.log(u)) * Math.cos(2*Math.PI*v);
}

function updateStatsBar() {
  const el = document.getElementById('anim-stats'); if (!el) return;
  const m=Math.floor(ANIM.simTime/60), s=Math.floor(ANIM.simTime%60);
  const t = m>0?`${m}m ${s}s`:`${s}s`;
  const procs=nodes.filter(n=>n.type==='process');
  const busy=procs.filter(n=>ANIM.procStates[n.id]?.busy).length;
  const eff=procs.length?Math.round(busy/procs.length*100):0;
  el.textContent=`⏱ ${t}  |  📦 Prod: ${ANIM.totalUnits}  |  🏁 Cliente: ${ANIM.customerCount}  |  ⚙ Efic: ${eff}%  |  🚀 ${ANIM.speed}X`;
}

function logAnim(msg) { const el=document.getElementById('anim-log'); if(el) el.textContent=msg; }
function updateAnimUI(r) {
  const s=document.getElementById('btn-anim-start'); const p=document.getElementById('btn-anim-stop');
  if(s) s.disabled=r; if(p) p.disabled=!r;
}
