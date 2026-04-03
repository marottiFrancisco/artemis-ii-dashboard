import { useState, useEffect, useRef } from "react";

const API = "http://localhost:3001";
const LAUNCH_TIME = new Date("2026-04-01T22:35:12Z").getTime();

function formatDuration(days) {
  if (!days || days <= 0) return "00d 00h 00m 00s";
  const d = Math.floor(days);
  const h = Math.floor((days - d) * 24);
  const m = Math.floor(((days - d) * 24 - h) * 60);
  const s = Math.floor((((days - d) * 24 - h) * 60 - m) * 60);
  return `${String(d).padStart(2, "0")}d ${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
}

// Reloj MET en tiempo real (no espera al fetch)
function useMET() {
  const [met, setMet] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      setMet((Date.now() - LAUNCH_TIME) / 86400000);
    }, 1000);
    return () => clearInterval(id);
  }, []);
  return met;
}

function OrbitCanvas({ telemetry }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const mouseRef = useRef({ x: 0.5, y: 0.5 });
  const trailRef = useRef([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const onMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = {
        x: (e.clientX - rect.left) / rect.width,
        y: (e.clientY - rect.top) / rect.height,
      };
    };
    canvas.addEventListener("mousemove", onMouseMove);

    const draw = () => {
      const W = canvas.width;
      const H = canvas.height;
      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;
      const t = Date.now();

      ctx.clearRect(0, 0, W, H);

      const bgGrad = ctx.createRadialGradient(W * 0.5, H * 0.5, 0, W * 0.5, H * 0.5, W * 0.7);
      bgGrad.addColorStop(0, "#001428");
      bgGrad.addColorStop(1, "#000408");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);

      // 3 capas de estrellas con parallax distinto según profundidad
      const starLayers = [
        { count: 80, speed: 0.008, size: 0.5, alpha: 0.35 },
        { count: 50, speed: 0.015, size: 1.0, alpha: 0.55 },
        { count: 20, speed: 0.025, size: 1.5, alpha: 0.7 },
      ];
      starLayers.forEach((layer, li) => {
        for (let i = 0; i < layer.count; i++) {
          const seed = li * 1000 + i;
          const bx = (Math.sin(seed * 137.508) * 0.5 + 0.5);
          const by = (Math.cos(seed * 97.31) * 0.5 + 0.5);
          const px = (bx + (mx - 0.5) * layer.speed * 2) % 1;
          const py = (by + (my - 0.5) * layer.speed * 2) % 1;
          const twinkle = layer.alpha * (0.5 + 0.5 * Math.sin(t / 1500 + seed));
          ctx.fillStyle = `rgba(200,220,255,${twinkle})`;
          ctx.beginPath();
          ctx.arc(px * W, py * H, layer.size, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      // Nebula cloud (subtle)
      const neb = ctx.createRadialGradient(W * 0.55, H * 0.3, 0, W * 0.55, H * 0.3, W * 0.35);
      neb.addColorStop(0, "rgba(0,80,160,0.04)");
      neb.addColorStop(0.5, "rgba(0,40,100,0.025)");
      neb.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = neb;
      ctx.fillRect(0, 0, W, H);

      const earthX = W * 0.14, earthY = H * 0.5;
      const moonX = W * 0.86, moonY = H * 0.5;
      const earthR = 34, moonR = 18;

      const atmo = ctx.createRadialGradient(earthX, earthY, earthR * 0.9, earthX, earthY, earthR * 2.2);
      atmo.addColorStop(0, "rgba(40,140,255,0.18)");
      atmo.addColorStop(0.4, "rgba(20,80,200,0.08)");
      atmo.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = atmo;
      ctx.beginPath(); ctx.arc(earthX, earthY, earthR * 2.2, 0, Math.PI * 2); ctx.fill();

      const earthGrad = ctx.createRadialGradient(earthX - earthR * 0.3, earthY - earthR * 0.3, earthR * 0.05, earthX, earthY, earthR);
      earthGrad.addColorStop(0, "#7dd8f8");
      earthGrad.addColorStop(0.3, "#2196f3");
      earthGrad.addColorStop(0.65, "#1040a0");
      earthGrad.addColorStop(1, "#020c2a");
      ctx.fillStyle = earthGrad;
      ctx.beginPath(); ctx.arc(earthX, earthY, earthR, 0, Math.PI * 2); ctx.fill();

      ctx.save();
      ctx.beginPath(); ctx.arc(earthX, earthY, earthR, 0, Math.PI * 2); ctx.clip();
      const landAreas = [
        { dx: -6, dy: -8, rx: 9, ry: 12 },
        { dx: 8, dy: -5, rx: 7, ry: 10 },
        { dx: -2, dy: 10, rx: 11, ry: 7 },
        { dx: 12, dy: 8, rx: 6, ry: 5 },
      ];
      const landRot = t / 80000;
      ctx.fillStyle = "rgba(60,180,60,0.35)";
      landAreas.forEach(({ dx, dy, rx, ry }) => {
        const lx = earthX + dx * Math.cos(landRot) - dy * Math.sin(landRot);
        const ly = earthY + dx * Math.sin(landRot) + dy * Math.cos(landRot);
        ctx.beginPath();
        ctx.ellipse(lx, ly, rx, ry, landRot * 0.5, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      [{ dx: -10, dy: -14, rx: 12, ry: 3 }, { dx: 8, dy: 12, rx: 10, ry: 2.5 }].forEach(({ dx, dy, rx, ry }) => {
        const cx2 = earthX + dx * Math.cos(landRot * 1.3) - dy * Math.sin(landRot * 1.3);
        const cy2 = earthY + dx * Math.sin(landRot * 1.3) + dy * Math.cos(landRot * 1.3);
        ctx.beginPath(); ctx.ellipse(cx2, cy2, rx, ry, 0.3, 0, Math.PI * 2); ctx.fill();
      });
      // Terminator (shadow)
      const termGrad = ctx.createLinearGradient(earthX - earthR, earthY, earthX + earthR * 0.2, earthY);
      termGrad.addColorStop(0, "rgba(0,0,10,0.55)");
      termGrad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = termGrad;
      ctx.beginPath(); ctx.arc(earthX, earthY, earthR, 0, Math.PI * 2); ctx.fill();
      ctx.restore();

      const moonGlow = ctx.createRadialGradient(moonX, moonY, moonR * 0.8, moonX, moonY, moonR * 2.5);
      moonGlow.addColorStop(0, "rgba(220,200,150,0.15)");
      moonGlow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = moonGlow;
      ctx.beginPath(); ctx.arc(moonX, moonY, moonR * 2.5, 0, Math.PI * 2); ctx.fill();

      const moonGrad = ctx.createRadialGradient(moonX - moonR * 0.25, moonY - moonR * 0.25, moonR * 0.05, moonX, moonY, moonR);
      moonGrad.addColorStop(0, "#f0e8d0");
      moonGrad.addColorStop(0.5, "#c8b890");
      moonGrad.addColorStop(1, "#5a5040");
      ctx.fillStyle = moonGrad;
      ctx.beginPath(); ctx.arc(moonX, moonY, moonR, 0, Math.PI * 2); ctx.fill();

      ctx.save();
      ctx.beginPath(); ctx.arc(moonX, moonY, moonR, 0, Math.PI * 2); ctx.clip();
      const craters = [
        { dx: -5, dy: -4, r: 3 }, { dx: 4, dy: 3, r: 2 },
        { dx: -2, dy: 6, r: 2.5 }, { dx: 6, dy: -6, r: 1.8 }, { dx: 0, dy: -8, r: 1.5 },
      ];
      craters.forEach(({ dx, dy, r }) => {
        ctx.fillStyle = "rgba(40,32,20,0.3)";
        ctx.beginPath(); ctx.arc(moonX + dx, moonY + dy, r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "rgba(255,240,200,0.12)";
        ctx.beginPath(); ctx.arc(moonX + dx - r * 0.3, moonY + dy - r * 0.3, r * 0.5, 0, Math.PI * 2); ctx.fill();
      });
      // Moon shadow
      const mTermGrad = ctx.createLinearGradient(moonX - moonR, moonY, moonX + moonR * 0.3, moonY);
      mTermGrad.addColorStop(0, "rgba(0,0,8,0.5)");
      mTermGrad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = mTermGrad;
      ctx.beginPath(); ctx.arc(moonX, moonY, moonR, 0, Math.PI * 2); ctx.fill();
      ctx.restore();

      // trayectoria de ida y vuelta — dashed para no tapar la posición real
      ctx.setLineDash([4, 8]);
      ctx.strokeStyle = "rgba(0,220,180,0.12)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(earthX + earthR, earthY);
      ctx.bezierCurveTo(
        earthX + (moonX - earthX) * 0.3, earthY - H * 0.22,
        earthX + (moonX - earthX) * 0.7, earthY - H * 0.22,
        moonX - moonR, moonY
      );
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(moonX - moonR, moonY);
      ctx.bezierCurveTo(
        earthX + (moonX - earthX) * 0.7, earthY + H * 0.22,
        earthX + (moonX - earthX) * 0.3, earthY + H * 0.22,
        earthX + earthR, earthY
      );
      ctx.stroke();
      ctx.setLineDash([]);

      let orionX, orionY;
      const phase = telemetry?.phase || "Earth Orbit";
      const prog = telemetry?.missionProgress || 0;

      if (phase === "Earth Orbit") {
        const angle = t / 1800;
        orionX = earthX + Math.cos(angle) * (earthR + 18);
        orionY = earthY + Math.sin(angle) * (earthR + 18) * 0.5;
      } else if (phase === "Translunar Coast") {
        const frac = Math.min(1, (prog - 10) / 35);
        // Follow bezier outbound
        const bx1 = earthX + (moonX - earthX) * 0.3, by1 = earthY - H * 0.22;
        const bx2 = earthX + (moonX - earthX) * 0.7, by2 = earthY - H * 0.22;
        const ex = moonX - moonR, ey = moonY;
        const sx = earthX + earthR, sy = earthY;
        orionX = Math.pow(1-frac,3)*sx + 3*Math.pow(1-frac,2)*frac*bx1 + 3*(1-frac)*frac*frac*bx2 + frac*frac*frac*ex;
        orionY = Math.pow(1-frac,3)*sy + 3*Math.pow(1-frac,2)*frac*by1 + 3*(1-frac)*frac*frac*by2 + frac*frac*frac*ey;
      } else if (phase === "Lunar Flyby") {
        const frac = (prog - 45) / 10;
        const angle = Math.PI + frac * Math.PI;
        orionX = moonX + Math.cos(angle) * (moonR + 15);
        orionY = moonY + Math.sin(angle) * (moonR + 15);
      } else if (phase === "Return to Earth") {
        const frac = Math.min(1, (prog - 55) / 40);
        const bx1 = earthX + (moonX - earthX) * 0.7, by1 = earthY + H * 0.22;
        const bx2 = earthX + (moonX - earthX) * 0.3, by2 = earthY + H * 0.22;
        const sx = moonX - moonR, sy = moonY;
        const ex = earthX + earthR, ey = earthY;
        orionX = Math.pow(1-frac,3)*sx + 3*Math.pow(1-frac,2)*frac*bx1 + 3*(1-frac)*frac*frac*bx2 + frac*frac*frac*ex;
        orionY = Math.pow(1-frac,3)*sy + 3*Math.pow(1-frac,2)*frac*by1 + 3*(1-frac)*frac*frac*by2 + frac*frac*frac*ey;
      } else {
        orionX = earthX + earthR + 25;
        orionY = earthY;
      }

      const trail = trailRef.current;
      trail.push({ x: orionX, y: orionY, age: 0 });
      if (trail.length > 60) trail.shift();
      trail.forEach((p) => { p.age++; });

      trail.forEach((p) => {
        const alpha = (1 - p.age / 60) * 0.5;
        const r = (1 - p.age / 60) * 3;
        ctx.fillStyle = `rgba(0,255,200,${alpha})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(0.5, r), 0, Math.PI * 2); ctx.fill();
      });

      // Engine glow
      const pulse = 0.7 + 0.3 * Math.sin(t / 300);
      const engGlow = ctx.createRadialGradient(orionX, orionY, 0, orionX, orionY, 28 * pulse);
      engGlow.addColorStop(0, `rgba(0,255,200,${0.3 * pulse})`);
      engGlow.addColorStop(0.4, `rgba(0,180,255,${0.12 * pulse})`);
      engGlow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = engGlow;
      ctx.beginPath(); ctx.arc(orionX, orionY, 28 * pulse, 0, Math.PI * 2); ctx.fill();

      ctx.fillStyle = "#00ffc8";
      ctx.shadowColor = "#00ffc8";
      ctx.shadowBlur = 16;
      ctx.beginPath(); ctx.arc(orionX, orionY, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.shadowBlur = 0;
      ctx.beginPath(); ctx.arc(orionX, orionY, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;

      // Distance line (Earth → Orion)
      ctx.setLineDash([2, 6]);
      ctx.strokeStyle = "rgba(0,255,200,0.1)";
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(earthX, earthY); ctx.lineTo(orionX, orionY); ctx.stroke();
      ctx.setLineDash([]);

      ctx.font = "bold 10px monospace";
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(150,210,255,0.6)";
      ctx.fillText("EARTH", earthX, earthY + earthR + 16);
      ctx.fillText("MOON", moonX, moonY + moonR + 16);
      ctx.fillStyle = "#00ffc8";
      ctx.font = "bold 10px monospace";
      ctx.fillText("ORION", orionX, orionY - 14);

      // tooltip si el mouse está cerca del punto de Orion
      const canvasMx = mx * W;
      const canvasMy = my * H;
      const dist = Math.sqrt((canvasMx - orionX) ** 2 + (canvasMy - orionY) ** 2);
      if (dist < 40 && telemetry) {
        const tx = Math.min(orionX + 14, W - 160);
        const ty = Math.max(orionY - 80, 8);
        ctx.fillStyle = "rgba(0,10,26,0.92)";
        ctx.strokeStyle = "rgba(0,255,200,0.4)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(tx, ty, 155, 80, 6);
        ctx.fill(); ctx.stroke();

        ctx.fillStyle = "#00ffc8";
        ctx.font = "bold 9px monospace";
        ctx.textAlign = "left";
        ctx.fillText("◈ ORION TELEMETRY", tx + 10, ty + 14);
        ctx.fillStyle = "rgba(180,220,255,0.7)";
        ctx.font = "9px monospace";
        ctx.fillText(`DIST EARTH  ${(telemetry.distanceFromEarthKm/1000).toFixed(1)}×10³ km`, tx + 10, ty + 30);
        ctx.fillText(`DIST MOON   ${Math.round(telemetry.distanceFromMoonKm/1000)}×10³ km`, tx + 10, ty + 44);
        ctx.fillText(`VELOCITY    ${telemetry.speedKmS} km/s`, tx + 10, ty + 58);
        ctx.fillText(`PHASE       ${telemetry.phase}`, tx + 10, ty + 72);
      }

      animRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      cancelAnimationFrame(animRef.current);
      canvas.removeEventListener("mousemove", onMouseMove);
    };
  }, [telemetry]);

  return (
    <canvas
      ref={canvasRef}
      width={900}
      height={280}
      style={{ width: "100%", borderRadius: "8px", display: "block", cursor: "crosshair" }}
    />
  );
}

function Stat({ label, value, unit, sub, color }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.025)",
      border: `1px solid ${color || "rgba(0,255,200,0.12)"}`,
      borderRadius: "10px",
      padding: "14px 16px",
      position: "relative",
      overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: "2px",
        background: color || "linear-gradient(90deg,#00ffc8,#00b8ff)",
      }} />
      <div style={{ color: "rgba(140,200,255,0.55)", fontSize: "9px", letterSpacing: "0.14em", marginBottom: "7px" }}>{label}</div>
      <div style={{ color: "#e4f4ff", fontSize: "19px", fontWeight: "800", fontFamily: "monospace", lineHeight: 1 }}>
        {value}
        {unit && <span style={{ fontSize: "10px", color: "rgba(140,200,255,0.5)", marginLeft: "4px" }}>{unit}</span>}
      </div>
      {sub && <div style={{ color: "rgba(140,200,255,0.4)", fontSize: "10px", marginTop: "4px" }}>{sub}</div>}
    </div>
  );
}

// --- Timeline de misión con countdown al próximo evento ---
const MISSION_EVENTS = [
  { name: "LAUNCH",                subtitle: "Kennedy Space Center · LC-39B",          time: new Date("2026-04-01T22:35:12Z") },
  { name: "TRANS-LUNAR INJECTION", subtitle: "TLI burn — leaving Earth orbit",          time: new Date("2026-04-02T05:10:00Z") },
  { name: "MID-COURSE CORRECTION", subtitle: "MCC-1 trajectory adjustment",             time: new Date("2026-04-03T14:00:00Z") },
  { name: "LUNAR FLYBY",           subtitle: "Closest approach · ~8,900 km from surface", time: new Date("2026-04-06T12:30:00Z") },
  { name: "RETURN BURN",           subtitle: "TEI — Trans-Earth Injection",             time: new Date("2026-04-08T06:00:00Z") },
  { name: "SPLASHDOWN",            subtitle: "Pacific Ocean · off San Diego",           time: new Date("2026-04-11T18:00:00Z") },
];

function fmtCountdown(ms) {
  if (ms < 0) return null;
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `T-${d}d ${h % 24}h ${m % 60}m`;
  if (h > 0) return `T-${h}h ${m % 60}m ${s % 60}s`;
  return `T-${m}m ${s % 60}s`;
}

function MissionTimeline() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const nextIdx = MISSION_EVENTS.findIndex(e => e.time.getTime() > now);

  return (
    <div style={{
      background: "rgba(255,255,255,0.02)", border: "1px solid rgba(0,255,200,0.08)",
      borderRadius: "12px", padding: "16px", marginBottom: "18px",
    }}>
      <div style={{ fontSize: "9px", letterSpacing: "0.16em", color: "rgba(0,255,200,0.45)", marginBottom: "16px" }}>
        ◈ MISSION TIMELINE
      </div>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 0, overflowX: "auto", paddingBottom: "4px" }}>
        {MISSION_EVENTS.map((ev, i) => {
          const done = ev.time.getTime() < now;
          const isNext = i === nextIdx;
          const color = done ? "#00ffc8" : isNext ? "#ffd54f" : "rgba(140,200,255,0.25)";
          return (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", flex: i < MISSION_EVENTS.length - 1 ? "1 1 0" : "0 0 auto", minWidth: "120px" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                {/* dot */}
                <div style={{
                  width: isNext ? "14px" : "10px", height: isNext ? "14px" : "10px",
                  borderRadius: "50%", flexShrink: 0,
                  background: done ? "#00ffc8" : isNext ? "#ffd54f" : "rgba(140,200,255,0.15)",
                  border: `2px solid ${color}`,
                  boxShadow: isNext ? "0 0 10px #ffd54f88" : done ? "0 0 6px #00ffc844" : "none",
                  transition: "all 0.3s",
                  marginTop: "2px",
                }} />
                {/* line */}
                {i < MISSION_EVENTS.length - 1 && (
                  <div style={{ flex: 1, display: "none" }} />
                )}
              </div>
              {/* connector line between dots */}
              {i < MISSION_EVENTS.length - 1 && (
                <div style={{
                  flex: 1, height: "2px", marginTop: "6px",
                  background: done
                    ? "linear-gradient(90deg,#00ffc8,#00ffc844)"
                    : "rgba(140,200,255,0.1)",
                  transition: "background 0.5s",
                }} />
              )}
              {/* label column (overlay below dot) */}
            </div>
          );
        })}
      </div>
      {/* Labels row */}
      <div style={{ display: "flex", marginTop: "8px" }}>
        {MISSION_EVENTS.map((ev, i) => {
          const done = ev.time.getTime() < now;
          const isNext = i === nextIdx;
          const countdown = fmtCountdown(ev.time.getTime() - now);
          return (
            <div key={i} style={{
              flex: i < MISSION_EVENTS.length - 1 ? "1 1 0" : "0 0 auto",
              minWidth: "100px", paddingRight: "8px",
            }}>
              <div style={{
                fontSize: "9px", fontWeight: "800", letterSpacing: "0.06em",
                color: done ? "#00ffc8" : isNext ? "#ffd54f" : "rgba(140,200,255,0.35)",
                marginBottom: "2px",
              }}>
                {done ? "✓ " : isNext ? "▶ " : ""}{ev.name}
              </div>
              <div style={{ fontSize: "8px", color: "rgba(140,200,255,0.3)", lineHeight: 1.4, marginBottom: "3px" }}>
                {ev.subtitle}
              </div>
              {isNext && countdown && (
                <div style={{
                  fontSize: "10px", color: "#ffd54f", fontWeight: "800",
                  fontFamily: "monospace", letterSpacing: "0.04em",
                }}>
                  {countdown}
                </div>
              )}
              {done && (
                <div style={{ fontSize: "8px", color: "rgba(0,255,200,0.4)" }}>
                  {ev.time.toLocaleDateString("en", { month: "short", day: "numeric" })} · {ev.time.toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })} UTC
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- Comparaciones rotativas de distancia ---
const COMPARISONS = [
  (km) => ({ value: (km / 40075).toFixed(1), label: "veces la circunferencia de la Tierra" }),
  (km) => ({ value: Math.round(km / 10025).toLocaleString(), label: "vuelos Buenos Aires → Madrid" }),
  (km) => ({ value: Math.round(km / 420).toLocaleString(), label: "veces la altitud de la ISS" }),
  (km) => ({ value: Math.round(km / 8.849).toLocaleString(), label: "veces la altura del Everest" }),
  (km) => ({ value: (km / 299792).toFixed(3) + "s", label: "de delay en señal (velocidad de la luz)" }),
];

function DistanceComparison({ distKm }) {
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const id = setInterval(() => {
      setVisible(false);
      setTimeout(() => { setIdx(i => (i + 1) % COMPARISONS.length); setVisible(true); }, 400);
    }, 4500);
    return () => clearInterval(id);
  }, []);

  if (!distKm) return null;
  const { value, label } = COMPARISONS[idx](distKm);
  return (
    <div style={{
      textAlign: "center", padding: "10px", marginBottom: "18px",
      opacity: visible ? 1 : 0, transition: "opacity 0.35s",
    }}>
      <span style={{ fontSize: "9px", color: "rgba(140,200,255,0.35)", letterSpacing: "0.1em" }}>
        EQUIVALE A ·{" "}
      </span>
      <span style={{ fontSize: "13px", color: "#00ffc8", fontWeight: "800" }}>{value}</span>
      <span style={{ fontSize: "9px", color: "rgba(140,200,255,0.5)", marginLeft: "6px" }}>{label}</span>
    </div>
  );
}

// --- Delay de señal basado en velocidad de la luz ---
function SignalDelay({ distKm }) {
  const C = 299792; // km/s
  const oneWay = distKm ? (distKm / C) : null;
  return (
    <div style={{
      background: "rgba(255,255,255,0.025)",
      border: "1px solid rgba(100,80,255,0.2)",
      borderRadius: "10px", padding: "14px 16px",
      position: "relative", overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: "2px",
        background: "linear-gradient(90deg,#a070ff,#6040ff)",
      }} />
      <div style={{ color: "rgba(140,200,255,0.55)", fontSize: "9px", letterSpacing: "0.14em", marginBottom: "7px" }}>
        SIGNAL DELAY (1-WAY)
      </div>
      <div style={{ color: "#e4f4ff", fontSize: "19px", fontWeight: "800", fontFamily: "monospace", lineHeight: 1 }}>
        {oneWay ? oneWay.toFixed(3) : "—"}
        <span style={{ fontSize: "10px", color: "rgba(140,200,255,0.5)", marginLeft: "4px" }}>s</span>
      </div>
      <div style={{ color: "rgba(140,200,255,0.4)", fontSize: "10px", marginTop: "4px" }}>
        {oneWay ? `round-trip ${(oneWay * 2).toFixed(3)}s` : ""}
      </div>
    </div>
  );
}

// --- Gráfico de distancia histórica (se llena durante la sesión) ---
function TelemetryChart({ history }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || history.length < 2) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.width, H = canvas.height;
    const PAD = { top: 18, right: 12, bottom: 24, left: 52 };

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "rgba(0,10,26,0)";
    ctx.fillRect(0, 0, W, H);

    const dists = history.map(h => h.distKm);
    const times = history.map(h => h.ts);
    const minD = Math.min(...dists), maxD = Math.max(...dists);
    const minT = Math.min(...times), maxT = Math.max(...times);
    const rangeD = maxD - minD || 1;
    const rangeT = maxT - minT || 1;

    const toX = (ts) => PAD.left + ((ts - minT) / rangeT) * (W - PAD.left - PAD.right);
    const toY = (d) => H - PAD.bottom - ((d - minD) / rangeD) * (H - PAD.top - PAD.bottom);

    // Grid lines
    ctx.strokeStyle = "rgba(0,255,200,0.05)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = PAD.top + (i / 4) * (H - PAD.top - PAD.bottom);
      ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(W - PAD.right, y); ctx.stroke();
      const val = Math.round(maxD - (i / 4) * rangeD);
      ctx.fillStyle = "rgba(140,200,255,0.3)";
      ctx.font = "8px monospace";
      ctx.textAlign = "right";
      ctx.fillText((val / 1000).toFixed(0) + "k", PAD.left - 4, y + 3);
    }

    // Area fill
    const grad = ctx.createLinearGradient(0, PAD.top, 0, H - PAD.bottom);
    grad.addColorStop(0, "rgba(0,255,200,0.15)");
    grad.addColorStop(1, "rgba(0,255,200,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(toX(times[0]), H - PAD.bottom);
    history.forEach(h => ctx.lineTo(toX(h.ts), toY(h.distKm)));
    ctx.lineTo(toX(times[times.length - 1]), H - PAD.bottom);
    ctx.closePath();
    ctx.fill();

    // Line
    ctx.strokeStyle = "#00ffc8";
    ctx.lineWidth = 2;
    ctx.shadowColor = "#00ffc8";
    ctx.shadowBlur = 4;
    ctx.beginPath();
    history.forEach((h, i) => {
      if (i === 0) ctx.moveTo(toX(h.ts), toY(h.distKm));
      else ctx.lineTo(toX(h.ts), toY(h.distKm));
    });
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Last point dot
    const last = history[history.length - 1];
    ctx.fillStyle = "#00ffc8";
    ctx.beginPath();
    ctx.arc(toX(last.ts), toY(last.distKm), 4, 0, Math.PI * 2);
    ctx.fill();

    // Time labels
    ctx.fillStyle = "rgba(140,200,255,0.3)";
    ctx.font = "8px monospace";
    ctx.textAlign = "center";
    [0, history.length - 1].forEach(i => {
      const h = history[i];
      const d = new Date(h.ts);
      ctx.fillText(d.toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" }), toX(h.ts), H - 6);
    });

    // Y axis label
    ctx.save();
    ctx.translate(10, H / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = "rgba(0,255,200,0.3)";
    ctx.font = "8px monospace";
    ctx.textAlign = "center";
    ctx.fillText("DIST EARTH (km)", 0, 0);
    ctx.restore();
  }, [history]);

  return (
    <div style={{
      background: "rgba(255,255,255,0.02)", border: "1px solid rgba(0,255,200,0.08)",
      borderRadius: "12px", padding: "14px 16px",
    }}>
      <div style={{ fontSize: "9px", letterSpacing: "0.16em", color: "rgba(0,255,200,0.45)", marginBottom: "10px" }}>
        ◈ DISTANCE HISTORY · LAST {history.length} READINGS
      </div>
      {history.length < 2 ? (
        <div style={{ color: "rgba(140,200,255,0.3)", fontSize: "11px", textAlign: "center", padding: "30px 0" }}>
          Acumulando datos... ({history.length}/2 lecturas mínimas)
        </div>
      ) : (
        <canvas ref={canvasRef} width={420} height={160} style={{ width: "100%", display: "block" }} />
      )}
    </div>
  );
}

// --- State vectors raw de JPL (lo que ve un ingeniero de NASA) ---
function VectorPanel({ telemetry }) {
  const pos = telemetry?.position;
  const vel = telemetry?.velocity;

  const VRow = ({ label, value, unit, color }) => (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "7px 0", borderBottom: "1px solid rgba(255,255,255,0.03)",
    }}>
      <span style={{ fontSize: "9px", color: "rgba(140,200,255,0.45)", letterSpacing: "0.08em", minWidth: "28px" }}>{label}</span>
      <div style={{ textAlign: "right" }}>
        <span style={{ fontSize: "12px", fontWeight: "800", color: color || "#e4f4ff", fontFamily: "monospace" }}>
          {value !== undefined ? value.toLocaleString() : "—"}
        </span>
        <span style={{ fontSize: "9px", color: "rgba(140,200,255,0.35)", marginLeft: "4px" }}>{unit}</span>
      </div>
    </div>
  );

  return (
    <div style={{
      background: "rgba(255,255,255,0.02)", border: "1px solid rgba(0,255,200,0.08)",
      borderRadius: "12px", padding: "14px 16px",
    }}>
      <div style={{ fontSize: "9px", letterSpacing: "0.16em", color: "rgba(0,255,200,0.45)", marginBottom: "10px" }}>
        ◈ STATE VECTORS · JPL HORIZONS RAW DATA
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
        <div>
          <div style={{ fontSize: "8px", color: "rgba(0,255,200,0.3)", letterSpacing: "0.1em", marginBottom: "6px" }}>
            POSITION (km · geocentric)
          </div>
          <VRow label="X" value={pos?.x} unit="km" color="#4fc3f7" />
          <VRow label="Y" value={pos?.y} unit="km" color="#4fc3f7" />
          <VRow label="Z" value={pos?.z} unit="km" color="#4fc3f7" />
        </div>
        <div>
          <div style={{ fontSize: "8px", color: "rgba(0,255,200,0.3)", letterSpacing: "0.1em", marginBottom: "6px" }}>
            VELOCITY (km/s)
          </div>
          <VRow label="VX" value={vel?.vx} unit="km/s" color="#ff7043" />
          <VRow label="VY" value={vel?.vy} unit="km/s" color="#ff7043" />
          <VRow label="VZ" value={vel?.vz} unit="km/s" color="#ff7043" />
        </div>
      </div>
      <div style={{ marginTop: "10px", fontSize: "8px", color: "rgba(140,200,255,0.2)", textAlign: "right" }}>
        SOURCE: JPL HORIZONS · EPHEM_TYPE=VECTORS · CENTER=500@399
      </div>
    </div>
  );
}

// --- Comparación con Apollo 17 al mismo MET ---
// Apollo 17 distance data approximated from historical records (km from Earth center)
const APOLLO17_PROFILE = [
  { day: 0,    dist: 6371 },
  { day: 0.08, dist: 9000 },
  { day: 0.25, dist: 25000 },
  { day: 0.5,  dist: 60000 },
  { day: 1.0,  dist: 120000 },
  { day: 1.5,  dist: 175000 },
  { day: 2.0,  dist: 220000 },
  { day: 2.5,  dist: 258000 },
  { day: 3.0,  dist: 290000 },
  { day: 3.5,  dist: 340000 },
  { day: 4.0,  dist: 384400 },
  { day: 5.0,  dist: 400000 },
  { day: 6.0,  dist: 384400 },
  { day: 7.0,  dist: 320000 },
  { day: 8.0,  dist: 230000 },
  { day: 9.0,  dist: 140000 },
  { day: 10.0, dist: 50000 },
  { day: 11.0, dist: 6371 },
];

function getApollo17Dist(elapsedDays) {
  if (!elapsedDays) return null;
  for (let i = 0; i < APOLLO17_PROFILE.length - 1; i++) {
    const a = APOLLO17_PROFILE[i], b = APOLLO17_PROFILE[i + 1];
    if (elapsedDays >= a.day && elapsedDays <= b.day) {
      const t = (elapsedDays - a.day) / (b.day - a.day);
      return Math.round(a.dist + t * (b.dist - a.dist));
    }
  }
  return null;
}

function ApolloComparison({ elapsedDays, distKm }) {
  const apolloDist = getApollo17Dist(elapsedDays);
  const diff = apolloDist && distKm ? distKm - apolloDist : null;
  const ahead = diff !== null && diff > 0;

  return (
    <div style={{
      background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,180,60,0.15)",
      borderRadius: "12px", padding: "16px", position: "relative", overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: "2px",
        background: "linear-gradient(90deg,#ffd54f,#ff9800)",
      }} />
      <div style={{ fontSize: "9px", letterSpacing: "0.14em", color: "rgba(255,213,79,0.6)", marginBottom: "12px" }}>
        ◈ VS APOLLO 17 · SAME MET
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        <div>
          <div style={{ fontSize: "8px", color: "rgba(140,200,255,0.4)", marginBottom: "3px" }}>ARTEMIS II (NOW)</div>
          <div style={{ fontSize: "16px", fontWeight: "800", color: "#00ffc8", fontFamily: "monospace" }}>
            {distKm ? `${(distKm / 1000).toFixed(1)}×10³` : "—"}
            <span style={{ fontSize: "9px", color: "rgba(0,255,200,0.5)", marginLeft: "4px" }}>km</span>
          </div>
        </div>
        <div>
          <div style={{ fontSize: "8px", color: "rgba(140,200,255,0.4)", marginBottom: "3px" }}>APOLLO 17 · DEC 1972</div>
          <div style={{ fontSize: "16px", fontWeight: "800", color: "#ffd54f", fontFamily: "monospace" }}>
            {apolloDist ? `${(apolloDist / 1000).toFixed(1)}×10³` : "—"}
            <span style={{ fontSize: "9px", color: "rgba(255,213,79,0.5)", marginLeft: "4px" }}>km</span>
          </div>
        </div>

        {diff !== null && (
          <div style={{
            padding: "8px 10px", borderRadius: "8px",
            background: ahead ? "rgba(0,255,200,0.06)" : "rgba(255,180,60,0.06)",
            border: `1px solid ${ahead ? "rgba(0,255,200,0.15)" : "rgba(255,180,60,0.15)"}`,
          }}>
            <div style={{ fontSize: "8px", color: "rgba(140,200,255,0.4)", marginBottom: "2px" }}>DIFERENCIA</div>
            <div style={{ fontSize: "13px", fontWeight: "800", color: ahead ? "#00ffc8" : "#ffd54f", fontFamily: "monospace" }}>
              {ahead ? "+" : ""}{(diff / 1000).toFixed(1)}×10³ km
            </div>
            <div style={{ fontSize: "8px", color: "rgba(140,200,255,0.35)", marginTop: "2px" }}>
              Artemis II va {ahead ? "más lejos" : "más cerca"} a este MET
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Speedómetro con referencias de velocidad cotidianas ---
const SPEED_REFS = [
  { label: "Fórmula 1",  kmh: 360,    color: "#ff5252" },
  { label: "Avión",      kmh: 900,    color: "#ff9800" },
  { label: "Bala",       kmh: 3600,   color: "#ffd54f" },
  { label: "SR-71",      kmh: 3540,   color: "#ffd54f" },
  { label: "Sonido ×10", kmh: 12348,  color: "#69f0ae" },
];

function Speedometer({ speedKmS }) {
  const speedKmH = speedKmS ? speedKmS * 3600 : 0;
  const maxKmH = 40000;
  const angle = Math.min(180, (speedKmH / maxKmH) * 180);

  const needle = (deg) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return { x: 80 + Math.cos(rad) * 58, y: 80 + Math.sin(rad) * 58 };
  };

  const arcPath = (startDeg, endDeg, r, cx, cy) => {
    const s = ((startDeg - 90) * Math.PI) / 180;
    const e = ((endDeg - 90) * Math.PI) / 180;
    return `M ${cx + Math.cos(s) * r} ${cy + Math.sin(s) * r} A ${r} ${r} 0 ${endDeg - startDeg > 180 ? 1 : 0} 1 ${cx + Math.cos(e) * r} ${cy + Math.sin(e) * r}`;
  };

  const n = needle(angle);

  return (
    <div style={{
      background: "rgba(255,255,255,0.02)", border: "1px solid rgba(0,180,255,0.15)",
      borderRadius: "12px", padding: "16px", position: "relative", overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: "2px",
        background: "linear-gradient(90deg,#00b8ff,#00ffc8)",
      }} />
      <div style={{ fontSize: "9px", letterSpacing: "0.14em", color: "rgba(0,200,255,0.6)", marginBottom: "8px" }}>
        ◈ SPEEDOMETER
      </div>

      <div style={{ display: "flex", justifyContent: "center" }}>
        <svg width="160" height="95" viewBox="0 0 160 95">
          {/* Track arc */}
          <path d={arcPath(0, 180, 60, 80, 80)} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" strokeLinecap="round" />
          {/* Speed fill arc */}
          <path d={arcPath(0, angle, 60, 80, 80)} fill="none"
            stroke="url(#speedGrad)" strokeWidth="8" strokeLinecap="round" />
          <defs>
            <linearGradient id="speedGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#00ffc8" />
              <stop offset="100%" stopColor="#00b8ff" />
            </linearGradient>
          </defs>
          {/* Tick marks */}
          {[0, 45, 90, 135, 180].map((deg) => {
            const rad = ((deg - 90) * Math.PI) / 180;
            return (
              <line key={deg}
                x1={80 + Math.cos(rad) * 52} y1={80 + Math.sin(rad) * 52}
                x2={80 + Math.cos(rad) * 68} y2={80 + Math.sin(rad) * 68}
                stroke="rgba(140,200,255,0.2)" strokeWidth="1.5" />
            );
          })}
          {/* Needle */}
          <line x1="80" y1="80" x2={n.x} y2={n.y} stroke="#00ffc8" strokeWidth="2" strokeLinecap="round" />
          <circle cx="80" cy="80" r="4" fill="#00ffc8" />
          {/* Speed labels */}
          <text x="22" y="88" fill="rgba(140,200,255,0.35)" fontSize="7" fontFamily="monospace">0</text>
          <text x="130" y="88" fill="rgba(140,200,255,0.35)" fontSize="7" fontFamily="monospace">40k</text>
          <text x="72" y="30" fill="rgba(140,200,255,0.35)" fontSize="7" fontFamily="monospace">20k</text>
        </svg>
      </div>

      <div style={{ textAlign: "center", marginTop: "-8px" }}>
        <div style={{ fontSize: "20px", fontWeight: "900", color: "#00ffc8", fontFamily: "monospace", lineHeight: 1 }}>
          {speedKmH ? Math.round(speedKmH).toLocaleString() : "—"}
          <span style={{ fontSize: "10px", color: "rgba(0,255,200,0.5)", marginLeft: "4px" }}>km/h</span>
        </div>
        <div style={{ fontSize: "10px", color: "rgba(140,200,255,0.4)", marginTop: "2px" }}>
          {speedKmS ? `${speedKmS} km/s` : ""}
        </div>
      </div>

      {/* Reference comparisons */}
      <div style={{ marginTop: "10px", display: "flex", flexDirection: "column", gap: "4px" }}>
        {SPEED_REFS.slice(0, 3).map(ref => (
          <div key={ref.label} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <div style={{ fontSize: "8px", color: "rgba(140,200,255,0.35)", minWidth: "52px" }}>{ref.label}</div>
            <div style={{ flex: 1, height: "3px", background: "rgba(255,255,255,0.05)", borderRadius: "2px", overflow: "hidden" }}>
              <div style={{
                height: "100%", width: `${Math.min(100, (ref.kmh / speedKmH) * 100)}%`,
                background: ref.color, borderRadius: "2px",
              }} />
            </div>
            <div style={{ fontSize: "8px", color: ref.color, fontFamily: "monospace", minWidth: "32px", textAlign: "right" }}>
              {speedKmH > 0 ? `×${(speedKmH / ref.kmh).toFixed(1)}` : "—"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Tamaño angular de la Tierra visto desde Orion ---
function EarthAngularSize({ distKm }) {
  const EARTH_RADIUS_KM = 6371;
  const angularDiamDeg = distKm
    ? (2 * Math.atan(EARTH_RADIUS_KM / distKm) * (180 / Math.PI))
    : null;

  // At ISS (~420km): ~140°   At Moon: ~1.9°   At 90000km: ~8°
  const maxDeg = 20;
  const apparentR = angularDiamDeg ? Math.max(4, Math.min(55, (angularDiamDeg / maxDeg) * 55)) : 20;

  return (
    <div style={{
      background: "rgba(255,255,255,0.02)", border: "1px solid rgba(80,140,255,0.15)",
      borderRadius: "12px", padding: "16px", position: "relative", overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: "2px",
        background: "linear-gradient(90deg,#4488ff,#88aaff)",
      }} />
      <div style={{ fontSize: "9px", letterSpacing: "0.14em", color: "rgba(100,160,255,0.6)", marginBottom: "8px" }}>
        ◈ EARTH FROM ORION
      </div>

      {/* Space view simulation */}
      <div style={{
        height: "110px", background: "#000408", borderRadius: "8px",
        display: "flex", alignItems: "center", justifyContent: "center",
        position: "relative", overflow: "hidden", marginBottom: "10px",
        border: "1px solid rgba(255,255,255,0.04)",
      }}>
        {/* Stars */}
        {[...Array(30)].map((_, i) => (
          <div key={i} style={{
            position: "absolute",
            left: `${(Math.sin(i * 137.5) * 0.5 + 0.5) * 100}%`,
            top: `${(Math.cos(i * 97.3) * 0.5 + 0.5) * 100}%`,
            width: i % 7 === 0 ? "2px" : "1px",
            height: i % 7 === 0 ? "2px" : "1px",
            borderRadius: "50%",
            background: `rgba(255,255,255,${0.2 + (i % 5) * 0.1})`,
          }} />
        ))}
        {/* Earth */}
        <div style={{
          width: `${apparentR * 2}px`, height: `${apparentR * 2}px`,
          borderRadius: "50%", flexShrink: 0,
          background: "radial-gradient(circle at 35% 35%, #7dd8f8, #2196f3 45%, #1040a0 75%, #020c2a)",
          boxShadow: `0 0 ${apparentR * 0.8}px rgba(30,120,255,0.4)`,
          position: "relative", overflow: "hidden",
          transition: "width 1s ease, height 1s ease",
        }}>
          <div style={{
            position: "absolute", inset: 0, borderRadius: "50%",
            background: "linear-gradient(120deg,rgba(60,180,60,0.3) 20%,transparent 60%,rgba(60,180,60,0.15) 80%)",
          }} />
          <div style={{
            position: "absolute", inset: 0, borderRadius: "50%",
            background: "linear-gradient(to right,rgba(0,0,10,0.45),transparent)",
          }} />
        </div>
      </div>

      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: "18px", fontWeight: "800", color: "#7ab4ff", fontFamily: "monospace" }}>
          {angularDiamDeg ? angularDiamDeg.toFixed(2) : "—"}°
        </div>
        <div style={{ fontSize: "9px", color: "rgba(140,200,255,0.4)", marginTop: "2px" }}>
          diámetro angular de la Tierra
        </div>
        <div style={{ fontSize: "8px", color: "rgba(140,200,255,0.25)", marginTop: "6px" }}>
          ISS ≈ 140° · Luna ≈ 1.9° · Marte ≈ 0.006°
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [telemetry, setTelemetry] = useState(null);
  const [error, setError] = useState(null);
  const [lastFetch, setLastFetch] = useState(null);
  const [history, setHistory] = useState([]);
  const met = useMET();

  const fetchTelemetry = async () => {
    try {
      const res = await fetch(`${API}/telemetry`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setTelemetry(data);
      setLastFetch(new Date());
      setError(null);
      setHistory(prev => {
        const entry = { ts: Date.now(), distKm: data.distanceFromEarthKm, speed: data.speedKmS };
        const next = [...prev, entry];
        return next.length > 80 ? next.slice(-80) : next;
      });
    } catch (e) {
      setError(e.message);
    }
  };

  useEffect(() => {
    fetchTelemetry();
    const id = setInterval(fetchTelemetry, 30000);
    return () => clearInterval(id);
  }, []);

  const phaseColors = {
    "Earth Orbit": "#4fc3f7",
    "Translunar Coast": "#00ffc8",
    "Lunar Flyby": "#ffd54f",
    "Return to Earth": "#ff7043",
    "Reentry": "#ef5350",
    "Mission Complete": "#69f0ae",
  };
  const phaseColor = phaseColors[telemetry?.phase] || "#00ffc8";

  return (
    <div style={{ minHeight: "100vh", background: "#000a1a", color: "#e0f0ff", fontFamily: "monospace", position: "relative", overflow: "hidden" }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes blink { 50%{opacity:0} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.2} }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-thumb { background: rgba(0,255,200,0.2); border-radius:2px; }
        input::placeholder { color: rgba(100,180,255,0.3); }
      `}</style>

      {/* Grid background */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none",
        backgroundImage: "linear-gradient(rgba(0,255,200,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(0,255,200,0.025) 1px,transparent 1px)",
        backgroundSize: "44px 44px",
      }} />

      <div style={{ maxWidth: "980px", margin: "0 auto", padding: "22px 16px", animation: "fadeUp 0.5s ease" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "22px", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "3px" }}>
              <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: error ? "#ff5252" : "#00ffc8", animation: "pulse 1.8s infinite" }} />
              <span style={{ fontSize: "9px", letterSpacing: "0.22em", color: error ? "#ff7070" : "rgba(0,255,200,0.65)" }}>
                {error ? "BACKEND OFFLINE" : "LIVE · JPL HORIZONS"}
              </span>
              {lastFetch && !error && (
                <span style={{ fontSize: "9px", color: "rgba(100,160,255,0.4)" }}>
                  · upd {lastFetch.toLocaleTimeString()}
                </span>
              )}
            </div>
            <h1 style={{ fontSize: "clamp(24px,5vw,36px)", fontWeight: "900", color: "#fff", letterSpacing: "-0.02em", lineHeight: 1 }}>
              ARTEMIS II
            </h1>
            <div style={{ fontSize: "11px", color: "rgba(140,200,255,0.5)", marginTop: "5px", letterSpacing: "0.09em" }}>
              FIRST CREWED LUNAR MISSION SINCE APOLLO 17 · 1972
            </div>
          </div>

          <div style={{ textAlign: "right" }}>
            <div style={{
              display: "inline-block", padding: "5px 14px", borderRadius: "20px",
              background: `${phaseColor}15`, border: `1px solid ${phaseColor}35`,
              color: phaseColor, fontSize: "10px", fontWeight: "800", letterSpacing: "0.1em", marginBottom: "5px",
            }}>
              {telemetry?.phase?.toUpperCase() || "CONNECTING..."}
            </div>
            <div style={{ fontSize: "12px", color: "rgba(140,200,255,0.5)", fontFamily: "monospace" }}>
              MET {formatDuration(met)}
            </div>
          </div>
        </div>

        {error && (
          <div style={{
            background: "rgba(255,80,80,0.08)", border: "1px solid rgba(255,80,80,0.25)",
            borderRadius: "10px", padding: "12px 16px", marginBottom: "18px",
            fontSize: "12px", color: "#ff9090",
          }}>
            ⚠ Backend offline: {error}
            <br />
            <span style={{ color: "rgba(255,150,150,0.6)", fontSize: "11px" }}>
              Asegurate de correr <code>node server.js</code> en otra terminal.
            </span>
          </div>
        )}

        {/* Progress bar */}
        <div style={{ marginBottom: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "9px", color: "rgba(140,200,255,0.4)", marginBottom: "5px", letterSpacing: "0.09em" }}>
            <span>LAUNCH · APR 1</span>
            <span>PROGRESS {telemetry?.missionProgress?.toFixed(1) || "0.0"}%</span>
            <span>SPLASHDOWN · APR 11</span>
          </div>
          <div style={{ height: "5px", background: "rgba(255,255,255,0.05)", borderRadius: "3px", overflow: "hidden" }}>
            <div style={{
              height: "100%",
              width: `${telemetry?.missionProgress || 0}%`,
              background: `linear-gradient(90deg, #00ffc8, ${phaseColor})`,
              borderRadius: "3px",
              transition: "width 2s ease",
              boxShadow: `0 0 8px ${phaseColor}60`,
            }} />
          </div>
        </div>

        {/* Orbit visualizer */}
        <div style={{
          background: "rgba(0,10,26,0.7)", border: "1px solid rgba(0,255,200,0.08)",
          borderRadius: "12px", padding: "14px", marginBottom: "18px",
        }}>
          <div style={{ fontSize: "9px", letterSpacing: "0.16em", color: "rgba(0,255,200,0.45)", marginBottom: "10px" }}>
            ◈ TRAJECTORY · DATA: NASA/JPL HORIZONS (ID -1024)
          </div>
          <OrbitCanvas telemetry={telemetry} />
        </div>

        {/* Mission Timeline */}
        <MissionTimeline />

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: "10px", marginBottom: "0" }}>
          <Stat
            label="DIST FROM EARTH"
            value={telemetry ? (telemetry.distanceFromEarthKm / 1000).toFixed(1) : "—"}
            unit="×10³ km"
            sub={telemetry ? `${telemetry.distanceFromEarthKm.toLocaleString()} km` : ""}
          />
          <Stat
            label="DIST FROM MOON"
            value={telemetry ? Math.round(telemetry.distanceFromMoonKm / 1000) : "—"}
            unit="×10³ km"
            color="rgba(200,180,80,0.35)"
          />
          <Stat
            label="VELOCITY"
            value={telemetry?.speedKmS || "—"}
            unit="km/s"
            sub={telemetry ? `${(telemetry.speedKmS * 3600).toFixed(0)} km/h` : ""}
            color="rgba(0,180,255,0.35)"
          />
          <Stat
            label="ALTITUDE"
            value={telemetry ? Math.round(telemetry.altitudeKm).toLocaleString() : "—"}
            unit="km"
            color="rgba(150,100,255,0.3)"
          />
          <SignalDelay distKm={telemetry?.distanceFromEarthKm} />
        </div>

        {/* Distance comparison */}
        <DistanceComparison distKm={telemetry?.distanceFromEarthKm} />

        {/* Chart + Vectors */}
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "14px", marginBottom: "18px" }}>
          <TelemetryChart history={history} />
          <VectorPanel telemetry={telemetry} />
        </div>

        {/* Apollo + Speedometer + Earth size */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "14px", marginBottom: "18px" }}>
          <ApolloComparison elapsedDays={telemetry?.elapsedDays} distKm={telemetry?.distanceFromEarthKm} />
          <Speedometer speedKmS={telemetry?.speedKmS} />
          <EarthAngularSize distKm={telemetry?.distanceFromEarthKm} />
        </div>

        {/* Crew */}
        <div style={{
          background: "rgba(255,255,255,0.02)", border: "1px solid rgba(0,255,200,0.08)",
          borderRadius: "12px", padding: "16px",
        }}>
          <div style={{ fontSize: "9px", letterSpacing: "0.16em", color: "rgba(0,255,200,0.45)", marginBottom: "14px" }}>
            ◈ CREW MANIFEST
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0" }}>
            {[
              { name: "Reid Wiseman",  role: "CDR", flag: "🇺🇸", note: "Commander" },
              { name: "Victor Glover", role: "PLT", flag: "🇺🇸", note: "1st POC beyond LEO" },
              { name: "Christina Koch",role: "MS1", flag: "🇺🇸", note: "1st woman beyond LEO" },
              { name: "Jeremy Hansen", role: "MS2", flag: "🇨🇦", note: "1st non-US beyond LEO" },
            ].map((c) => (
              <div key={c.name} style={{
                display: "flex", alignItems: "center", gap: "10px",
                padding: "9px 12px", borderBottom: "1px solid rgba(255,255,255,0.03)",
              }}>
                <div style={{
                  width: "34px", height: "34px", borderRadius: "50%", flexShrink: 0,
                  background: "rgba(0,255,200,0.08)", border: "1px solid rgba(0,255,200,0.18)",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px",
                }}>
                  {c.flag}
                </div>
                <div>
                  <div style={{ fontSize: "12px", color: "#e0f4ff", fontWeight: "700" }}>{c.name}</div>
                  <div style={{ fontSize: "9px", color: "rgba(0,255,200,0.55)", letterSpacing: "0.08em" }}>{c.role} · {c.note}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: "14px", padding: "10px 12px", background: "rgba(0,255,200,0.03)", borderRadius: "8px", border: "1px solid rgba(0,255,200,0.07)" }}>
            <div style={{ fontSize: "9px", color: "rgba(140,200,255,0.4)", marginBottom: "3px", letterSpacing: "0.1em" }}>SPLASHDOWN</div>
            <div style={{ fontSize: "12px", color: "#e0f4ff" }}>April 11, 2026 · Pacific Ocean · off San Diego</div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ textAlign: "center", marginTop: "24px", fontSize: "9px", color: "rgba(140,200,255,0.2)", letterSpacing: "0.1em" }}>
          TELEMETRY: NASA/JPL HORIZONS API · ORION ID -1024 · REFRESH 30s · NOT AFFILIATED WITH NASA
        </div>
      </div>
    </div>
  );
}
