/*
  MOTOR DE RELACIONES: partículas + vínculos explícitos
  -----------------------------------------------------
  Partícula = una persona. Dos tipos: JUVENTUD (liviana, rápida, cyan) y
  EXPERIENCIA (pesada, lenta, plateada). Un grupo vinculado se lee como generación/actor.
  Vínculo   = resorte entre dos partículas = una RELACIÓN. Propiedades:
    s (0..1)  fuerza/confianza: más s, más rígido, más visible, más difícil de romper.
    m (0..1)  memoria: crece cuando pasa energía por el vínculo (el impacto deja huella).
  Relevo    = la energía (p.e) de una partícula se transmite por los vínculos, proporcional a s.
  Cada escena (un momento del guion) define: dónde va cada partícula (layout),
  qué relaciones se permiten (allowed) y cuándo se dispara un pulso (pulse).
*/
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (x) => { const t = clamp(x, 0, 1); return t * t * (3 - 2 * t); };
const unit = (s) => { const x = Math.sin(s * 999.91) * 10000; return x - Math.floor(x); };
const rgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const rgba = (h, a) => { const [r, g, b] = rgb(h); return `rgba(${r},${g},${b},${a})`; };
const mix = (a, b, t) => {
  const A = rgb(a), B = rgb(b);
  return "#" + A.map((v, i) => Math.round(lerp(v, B[i], clamp(t, 0, 1))).toString(16).padStart(2, "0")).join("");
};
const val = (x, t) => (typeof x === "function" ? x(t) : x);

function buildScenes() {
  const P = CONFIG.palette;
  const Y = P.eventCyan, E = P.eventSilver, RED = P.eventRed, MAG = P.eventMagenta;
  const GRP = [Y, RED, MAG];
  const typeColor = (p) => (p.young ? Y : E);
  const anchors = (c) => [[c.W * 0.58, c.H * 0.28], [c.W * 0.78, c.H * 0.62], [c.W * 0.43, c.H * 0.66]];
  const wander = (p, t, c, spread = 1) => {
    const a = p.u * TAU + t * 0.03 * (p.g - 1);
    const r = c.R * (1.4 + p.v * 2.6) * spread;
    return [c.cx + Math.cos(a) * r * 1.15, c.cy + Math.sin(a) * r * 0.62, 0.5];
  };
  const orbitAt = (p, t, x, y, c, r0, r1, sp) => {
    const a = p.u * TAU + t * sp * (p.g % 2 ? -1 : 1);
    const r = c.R * (r0 + p.v * (r1 - r0));
    return [x + Math.cos(a) * r, y + Math.sin(a) * r * 0.7, 1];
  };
  const grpBond = (a, b) => (a.g === b.g ? GRP[a.g] : E);
  // Arco (slides 12-13): la juventud sube por la izquierda, la experiencia por la derecha, y se encuentran arriba.
  const archPos = (p, ax, ay, w, h) => {
    const u = Math.floor(p.i / 2) / 31, s = p.young ? -1 : 1;
    return [ax + s * w * Math.cos((u * Math.PI) / 2), ay - h * Math.sin((u * Math.PI) / 2), 2];
  };
  const join = (p) => 0.6 + Math.floor(p.i / 2) * 0.34;
  const archBond = (a, b, t, instant) => {
    if (a.i >= 64 || b.i >= 64) return 0;
    if (!instant && (t < join(a) || t < join(b))) return 0;
    const ua = Math.floor(a.i / 2), ub = Math.floor(b.i / 2);
    if (a.young === b.young) return Math.abs(ua - ub) <= 3 ? 0.9 : 0;
    return ua >= 29 && ub >= 29 ? 0.9 : 0;
  };
  // Dos generaciones orbitando una visión: cada una ocupa su semicírculo y, con m, se entrelazan.
  const dual = (p, t, c, m) => {
    const hw = Math.PI * (0.45 + 0.55 * m);
    const center = p.young ? Math.PI : 0;
    const a = center + Math.sin(t * (p.young ? 0.5 : 0.15) + p.u * TAU) * hw;
    const r = p.young ? c.R * lerp(1.5 + p.v * 1.0, 0.9 + p.v * 1.2, m) : c.R * (0.9 + p.v * 0.7);
    return [c.cx + Math.cos(a) * r * 1.1, c.cy + Math.sin(a) * r * 0.75, 1.2];
  };

  return {
    // 1. Sin vínculos: potencial que nadie aprovecha.
    "relevo-generacional": {
      layout: (p, t, c) => wander(p, t, c), allowed: () => 0, link: 1, tint: () => E, vis: () => 0.55,
    },
    // 2. Filas rígidas orientadas al escenario, quietas y sin relación entre sí.
    "auditorio-grados": {
      layout: (p, t, c) => [c.W * (0.5 + ((p.i % 12) / 11) * 0.38), c.H * (0.24 + (Math.floor(p.i / 12) / 11) * 0.5), 1.5],
      allowed: () => 0, link: 1, jit: 0, tint: () => mix(E, "#777777", 0.4), vis: () => 0.7,
    },
    // 3. Los de adentro salen, los de afuera entran; solo se vinculan al cruzarse (adentro-afuera).
    "universidad-mundo": {
      layout: (p, t, c) => {
        const k = smooth(t / 7);
        if (p.i % 2 === 0) { const a = p.u * TAU + t * 0.05, r = c.R * (0.5 + p.v * 0.9 + 0.9 * k); return [c.cx + Math.cos(a) * r, c.cy + Math.sin(a) * r * 0.7, 1]; }
        const a = p.u * TAU, r = c.R * (4.4 - 3.1 * k + p.v * 0.6);
        return [c.cx + Math.cos(a) * r * 1.1, c.cy + Math.sin(a) * r * 0.6, 1];
      },
      allowed: (a, b) => ((a.i % 2) !== (b.i % 2) ? 0.35 : 0), link: 1.0, cap: 3, jit: 0.2,
      tint: (p) => (p.i % 2 === 0 ? E : Y), bond: () => Y,
    },
    // 4. Tres actores: vínculos fuertes dentro del grupo, apenas puentes entre grupos.
    "academia-industria-ciudad": {
      layout: (p, t, c) => { const A = anchors(c)[p.g]; return orbitAt(p, t, A[0], A[1], c, 0.35, 0.9, 0.15); },
      allowed: (a, b) => (a.g === b.g ? 0.55 : (a.i + b.i) % 23 === 0 ? 0.2 : 0),
      link: 0.9, cap: 5, tint: (p) => GRP[p.g], bond: grpBond,
    },
    // 5. Los grupos se acercan; un pulso (el evento) recorre la red y deja huella en los vínculos (el impacto).
    impacto: {
      layout: (p, t, c) => {
        const q = 0.45 * smooth(t / 5), A = anchors(c)[p.g];
        return orbitAt(p, t, lerp(A[0], c.cx, q), lerp(A[1], c.cy, q), c, 0.3, 0.8, 0.15);
      },
      allowed: (a, b, t) => (a.g === b.g ? 0.6 : t > 4 && (a.i + b.i) % 3 === 0 ? 0.4 : 0),
      link: 1.0, cap: 5, pulse: 2.0, scar: true, tint: (p) => GRP[p.g], bond: grpBond,
    },
    // 6. Primero personas sueltas; luego se vinculan y el conjunto se mueve como un solo cuerpo.
    comunidad: {
      layout: (p, t, c) => {
        const a = p.u * TAU + t * 0.1, r = c.R * (0.3 + p.v * 1.5) * (1.6 - 0.8 * smooth((t - 3) / 4));
        return [c.cx + Math.cos(a) * r * 1.1, c.cy + Math.sin(a) * r * 0.7, 1];
      },
      allowed: (a, b, t) => (t < 3 ? 0 : 0.6 * smooth((t - 3) / 3)),
      link: 0.8, cap: 6, pulse: (t) => (t > 5 ? 2.6 : 0),
      tint: (p, t) => mix(E, Y, smooth((t - 3) / 3)), bond: () => Y,
    },
    // 7. La confianza gobierna: sube la rigidez, la red crece y los vínculos no se rompen.
    confianza: {
      layout: (p, t, c) => {
        const k = 0.15 + 0.85 * smooth(t / 10), a = p.u * TAU + t * 0.04, r = c.R * (0.9 + k * 1.6 * (0.5 + p.v));
        return [c.cx + Math.cos(a) * r, c.cy + Math.sin(a) * r * 0.55, 1];
      },
      allowed: (a, b, t) => 0.15 + 0.85 * smooth(t / 10),
      link: (t) => 0.7 + 0.9 * smooth(t / 10), cap: (t) => 3 + Math.floor(5 * smooth(t / 10)),
      pulse: (t) => 3.2 - 2 * smooth(t / 10),
      tint: (p, t) => mix(E, MAG, smooth(t / 10)), bond: (a, b, t) => mix(E, MAG, smooth(t / 10)),
    },
    // 8. La experiencia traza un camino (estela); la juventud abre una ruta nueva y luego otros la siguen.
    "nuevas-rutas": {
      layout: (p, t, c) => {
        const onNew = p.young || (p.i % 3 === 0 && t > 6);
        const ang = t * (onNew ? 0.35 : 0.25) + p.u * 0.8;
        if (onNew) return [c.cx + Math.cos(ang * 1.3) * c.R * 3.4 * 0.9, c.cy + Math.sin(ang * 0.9) * c.R * 1.9, 2.2];
        return [c.cx + Math.cos(ang) * c.R * 3, c.cy + Math.sin(ang) * c.R * 1.6, 2.2];
      },
      allowed: () => 0, link: 1, jit: 0.1, trail: true, tint: typeColor, vis: () => 0.9,
    },
    // 9. Dos generaciones, una visión: coexisten sin mezclarse. Juventud = vínculos débiles; experiencia = fuertes.
    "vision-generaciones": {
      layout: (p, t, c) => dual(p, t, c, 0),
      allowed: (a, b) => (a.young !== b.young ? 0 : a.young ? 0.12 : 0.8),
      link: 0.9, cap: 4, pulse: 3, dashYoung: true, vision: () => 0.6, tint: typeColor,
    },
    // 10. Se entrelazan: aparecen vínculos entre generaciones y el conjunto crece.
    "trabajan-juntas": {
      layout: (p, t, c) => dual(p, t, c, smooth(t / 7)),
      allowed: (a, b, t) => (a.young === b.young ? 0.5 : 0.9 * smooth((t - 1) / 6)),
      link: 1.0, cap: 6, pulse: 1.6, vision: (t) => 0.6 + 0.4 * smooth(t / 7), tint: typeColor,
    },
    // 11. La juventud pasa al frente y activa a la experiencia: los pulsos nacen en los jóvenes.
    "presente-joven": {
      layout: (p, t, c) => (p.young ? orbitAt(p, t, c.cx, c.cy, c, 0.6, 1.9, 0.22) : orbitAt(p, t, c.cx, c.cy, c, 1.7, 3.3, 0.1)),
      allowed: (a, b) => (a.young && b.young ? 0.8 : a.young !== b.young ? 0.5 : 0.3),
      link: 1.0, cap: 6, pulse: 1.4, source: (p) => p.young,
      tint: typeColor, vis: (p) => (p.young ? 1 : 0.4), size: (p) => (p.young ? 1.5 : 0.9),
    },
    // 12. El futuro se construye: las partículas se suman una a una a un arco entre dos generaciones.
    "futuro-construido": {
      layout: (p, t, c) => (p.i < 64 && t > join(p) ? archPos(p, c.W * 0.64, c.H * 0.74, c.W * 0.24, c.H * 0.46) : wander(p, t, c, 0.9)),
      allowed: (a, b, t) => archBond(a, b, t, false),
      link: 0.55, rest: 0.2, cap: 5, pulse: 1.2, source: (p, t) => p.i < 64 && t > join(p), tint: typeColor,
    },
    // 13. Estructura completa y respirando: la energía no se apaga.
    "qr-cierre": {
      layout: (p, t, c) => {
        if (p.i < 64) return archPos(p, c.W * 0.6, c.H * 0.58, c.W * 0.2 * (1 + 0.02 * Math.sin(t)), c.H * 0.32 * (1 + 0.02 * Math.sin(t)));
        return wander(p, t, c, 0.9);
      },
      allowed: (a, b, t) => (a.i < 64 && b.i < 64 ? archBond(a, b, t, true) : a.i >= 64 && b.i >= 64 ? 0.3 : 0),
      link: 0.6, rest: 0.2, cap: 5, pulse: 1.0, tint: typeColor,
    },
  };
}

class VisualSystem {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.width = 1; this.height = 1; this.dpr = 1;
    this.time = 0; this.mt = 0; this.frame = 0; this.lastPulse = 0;
    this.current = null;
    this.scenes = buildScenes();
    this.scene = this.scenes["relevo-generacional"];
    this.bonds = new Map();
    this.particles = Array.from({ length: CONFIG.particleCount }, (_, i) => ({
      i, u: unit(i + 4), v: unit(i + 18), g: i % 3, young: i % 2 === 0, drift: unit(i + 88) * TAU,
      x: 0, y: 0, vx: 0, vy: 0, e: 0, hist: [],
    }));
    this.resize();
    for (const p of this.particles) { p.x = this.width * unit(p.i + 4); p.y = this.height * unit(p.i + 30); }
    window.addEventListener("resize", () => this.resize());
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = Math.max(1, rect.width);
    this.height = Math.max(1, rect.height);
    this.canvas.width = Math.floor(this.width * this.dpr);
    this.canvas.height = Math.floor(this.height * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  setMoment(moment) {
    this.current = moment;
    this.scene = this.scenes[moment.id] || this.scenes["relevo-generacional"];
    this.mt = 0;
    this.lastPulse = 0;
    if (!this.scene.trail) for (const p of this.particles) p.hist.length = 0;
  }

  hasBackgroundAsset() {
    const a = CONFIG.assets.byMoment?.[this.current?.id];
    return (a === false ? null : a || this.current?.asset)?.placement === "background";
  }

  frameCtx() {
    const W = this.width, H = this.height;
    return { W, H, cx: W * 0.64, cy: H * 0.46, R: Math.min(W, H) * 0.16 };
  }

  // Crea, refuerza, debilita y rompe vínculos según lo que permita la escena.
  updateBonds(S, t, c) {
    const N = this.particles.length, deg = new Array(N).fill(0);
    const maxD = val(S.link ?? 1, t) * c.R, cap = val(S.cap ?? 5, t);
    for (const [key, b] of this.bonds) {
      const d = Math.hypot(b.a.x - b.b.x, b.a.y - b.b.y);
      const k = d > maxD * 1.3 ? 0 : S.allowed(b.a, b.b, t);
      b.s = k > 0 ? b.s + (k - b.s) * 0.03 : b.s - 0.03;
      if (b.s <= 0.01) { this.bonds.delete(key); continue; }
      deg[b.a.i] += 1; deg[b.b.i] += 1;
    }
    if (this.frame % 6) return;
    const ps = this.particles;
    for (let i = 0; i < N; i += 1) {
      if (deg[i] >= cap) continue;
      for (let j = i + 1; j < N; j += 1) {
        if (deg[j] >= cap || this.bonds.has(i * 1000 + j)) continue;
        if (Math.hypot(ps[i].x - ps[j].x, ps[i].y - ps[j].y) > maxD) continue;
        if (S.allowed(ps[i], ps[j], t) <= 0) continue;
        this.bonds.set(i * 1000 + j, { a: ps[i], b: ps[j], s: 0.02, m: 0 });
        deg[i] += 1; deg[j] += 1;
        if (deg[i] >= cap) break;
      }
    }
  }

  step() {
    const S = this.scene, t = this.mt, c = this.frameCtx();
    this.updateBonds(S, t, c);
    const ps = this.particles;
    for (const p of ps) {
      const [tx, ty, pull] = S.layout(p, t, c);
      const j = (S.jit ?? 0.35) * (p.young ? 1 : 0.4);
      p.ax = (tx - p.x) * 0.012 * pull + Math.sin(this.time * 0.9 + p.drift) * 0.02 * j;
      p.ay = (ty - p.y) * 0.012 * pull + Math.cos(this.time * 0.8 + p.drift * 1.3) * 0.02 * j;
    }
    const rest = (S.rest ?? 0.45) * c.R;
    for (const b of this.bonds.values()) {
      const dx = b.b.x - b.a.x, dy = b.b.y - b.a.y, d = Math.hypot(dx, dy) || 1;
      const f = (d - rest) * b.s * 0.01, fx = (dx / d) * f, fy = (dy / d) * f;
      b.a.ax += fx / (b.a.young ? 0.7 : 1.4); b.a.ay += fy / (b.a.young ? 0.7 : 1.4);
      b.b.ax -= fx / (b.b.young ? 0.7 : 1.4); b.b.ay -= fy / (b.b.young ? 0.7 : 1.4);
      // Relevo: la energía pasa de una partícula a la otra según la fuerza del vínculo.
      const flow = (b.a.e - b.b.e) * b.s * 0.2;
      b.a.e -= flow; b.b.e += flow;
      b.hot = b.a.e + b.b.e;
      b.m = Math.min(1, b.m * 0.9995 + b.hot * 0.01 * b.s);
    }
    const interval = val(S.pulse ?? 0, t);
    if (interval > 0 && t - this.lastPulse > interval) {
      this.lastPulse = t;
      const pool = ps.filter((p) => !S.source || S.source(p, t));
      if (pool.length) pool[Math.floor(Math.random() * pool.length)].e = 1.6;
    }
    for (const p of ps) {
      p.vx = (p.vx + p.ax) * 0.8; p.vy = (p.vy + p.ay) * 0.8;
      p.x += clamp(p.vx, -14, 14); p.y += clamp(p.vy, -14, 14);
      p.e *= 0.985;
      if (S.trail && this.frame % 2 === 0) { p.hist.push([p.x, p.y]); if (p.hist.length > 26) p.hist.shift(); }
    }
  }

  render() {
    this.time += 1 / 60; this.mt += 1 / 60; this.frame += 1;
    this.step();
    const ctx = this.ctx, S = this.scene, t = this.mt;
    ctx.clearRect(0, 0, this.width, this.height);
    const c = this.frameCtx();
    if (S.vision) {
      const g = ctx.createRadialGradient(c.cx, c.cy, 0, c.cx, c.cy, c.R * 0.9);
      g.addColorStop(0, rgba("#ffffff", 0.34 * S.vision(t))); g.addColorStop(1, rgba("#ffffff", 0));
      ctx.fillStyle = g; ctx.fillRect(c.cx - c.R, c.cy - c.R, c.R * 2, c.R * 2);
    }
    if (S.trail) {
      for (const p of this.particles) {
        const col = S.tint(p, t);
        for (let k = 1; k < p.hist.length; k += 1) {
          ctx.strokeStyle = rgba(col, (k / p.hist.length) * 0.4); ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.moveTo(p.hist[k - 1][0], p.hist[k - 1][1]); ctx.lineTo(p.hist[k][0], p.hist[k][1]); ctx.stroke();
        }
      }
    }
    for (const b of this.bonds.values()) {
      const col = S.bond ? S.bond(b.a, b.b, t) : b.a.young === b.b.young ? (b.a.young ? CONFIG.palette.eventCyan : CONFIG.palette.eventSilver) : CONFIG.palette.eventMagenta;
      ctx.setLineDash(S.dashYoung && b.a.young && b.b.young ? [3, 6] : []);
      ctx.strokeStyle = rgba(col, Math.min(0.9, 0.08 + 0.55 * b.s + 0.5 * Math.min(1, b.hot || 0)));
      ctx.lineWidth = 0.6 + 1.6 * b.s;
      ctx.beginPath(); ctx.moveTo(b.a.x, b.a.y); ctx.lineTo(b.b.x, b.b.y); ctx.stroke();
      if (S.scar && b.m > 0.15) {
        ctx.setLineDash([]); ctx.strokeStyle = rgba(CONFIG.palette.eventRed, b.m * 0.55); ctx.lineWidth = 1.8;
        ctx.beginPath(); ctx.moveTo(b.a.x, b.a.y); ctx.lineTo(b.b.x, b.b.y); ctx.stroke();
      }
    }
    ctx.setLineDash([]);
    for (const p of this.particles) {
      const vis = S.vis ? S.vis(p, t) : 1, r = (p.young ? 2.2 : 3.2) * (S.size ? S.size(p) : 1) * (1 + p.e * 1.1), col = S.tint(p, t);
      if (p.e > 0.25) { ctx.fillStyle = rgba(col, Math.min(0.3, p.e * 0.25)); ctx.beginPath(); ctx.arc(p.x, p.y, r * 3.2, 0, TAU); ctx.fill(); }
      ctx.fillStyle = rgba(col, Math.min(0.95, 0.8 * vis + p.e * 0.4));
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.fill();
    }
  }
}
