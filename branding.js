/**
 * branding.js — Largotek Lean Suite v5.6
 * Inyecta logo real, navbar global, footer, toggle Light/Dark
 * y módulo save-load (export/import JSON) en todas las páginas.
 */
(function(){

  const LOGO_URL = 'https://www.largotek.com/web/image/website/2/logo/www.largotek.com?unique=14c10ad';

  const LOGO_NAVBAR = `<img src="${LOGO_URL}" alt="Largotek" height="36" style="height:36px;width:auto;display:block;object-fit:contain;" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
<span style="display:none;align-items:center;gap:6px;font-family:'Instrument Serif',Georgia,serif;font-size:20px;color:var(--lk-nav-text,#e6edf3);letter-spacing:.02em">largo<span style="color:#4f98a3">tek</span></span>`;

  const LOGO_FOOTER = `<img src="${LOGO_URL}" alt="Largotek" height="44" style="height:44px;width:auto;display:block;object-fit:contain;filter:brightness(1.05)" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
<span style="display:none;align-items:center;gap:6px;font-family:'Instrument Serif',Georgia,serif;font-size:24px;color:var(--lk-nav-text,#e6edf3)">largo<span style="color:#4f98a3">tek</span></span>`;

  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  const navLinks = [
    { href:'index.html',        label:'Inicio' },
    { href:'vsm.html',          label:'VSM' },
    { href:'caso-negocio.html', label:'Charter' },
    { href:'ishikawa.html',     label:'Ishikawa' },
    { href:'5-porques.html',    label:'5 Porqués' },
    { href:'pareto.html',       label:'Pareto' },
    { href:'5s.html',           label:'5S' },
    { href:'pdca.html',         label:'PDCA' },
    { href:'a3-report.html',    label:'A3' },
    { href:'oee.html',          label:'OEE' },
    { href:'spc.html',          label:'SPC' },
  ];

  const linksHtml = navLinks.map(l=>{
    const cls = currentPage === l.href ? 'lk-nav-link active' : 'lk-nav-link';
    return `<a href="${l.href}" class="${cls}">${l.label}</a>`;
  }).join('');

  // ── THEME ENGINE ───────────────────────────────────────────────────────
  const STORAGE_KEY = 'lk-theme';

  const DARK_VARS = `
    --bg:#0d1117; --surface:#161b22; --surface2:#21262d; --border:#30363d;
    --text:#e6edf3; --muted:#8b949e; --faint:#484f58;
    --d-color:#4f98a3; --m-color:#d29922; --a-color:#bc8cff;
    --i-color:#3fb950; --c-color:#f85149;
    --lk-nav-bg:#0f1419; --lk-nav-border:#1e2936;
    --lk-nav-text:#e6edf3; --lk-nav-link:#7a8899;
    --lk-nav-link-hover-bg:#1c2535; --lk-nav-link-hover-text:#c9d5e0;
    --lk-nav-active-bg:rgba(79,152,163,.15); --lk-nav-active-text:#4f98a3;
    --lk-footer-bg:#0d1117; --lk-footer-border:#1e2936;
    --lk-footer-text:#4f6070; --lk-copyright:#2e3d4a;
  `;

  const LIGHT_VARS = `
    --bg:#f5f7fa; --surface:#ffffff; --surface2:#eef1f5; --border:#d0d7de;
    --text:#1c2128; --muted:#57606a; --faint:#9198a1;
    --d-color:#0e7490; --m-color:#9a6700; --a-color:#7c3aed;
    --i-color:#1a7f37; --c-color:#cf222e;
    --lk-nav-bg:#ffffff; --lk-nav-border:#d0d7de;
    --lk-nav-text:#1c2128; --lk-nav-link:#57606a;
    --lk-nav-link-hover-bg:#f0f3f6; --lk-nav-link-hover-text:#1c2128;
    --lk-nav-active-bg:rgba(14,116,144,.1); --lk-nav-active-text:#0e7490;
    --lk-footer-bg:#f0f3f6; --lk-footer-border:#d0d7de;
    --lk-footer-text:#57606a; --lk-copyright:#9198a1;
  `;

  function applyTheme(theme){
    let varStyle = document.getElementById('lk-theme-vars');
    if(!varStyle){
      varStyle = document.createElement('style');
      varStyle.id = 'lk-theme-vars';
      document.head.appendChild(varStyle);
    }
    varStyle.textContent = `:root { ${theme === 'light' ? LIGHT_VARS : DARK_VARS} }`;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(STORAGE_KEY, theme);
    const btn = document.getElementById('lk-theme-btn');
    if(btn){
      btn.innerHTML = theme === 'light'
        ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`
        : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;
      btn.setAttribute('aria-label', theme === 'light' ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro');
      btn.title = theme === 'light' ? 'Modo Oscuro' : 'Modo Claro';
    }
  }

  function toggleTheme(){
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    applyTheme(current === 'dark' ? 'light' : 'dark');
  }

  function getInitialTheme(){
    const saved = localStorage.getItem(STORAGE_KEY);
    if(saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }

  // ── CSS ─────────────────────────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    :root { --lk-accent: #4f98a3; }
    .topnav { display: none !important; }

    #lk-navbar {
      display: flex; align-items: center; padding: 0 24px; height: 60px;
      background: var(--lk-nav-bg, #0f1419);
      border-bottom: 1px solid var(--lk-nav-border, #1e2936);
      position: sticky; top: 0; z-index: 1000; gap: 0;
      transition: background .25s, border-color .25s;
    }
    #lk-navbar .lk-brand {
      display: flex; align-items: center;
      text-decoration: none; flex-shrink: 0; padding-right: 4px;
    }
    #lk-navbar .lk-suite-badge {
      font-size: 10px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase;
      color: var(--lk-accent); background: rgba(79,152,163,.12);
      border: 1px solid rgba(79,152,163,.25); padding: 3px 8px; border-radius: 99px;
      margin-left: 10px; white-space: nowrap; font-family: 'Inter', sans-serif; flex-shrink: 0;
    }
    #lk-navbar .lk-divider {
      width: 1px; height: 26px;
      background: var(--lk-nav-border, #2a3545); margin: 0 16px; flex-shrink: 0;
    }
    #lk-navbar .lk-nav-links {
      display: flex; gap: 2px; overflow-x: auto; flex: 1; scrollbar-width: none;
    }
    #lk-navbar .lk-nav-links::-webkit-scrollbar { display: none; }
    .lk-nav-link {
      padding: 6px 12px; border-radius: 6px; font-size: 12.5px; font-weight: 500;
      color: var(--lk-nav-link, #7a8899); text-decoration: none; white-space: nowrap;
      transition: background 150ms, color 150ms; font-family: 'Inter', sans-serif;
    }
    .lk-nav-link:hover {
      background: var(--lk-nav-link-hover-bg, #1c2535);
      color: var(--lk-nav-link-hover-text, #c9d5e0);
    }
    .lk-nav-link.active {
      background: var(--lk-nav-active-bg, rgba(79,152,163,.15));
      color: var(--lk-nav-active-text, #4f98a3); font-weight: 600;
    }
    #lk-navbar .lk-nav-right {
      display: flex; align-items: center; gap: 8px; flex-shrink: 0; margin-left: 8px;
    }
    #lk-navbar .lk-web-link {
      font-size: 12px; font-weight: 600; color: var(--lk-accent); text-decoration: none;
      padding: 6px 14px; border: 1px solid rgba(79,152,163,.35); border-radius: 8px;
      transition: all 150ms; font-family: 'Inter', sans-serif;
    }
    #lk-navbar .lk-web-link:hover { background: rgba(79,152,163,.12); border-color: var(--lk-accent); }
    #lk-theme-btn {
      display: flex; align-items: center; justify-content: center;
      width: 34px; height: 34px; border-radius: 8px; border: none; cursor: pointer;
      background: var(--surface2, #21262d); color: var(--muted, #8b949e);
      transition: background .2s, color .2s, transform .15s; flex-shrink: 0;
    }
    #lk-theme-btn:hover {
      background: var(--lk-nav-link-hover-bg, #1c2535);
      color: var(--lk-accent); transform: rotate(20deg);
    }
    #lk-theme-btn:active { transform: rotate(0deg) scale(.92); }
    #lk-footer {
      border-top: 1px solid var(--lk-footer-border, #1e2936);
      background: var(--lk-footer-bg, #0d1117); padding: 36px 32px 28px;
      display: flex; flex-direction: column; align-items: center; gap: 16px;
      margin-top: auto; transition: background .25s, border-color .25s;
    }
    #lk-footer .lk-footer-top {
      display: flex; align-items: center; gap: 20px; flex-wrap: wrap; justify-content: center;
    }
    #lk-footer .lk-footer-sep { width: 1px; height: 22px; background: var(--lk-footer-border, #2a3545); }
    #lk-footer .lk-footer-tagline {
      font-size: 13px; color: var(--lk-footer-text, #4f6070); font-family: 'Inter', sans-serif;
    }
    #lk-footer .lk-footer-links { display: flex; gap: 20px; flex-wrap: wrap; justify-content: center; }
    #lk-footer .lk-footer-links a {
      font-size: 12px; color: var(--lk-footer-text, #4f6070);
      text-decoration: none; font-family: 'Inter', sans-serif; transition: color 150ms;
    }
    #lk-footer .lk-footer-links a:hover { color: var(--lk-accent); }
    #lk-footer .lk-copyright {
      font-size: 11px; color: var(--lk-copyright, #2e3d4a);
      font-family: 'Inter', sans-serif; text-align: center; letter-spacing: .04em;
    }
    body { display: flex; flex-direction: column; min-height: 100vh;
      transition: background .25s, color .2s; }
  `;
  document.head.appendChild(style);

  // ── APLICAR TEMA (antes del render, evita flash) ────────────────────────
  const initialTheme = getInitialTheme();
  applyTheme(initialTheme);

  // ── NAVBAR ─────────────────────────────────────────────────────────────
  const navbar = document.createElement('div');
  navbar.id = 'lk-navbar';
  navbar.innerHTML = `
    <a class="lk-brand" href="index.html">${LOGO_NAVBAR}</a>
    <span class="lk-suite-badge">Lean Suite</span>
    <div class="lk-divider"></div>
    <nav class="lk-nav-links" aria-label="Herramientas">${linksHtml}</nav>
    <div class="lk-nav-right">
      <button id="lk-theme-btn" aria-label="Cambiar tema"></button>
      <a class="lk-web-link" href="https://www.largotek.com" target="_blank" rel="noopener">largotek.com ↗</a>
    </div>
  `;
  document.body.insertBefore(navbar, document.body.firstChild);
  document.getElementById('lk-theme-btn').addEventListener('click', toggleTheme);
  applyTheme(initialTheme); // fuerza ícono correcto post-render del botón

  // ── FOOTER ─────────────────────────────────────────────────────────────
  const oldFooter = document.querySelector('footer');
  if(oldFooter) oldFooter.remove();

  const footer = document.createElement('div');
  footer.id = 'lk-footer';
  footer.innerHTML = `
    <div class="lk-footer-top">
      ${LOGO_FOOTER}
      <div class="lk-footer-sep"></div>
      <span class="lk-footer-tagline">Transformación Digital · Consultoría Lean · Odoo Partner</span>
    </div>
    <div class="lk-footer-links">
      <a href="https://www.largotek.com" target="_blank" rel="noopener">largotek.com</a>
      <a href="index.html">Portal Lean Suite</a>
      <a href="vsm.html">VSM Flow Studio</a>
      <a href="https://www.largotek.com" target="_blank" rel="noopener">Contacto</a>
    </div>
    <div class="lk-copyright">
      © ${new Date().getFullYear()} Largotek · Lean Analysis Suite v5.6 · Todos los derechos reservados
    </div>
  `;
  document.body.appendChild(footer);

  // ── CARGAR MÓDULO SAVE-LOAD ─────────────────────────────────────────────
  // Añade botón "Exportar JSON" / "Importar JSON" en cada herramienta
  // y "Exportar Portafolio" / "Importar Portafolio" en index.html
  const sl = document.createElement('script');
  sl.src = 'js/save-load.js';
  sl.defer = true;
  document.head.appendChild(sl);

})();
