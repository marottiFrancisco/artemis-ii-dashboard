# Artemis II — Live Mission Dashboard

Dashboard en tiempo real de la misión Artemis II. Los datos de telemetría vienen directo de la API de JPL Horizons — la misma que usan astrónomos y equipos de misión. No hay datos simulados ni scraping; es un query real a la efeméride oficial de la NASA.

---

## Stack

| Capa | Tecnología |
|------|-----------|
| Backend | Node.js puro (sin Express, sin dependencias externas) |
| Frontend | React 18 + Vite |
| Telemetría | NASA/JPL Horizons API (gratuita, sin API key) |

---

## Lo que muestra

- **Posición y velocidad** de Orion en tiempo real (X/Y/Z geocéntrico, km y km/s)
- **Visualizador orbital** animado con parallax de estrellas e interacción por mouse
- **Timeline de misión** con countdown al próximo evento
- **Delay de señal** calculado a la velocidad de la luz desde la distancia actual
- **Comparaciones** de distancia rotativas (circunferencia de la Tierra, vuelos, ISS)
- **Gráfico histórico** de distancia acumulado durante la sesión
- **State vectors raw** tal como los devuelve JPL (posición y velocidad geocéntrica)
- **Comparación con Apollo 17** al mismo Mission Elapsed Time
- **Speedómetro** comparando la velocidad de Orion vs F1, avión comercial y bala
- **Diámetro angular de la Tierra** visto desde la cápsula, con simulación visual

---

## Setup

### Requisitos

- Node.js v18 o superior

### Instalación

```bash
git clone https://github.com/marottiFrancisco/artemis-ii-dashboard.git
cd artemis-ii-dashboard
npm install
```

### Correrlo

Dos terminales:

```bash
# Terminal 1 — backend
node server.js

# Terminal 2 — frontend
npm run dev
```

Abrir `http://localhost:5173`.

---

## Cómo funciona la telemetría

JPL Horizons es el sistema de efemérides del Jet Propulsion Laboratory. Permite consultar la posición y velocidad de cualquier objeto del sistema solar (planetas, cometas, asteroides, naves espaciales) para cualquier instante de tiempo.

El backend hace un query cada 30 segundos al endpoint:

```
https://ssd.jpl.nasa.gov/api/horizons.api
```

Con `COMMAND='-1024'` (ID de Artemis II / Orion) y `EPHEM_TYPE='VECTORS'`, que devuelve un state vector geocéntrico: coordenadas X, Y, Z en km y velocidades VX, VY, VZ en km/s respecto al centro de la Tierra.

La respuesta trae el bloque de datos entre marcadores `$$SOE` y `$$EOE`. De ahí se extrae:
- **RG** (range): distancia geocéntrica directa en km
- **X, Y, Z**: posición
- **VX, VY, VZ**: velocidad

La distancia a la Luna es una aproximación (distancia media de 384,400 km menos RG). Para precisión exacta habría que queryear también la posición de la Luna en el mismo instante.

El backend cachea la respuesta 30 segundos para no saturar la API de JPL.

---

## Estructura del proyecto

```
artemis-ii-dashboard/
├── server.js          # Backend: consulta JPL Horizons y sirve la telemetría
├── package.json
├── vite.config.js
├── index.html
└── src/
    ├── main.jsx
    └── App.jsx        # Todo el frontend: componentes, lógica, estilos inline
```

---

## Notas

- La API de JPL Horizons es pública y gratuita, sin límite de requests documentado. No requiere API key.
- El ID `-1024` corresponde a Artemis II (Orion spacecraft). JPL carga las efemérides oficiales de la NASA cuando se confirma la trayectoria de una misión.
- El frontend no tiene dependencias más allá de React. Todos los estilos son inline.

---

*Not affiliated with NASA. Data source: NASA/JPL Horizons System.*
