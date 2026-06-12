# ⬡ VSM Flow Studio

> Value Stream Mapping simulator with real-time Lean Six Sigma calculations.

![VSM Flow Studio](https://img.shields.io/badge/Lean-Six%20Sigma-blue) ![VSM](https://img.shields.io/badge/VSM-Flow%20Studio-green)

## 🚀 Uso

Abre `index.html` en tu navegador — no requiere servidor ni dependencias.

## 🗺 Elementos VSM

| Icono | Elemento | Descripción |
|---|---|---|
| ▣ | Proveedor | Origen del material |
| ▣ | Cliente | Destino final |
| ▬ | Proceso | Paso productivo con CT, C/O, Uptime |
| ▲ | Inventario | WIP entre procesos |
| ✸ | Kaizen Burst | Punto de mejora identificado |

## 📊 KPIs calculados

- **Takt Time** = Tiempo disponible / Demanda cliente
- **Lead Time** = Σ días WIP + Σ CT procesos
- **Process Time** = Σ CT procesos VA
- **PCE** = Process Time / Lead Time × 100
- **Bottleneck** = Proceso con mayor CT neto
- **Capacidad** por proceso = Tiempo disponible / CT

## 🛠 Stack

- Pure HTML5 + CSS3 + JavaScript (sin dependencias)
- LocalStorage para persistencia
- Export JSON y Print/PDF

## 📁 Estructura

```
vsm-flow-studio/
├── index.html
├── css/style.css
├── js/
│   ├── nodes.js        # Modelo de datos
│   ├── simulation.js   # Motor de cálculo VSM
│   ├── canvas.js       # Canvas drag & drop
│   └── ui.js           # Modal, save/load
└── README.md
```

---
Desarrollado con metodología **Lean Six Sigma Black Belt** 🖤
