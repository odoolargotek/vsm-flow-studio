// ===== NODES DEFINITIONS — VSM Flow Studio =====

const NODE_DEFAULTS = {
  process: {
    label: 'Proceso',
    ct: 30,        // Cycle Time (seg)
    co: 0,         // Changeover (min)
    uptime: 90,    // Uptime %
    operators: 1,
    shifts: 1,
    hoursShift: 8,
    defectRate: 0,
    isVA: true
  },
  inventory: {
    label: 'WIP',
    units: 100
  },
  supplier: { label: 'Proveedor' },
  customer: { label: 'Cliente' },
  kaizen: { label: 'Mejora!' }
};

let nodes = [];       // { id, type, x, y, props }
let arrows = [];      // { id, fromId, toId, type }
let nodeIdCounter = 1;
let arrowIdCounter = 1;
let selectedNodeId = null;
let editingNodeId = null;

function createNode(type, x, y) {
  const id = 'n' + (nodeIdCounter++);
  const defaults = JSON.parse(JSON.stringify(NODE_DEFAULTS[type] || {}));
  const node = { id, type, x, y, props: defaults };
  nodes.push(node);
  return node;
}

function getNode(id) {
  return nodes.find(n => n.id === id);
}

function deleteNode(id) {
  nodes = nodes.filter(n => n.id !== id);
  arrows = arrows.filter(a => a.fromId !== id && a.toId !== id);
}

function addArrow(fromId, toId, type = 'push') {
  // avoid duplicates
  if (arrows.find(a => a.fromId === fromId && a.toId === toId)) return;
  arrows.push({ id: 'a' + (arrowIdCounter++), fromId, toId, type });
}

// Get processes in flow order (simple left-to-right sort)
function getProcessesOrdered() {
  return nodes.filter(n => n.type === 'process').sort((a, b) => a.x - b.x);
}

// Get inventory nodes in flow order
function getInventoriesOrdered() {
  return nodes.filter(n => n.type === 'inventory').sort((a, b) => a.x - b.x);
}
