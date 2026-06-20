// ===== REPORT BRIDGE — adapta simulation.js → report.js =====
// simulation.js llama: buildReport(procData, { taktTime, leadTimeDays, pce, totalVA, demand, bottleneck, scenarios })
// report.js expone: saveReportData(data)

function buildReport(procData, summary) {
  const taktTime     = summary.taktTime     || 0;
  const leadTimeDays = summary.leadTimeDays || 0;
  const pce          = summary.pce          || 0;
  const totalVA      = summary.totalVA      || 0;
  const demand       = summary.demand       || 0;
  const bottleneck   = summary.bottleneck   || procData[0];

  const hoursDay  = parseFloat(document.getElementById('sim-hours')?.value) || 8;
  const availSec  = hoursDay * 3600;
  const leadTimeSec = leadTimeDays * availSec;

  const totalNVASec = procData
    .filter(d => d.p.isVA === false)
    .reduce((s, d) => s + d.ct, 0);

  const wipStats = (typeof nodes !== 'undefined' ? nodes : [])
    .filter(n => n.type === 'inventory')
    .map(n => ({
      label: n.props.label || 'Inventario',
      units: n.props.units || 0,
      days:  (n.props.units || 0) > 0 && demand > 0 ? (n.props.units / demand) : 0
    }));

  const arrowStats = (typeof arrows !== 'undefined' ? arrows : []).map(a => ({
    from: (typeof getNode !== 'undefined' ? getNode(a.fromId) : null)?.props?.label || a.fromId,
    to:   (typeof getNode !== 'undefined' ? getNode(a.toId)   : null)?.props?.label || a.toId,
    days: a.transportDays || 0
  }));

  const procResults = procData.map(d => ({
    label:      d.p.label      || 'Proceso',
    ctMean:     d.ct           || 0,
    ctP90:      (d.ct || 0) * 1.2,
    netCT:      d.netCT        || 0,
    capacity:   d.capacity     || 0,
    uptime:     d.p.uptime     || 90,
    operators:  d.ops          || d.p.operators || 1,
    defectRate: d.p.defectRate || 0,
    isVA:       d.p.isVA !== false,
    distType:   d.p.distType   || 'fixed',
    batchSize:  d.batchSize    || 1,
    isBn:       d.node.id === (bottleneck.node?.id || bottleneck?.id)
  }));

  saveReportData({
    ltMean:       leadTimeDays,
    lt10:         leadTimeDays * 0.85,
    lt90:         leadTimeDays * 1.15,
    hasStoch:     procData.some(d => d.p.distType && d.p.distType !== 'fixed'),
    taktTime,
    totalVASec:   totalVA,
    totalNVASec,
    pceMean:      pce,
    demand,
    availSec,
    wipDays:      0,
    wipStats,
    arrowStats,
    procResults
  });
}

// helper usado por report.js
function fmtTime(sec) {
  if (sec >= 3600) return (sec / 3600).toFixed(2) + ' h';
  if (sec >= 60)   return (sec / 60).toFixed(1) + ' min';
  return sec.toFixed(0) + ' s';
}
