/**
 * branding.js — Largotek Lean Suite
 * Inyecta logo SVG, navbar con branding y footer en todas las páginas.
 * Incluir como <script src="branding.js"></script> al final del <body>.
 */
(function(){

  // ── LOGO SVG LARGOTEK ──────────────────────────────────────────────────────
  // Basado en identidad visual: hexágono tecnológico + wordmark
  const LOGO_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 32" fill="none" aria-label="Largotek" role="img" style="height:28px;width:auto;display:block">
  <!-- Hexágono ⬡ -->
  <polygon points="10,2 18,2 22,9 18,16 10,16 6,9" fill="#4f98a3" opacity="0.95"/>
  <polygon points="11,4.5 17,4.5 20,9 17,13.5 11,13.5 8,9" fill="#0d1117"/>
  <polygon points="12.5,7 15.5,7 17,9 15.5,11 12.5,11 11,9" fill="#4f98a3"/>
  <!-- Wordmark -->
  <text x="27" y="12" font-family="'Instrument Serif','Georgia',serif" font-size="10" font-weight="400" fill="#e6edf3" letter-spacing="0.5">largo</text>
  <text x="27" y="12" font-family="'Instrument Serif','Georgia',serif" font-size="10" font-weight="400" fill="#4f98a3" letter-spacing="0.5" dx="22">tek</text>
  <!-- Subtítulo -->
  <text x="27" y="20" font-family="'Inter','Helvetica Neue',sans-serif" font-size="5.5" font-weight="600" fill="#8b949e" letter-spacing="1.2">LEAN SUITE</text>
</svg>`;

  // ── NAV LINKS (detecta página activa) ─────────────────────────────────────
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
    const active = currentPage === l.href ? ' class="lk-nav-link active"' : ' class="lk-nav-link"';
    return `<a href="${l.href}"${active}>${l.label}</a>`;
  }).join('');

  // ── INJECT CSS ─────────────────────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    /* ── LARGOTEK BRANDING OVERRIDES ── */
    :root {
      --lk-blue: #4f98a3;
      --lk-blue-dark: #2d6e77;
      --lk-bg: #0d1117;
      --lk-surface: #161b22;
      --lk-border: #30363d;
      --lk-text: #e6edf3;
      --lk-muted: #8b949e;
    }

    /* Remove original topnav if it exists (we replace it) */
    .topnav { display: none !important; }

    /* ── NEW NAVBAR ── */
    #lk-navbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 24px;
      height: 52px;
      background: #13181f;
      border-bottom: 1px solid #1e2936;
      position: sticky;
      top: 0;
      z-index: 1000;
      gap: 12px;
    }
    #lk-navbar .lk-brand {
      display: flex;
      align-items: center;
      gap: 0;
      text-decoration: none;
      flex-shrink: 0;
    }
    #lk-navbar .lk-divider {
      width: 1px;
      height: 22px;
      background: #2a3545;
      margin: 0 14px;
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
      padding: 5px 11px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
      color: #7a8899;
      text-decoration: none;
      white-space: nowrap;
      transition: background 150ms, color 150ms;
      font-family: 'Inter', sans-serif;
    }
    .lk-nav-link:hover { background: #1c2535; color: #c9d5e0; }
    .lk-nav-link.active { background: rgba(79,152,163,0.15); color: #4f98a3; font-weight: 600; }
    #lk-navbar .lk-nav-right {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
    }
    #lk-navbar .lk-web-link {
      font-size: 11px;
      font-weight: 600;
      color: #4f98a3;
      text-decoration: none;
      padding: 5px 11px;
      border: 1px solid rgba(79,152,163,0.3);
      border-radius: 6px;
      transition: all 150ms;
      font-family: 'Inter', sans-serif;
      letter-spacing: 0.02em;
    }
    #lk-navbar .lk-web-link:hover { background: rgba(79,152,163,0.12); border-color: #4f98a3; }

    /* ── FOOTER ── */
    #lk-footer {
      border-top: 1px solid #1e2936;
      background: #0d1117;
      padding: 28px 32px 22px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 14px;
      margin-top: auto;
    }
    #lk-footer .lk-footer-top {
      display: flex;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;
      justify-content: center;
    }
    #lk-footer .lk-footer-sep {
      width: 1px; height: 18px;
      background: #2a3545;
    }
    #lk-footer .lk-footer-tagline {
      font-size: 12px;
      color: #4f6070;
      font-family: 'Inter', sans-serif;
    }
    #lk-footer .lk-footer-links {
      display: flex;
      gap: 18px;
      flex-wrap: wrap;
      justify-content: center;
    }
    #lk-footer .lk-footer-links a {
      font-size: 11px;
      color: #4f6070;
      text-decoration: none;
      font-family: 'Inter', sans-serif;
      transition: color 150ms;
    }
    #lk-footer .lk-footer-links a:hover { color: #4f98a3; }
    #lk-footer .lk-copyright {
      font-size: 10px;
      color: #2e3d4a;
      font-family: 'Inter', sans-serif;
      text-align: center;
      letter-spacing: 0.04em;
    }

    /* Adjust body top padding to account for new navbar */
    body { display: flex; flex-direction: column; min-height: 100vh; }
    body > :not(#lk-navbar):not(#lk-footer):not(style):not(script):first-of-type {
      /* leave room if content is direct child */
    }
  `;
  document.head.appendChild(style);

  // ── INJECT NAVBAR ──────────────────────────────────────────────────────────
  const navbar = document.createElement('div');
  navbar.id = 'lk-navbar';
  navbar.innerHTML = `
    <a class="lk-brand" href="index.html">${LOGO_SVG}</a>
    <div class="lk-divider"></div>
    <nav class="lk-nav-links" aria-label="Herramientas">
      ${linksHtml}
    </nav>
    <div class="lk-nav-right">
      <a class="lk-web-link" href="https://www.largotek.com" target="_blank" rel="noopener">largotek.com ↗</a>
    </div>
  `;
  // Insert as first element in body
  document.body.insertBefore(navbar, document.body.firstChild);

  // ── INJECT FOOTER ──────────────────────────────────────────────────────────
  // Remove existing <footer> if any
  const oldFooter = document.querySelector('footer');
  if (oldFooter) oldFooter.remove();

  const footer = document.createElement('div');
  footer.id = 'lk-footer';
  footer.innerHTML = `
    <div class="lk-footer-top">
      ${LOGO_SVG}
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
