// ===== NODES DEFINITIONS v4 — VSM Flow Studio =====

const NODE_DEFAULTS = {
  process:   { label:'Proceso', ct:30, co:0, uptime:90, operators:1, shifts:1, hoursShift:8, defectRate:0, isVA:true },
  inventory: { label:'WIP', units:100 },
  supplier:  { label:'Proveedor' },
  customer:  { label:'Cliente' },
  kaizen:    { label:'Mejora!' }
};

let nodes         = [];   // { id, type, x, y, props }
let arrows        = [];   // { id, fromId, toId, type, transportDays }
let nodeIdCounter  = 1;
let arrowIdCounter = 1;
let selectedNodeId  = null;
let selectedArrowId = null;   // <-- NEW: currently selected arrow
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
  arrows.push({ id:'a' + (arrowIdCounter++), fromId, toId, type, transportDays: 0.5 });
}

function getProcessesOrdered()   { return nodes.filter(n => n.type === 'process')  .sort((a,b) => a.x - b.x); }
function getInventoriesOrdered() { return nodes.filter(n => n.type === 'inventory').sort((a,b) => a.x - b.x); }
