/**
 * save-load.js — Largotek Lean Suite v1.0
 * Módulo global de persistencia: Export/Import JSON por herramienta + portafolio completo.
 * Se inyecta automáticamente desde branding.js en todas las páginas.
 */
(function(){

  // ── REGISTRO DE TODAS LAS HERRAMIENTAS ──────────────────────────────────────
  const TOOL_REGISTRY = [
    { key: 'largotek_caso_negocio',       label: 'Project Charter',          file: 'caso-negocio.html' },
    { key: 'largotek_a3',                 label: 'A3 Report',                file: 'a3-report.html' },
    { key: 'largotek_sipoc',              label: 'SIPOC',                    file: 'sipoc.html' },
    { key: 'largotek_voc_ctq',            label: 'VOC / CTQs',               file: 'voc-ctq.html' },
    { key: 'largotek_beneficios',         label: 'Beneficios Financieros',   file: 'beneficios-financieros.html' },
    { key: 'largotek_vsm',                label: 'VSM Flow Studio',          file: 'vsm.html' },
    { key: 'largotek_cursograma',         label: 'Cursograma Analítico',     file: 'cursograma-analitico.html' },
    { key: 'largotek_oee',                label: 'OEE Calculator',           file: 'oee.html' },
    { key: 'largotek_recoleccion',        label: 'Hoja de Recolección',      file: 'hoja-recoleccion.html' },
    { key: 'largotek_spaguetti',          label: 'Diagrama Spaguetti',       file: 'spaguetti.html' },
    { key: 'largotek_pareto',             label: 'Pareto 80/20',             file: 'pareto.html' },
    { key: 'largotek_ishikawa',           label: 'Ishikawa',                 file: 'ishikawa.html' },
    { key: 'largotek_arbol',              label: 'Árbol Causa-Efecto',       file: 'arbol-causa-efecto.html' },
    { key: 'largotek_5porques',           label: '5 Porqués',                file: '5-porques.html' },
    { key: 'largotek_amef',               label: 'AMEF / FMEA',              file: 'amef.html' },
    { key: 'largotek_balance_takt',       label: 'Balance / Takt Time',      file: 'balance-takt.html' },
    { key: 'largotek_5s',                 label: 'Auditoría 5S',             file: '5s.html' },
    { key: 'largotek_pdca',               label: 'Ciclo PDCA',               file: 'pdca.html' },
    { key: 'largotek_trabajo_estandar',   label: 'Trabajo Estandarizado',    file: 'trabajo-estandarizado.html' },
    { key: 'largotek_guia_almacen',       label: 'Guía de Almacén',          file: 'guia-almacen.html' },
    { key: 'largotek_propuesta_almacen',  label: 'Propuesta Almacén',        file: 'propuesta-almacen.html' },
    { key: 'largotek_kanban',             label: 'Kanban',                   file: 'kanban.html' },
    { key: 'largotek_smed',               label: 'SMED',                     file: 'smed.html' },
    { key: 'largotek_poka_yoke',          label: 'Poka Yoke',                file: 'poka-yoke.html' },
    { key: 'largotek_spc',                label: 'Gráfica SPC',              file: 'spc.html' },
    { key: 'largotek_plan_control',       label: 'Plan de Control',          file: 'plan-control.html' },
    { key: 'largotek_resultados',         label: 'Resultados Mejoras',       file: 'resultados-mejoras.html' },
    { key: 'largotek_lecciones',          label: 'Lecciones Aprendidas',     file: 'lecciones-aprendidas.html' },
    { key: 'largotek_kata',               label: 'KATA',                     file: 'kata.html' },
  ];

  // ── DETECTAR HERRAMIENTA ACTUAL ──────────────────────────────────────────────
  const currentFile = window.location.pathname.split('/').pop() || 'index.html';
  const currentTool = TOOL_REGISTRY.find(t => t.file === currentFile);

  // ── HELPERS ──────────────────────────────────────────────────────────────────
  function downloadJSON(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function readJSONFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => { try { resolve(JSON.parse(e.target.result)); } catch(err) { reject(err); } };
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }

  function slugDate() {
    return new Date().toISOString().slice(0, 10);
  }

  function lkToast(msg, color) {
    let el = document.getElementById('lk-sl-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'lk-sl-toast';
      Object.assign(el.style, {
        position:'fixed', bottom:'72px', left:'50%',
        transform:'translateX(-50%) translateY(80px)',
        padding:'9px 22px', borderRadius:'99px',
        fontSize:'13px', fontWeight:'600',
        fontFamily:'Inter,sans-serif',
        opacity:'0', transition:'all .3s',
        zIndex:'9999', whiteSpace:'nowrap', pointerEvents:'none'
      });
      document.body.appendChild(el);
    }
    el.textContent = msg;
    const colors = {
      ok:  { bg:'#1e3a2e', border:'1px solid #3fb950', color:'#3fb950' },
      err: { bg:'#3a1e1e', border:'1px solid #f85149', color:'#f85149' },
      info:{ bg:'#1e2a3a', border:'1px solid #4f98a3', color:'#4f98a3' }
    };
    const c = colors[color] || colors.info;
    el.style.background = c.bg;
    el.style.border     = c.border;
    el.style.color      = c.color;
    el.style.transform  = 'translateX(-50%) translateY(0)';
    el.style.opacity    = '1';
    clearTimeout(el._timer);
    el._timer = setTimeout(() => {
      el.style.opacity   = '0';
      el.style.transform = 'translateX(-50%) translateY(80px)';
    }, 2800);
  }

  // ── EXPORT HERRAMIENTA ACTUAL ─────────────────────────────────────────────────
  window.lkExportTool = function() {
    if (!currentTool) { lkToast('No hay datos que exportar en esta página.', 'err'); return; }
    const raw = localStorage.getItem(currentTool.key);
    if (!raw) { lkToast('Aún no hay datos guardados para exportar.', 'err'); return; }
    try {
      const envelope = {
        _meta: {
          tool:     currentTool.label,
          key:      currentTool.key,
          exported: new Date().toISOString(),
          suite:    'Largotek Lean Suite v5.6',
          version:  '1.0'
        },
        data: JSON.parse(raw)
      };
      downloadJSON(envelope, `largotek_${currentTool.key.replace('largotek_','')}_${slugDate()}.json`);
      lkToast('✅ JSON exportado correctamente', 'ok');
    } catch(e) {
      lkToast('Error al exportar: ' + e.message, 'err');
    }
  };

  // ── IMPORT HERRAMIENTA ACTUAL ─────────────────────────────────────────────────
  window.lkImportTool = function() {
    if (!currentTool) { lkToast('Importación no disponible aquí.', 'err'); return; }
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.json,application/json';
    input.onchange = async e => {
      const file = e.target.files[0]; if (!file) return;
      try {
        const envelope = await readJSONFile(file);
        // Acepta sobre completo o JSON crudo (retrocompatible)
        const payload = envelope.data || envelope;
        if (!confirm(`¿Cargar "${file.name}" en ${currentTool.label}?\nSe sobreescribirá el contenido actual.`)) return;
        localStorage.setItem(currentTool.key, JSON.stringify(payload));
        lkToast('✅ Datos cargados — recargando...', 'ok');
        setTimeout(() => location.reload(), 900);
      } catch(err) {
        lkToast('Error al leer JSON: ' + err.message, 'err');
      }
    };
    input.click();
  };

  // ── EXPORT PORTAFOLIO COMPLETO ────────────────────────────────────────────────
  window.lkExportPortfolio = function(projectName) {
    const portfolio = {
      _meta: {
        type:     'portfolio',
        project:  projectName || 'Proyecto Lean',
        exported: new Date().toISOString(),
        suite:    'Largotek Lean Suite v5.6',
        version:  '1.0'
      },
      tools: {}
    };
    let count = 0;
    TOOL_REGISTRY.forEach(t => {
      const raw = localStorage.getItem(t.key);
      if (raw) {
        try {
          portfolio.tools[t.key] = { label: t.label, file: t.file, data: JSON.parse(raw) };
          count++;
        } catch(e) { /* skip corrupted */ }
      }
    });
    if (count === 0) { lkToast('No hay datos en ninguna herramienta aún.', 'err'); return; }
    const slug = (projectName || 'portafolio').toLowerCase().replace(/[^a-z0-9]/g, '_');
    downloadJSON(portfolio, `largotek_portafolio_${slug}_${slugDate()}.json`);
    lkToast(`✅ Portafolio exportado (${count} herramientas)`, 'ok');
  };

  // ── IMPORT PORTAFOLIO COMPLETO ────────────────────────────────────────────────
  window.lkImportPortfolio = function() {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.json,application/json';
    input.onchange = async e => {
      const file = e.target.files[0]; if (!file) return;
      try {
        const portfolio = await readJSONFile(file);
        if (!portfolio.tools) { lkToast('El archivo no es un portafolio válido.', 'err'); return; }
        const keys = Object.keys(portfolio.tools);
        if (!confirm(`¿Cargar portafolio "${portfolio._meta?.project || file.name}"?\n${keys.length} herramientas serán restauradas.`)) return;
        keys.forEach(k => {
          const entry = portfolio.tools[k];
          if (entry && entry.data) localStorage.setItem(k, JSON.stringify(entry.data));
        });
        lkToast(`✅ ${keys.length} herramientas restauradas`, 'ok');
        if (currentFile !== 'index.html') setTimeout(() => location.reload(), 900);
      } catch(err) {
        lkToast('Error al leer portafolio: ' + err.message, 'err');
      }
    };
    input.click();
  };

  // ── INYECTAR BOTONES EN TOOLBAR ───────────────────────────────────────────────
  function injectToolbar() {
    const s = document.createElement('style');
    s.textContent = `
      .lk-sl-btn {
        display:inline-flex; align-items:center; gap:5px;
        padding:6px 13px; border-radius:8px;
        border:1.5px solid var(--border,#30363d);
        background:transparent; color:var(--muted,#8b949e);
        font-size:12px; font-weight:600; cursor:pointer;
        font-family:'Inter',sans-serif; transition:all .18s;
        white-space:nowrap;
      }
      .lk-sl-btn:hover { border-color:var(--lk-accent,#4f98a3); color:var(--lk-accent,#4f98a3); }
      .lk-sl-btn.primary { background:var(--lk-accent,#4f98a3); color:#fff; border-color:var(--lk-accent,#4f98a3); }
      .lk-sl-btn.primary:hover { opacity:.88; }
      #lk-sl-bar { display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
    `;
    document.head.appendChild(s);

    const bar = document.createElement('div');
    bar.id = 'lk-sl-bar';

    if (currentTool) {
      // Botones por herramienta individual
      const btnEx = document.createElement('button');
      btnEx.className = 'lk-sl-btn primary';
      btnEx.innerHTML = '💾 Exportar JSON';
      btnEx.title = 'Descarga los datos de esta herramienta como .json';
      btnEx.onclick = window.lkExportTool;

      const btnIm = document.createElement('button');
      btnIm.className = 'lk-sl-btn';
      btnIm.innerHTML = '📂 Importar JSON';
      btnIm.title = 'Carga datos desde un .json exportado anteriormente';
      btnIm.onclick = window.lkImportTool;

      bar.appendChild(btnEx);
      bar.appendChild(btnIm);

    } else if (currentFile === 'index.html') {
      // Botones de portafolio en el índice
      const btnExP = document.createElement('button');
      btnExP.className = 'lk-sl-btn primary';
      btnExP.innerHTML = '💾 Exportar Portafolio';
      btnExP.title = 'Descarga todas las herramientas como un solo .json';
      btnExP.onclick = () => {
        const name = prompt('Nombre del proyecto:', 'Proyecto Lean');
        if (name !== null) window.lkExportPortfolio(name);
      };

      const btnImP = document.createElement('button');
      btnImP.className = 'lk-sl-btn';
      btnImP.innerHTML = '📂 Importar Portafolio';
      btnImP.title = 'Restaura todas las herramientas desde un .json de portafolio';
      btnImP.onclick = window.lkImportPortfolio;

      bar.appendChild(btnExP);
      bar.appendChild(btnImP);
    }

    // Insertar en .topbar-right (herramientas) o .lk-nav-right (índice / navbar global)
    function tryInject() {
      const spot = document.querySelector('.topbar-right') ||
                   document.getElementById('lk-navbar')?.querySelector('.lk-nav-right');
      if (spot) { spot.insertBefore(bar, spot.firstChild); return true; }
      return false;
    }

    if (!tryInject()) {
      const obs = new MutationObserver(() => { if (tryInject()) obs.disconnect(); });
      obs.observe(document.body, { childList: true, subtree: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectToolbar);
  } else {
    injectToolbar();
  }

})();
