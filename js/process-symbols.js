/**
 * process-symbols.js — Largotek Lean Suite v5.6
 * Librería centralizada de símbolos de proceso ASME / ISO 9000
 * Estándar para: Cursograma Analítico, Trabajo Estandarizado, SMED
 * NO aplica a VSM (tiene su propio vocabulario Toyota).
 *
 * Símbolos estándar:
 *   operacion  → ○  Círculo          (VA — valor agregado)
 *   inspeccion → □  Cuadrado         (control de calidad)
 *   transporte → ➜  Flecha vacía     (movimiento / traslado)
 *   demora     → D  Letra D          (espera / retraso)
 *   almacen    → ▽  Triángulo inv.   (almacenaje / stock)
 *   opInsp     → ○□ Combinado        (operación + inspección simultánea)
 */

(function(global) {
  'use strict';

  // ─── Paleta de colores ──────────────────────────────────────────────────────
  const COLORS = {
    operacion:  '#4f98a3',   // teal
    inspeccion: '#d29922',   // amber
    transporte: '#ffa657',   // orange
    demora:     '#f85149',   // red
    almacen:    '#bc8cff',   // purple
    opInsp:     '#4f98a3',   // teal (mismo que operación)
  };

  // ─── Etiquetas ──────────────────────────────────────────────────────────────
  const LABELS = {
    operacion:  'Operación',
    inspeccion: 'Inspección',
    transporte: 'Transporte',
    demora:     'Demora',
    almacen:    'Almacenamiento',
    opInsp:     'Op. + Inspección',
  };

  // ─── Descripción corta (para tooltips/leyendas) ─────────────────────────────
  const SUBLABELS = {
    operacion:  'Círculo · Valor Agregado',
    inspeccion: 'Cuadrado · Control',
    transporte: 'Flecha · Movimiento',
    demora:     'D · Espera',
    almacen:    'Triángulo ▽ · Stock',
    opInsp:     'Círculo+Cuadrado',
  };

  /**
   * makeSVG(type, size, color)
   * Devuelve un string SVG con el símbolo ASME estándar.
   * @param {string} type   — clave del tipo (operacion, inspeccion, transporte, demora, almacen, opInsp)
   * @param {number} size   — tamaño en px del viewBox (default 60)
   * @param {string} color  — color hex override (default = COLORS[type])
   * @param {number} opacity — opacidad del fill interior (default 0.12, usar 0 para sin fill)
   */
  function makeSVG(type, size, color, opacity) {
    size    = size    || 60;
    color   = color   || COLORS[type] || '#4f98a3';
    opacity = (opacity === undefined) ? 0.12 : opacity;
    const fill = hexAlpha(color, opacity);
    const sw   = Math.max(2, Math.round(size * 0.05));  // stroke-width proporcional

    const half = size / 2;
    const r    = half * 0.78;   // radio para círculo
    const pad  = size * 0.1;    // padding interno

    switch (type) {

      // ○ Operación — Círculo
      case 'operacion':
        return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
          <circle cx="${half}" cy="${half}" r="${r}" fill="${fill}" stroke="${color}" stroke-width="${sw}"/>
        </svg>`;

      // □ Inspección — Cuadrado
      case 'inspeccion': {
        const p = pad;
        const s = size - pad * 2;
        return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
          <rect x="${p}" y="${p}" width="${s}" height="${s}" fill="${fill}" stroke="${color}" stroke-width="${sw}"/>
        </svg>`;
      }

      // ➜ Transporte — Flecha vacía (outline)
      case 'transporte': {
        // Flecha ancha apuntando a la derecha
        const cx = size / 2;
        const cy = size / 2;
        const ah = size * 0.52;  // alto del cuerpo
        const aw = size * 0.72;  // ancho total
        const tip = size * 0.38; // profundidad de la punta
        const bw  = size * 0.36; // alto del cuello
        const x0  = (size - aw) / 2;
        const x1  = x0 + aw - tip;
        const y1  = cy - ah / 2;
        const y2  = cy + ah / 2;
        const y1n = cy - bw / 2;
        const y2n = cy + bw / 2;
        const pts = [
          `${x0},${y1n}`,
          `${x1},${y1n}`,
          `${x1},${y1}`,
          `${x0 + aw},${cy}`,
          `${x1},${y2}`,
          `${x1},${y2n}`,
          `${x0},${y2n}`,
        ].join(' ');
        return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
          <polygon points="${pts}" fill="${fill}" stroke="${color}" stroke-width="${sw}" stroke-linejoin="round"/>
        </svg>`;
      }

      // D Demora — Letra D / semicírculo plano hacia la derecha
      case 'demora': {
        const p2  = pad;
        const h   = size - pad * 2;
        const w   = size - pad * 2;
        const x0  = p2;
        const y0  = p2;
        const mid = p2 + h / 2;
        // Rectángulo izquierdo + arco derecho (forma D)
        const rx  = w * 0.52;  // radio horizontal del arco
        const ry  = h / 2;
        const d = [
          `M ${x0} ${y0}`,
          `L ${x0 + rx} ${y0}`,
          `A ${rx} ${ry} 0 0 1 ${x0 + rx} ${y0 + h}`,
          `L ${x0} ${y0 + h}`,
          'Z'
        ].join(' ');
        return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
          <path d="${d}" fill="${fill}" stroke="${color}" stroke-width="${sw}" stroke-linejoin="round"/>
        </svg>`;
      }

      // ▽ Almacenamiento — Triángulo invertido
      case 'almacen': {
        const p2 = pad;
        const pts = [
          `${half},${size - p2}`,           // vértice inferior
          `${p2},${p2}`,                     // esquina sup-izq
          `${size - p2},${p2}`,             // esquina sup-der
        ].join(' ');
        return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
          <polygon points="${pts}" fill="${fill}" stroke="${color}" stroke-width="${sw}" stroke-linejoin="round"/>
        </svg>`;
      }

      // ○□ Operación + Inspección combinada
      case 'opInsp': {
        const r2 = half * 0.62;
        const sq = r2 * 1.18;
        return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
          <circle cx="${half}" cy="${half}" r="${r2}" fill="${fill}" stroke="${color}" stroke-width="${sw}"/>
          <rect x="${half - sq}" y="${half - sq}" width="${sq * 2}" height="${sq * 2}"
            fill="none" stroke="${color}" stroke-width="${sw}" opacity="0.6"/>
        </svg>`;
      }

      default:
        return makeSVG('operacion', size, color, opacity);
    }
  }

  /**
   * makeSVGDim(type, size)
   * Versión atenuada del símbolo (para columnas inactivas en cursograma).
   */
  function makeSVGDim(type, size) {
    return makeSVG(type, size, COLORS[type], 0);
    // Se agrega opacity en el SVG root via wrapper si se necesita
  }

  /**
   * makeSVGSmall(type, color)
   * Versión 20x20 para uso en tablas y badges.
   */
  function makeSVGSmall(type, color) {
    return makeSVG(type, 20, color, 0.18);
  }

  /**
   * makeSVGMedium(type, color)
   * Versión 32x32 para paletas de herramientas.
   */
  function makeSVGMedium(type, color) {
    return makeSVG(type, 32, color, 0.15);
  }

  /**
   * makeSVGLarge(type, color)
   * Versión 60x60 para lienzo de trabajo estandarizado.
   */
  function makeSVGLarge(type, color) {
    return makeSVG(type, 60, color, 0.12);
  }

  /**
   * makeSVGLegend(type)
   * Versión 22x22 para leyendas.
   */
  function makeSVGLegend(type) {
    return makeSVG(type, 22, COLORS[type], 0);
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────
  function hexAlpha(hex, alpha) {
    if (alpha === 0) return 'none';
    // Convierte #rrggbb → rgba(r,g,b,alpha)
    const r = parseInt(hex.slice(1,3),16);
    const g = parseInt(hex.slice(3,5),16);
    const b = parseInt(hex.slice(5,7),16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  /**
   * PALETTE_ITEMS
   * Array con los 5 tipos base en orden estándar ASME para construir
   * paletas de arrastrar en herramientas.
   * Formato: { type, label, sublabel, color }
   */
  const PALETTE_ITEMS = [
    { type:'operacion',  label:LABELS.operacion,  sublabel:SUBLABELS.operacion,  color:COLORS.operacion  },
    { type:'inspeccion', label:LABELS.inspeccion, sublabel:SUBLABELS.inspeccion, color:COLORS.inspeccion },
    { type:'transporte', label:LABELS.transporte, sublabel:SUBLABELS.transporte, color:COLORS.transporte },
    { type:'demora',     label:LABELS.demora,     sublabel:SUBLABELS.demora,     color:COLORS.demora     },
    { type:'almacen',    label:LABELS.almacen,    sublabel:SUBLABELS.almacen,    color:COLORS.almacen    },
  ];

  /**
   * TABLE_TYPES
   * Orden de columnas para el cursograma analítico (ASME estándar).
   */
  const TABLE_TYPES = ['operacion','inspeccion','transporte','demora','almacen'];

  // ─── Exportar al namespace global ───────────────────────────────────────────
  global.ProcessSymbols = {
    COLORS,
    LABELS,
    SUBLABELS,
    PALETTE_ITEMS,
    TABLE_TYPES,
    makeSVG,
    makeSVGDim,
    makeSVGSmall,
    makeSVGMedium,
    makeSVGLarge,
    makeSVGLegend,
  };

})(window);
