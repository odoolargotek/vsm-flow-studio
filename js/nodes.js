// ===== NODES DEFINITIONS v5 — VSM Flow Studio =====

const NODE_DEFAULTS = {
  process:   { label:'Proceso', ct:480, co:0, uptime:90, operators:1, shifts:1, hoursShift:8, defectRate:0, isVA:true, batchSize:1,
               resourceName:'', resourceCT:0 },
  inventory: { label:'WIP', units:100 },
  supplier:  { label:'Proveedor' },
  customer:  { label:'Cliente' },
  kaizen:    { label:'Mejora!' },
  gate:      { label:'Gate', splits:[] }   // splits: [{toId, pct}] managed at runtime
};

let nodes         = [];   // { id, type, x, y, props }
let arrows        = [];   // { id, fromId, toId, type, transportDays, splitPct }
let nodeIdCounter  = 1;
let arrowIdCounter = 1;
let selectedNodeId  = null;
let selectedArrowId = null;
let editingNodeId   = null;

function createNode(type, x, y) {
  const id = 'n' + (nodeIdCounter++);
  const node = { id, type, x, y, props: JSON.parse(JSON.stringify(NODE_DEFAULTS[type] || {})) };
  nodes.push(node);
  return node;
}

function getNode(id)   { return nodes.find(n => n.id === id); }
function getArrow(id)  { return arrows.find(a => a.id === id); }

function deleteNode(id) {
  nodes  = nodes.filter(n => n.id !== id);
  arrows = arrows.filter(a => a.fromId !== id && a.toId !== id);
}

function deleteArrow(id) {
  arrows = arrows.filter(a => a.id !== id);
  if (selectedArrowId === id) selectedArrowId = null;
}

function addArrow(fromId, toId, type = 'push') {
  if (arrows.find(a => a.fromId === fromId && a.toId === toId)) return;
  // Default splitPct: for gate outputs start at 50, will be normalized later
  const fromNode = getNode(fromId);
  const splitPct = fromNode && fromNode.type === 'gate' ? 50 : null;
  arrows.push({ id:'a' + (arrowIdCounter++), fromId, toId, type, transportDays: 0.5, splitPct });
  // Auto-balance gate splits
  if (fromNode && fromNode.type === 'gate') autoBalanceGate(fromId);
}

function autoBalanceGate(gateId) {
  const outs = arrows.filter(a => a.fromId === gateId);
  if (!outs.length) return;
  // Distribute evenly
  const share = Math.floor(100 / outs.length);
  const rem   = 100 - share * outs.length;
  outs.forEach((a, i) => { a.splitPct = share + (i === 0 ? rem : 0); });
}

function getProcessesOrdered()   { return nodes.filter(n => n.type === 'process')  .sort((a,b) => a.x - b.x); }
function getInventoriesOrdered() { return nodes.filter(n => n.type === 'inventory').sort((a,b) => a.x - b.x); }
