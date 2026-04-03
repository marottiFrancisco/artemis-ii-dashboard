import http from "http";
import https from "https";
import { parse as parseUrl } from "url";
const PORT = 3001;

let cache = { data: null, timestamp: 0 };
const CACHE_TTL = 30000;

function buildHorizonsUrl() {
  const now = new Date();
  const start = new Date(now.getTime() - 60000);
  const stop = new Date(now.getTime() + 60000);

  const fmt = (d) =>
    `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")} ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;

  const params = new URLSearchParams({
    format: "json",
    COMMAND: "'-1024'",
    OBJ_DATA: "'NO'",
    MAKE_EPHEM: "'YES'",
    EPHEM_TYPE: "'VECTORS'",
    CENTER: "'500@399'",        // geocéntrico
    START_TIME: `'${fmt(start)}'`,
    STOP_TIME: `'${fmt(stop)}'`,
    STEP_SIZE: "'1 m'",
    VEC_TABLE: "'3'",           // tabla 3 incluye RG (range geocéntrico)
    OUT_UNITS: "'KM-S'",
    VEC_LABELS: "'YES'",
    CSV_FORMAT: "'NO'",
  });

  return `https://ssd.jpl.nasa.gov/api/horizons.api?${params.toString()}`;
}

function parseHorizonsResponse(raw) {
  const result = raw.result || "";

  const soeIdx = result.indexOf("$$SOE");
  const eoeIdx = result.indexOf("$$EOE");

  if (soeIdx === -1 || eoeIdx === -1) {
    throw new Error("No se encontraron datos de efemérides en la respuesta de JPL");
  }

  const block = result.slice(soeIdx + 5, eoeIdx).trim();
  const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);

  if (lines.length < 4) throw new Error("Datos insuficientes en respuesta JPL");

  // Formato tabla 3: línea 0 = fecha, 1 = X Y Z, 2 = VX VY VZ, 3 = LT RG RR
  const xyzMatch = lines[1].match(/X\s*=\s*([-\d.E+]+)\s+Y\s*=\s*([-\d.E+]+)\s+Z\s*=\s*([-\d.E+]+)/i);
  const vMatch   = lines[2].match(/VX\s*=\s*([-\d.E+]+)\s+VY\s*=\s*([-\d.E+]+)\s+VZ\s*=\s*([-\d.E+]+)/i);
  const rgMatch  = lines[3].match(/RG\s*=\s*([-\d.E+]+)/i);

  if (!xyzMatch || !vMatch) throw new Error("No se pudo parsear el vector de estado");

  const x  = parseFloat(xyzMatch[1]);
  const y  = parseFloat(xyzMatch[2]);
  const z  = parseFloat(xyzMatch[3]);
  const vx = parseFloat(vMatch[1]);
  const vy = parseFloat(vMatch[2]);
  const vz = parseFloat(vMatch[3]);

  const distFromEarthCenter = rgMatch
    ? parseFloat(rgMatch[1])
    : Math.sqrt(x * x + y * y + z * z);

  const EARTH_RADIUS_KM = 6371;
  const MOON_DIST_KM    = 384400;

  const altitude  = distFromEarthCenter - EARTH_RADIUS_KM;
  const speed     = Math.sqrt(vx * vx + vy * vy + vz * vz);

  // distancia a la luna es aproximada — no queremos un segundo query solo para esto
  const distFromMoon = Math.abs(MOON_DIST_KM - distFromEarthCenter);

  const LAUNCH_TIME  = new Date("2026-04-01T22:35:12Z").getTime();
  const elapsedDays  = (Date.now() - LAUNCH_TIME) / 86400000;

  let phase = "Unknown";
  if      (elapsedDays < 0)                               phase = "Pre-Launch";
  else if (distFromEarthCenter < 7000)                    phase = "Earth Orbit";
  else if (distFromEarthCenter < MOON_DIST_KM * 0.5)     phase = "Translunar Coast";
  else if (distFromEarthCenter < MOON_DIST_KM * 1.05)    phase = "Lunar Flyby";
  else if (distFromEarthCenter > MOON_DIST_KM)            phase = "Return to Earth";
  else                                                     phase = "Deep Space";

  const missionProgress = Math.min(100, Math.max(0, (elapsedDays / 10) * 100));

  return {
    source: "NASA/JPL Horizons API",
    timestamp: new Date().toISOString(),
    elapsedDays: Math.max(0, elapsedDays),
    phase,
    missionProgress,
    distanceFromEarthKm: Math.round(distFromEarthCenter),
    distanceFromMoonKm:  Math.round(distFromMoon),
    altitudeKm:          Math.round(altitude),
    speedKmS:            parseFloat(speed.toFixed(3)),
    position: { x: Math.round(x), y: Math.round(y), z: Math.round(z) },
    velocity: {
      vx: parseFloat(vx.toFixed(4)),
      vy: parseFloat(vy.toFixed(4)),
      vz: parseFloat(vz.toFixed(4)),
    },
    crew: [
      { name: "Reid Wiseman",  role: "CDR", agency: "NASA", flag: "🇺🇸" },
      { name: "Victor Glover", role: "PLT", agency: "NASA", flag: "🇺🇸" },
      { name: "Christina Koch",role: "MS1", agency: "NASA", flag: "🇺🇸" },
      { name: "Jeremy Hansen", role: "MS2", agency: "CSA",  flag: "🇨🇦" },
    ],
    mission: {
      name:        "Artemis II",
      vehicle:     "Orion / SLS Block 1",
      launchDate:  "April 1, 2026 — 22:35 UTC",
      splashdown:  "April 11, 2026 — Pacific Ocean",
      launchSite:  "Kennedy Space Center, LC-39B",
    },
  };
}

async function fetchOrionTelemetry() {
  const now = Date.now();
  if (cache.data && now - cache.timestamp < CACHE_TTL) {
    return { ...cache.data, cached: true };
  }

  return new Promise((resolve, reject) => {
    const apiUrl = buildHorizonsUrl();
    console.log(`[JPL] Fetching: ${apiUrl}`);

    https.get(apiUrl, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        try {
          const json   = JSON.parse(body);
          const parsed = parseHorizonsResponse(json);
          cache = { data: parsed, timestamp: now };
          resolve({ ...parsed, cached: false });
        } catch (e) {
          console.error("[JPL] Parse error:", e.message);
          if (cache.data) resolve({ ...cache.data, cached: true, stale: true });
          else reject(e);
        }
      });
    }).on("error", (e) => {
      console.error("[JPL] Network error:", e.message);
      if (cache.data) resolve({ ...cache.data, cached: true, stale: true });
      else reject(e);
    });
  });
}

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  const { pathname } = parseUrl(req.url, true);

  if (pathname === "/telemetry") {
    try {
      const data = await fetchOrionTelemetry();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(data));
    } catch (e) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: e.message }));
    }

  } else if (pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", service: "Artemis II Telemetry Backend" }));

  } else {
    res.writeHead(404);
    res.end("Not found");
  }
});

server.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════╗
║   ARTEMIS II — Telemetry Backend             ║
║   Fuente: NASA/JPL Horizons API              ║
║   Orion ID: -1024                            ║
║   Servidor: http://localhost:${PORT}            ║
╚══════════════════════════════════════════════╝
  `);
});
