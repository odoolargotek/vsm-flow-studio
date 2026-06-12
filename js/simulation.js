// ===== VSM SIMULATION ENGINE v4 — VSM Flow Studio =====

const MC_RUNS = 500;

function sampleNormal(mean, std) {
  let u, v;
  do { u = Math.random(); } while (u === 0);
  do { v = Math.random(); } while (v === 0);
  return Math.max(0, mean + Math.sqrt(-2*Math.log(u)) * Math.cos(2*Math.PI*v) * std);
}
function sampleTriangular(min, mode, max) {
  if (min >= max) return mode;
  const u = Math.random(), fc = (mode-min)/(max-min);
  return u < fc ? min+Math.sqrt(u*(max-min)*(mode-min)) : max-Math.sqrt((1-u)*(max-min)*(max-mode));
}
function sampleCT(props) {
  const dist = props.distType||'fixed';
  if (dist==='normal')     return sampleNormal(props.ct, props.ctStd||props.ct*0.1);
  if (dist==='triangular') return sampleTriangular(props.ctMin||props.ct*0.7, props.ct, props.ctMax||props.ct*1.5);
  return props.ct;
}

function runSimulation() {
  const demand     = parseFloat(document.getElementById('demand').value)      || 400;
  const hoursShift = parseFloat(document.getElementById('hours-shift').value) || 8;
  const shiftsDay  = parseFloat(document.getElementById('shifts').value)      || 1;
  const mcRuns     = parseInt(document.getElementById('mc-runs')?.value)      || MC_RUNS;
  const processes  = getProcessesOrdered();
  const inventories= getInventoriesOrdered();

  if (!processes.length) { setSimLog('⚠ No hay procesos en el canvas.'); return; }

  const availSec = hoursShift * shiftsDay * 3600;
  const taktTime = availSec / demand;
  const hasStoch = processes.some(n => n.props.distType && n.props.distType !== 'fixed');
  const iters    = hasStoch ? mcRuns : 1;

  const ltSamples=[], pceSamples=[], bnCounts={}, procCTSamples={};
  processes.forEach(n => { procCTSamples[n.id] = []; });

  for (let i = 0; i < iters; i++) {
    let totalVA=0, bnCT=0, bnId=null;
    processes.forEach(node => {
      const ct       = sampleCT(node.props);
      const batch    = node.props.batchSize > 1 ? node.props.batchSize : 1;
      // effective CT per unit = CT + (batch-1)*CT / batch = CT  (same per-unit)
      // but batch delay added to lead time: first unit at process waits (batch-1)*CT before being released
      const ctPerUnit = ct; // cycle time per piece is unchanged
      procCTSamples[node.id].push(ctPerUnit);
      const netCT = ctPerUnit / ((node.props.uptime||90)/100);
      if (node.props.isVA !== false) totalVA += ctPerUnit;
      if (netCT > bnCT) { bnCT=netCT; bnId=node.id; }
    });
    // batch delay contribution to lead time (waiting for full batch to be ready)
    const batchDelaySec = processes.reduce((s, node) => {
      const batch = node.props.batchSize > 1 ? node.props.batchSize : 1;
      const ct    = node.props.ct || 0;
      return s + (batch - 1) * ct;
    }, 0);
    const wipDays  = inventories.reduce((s,inv) => s+(inv.props.units||0)/demand, 0);
    const procDays = totalVA / availSec;
    const batchDays = batchDelaySec / availSec;
    const lt = wipDays + procDays + batchDays;
    ltSamples.push(lt);
    pceSamples.push(lt>0 ? (procDays/lt)*100 : 0);
    if (bnId) bnCounts[bnId] = (bnCounts[bnId]||0)+1;
  }

  const mean = arr => arr.reduce((a,b)=>a+b,0)/arr.length;
  const pct  = (arr,p) => { const s=[...arr].sort((a,b)=>a-b); return s[Math.floor(p*s.length)]; };
  const ltMean=mean(ltSamples), lt10=pct(ltSamples,.10), lt90=pct(ltSamples,.90);
  const pceMean=mean(pceSamples);
  const bnId = Object.keys(bnCounts).sort((a,b)=>bnCounts[b]-bnCounts[a])[0]||null;
  const bn   = bnId ? getNode(bnId) : null;

  const procResults = processes.map(node => {
    const s=procCTSamples[node.id];
    const ctMean=mean(s), ctP90=pct(s,.90);
    const netCT=ctMean/((node.props.uptime||90)/100);
    const batch=node.props.batchSize > 1 ? node.props.batchSize : 1;
    return { id:node.id, label:node.props.label, ctMean, ctP90, netCT,
      capacity: availSec*((node.props.uptime||90)/100)/ctMean,
      batchSize: batch,
      status: netCT<=taktTime?'ok':'overloaded', isBn:node.id===bnId,
      uptime:node.props.uptime, operators:node.props.operators,
      defectRate:node.props.defectRate, distType:node.props.distType||'fixed',
      isVA: node.props.isVA !== false
    };
  });

  const totalVAFixed  = processes.reduce((s,n) => s+(n.props.isVA!==false ? n.props.ct : 0), 0);
  const totalNVAFixed = processes.reduce((s,n) => s+(n.props.isVA===false  ? n.props.ct : 0), 0)
                      + arrows.reduce((s,a) => s+(a.transportDays||0.5)*hoursShift*3600, 0);
  const wipDaysMean   = inventories.reduce((s,inv) => s+(inv.props.units||0)/demand, 0);

  const arrowStats = arrows.map(a => {
    const fn=getNode(a.fromId), tn=getNode(a.toId);
    const days = a.transportDays||0.5;
    return { from:fn?.props?.label||a.fromId, to:tn?.props?.label||a.toId, type:a.type, days, sec:days*hoursShift*3600 };
  });

  const wipStats = inventories.map(inv => {
    const d=(inv.props.units||0)/demand;
    return { label:inv.props.label, units:inv.props.units||0, days:d, sec:d*availSec };
  });

  saveReportData({
    ltMean, lt10, lt90, taktTime, pceMean, hasStoch, iters,
    totalVASec:  totalVAFixed,
    totalNVASec: totalNVAFixed,
    wipDays:     wipDaysMean,
    availSec, demand,
    procResults, arrowStats, wipStats
  });

  updateKPIs({ taktTime,ltMean,lt10,lt90,totalVA:totalVAFixed,pceMean,dominantBn:bn,availSec,iters,hasStoch });
  updateProcessList(procResults, taktTime);
  buildValueTimeline(processes, inventories, demand, availSec);
  highlightBottleneck(bnId);

  setSimLog([
    `✔ ${hasStoch?'Monte Carlo ('+iters+' iter.)':'Determinista'} OK`,
    `Procesos: ${processes.length} | Inventarios: ${inventories.length}`,
    `Takt: ${taktTime.toFixed(1)}s | LT: ${ltMean.toFixed(3)}d`,
    hasStoch ? `P10-P90: [${lt10.toFixed(2)} – ${lt90.toFixed(2)}] d` : '',
    `PCE: ${pceMean.toFixed(1)}%`,
    bn ? `Cuello: ${bn.props.label}` : ''
  ].filter(Boolean).join('\n'));

  document.getElementById('canvas-hint').style.display='none';
}

function updateKPIs({taktTime,ltMean,lt10,lt90,totalVA,pceMean,dominantBn,availSec,iters,hasStoch}) {
  const set=(id,val,sub)=>{ const c=document.getElementById(id); if(!c) return;
    c.querySelector('.kpi-value').textContent=val;
    if(sub!==undefined) c.querySelector('.kpi-sub').textContent=sub; };
  set('kpi-takt', taktTime.toFixed(1), 'seg/unidad');
  set('kpi-lt',   ltMean.toFixed(2), hasStoch?`días | P10:${lt10.toFixed(2)} P90:${lt90.toFixed(2)}`:'días');
  set('kpi-pt',   totalVA.toFixed(0), 'seg (VA)');
  set('kpi-pce',  pceMean.toFixed(1)+'%', pceMean<15?'⚠️ Crítico':pceMean<35?'⚠ Mejorar':pceMean<60?'✔ Moderado':'★ Óptimo');
  set('kpi-bn',   dominantBn?dominantBn.props.label:'Ninguno',
      dominantBn?`CT neto ≈ ${(dominantBn.props.ct/((dominantBn.props.uptime||90)/100)).toFixed(1)}s`:'');
  set('kpi-avail',availSec.toLocaleString(), 'seg/día');
  let badge=document.getElementById('kpi-mc-badge');
  if(!badge){ badge=document.createElement('div'); badge.id='kpi-mc-badge'; badge.className='kpi-mc-badge';
    document.getElementById('kpi-section')?.appendChild(badge); }
  badge.textContent = hasStoch?`🎲 Monte Carlo: ${iters} iter.`:`• Determinista`;
  badge.style.color = hasStoch?'#d29922':'#6e7681';
}

function updateProcessList(procResults, taktTime) {
  const c=document.getElementById('process-list'); c.innerHTML='';
  const dl={fixed:'Fijo',normal:'Normal',triangular:'Triangular'};
  procResults.forEach(p => {
    const cls=p.status==='ok'?'proc-ok':'proc-bad';
    const batchTag = p.batchSize > 1
      ? `<span class="proc-item-badge" style="background:#1f6feb;color:#cae8ff">LOTE ×${p.batchSize}</span>`
      : '';
    c.innerHTML+=`
      <div class="proc-item ${p.isBn?'is-bn':''}">
        <div class="proc-item-name">${p.label}
          ${p.status!=='ok'?'<span class="proc-item-badge">SOBRECARGADO</span>':''}
          ${p.isBn?'<span class="proc-item-badge" style="background:#d29922">CUELLO</span>':''}
          ${batchTag}
        </div>
        <div class="proc-item-stats">
          CT: <span class="${cls}">${p.ctMean.toFixed(1)}s${p.distType!=='fixed'?` (P90:${p.ctP90.toFixed(1)}s)`:''}</span><br>
          Net CT: <span class="${cls}">${p.netCT.toFixed(1)}s</span> vs Takt: ${taktTime.toFixed(1)}s<br>
          Uptime: ${p.uptime}% | Ops: ${p.operators} | Dist: <em>${dl[p.distType]||p.distType}</em>${p.batchSize>1?' | Lote: '+p.batchSize+' u':''}
        </div>
      </div>`;
  });
}

function buildValueTimeline(processes, inventories, demand, availSec) {
  const svg=document.getElementById('vt-svg'); if(!svg) return;
  svg.innerHTML='';
  const sequence=buildFlowSequence();
  if(!sequence.length){ svg.innerHTML='<text x="10" y="20" fill="#6e7681" font-size="11">Conecta los nodos para ver el timeline</text>'; return; }
  const BOX_H=36,BOX_GAP=6,Y_TOP=8,Y_ZIGZAG=Y_TOP+BOX_H+4,Y_LABEL=Y_ZIGZAG+18,TOTAL_H=Y_LABEL+18;
  const MIN_W=60,MAX_W=160;
  const values=sequence.map(s=>s.valueSec||1);
  const maxVal=Math.max(...values);
  const widths=values.map(v=>Math.max(MIN_W,Math.round((v/maxVal)*MAX_W)));
  const totalW=widths.reduce((s,w)=>s+w,0)+(widths.length-1)*BOX_GAP+20;
  svg.setAttribute('viewBox',`0 0 ${totalW} ${TOTAL_H}`);
  svg.setAttribute('width',totalW); svg.setAttribute('height',TOTAL_H);
  let x=10; const zigZagPoints=[];
  sequence.forEach((seg,i)=>{
    const w=widths[i],cx=x+w/2;
    const colors={va:{fill:'rgba(63,185,80,.18)',stroke:'#3fb950',text:'#3fb950'},nva:{fill:'rgba(248,81,73,.18)',stroke:'#f85149',text:'#f85149'},wip:{fill:'rgba(210,153,34,.18)',stroke:'#d29922',text:'#d29922'}};
    const c=colors[seg.type]||colors.nva;
    const rect=document.createElementNS('http://www.w3.org/2000/svg','rect');
    rect.setAttribute('x',x); rect.setAttribute('y',Y_TOP); rect.setAttribute('width',w); rect.setAttribute('height',BOX_H);
    rect.setAttribute('rx',4); rect.setAttribute('fill',c.fill); rect.setAttribute('stroke',c.stroke); rect.setAttribute('stroke-width','1.5');
    svg.appendChild(rect);
    const badge=document.createElementNS('http://www.w3.org/2000/svg','text');
    badge.setAttribute('x',x+4); badge.setAttribute('y',Y_TOP+11); badge.setAttribute('fill',c.stroke);
    badge.setAttribute('font-size','7'); badge.setAttribute('font-family','monospace'); badge.setAttribute('font-weight','700');
    badge.textContent=seg.type.toUpperCase(); svg.appendChild(badge);
    const val=document.createElementNS('http://www.w3.org/2000/svg','text');
    val.setAttribute('x',cx); val.setAttribute('y',Y_TOP+24); val.setAttribute('fill',c.text);
    val.setAttribute('font-size','11'); val.setAttribute('font-weight','700'); val.setAttribute('text-anchor','middle'); val.setAttribute('font-family','monospace');
    val.textContent=seg.valueLabel; svg.appendChild(val);
    const lbl=document.createElementNS('http://www.w3.org/2000/svg','text');
    lbl.setAttribute('x',cx); lbl.setAttribute('y',Y_LABEL); lbl.setAttribute('fill','#6e7681');
    lbl.setAttribute('font-size','8'); lbl.setAttribute('text-anchor','middle'); lbl.setAttribute('font-family','sans-serif');
    lbl.textContent=seg.label.length>12?seg.label.slice(0,11)+'…':seg.label; svg.appendChild(lbl);
    const zy=(i%2===0)?Y_TOP:Y_TOP+BOX_H;
    zigZagPoints.push(`${cx},${zy}`);
    x+=w+BOX_GAP;
  });
  if(zigZagPoints.length>=2){
    const poly=document.createElementNS('http://www.w3.org/2000/svg','polyline');
    poly.setAttribute('points',zigZagPoints.join(' ')); poly.setAttribute('fill','none');
    poly.setAttribute('stroke','#58a6ff'); poly.setAttribute('stroke-width','1.5');
    poly.setAttribute('stroke-dasharray','4,3'); poly.setAttribute('opacity','0.6');
    svg.insertBefore(poly,svg.firstChild);
  }
  const vaTotal=sequence.filter(s=>s.type==='va').reduce((s,x)=>s+x.valueSec,0);
  const nvaTotal=sequence.filter(s=>s.type!=='va').reduce((s,x)=>s+x.valueSec,0);
  const pce=vaTotal+nvaTotal>0?(vaTotal/(vaTotal+nvaTotal)*100).toFixed(1):'0.0';
  const summary=document.getElementById('vt-summary');
  if(summary) summary.innerHTML=`<span style="color:#3fb950">■ VA: ${fmtTime(vaTotal)}</span><span style="color:#f85149">■ NVA: ${fmtTime(nvaTotal)}</span><span style="color:#d29922">■ WIP: incluido en LT</span><span style="color:#58a6ff;font-weight:700">PCE visual: ${pce}%</span>`;
}

function buildFlowSequence() {
  if(!arrows.length||!nodes.length) return [];
  let startNode=nodes.find(n=>n.type==='supplier');
  if(!startNode) startNode=nodes.slice().sort((a,b)=>a.x-b.x)[0];
  const sequence=[],visited=new Set();
  let current=startNode,safety=0;
  while(current&&safety++<50){
    if(visited.has(current.id)) break;
    visited.add(current.id);
    const seg=nodeToSegment(current);
    if(seg) sequence.push(seg);
    const outArrow=arrows.find(a=>a.fromId===current.id&&!visited.has(a.toId));
    if(!outArrow) break;
    const nextNode=getNode(outArrow.toId);
    if(nextNode&&nextNode.type!=='inventory'){
      const transportSec=(outArrow.transportDays||0.5)*8*3600;
      sequence.push({type:'nva',label:outArrow.type==='push'?'Push':outArrow.type==='pull'?'Pull':'Info',valueSec:transportSec,valueLabel:fmtTime(transportSec)});
    }
    current=nextNode;
  }
  return sequence.filter(s=>s.type!=='entity');
}

function nodeToSegment(node) {
  if(node.type==='process'){
    const batch = node.props.batchSize > 1 ? node.props.batchSize : 1;
    // total time a unit waits at this process = CT (own) + (batch-1)*CT (waiting peers)
    const totalSec = node.props.ct * batch;
    return {type:node.props.isVA!==false?'va':'nva',label:node.props.label+(batch>1?` ×${batch}`:''),valueSec:totalSec,valueLabel:fmtTime(totalSec)};
  }
  if(node.type==='inventory'){
    const demand=parseFloat(document.getElementById('demand')?.value)||400;
    const availSec=(parseFloat(document.getElementById('hours-shift')?.value)||8)*(parseFloat(document.getElementById('shifts')?.value)||1)*3600;
    const days=(node.props.units||0)/demand;
    return {type:'wip',label:node.props.label,valueSec:days*availSec,valueLabel:days.toFixed(2)+'d'};
  }
  return null;
}

function fmtTime(sec) {
  if(sec<=0) return '0s';
  if(sec<60)    return sec.toFixed(0)+'s';
  if(sec<3600)  return (sec/60).toFixed(1)+'m';
  if(sec<86400) return (sec/3600).toFixed(1)+'h';
  return (sec/86400).toFixed(2)+'d';
}

function highlightBottleneck(bnId){
  document.querySelectorAll('.vsm-node').forEach(el=>el.classList.remove('bottleneck'));
  if(bnId){const el=document.getElementById(bnId); if(el) el.classList.add('bottleneck');}
}

function setSimLog(text){document.getElementById('sim-log').textContent=text;}
