/**
 * branding.js — Largotek Lean Suite v5.5
 * Inyecta logo real, navbar global y footer en todas las páginas.
 */
(function(){

  const LOGO_URL = 'https://www.largotek.com/web/image/website/2/logo/www.largotek.com?unique=14c10ad';

  // Logo img para navbar (más grande)
  const LOGO_NAVBAR = `<img src="${LOGO_URL}" alt="Largotek" height="36" style="height:36px;width:auto;display:block;object-fit:contain;" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
<span style="display:none;align-items:center;gap:6px;font-family:'Instrument Serif',Georgia,serif;font-size:20px;color:#e6edf3;letter-spacing:.02em">largo<span style="color:#4f98a3">tek</span></span>`;

  // Logo img para footer (más grande también)
  const LOGO_FOOTER = `<img src="${LOGO_URL}" alt="Largotek" height="44" style="height:44px;width:auto;display:block;object-fit:contain;filter:brightness(1.05)" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
<span style="display:none;align-items:center;gap:6px;font-family:'Instrument Serif',Georgia,serif;font-size:24px;color:#e6edf3">largo<span style="color:#4f98a3">tek</span></span>`;

  // ── NAV LINKS
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

  // ── CSS
  const style = document.createElement('style');
  style.textContent = `
    :root {
      --lk-accent: #4f98a3;
    }
    .topnav { display: none !important; }

    /* NAVBAR */
    #lk-navbar {
      display: flex;
      align-items: center;
      padding: 0 24px;
      height: 60px;
      background: #0f1419;
      border-bottom: 1px solid #1e2936;
      position: sticky;
      top: 0;
      z-index: 1000;
      gap: 0;
    }
    #lk-navbar .lk-brand {
      display: flex;
      align-items: center;
      text-decoration: none;
      flex-shrink: 0;
      padding-right: 4px;
    }
    #lk-navbar .lk-suite-badge {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: .1em;
      text-transform: uppercase;
      color: #4f98a3;
      background: rgba(79,152,163,.12);
      border: 1px solid rgba(79,152,163,.25);
      padding: 3px 8px;
      border-radius: 99px;
      margin-left: 10px;
      white-space: nowrap;
      font-family: 'Inter', sans-serif;
      flex-shrink: 0;
    }
    #lk-navbar .lk-divider {
      width: 1px;
      height: 26px;
      background: #2a3545;
      margin: 0 16px;
      flex-shrink: 0;
    }
    #lk-navbar .lk-nav-links {
      display: flex;
      gap: 2px;
      overflow-x: auto;
      flex: 1;
      scrollbar-width: none;
    }
    #lk-navbar .lk-nav-links::-webkit-scrollbar { display: none; }
    .lk-nav-link {
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 12.5px;
      font-weight: 500;
      color: #7a8899;
      text-decoration: none;
      white-space: nowrap;
      transition: background 150ms, color 150ms;
      font-family: 'Inter', sans-serif;
    }
    .lk-nav-link:hover { background: #1c2535; color: #c9d5e0; }
    .lk-nav-link.active { background: rgba(79,152,163,.15); color: #4f98a3; font-weight: 600; }
    #lk-navbar .lk-nav-right {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
      margin-left: 8px;
    }
    #lk-navbar .lk-web-link {
      font-size: 12px;
      font-weight: 600;
      color: #4f98a3;
      text-decoration: none;
      padding: 6px 14px;
      border: 1px solid rgba(79,152,163,.35);
      border-radius: 8px;
      transition: all 150ms;
      font-family: 'Inter', sans-serif;
    }
    #lk-navbar .lk-web-link:hover { background: rgba(79,152,163,.12); border-color: #4f98a3; }

    /* FOOTER */
    #lk-footer {
      border-top: 1px solid #1e2936;
      background: #0d1117;
      padding: 36px 32px 28px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      margin-top: auto;
    }
    #lk-footer .lk-footer-top {
      display: flex;
      align-items: center;
      gap: 20px;
      flex-wrap: wrap;
      justify-content: center;
    }
    #lk-footer .lk-footer-sep {
      width: 1px; height: 22px;
      background: #2a3545;
    }
    #lk-footer .lk-footer-tagline {
      font-size: 13px;
      color: #4f6070;
      font-family: 'Inter', sans-serif;
    }
    #lk-footer .lk-footer-links {
      display: flex;
      gap: 20px;
      flex-wrap: wrap;
      justify-content: center;
    }
    #lk-footer .lk-footer-links a {
      font-size: 12px;
      color: #4f6070;
      text-decoration: none;
      font-family: 'Inter', sans-serif;
      transition: color 150ms;
    }
    #lk-footer .lk-footer-links a:hover { color: #4f98a3; }
    #lk-footer .lk-copyright {
      font-size: 11px;
      color: #2e3d4a;
      font-family: 'Inter', sans-serif;
      text-align: center;
      letter-spacing: .04em;
    }

    body { display: flex; flex-direction: column; min-height: 100vh; }
  `;
  document.head.appendChild(style);

  // ── NAVBAR
  const navbar = document.createElement('div');
  navbar.id = 'lk-navbar';
  navbar.innerHTML = `
    <a class="lk-brand" href="index.html">${LOGO_NAVBAR}</a>
    <span class="lk-suite-badge">Lean Suite</span>
    <div class="lk-divider"></div>
    <nav class="lk-nav-links" aria-label="Herramientas">
      ${linksHtml}
    </nav>
    <div class="lk-nav-right">
      <a class="lk-web-link" href="https://www.largotek.com" target="_blank" rel="noopener">largotek.com ↗</a>
    </div>
  `;
  document.body.insertBefore(navbar, document.body.firstChild);

  // ── FOOTER
  const oldFooter = document.querySelector('footer');
  if (oldFooter) oldFooter.remove();

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
      © ${new Date().getFullYear()} Largotek · Lean Analysis Suite v5.5 · Todos los derechos reservados
    </div>
  `;
  document.body.appendChild(footer);

})();
