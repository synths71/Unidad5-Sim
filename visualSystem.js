/*
  MOTOR DE RELACIONES v2: partículas + vínculos con consecuencias
  ----------------------------------------------------------------
  Partícula = una persona. Dos tipos: JUVENTUD (liviana, rápida, cyan) y
  EXPERIENCIA (pesada, lenta, plateada).

  Vínculo = resorte entre dos partículas = una RELACIÓN. Propiedades:
    s (0..1)  CONFIANZA: más s, más rígido, más visible, más difícil de romper.
    m (0..1)  MEMORIA: crece cada vez que pasa energía por el vínculo (el uso deja huella).
              La memoria hace que el vínculo resista más a romperse y pueda llegar a más confianza.

  Relevo = la energía (p.e) pasa de una partícula a otra por los vínculos, proporcional a s.
           Se ve como paquetes de luz que viajan por la línea.

  CONSECUENCIAS (lo que hace que una relación sea relación y no decoración):
    1. La confianza se gana con el uso: cada paso de energía refuerza el vínculo (m sube, el techo de s sube).
    2. Sin uso ni memoria, el vínculo se debilita y se rompe (aparece un destello rojo al romperse).
    3. Cuando la energía cruza entre generaciones, CAMBIA A AMBOS (p.k = influencia mutua):
         la experiencia se tiñe de energía joven; la juventud gana un poco de estructura (más blanca, menos errática).
    4. En el slide 8, la experiencia adopta la ruta nueva SOLO si tiene un vínculo con un joven (p.route).

  Cada escena (un momento del guion) define: dónde va cada partícula (layout),
  qué relaciones se permiten (allowed) y cuándo se dispara un pulso (pulse).

  Tecla M: muestra/oculta las métricas de relaciones (vínculos, confianza media, % entre generaciones).
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
  const Y = P.eventCyan, E = P.eventSilver, RED = P.eventRed, MAG = P.eventMagenta, WHITE = "#ffffff";
  const GRP = [Y, RED, MAG];
  const typeColor = (p) => (p.young ? Y : E);
  // Color según influencia mutua (p.k): la experiencia se tiñe de cyan; la juventud se "asienta" (más blanca).
  const kTint = (p) => (p.young ? mix(Y, WHITE, 0.5 * p.k) : mix(E, Y, p.k));
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
      layout: (p, t, c) => wander(p, t, c), allowed: () => 0, link: 1, tint: () => E, vis: () => 0.55, resetK: true, micro: false,
    },
    // 2. Filas rígidas orientadas al escenario, quietas y sin relación entre sí.
    "auditorio-grados": {
      layout: (p, t, c) => [c.W * (0.5 + ((p.i % 12) / 11) * 0.38), c.H * (0.24 + (Math.floor(p.i / 12) / 11) * 0.5), 1.5],
      allowed: () => 0, link: 1, jit: 0, tint: () => mix(E, "#777777", 0.4), vis: () => 0.7, resetK: true, micro: false,
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
      tint: (p) => (p.i % 2 === 0 ? E : Y), bond: () => Y, resetK: true,
    },
    // 4. Tres actores: vínculos fuertes dentro del grupo; los puentes entre grupos son débiles,
    //    pero cuando por ellos pasa energía se fortalecen solos (la relación se gana con el uso).
    "academia-industria-ciudad": {
      layout: (p, t, c) => { const A = anchors(c)[p.g]; return orbitAt(p, t, A[0], A[1], c, 0.35, 0.9, 0.15); },
      allowed: (a, b) => (a.g === b.g ? 0.55 : (a.i + b.i) % 23 === 0 ? 0.2 : 0),
      link: 0.9, cap: 5, pulse: 3.2, tint: (p) => GRP[p.g], bond: grpBond, resetK: true,
    },
    // 5. Los grupos se acercan; un pulso (el evento) recorre la red y deja huella en los vínculos (el impacto).
    impacto: {
      layout: (p, t, c) => {
        const q = 0.45 * smooth(t / 5), A = anchors(c)[p.g];
        return orbitAt(p, t, lerp(A[0], c.cx, q), lerp(A[1], c.cy, q), c, 0.3, 0.8, 0.15);
      },
      allowed: (a, b, t) => (a.g === b.g ? 0.6 : t > 4 && (a.i + b.i) % 3 === 0 ? 0.4 : 0),
      link: 1.0, cap: 5, pulse: 2.0, scar: true, ripple: true, tint: (p) => GRP[p.g], bond: grpBond, resetK: true,
    },
    // 6. Primero personas sueltas; luego se vinculan y el conjunto se mueve como un solo cuerpo.
    comunidad: {
      layout: (p, t, c) => {
        const a = p.u * TAU + t * 0.1, r = c.R * (0.3 + p.v * 1.5) * (1.6 - 0.8 * smooth((t - 3) / 4));
        return [c.cx + Math.cos(a) * r * 1.1, c.cy + Math.sin(a) * r * 0.7, 1];
      },
      allowed: (a, b, t) => (t < 3 ? 0 : 0.6 * smooth((t - 3) / 3)),
      link: 0.8, cap: 6, pulse: (t) => (t > 5 ? 2.6 : 0),
      tint: (p, t) => mix(E, Y, smooth((t - 3) / 3)), bond: () => Y, resetK: true,
    },
    // 7. La confianza gobierna: sube la rigidez, la red crece y los vínculos que se usan no se rompen.
    confianza: {
      layout: (p, t, c) => {
        const k = 0.15 + 0.85 * smooth(t / 10), a = p.u * TAU + t * 0.04, r = c.R * (0.9 + k * 1.6 * (0.5 + p.v));
        return [c.cx + Math.cos(a) * r, c.cy + Math.sin(a) * r * 0.55, 1];
      },
      allowed: (a, b, t) => 0.15 + 0.85 * smooth(t / 10),
      link: (t) => 0.7 + 0.9 * smooth(t / 10), cap: (t) => 3 + Math.floor(5 * smooth(t / 10)),
      pulse: (t) => 3.2 - 2 * smooth(t / 10),
      tint: (p, t) => mix(E, MAG, smooth(t / 10)), bond: (a, b, t) => mix(E, MAG, smooth(t / 10)), resetK: true,
    },
    // 8. La experiencia traza un camino (estela); la juventud abre una ruta nueva.
    //    La experiencia adopta esa ruta SOLO si tiene un vínculo con un joven: el vínculo es el canal del relevo.
    "nuevas-rutas": {
      layout: (p, t, c) => {
        const ra = t * 0.25 + p.u * 1.4, rb = t * 0.35 + p.u * 1.4;
        const ax = c.cx + Math.cos(ra) * c.R * 3, ay = c.cy + Math.sin(ra) * c.R * 1.6;
        const bx = c.cx + Math.cos(rb * 1.3) * c.R * 3.06, by = c.cy + Math.sin(rb * 0.9) * c.R * 1.9;
        const w = p.young ? 1 : smooth(p.route);
        return [lerp(ax, bx, w), lerp(ay, by, w), 2.2];
      },
      allowed: (a, b) => (a.young !== b.young ? 0.5 : 0),
      link: 1.5, cap: 2, jit: 0.1, trail: true, pulse: 2.2, source: (p) => p.young, follow: 3.5, rest: 0.9,
      tint: (p) => (p.young ? Y : mix(E, Y, p.route)), vis: () => 0.9, resetK: true,
    },
    // 9. Dos generaciones, una visión: coexisten sin mezclarse. Juventud = vínculos débiles y efímeros; experiencia = fuertes.
    "vision-generaciones": {
      layout: (p, t, c) => dual(p, t, c, 0),
      allowed: (a, b) => (a.young !== b.young ? 0 : a.young ? 0.12 : 0.8),
      link: 0.9, cap: 4, pulse: 3, dashYoung: true, ephemeral: 0.006, vision: () => 0.6, tint: typeColor, resetK: true, kdecay: 0.99,
    },
    // 10. Se entrelazan: aparecen vínculos entre generaciones y cada uno cambia al otro.
    "trabajan-juntas": {
      layout: (p, t, c) => dual(p, t, c, smooth(t / 7)),
      allowed: (a, b, t) => (a.young === b.young ? 0.5 : 0.9 * smooth((t - 1) / 6)),
      link: 1.0, cap: 8, crossFirst: true, pulse: 1.6, vision: (t) => 0.6 + 0.4 * smooth(t / 7), tint: kTint,
    },
    // 11. La juventud pasa al frente y activa a la experiencia: los pulsos nacen en los jóvenes.
    "presente-joven": {
      layout: (p, t, c) => (p.young ? orbitAt(p, t, c.cx, c.cy, c, 0.6, 1.9, 0.22) : orbitAt(p, t, c.cx, c.cy, c, 1.7, 3.3, 0.1)),
      allowed: (a, b) => (a.young && b.young ? 0.8 : a.young !== b.young ? 0.5 : 0.3),
      link: 1.0, cap: 8, crossFirst: true, pulse: 1.4, source: (p) => p.young,
      tint: kTint, vis: (p) => (p.young ? 1 : 0.4 + 0.5 * p.k), size: (p) => (p.young ? 1.5 : 0.9 + 0.3 * p.k),
    },
    // 12. El futuro se construye: las partículas se suman una a una a un arco entre dos generaciones.
    "futuro-construido": {
      layout: (p, t, c) => (p.i < 64 && t > join(p) ? archPos(p, c.W * 0.64, c.H * 0.74, c.W * 0.24, c.H * 0.46) : wander(p, t, c, 0.9)),
      allowed: (a, b, t) => archBond(a, b, t, false),
      link: 0.55, rest: 0.2, cap: 5, pulse: 1.2, source: (p, t) => p.i < 64 && t > join(p), tint: kTint,
    },
    // 13. Estructura completa y respirando: la energía no se apaga.
    "qr-cierre": {
      layout: (p, t, c) => {
        if (p.i < 64) return archPos(p, c.W * 0.6, c.H * 0.58, c.W * 0.2 * (1 + 0.02 * Math.sin(t)), c.H * 0.32 * (1 + 0.02 * Math.sin(t)));
        return wander(p, t, c, 0.9);
      },
      allowed: (a, b, t) => (a.i < 64 && b.i < 64 ? archBond(a, b, t, true) : a.i >= 64 && b.i >= 64 ? 0.3 : 0),
      link: 0.6, rest: 0.2, cap: 5, pulse: 1.0, tint: kTint,
    },
  };
}

class VisualSystem {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.width = 1; this.height = 1; this.dpr = 1; this.u = 1;
    this.time = 0; this.mt = 0; this.frame = 0; this.lastPulse = 0;
    this.current = null;
    this.scenes = buildScenes();
    this.scene = this.scenes["relevo-generacional"];
    this.bonds = new Map();
    this.fx = [];
    this.stats = { n: 0, avg: 0, cross: 0, scarred: 0 };
    this.showStats = false;
    this.particles = Array.from({ length: CONFIG.particleCount }, (_, i) => ({
      i, u: unit(i + 4), v: unit(i + 18), g: i % 3, young: i % 2 === 0, drift: unit(i + 88) * TAU,
      x: 0, y: 0, vx: 0, vy: 0, e: 0, k: 0, route: 0, yb: 0, hist: [],
    }));
    this.resize();
    for (const p of this.particles) { p.x = this.width * unit(p.i + 4); p.y = this.height * unit(p.i + 30); }
    window.addEventListener("resize", () => this.resize());
    window.addEventListener("keydown", (e) => { if (e.key && e.key.toLowerCase() === "m") this.showStats = !this.showStats; });
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = Math.max(1, rect.width);
    this.height = Math.max(1, rect.height);
    this.u = clamp(this.height / 720, 0.9, 2.4); // escala para pantallas grandes
    this.canvas.width = Math.floor(this.width * this.dpr);
    this.canvas.height = Math.floor(this.height * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  setMoment(moment) {
    this.current = moment;
    this.scene = this.scenes[moment.id] || this.scenes["relevo-generacional"];
    this.mt = 0;
    this.lastPulse = 0;
    for (const p of this.particles) {
      p.route = 0;
      if (this.scene.resetK === true) p.k = 0;
      if (!this.scene.trail && this.scene.micro === false) p.hist.length = 0;
    }
  }

  hasBackgroundAsset() {
    const a = CONFIG.assets.byMoment?.[this.current?.id];
    return (a === false ? null : a || this.current?.asset)?.placement === "background";
  }

  frameCtx() {
    const W = this.width, H = this.height;
    return { W, H, cx: W * 0.64, cy: H * 0.46, R: Math.min(W, H) * 0.16 };
  }

  addFx(type, x, y, col) {
    this.fx.push({ type, x, y, col, life: 1 });
    if (this.fx.length > 70) this.fx.shift();
  }

  // Crea, refuerza, debilita y rompe vínculos según lo que permita la escena y el uso que han tenido.
  updateBonds(S, t, c) {
    const N = this.particles.length, deg = new Array(N).fill(0);
    const maxD = val(S.link ?? 1, t) * c.R, cap = val(S.cap ?? 5, t);
    for (const p of this.particles) p.yb = 0;
    let sum = 0, cross = 0, scarred = 0;
    for (const [key, b] of this.bonds) {
      const d = Math.hypot(b.a.x - b.b.x, b.a.y - b.b.y);
      let k = d > maxD * 1.3 ? 0 : S.allowed(b.a, b.b, t);
      // Vínculos efímeros (juventud sin estructura): se rompen al azar y se vuelven a crear.
      if (k > 0 && S.ephemeral && b.a.young && b.b.young && Math.random() < S.ephemeral) b.s = 0;
      else if (k > 0) {
        // La confianza sube hacia lo permitido y puede superarlo si el vínculo tiene memoria (se ha usado).
        const ceil = Math.min(1, k + 0.5 * b.m);
        b.s = Math.min(ceil, b.s + (k - b.s) * 0.03 + Math.abs(b.flow || 0) * 0.12);
      } else {
        // Sin permiso: la memoria protege al vínculo de romperse rápido.
        b.s -= 0.03 * (1 - 0.85 * b.m);
      }
      b.peak = Math.max(b.peak || 0, b.s);
      if (b.s <= 0.01) {
        if (b.peak > 0.3) this.addFx("snap", (b.a.x + b.b.x) / 2, (b.a.y + b.b.y) / 2, CONFIG.palette.eventRed);
        this.bonds.delete(key); continue;
      }
      deg[b.a.i] += 1; deg[b.b.i] += 1;
      sum += b.s;
      if (b.a.young !== b.b.young) { cross += 1; (b.a.young ? b.b : b.a).yb += 1; }
      if (b.m > 0.15) scarred += 1;
    }
    const n = this.bonds.size;
    this.stats = { n, avg: n ? sum / n : 0, cross: n ? cross / n : 0, scarred };
    if (this.frame % 6) return;
    const ps = this.particles;
    // Si la escena es de colaboración (crossFirst), primero se crean los vínculos entre generaciones.
    for (const onlyCross of S.crossFirst ? [true, false] : [false]) {
      for (let i = 0; i < N; i += 1) {
        if (deg[i] >= cap) continue;
        for (let j = i + 1; j < N; j += 1) {
          if (deg[j] >= cap || this.bonds.has(i * 1000 + j)) continue;
          if (onlyCross && ps[i].young === ps[j].young) continue;
          if (Math.hypot(ps[i].x - ps[j].x, ps[i].y - ps[j].y) > maxD) continue;
          if (S.allowed(ps[i], ps[j], t) <= 0) continue;
          this.bonds.set(i * 1000 + j, { a: ps[i], b: ps[j], s: 0.02, m: 0, flow: 0, act: 0, dir: 1, peak: 0, seed: unit(i * 7 + j) });
          this.addFx("born", (ps[i].x + ps[j].x) / 2, (ps[i].y + ps[j].y) / 2, CONFIG.palette.eventSilver);
          deg[i] += 1; deg[j] += 1;
          if (deg[i] >= cap) break;
        }
      }
    }
  }

  step() {
    const S = this.scene, t = this.mt, c = this.frameCtx();
    this.updateBonds(S, t, c);
    const ps = this.particles;
    for (const p of ps) {
      const [tx, ty, pull] = S.layout(p, t, c);
      // La juventud que ha sido influida por la experiencia se vuelve menos errática.
      const j = (S.jit ?? 0.35) * (p.young ? 1 - 0.5 * p.k : 0.4);
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
      b.flow = flow;
      b.act = b.act * 0.93 + Math.abs(flow) * 0.07;
      if (Math.abs(flow) > 0.006) b.dir = flow > 0 ? 1 : -1; // 1: de a hacia b
      b.hot = b.a.e + b.b.e;
      // Memoria: crece con el uso, olvida muy despacio.
      b.m = Math.min(1, b.m * 0.9997 + (b.hot * 0.015 + Math.abs(flow) * 0.4) * b.s);
      // Cuando la energía cruza entre generaciones, cambia a ambos.
      if (b.a.young !== b.b.young) {
        const yo = b.a.young ? b.a : b.b, ol = b.a.young ? b.b : b.a, w = Math.abs(flow) * b.s;
        ol.k = Math.min(1, ol.k + w * 0.9);
        yo.k = Math.min(1, yo.k + w * 0.4);
      }
    }
    const interval = val(S.pulse ?? 0, t);
    if (interval > 0 && t - this.lastPulse > interval) {
      this.lastPulse = t;
      const pool = ps.filter((p) => !S.source || S.source(p, t));
      if (pool.length) {
        const src = pool[Math.floor(Math.random() * pool.length)];
        src.e = 1.6;
        if (S.ripple) this.addFx("wave", src.x, src.y, CONFIG.palette.eventRed);
      }
    }
    const kd = S.kdecay ?? 0.9998;
    for (const p of ps) {
      p.vx = (p.vx + p.ax) * 0.8; p.vy = (p.vy + p.ay) * 0.8;
      p.x += clamp(p.vx, -14, 14); p.y += clamp(p.vy, -14, 14);
      p.e *= 0.985; p.k *= kd;
      // Slide 8: la experiencia adopta la ruta nueva solo si está vinculada a un joven.
      if (S.follow != null && !p.young && p.yb > 0 && t > S.follow) p.route = Math.min(1, p.route + 0.0015);
      const maxH = S.trail ? 26 : (S.micro !== false && p.young ? 7 : 0);
      if (maxH && this.frame % 2 === 0) { p.hist.push([p.x, p.y]); }
      while (p.hist.length > maxH) p.hist.shift();
    }
  }

  render() {
    this.time += 1 / 60; this.mt += 1 / 60; this.frame += 1;
    this.step();
    const ctx = this.ctx, S = this.scene, t = this.mt, U = this.u;
    ctx.clearRect(0, 0, this.width, this.height);
    const c = this.frameCtx();
    const P = CONFIG.palette;

    if (S.vision) {
      const g = ctx.createRadialGradient(c.cx, c.cy, 0, c.cx, c.cy, c.R * 0.9);
      g.addColorStop(0, rgba("#ffffff", 0.34 * S.vision(t))); g.addColorStop(1, rgba("#ffffff", 0));
      ctx.fillStyle = g; ctx.fillRect(c.cx - c.R, c.cy - c.R, c.R * 2, c.R * 2);
    }

    // Estelas: largas en el slide 8 (el camino); cortas en la juventud (movimiento reciente).
    ctx.lineCap = "round";
    for (const p of this.particles) {
      if (p.hist.length < 2) continue;
      const col = S.tint(p, t), a0 = S.trail ? 0.4 : 0.22;
      for (let k = 1; k < p.hist.length; k += 1) {
        ctx.strokeStyle = rgba(col, (k / p.hist.length) * a0); ctx.lineWidth = (S.trail ? 1.4 : 1.8) * U;
        ctx.beginPath(); ctx.moveTo(p.hist[k - 1][0], p.hist[k - 1][1]); ctx.lineTo(p.hist[k][0], p.hist[k][1]); ctx.stroke();
      }
    }

    // Vínculos: grosor y opacidad = confianza; núcleo claro = memoria; rojo = huella del impacto (slide 5).
    for (const b of this.bonds.values()) {
      const col = S.bond ? S.bond(b.a, b.b, t) : b.a.young === b.b.young ? (b.a.young ? P.eventCyan : P.eventSilver) : P.eventMagenta;
      ctx.setLineDash(S.dashYoung && b.a.young && b.b.young ? [3 * U, 6 * U] : []);
      ctx.strokeStyle = rgba(col, Math.min(0.9, 0.08 + 0.55 * b.s + 0.5 * Math.min(1, b.hot || 0)));
      ctx.lineWidth = (0.6 + 1.8 * b.s) * U;
      ctx.beginPath(); ctx.moveTo(b.a.x, b.a.y); ctx.lineTo(b.b.x, b.b.y); ctx.stroke();
      if (b.m > 0.15) {
        ctx.setLineDash([]);
        ctx.strokeStyle = S.scar ? rgba(P.eventRed, b.m * 0.6) : rgba("#ffffff", b.m * 0.35);
        ctx.lineWidth = (S.scar ? 1.8 : 1) * U;
        ctx.beginPath(); ctx.moveTo(b.a.x, b.a.y); ctx.lineTo(b.b.x, b.b.y); ctx.stroke();
      }
    }
    ctx.setLineDash([]);

    // Relevo visible: paquetes de energía que viajan por el vínculo, de quien da a quien recibe.
    ctx.globalCompositeOperation = "lighter";
    for (const b of this.bonds.values()) {
      if (b.act < 0.004) continue;
      const ph = (this.time * 1.1 + b.seed) % 1, f = b.dir > 0 ? ph : 1 - ph;
      const x = lerp(b.a.x, b.b.x, f), y = lerp(b.a.y, b.b.y, f), r = (2 + Math.min(3, b.act * 40)) * U;
      ctx.fillStyle = rgba("#ffffff", Math.min(0.9, 0.3 + b.act * 8));
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
      ctx.fillStyle = rgba(P.eventMagenta, 0.25);
      ctx.beginPath(); ctx.arc(x, y, r * 2.6, 0, TAU); ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";

    // Eventos: nacimiento de un vínculo, ruptura, onda de impacto.
    for (let i = this.fx.length - 1; i >= 0; i -= 1) {
      const f = this.fx[i];
      f.life -= f.type === "wave" ? 0.012 : f.type === "snap" ? 0.04 : 0.05;
      if (f.life <= 0) { this.fx.splice(i, 1); continue; }
      const grow = 1 - f.life;
      const r = (f.type === "wave" ? 8 + grow * 120 : f.type === "snap" ? 4 + grow * 22 : 2 + grow * 10) * U;
      ctx.strokeStyle = rgba(f.col, f.life * (f.type === "snap" ? 0.9 : 0.55)); ctx.lineWidth = (f.type === "wave" ? 1.6 : 1.2) * U;
      ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, TAU); ctx.stroke();
    }

    // Partículas: tamaño escalado a la pantalla, halo suave y brillo según energía.
    for (const p of this.particles) {
      const vis = S.vis ? S.vis(p, t) : 1, r = (p.young ? 2.6 : 3.6) * U * (S.size ? S.size(p) : 1) * (1 + p.e * 1.1), col = S.tint(p, t);
      ctx.fillStyle = rgba(col, (p.young ? 0.1 : 0.07) * vis + Math.min(0.3, p.e * 0.25));
      ctx.beginPath(); ctx.arc(p.x, p.y, r * (p.e > 0.25 ? 3.4 : 2.4), 0, TAU); ctx.fill();
      ctx.fillStyle = rgba(col, Math.min(0.95, 0.8 * vis + p.e * 0.4));
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.fill();
    }

    if (this.showStats) this.drawStats(ctx, c);
  }

  // Métricas en vivo de las relaciones (tecla M) para explicar el sistema durante la demostración.
  drawStats(ctx, c) {
    if (this.frame % 10 === 0 || !this._statLines) {
      const s = this.stats;
      this._statLines = [
        `RELACIONES  ${s.n}`,
        `CONFIANZA MEDIA  ${s.avg.toFixed(2)}`,
        `ENTRE GENERACIONES  ${Math.round(s.cross * 100)}%`,
        `CON HUELLA (memoria)  ${s.scarred}`,
      ];
    }
    const U = this.u, x = clamp(this.width * 0.07, 36, 108), y0 = this.height * 0.2, lh = 20 * U;
    ctx.font = `${12 * U}px system-ui, sans-serif`;
    ctx.textBaseline = "top";
    ctx.fillStyle = "rgba(7,8,8,0.55)";
    ctx.fillRect(x - 12 * U, y0 - 10 * U, 270 * U, lh * this._statLines.length + 14 * U);
    ctx.fillStyle = rgba("#f7f7f4", 0.9);
    this._statLines.forEach((line, i) => ctx.fillText(line, x, y0 + i * lh));
  }
}
