// Controllers for the duality slides: bounds from both sides, dual multipliers, building the dual from the
// primal's columns, and the general primal/dual pair.
"use strict";

const PINK = "#f2a7c3", GREY = "#9aa0ad";  // A and b, as on slide 4
const kcol = (c, s) => `\\textcolor{${c.slice(1)}}{${s}}`;
const term = (a, v) => `${a === 1 ? "" : a}${v}`;

// el's box in stage pixels (1600 x 900), relative to `ref`: undoes the stage's CSS scale.
function relRect(el, ref) {
  const r = el.getBoundingClientRect(), b = ref.getBoundingClientRect(), s = b.width / ref.offsetWidth;
  return { x: (r.left - b.left) / s, y: (r.top - b.top) / s, w: r.width / s, h: r.height / s };
}

// A rounded highlight box (deck.css .mfbox) around a group of cells inside `host` (position: relative).
// box.fit() re-measures it (KaTeX's fonts may still be loading when a slide is first built).
function boxAround(host, cells, cls = "", pad = 7) {
  const d = document.createElement("div");
  d.className = `mfbox ${cls}`;
  host.appendChild(d);
  d.fit = () => {
    const rs = cells.map((c) => relRect(c, host));
    const L = Math.min(...rs.map((r) => r.x)), T = Math.min(...rs.map((r) => r.y));
    const R = Math.max(...rs.map((r) => r.x + r.w)), B = Math.max(...rs.map((r) => r.y + r.h));
    Object.assign(d.style, { left: `${L - pad}px`, top: `${T - pad}px`, width: `${R - L + 2 * pad}px`, height: `${B - T + 2 * pad}px` });
  };
  d.fit();
  return d;
}

// Timed jobs that can all be cancelled when the step changes mid-animation.
class Jobs {
  constructor() { this.list = []; }
  add(p) { this.list.push(p); return p; }
  after(ms, fn) { const p = Anim.wait(ms); p.then((ok) => ok && fn()); return this.add(p); }
  cancel() { for (const p of this.list) p.cancel(); this.list = []; }
}

// manim's ReplacementTransform: a copy of `from` flies onto `to`, cross-fading into a copy of `to` on the way.
// `to` (hidden with .hid) is revealed when the copy lands. `bend` > 0 arcs the flight upwards.
function morph(slide, from, to, { dur = 900, delay = 0, bend = 0 } = {}) {
  const a = relRect(from, slide), b = relRect(to, slide);
  const copy = (src, r) => {
    const c = src.cloneNode(true);
    c.classList.remove("hid", "dim");
    const cs = getComputedStyle(src);
    Object.assign(c.style, { position: "absolute", left: "0", top: "0", margin: "0", width: `${r.w}px`, height: `${r.h}px`,
      fontSize: cs.fontSize, color: cs.color, textAlign: cs.textAlign, lineHeight: cs.lineHeight, transition: "none" });
    return c;
  };
  const fa = copy(from, a), fb = copy(to, b);
  const wrap = document.createElement("div");
  wrap.className = "flyer";
  wrap.append(fa, fb);
  const ca = [a.x + a.w / 2, a.y + a.h / 2], cb = [b.x + b.w / 2, b.y + b.h / 2];
  const place = (e) => {
    const cx = lerp(ca[0], cb[0], e), cy = lerp(ca[1], cb[1], e) - bend * Math.sin(Math.PI * e);
    fa.style.transform = `translate(${cx - a.w / 2}px, ${cy - a.h / 2}px)`;
    fb.style.transform = `translate(${cx - b.w / 2}px, ${cy - b.h / 2}px)`;
    const f = Math.min(1, Math.max(0, (e - 0.25) / 0.5));
    fa.style.opacity = 1 - f;
    fb.style.opacity = f;
  };
  let tw = null, dead = false;
  const p = Anim.wait(delay).then((ok) => {
    if (!ok || dead) return false;
    place(0);
    slide.appendChild(wrap);
    tw = Anim.tween(dur, place);
    return tw;
  }).then((ok) => {
    wrap.remove();
    if (ok) {
      // swap the copy for the real cell in the same frame: no opacity transition, or it blinks as it fades in
      to.style.transition = "none";
      to.classList.remove("hid");
      void to.offsetWidth;
      to.style.transition = "";
    }
    return ok;
  });
  p.cancel = () => { dead = true; if (tw) tw.cancel(); wrap.remove(); };
  return p;
}

// ------------------------------------------------------------------ LP models as grids of cells
// One cell per term, so columns can be boxed and single terms can fly between models.
function lpCell(host, tex, cls = "") {
  const d = document.createElement("div");
  d.className = cls;
  if (tex) Deck.tex(d, tex);
  host.appendChild(d);
  return d;
}

// The bakery primal, with an optional (y_i) tag beside each constraint in its resource's colour.
function buildPrimal(host, { tags = true, tagWidth = null } = {}) {
  host.style.gridTemplateColumns = `repeat(6, auto)${tags ? ` ${tagWidth ? `${tagWidth}px` : "auto"}` : ""}`;
  const R = Bakery2D.res, c = Bakery2D.c, pad = () => { if (tags) lpCell(host, ""); };
  const obj = { lab: lpCell(host, "\\max"), t: [], ops: [] };
  obj.t[0] = lpCell(host, `\\OB{${term(c[0], "x_1")}}`, "r");
  obj.ops[0] = lpCell(host, "+", "c");
  obj.t[1] = lpCell(host, `\\OB{${term(c[1], "x_2")}}`, "r");
  lpCell(host, ""); lpCell(host, ""); pad();
  const rows = R.map((r, i) => {
    const k = (s) => kcol(r.color, s);
    const o = { lab: lpCell(host, i === 0 ? "\\text{s.t.}" : ""), t: [], ops: [] };
    o.t[0] = lpCell(host, k(term(r.a[0], "x_1")), "r");
    o.ops[0] = lpCell(host, k("+"), "c");
    o.t[1] = lpCell(host, k(term(r.a[1], "x_2")), "r");
    o.rel = lpCell(host, k("\\le"), "c");
    o.rhs = lpCell(host, k(String(r.b)), "r");
    if (tags) o.tag = lpCell(host, `(${k(`y_${i + 1}`)})`, "tag");
    o.cells = [o.t[0], o.ops[0], o.t[1], o.rel, o.rhs];
    return o;
  });
  lpCell(host, "");
  const signs = lpCell(host, "x_1, x_2 \\ge 0", "span");
  return { obj, rows, signs };
}

// The bakery dual: min 10y1 + 16y2 + 12y3 s.t. one row per primal column, y >= 0. Every cell starts hidden.
function buildDual(host) {
  host.style.gridTemplateColumns = "repeat(8, auto)";
  const R = Bakery2D.res, c = Bakery2D.c;
  const row = (lab, terms, rel, rhs) => {
    const o = { lab: lpCell(host, lab, "hid"), t: [], ops: [] };
    terms.forEach((tx, i) => {
      if (i) o.ops.push(lpCell(host, "+", "c hid"));
      o.t.push(lpCell(host, tx, "r hid"));
    });
    o.rel = lpCell(host, rel, "c hid");
    o.rhs = lpCell(host, rhs, "r hid");
    return o;
  };
  const obj = row("\\min", R.map((r, i) => kcol(r.color, term(r.b, `y_${i + 1}`))), "", "");
  const rows = [0, 1].map((j) => row(j === 0 ? "\\text{s.t.}" : "", R.map((r, i) => kcol(r.color, term(r.a[j], `y_${i + 1}`))), "\\ge", `\\OB{${c[j]}}`));
  lpCell(host, "");
  const signs = lpCell(host, "y_1, y_2, y_3 \\ge 0", "span hid");
  return { obj, rows, signs };
}

// A beaten upper bound drops in from above, then fades: the bar's marker and the little plot's line share these timings.
const GHOST = { wait: 150, drop: 750, fade: 400 };

// ------------------------------------------------------------------ the bound bar
// A vertical profit axis: lower bounds (plans) rise from below on the left, upper bounds (proofs) come down
// from above on the right, and the best profit is squeezed into the shaded gap between them.
class BoundBar {
  constructor(el, { h = 560, max = 120 } = {}) {
    const w = 340, ax = 170;
    Object.assign(this, { ax, max, y0: h - 30, y1: 44 });
    el.classList.add("plot", "boundbar");
    Object.assign(el.style, { width: `${w}px`, height: `${h}px` });
    const svg = (this.svg = svgEl("svg", { width: w, height: h, viewBox: `0 0 ${w} ${h}` }, el));
    this.ov = document.createElement("div");
    this.ov.className = "ov";
    el.appendChild(this.ov);
    svgEl("line", { x1: ax, y1: this.y0, x2: ax, y2: this.y1 - 16, stroke: "var(--axis)", "stroke-width": 2 }, svg);
    svgEl("path", { d: `M${ax},${this.y1 - 26}l-7,13h14z`, fill: "var(--axis)" }, svg);
    for (let v = 0; v <= max; v += 20) {
      svgEl("line", { x1: ax - 5, y1: this.Y(v), x2: ax + 5, y2: this.Y(v), stroke: "var(--axis)", "stroke-width": 2 }, svg);
    }
    this.lab("lab small muted", ax, this.y1 - 44).textContent = "profit";
    this.band = svgEl("rect", { x: ax - 7, width: 14, y: 0, height: 0, fill: C.proof, "fill-opacity": 0.2 }, svg);
    this.histG = svgEl("g", {}, svg);
    this.loM = svgEl("path", { fill: C.obj }, svg);
    this.upM = svgEl("path", { fill: "none", stroke: C.proof, "stroke-width": 2.5, "stroke-linejoin": "round" }, svg);
    this.ghostM = svgEl("path", { fill: "none", stroke: C.proof, "stroke-width": 2.5, "stroke-linejoin": "round", opacity: 0 }, svg);
    this.loL = this.lab("lab c-obj r");
    this.upL = this.lab("lab c-proof l");
    this.hist = {};
    this.cur = { lo: null, up: null };
    this.jobs = new Jobs();
  }
  Y(v) { return this.y0 - ((this.y0 - this.y1) * Math.min(v, this.max)) / this.max; }
  lab(cls, x = 0, y = 0) {
    const d = document.createElement("div");
    d.className = cls;
    Object.assign(d.style, { left: `${x}px`, top: `${y}px` });
    this.ov.appendChild(d);
    return d;
  }
  // a faint tick and number for a bound that has been beaten
  histItem(side, v) {
    const key = `${side}${v}`;
    if (!this.hist[key]) {
      const g = svgEl("g", { class: "fade", opacity: 0 }, this.histG), y = this.Y(v), s = side === "lo" ? -1 : 1;
      svgEl("line", { x1: this.ax + s * 7, y1: y, x2: this.ax + s * 17, y2: y, stroke: side === "lo" ? C.obj : C.proof, "stroke-width": 2, opacity: 0.55 }, g);
      svgEl("text", { x: this.ax + s * 22, y: y + 5, "text-anchor": side === "lo" ? "end" : "start", class: "hist" }, g).textContent = fmt(v);
      this.hist[key] = g;
    }
    return this.hist[key];
  }
  draw(lo, up) {
    const ax = this.ax;
    this.loM.setAttribute("d", lo === null ? "" : `M${ax - 10},${this.Y(lo)}l-17,-10v20z`);
    this.upM.setAttribute("d", up === null ? "" : `M${ax + 10},${this.Y(up)}l17,-10v20z`);
    Object.assign(this.loL.style, { left: `${ax - 36}px`, top: `${this.Y(lo ?? 0)}px`, opacity: lo === null ? 0 : 1 });
    Object.assign(this.upL.style, { left: `${ax + 36}px`, top: `${this.Y(up ?? 0)}px`, opacity: up === null ? 0 : 1 });
    if (lo !== null) this.loL.innerHTML = `lower bound: <b>${fmt(Math.round(lo))}</b>`;
    if (up !== null) this.upL.innerHTML = `upper bound: <b>${fmt(Math.round(up))}</b>`;
    const on = lo !== null && up !== null;
    this.band.setAttribute("y", on ? this.Y(up) : 0);
    this.band.setAttribute("height", on ? Math.max(0, this.Y(lo) - this.Y(up)) : 0);
  }
  // st = { lo, up, loHist, upHist }; animate: markers glide, new upper-bound candidates drop in from the top
  set({ lo = null, up = null, loHist = [], upHist = [] }, animate = false, { pulse = false } = {}) {
    this.jobs.cancel();
    if (!pulse) this.upL.classList.remove("pulse");
    this.ghostM.setAttribute("opacity", 0);
    const want = new Set([...loHist.map((v) => `lo${v}`), ...upHist.map((v) => `up${v}`)]);
    const fresh = upHist.filter((v) => v !== this.cur.up && !(this.hist[`up${v}`] && this.hist[`up${v}`].getAttribute("opacity") === "1"));
    for (const v of loHist) this.histItem("lo", v);
    for (const v of upHist) this.histItem("up", v);
    for (const [k, g] of Object.entries(this.hist)) {
      const show = want.has(k) && !(animate && k.startsWith("up") && fresh.includes(+k.slice(2)));
      g.setAttribute("opacity", show ? 1 : 0);
      // a beaten bound's number would collide with the marker's label when they are close: keep just the tick
      const m = k.startsWith("lo") ? lo : up;
      g.lastChild.setAttribute("opacity", m !== null && Math.abs(this.Y(+k.slice(2)) - this.Y(m)) < 22 ? 0 : 1);
    }
    const from = { ...this.cur };
    this.cur = { lo, up };
    if (!animate) { this.draw(lo, up); return; }
    const a0 = from.lo ?? 0, b0 = from.up ?? this.max;
    if (from.lo !== lo || from.up !== up) {
      this.jobs.add(Anim.tween(800, (e) => this.draw(lo === null ? null : lerp(a0, lo, e), up === null ? null : lerp(b0, up, e))));
    } else this.draw(lo, up);
    // a beaten upper bound: a marker drops from the top to its value, then turns into a faint tick
    fresh.forEach((v, i) => {
      this.jobs.add(Anim.wait(GHOST.wait + i * 900)).then((ok) => {
        if (!ok) return;
        this.ghostM.setAttribute("opacity", 1);
        this.jobs.add(Anim.tween(GHOST.drop, (e) => this.ghostM.setAttribute("d", `M${this.ax + 10},${this.Y(lerp(this.max, v, e))}l17,-10v20z`))).then((ok2) => {
          if (!ok2) return;
          this.histItem("up", v).setAttribute("opacity", 1);
          this.jobs.add(Anim.tween(GHOST.fade, (e) => this.ghostM.setAttribute("opacity", 1 - e)));
        });
      });
    });
    if (pulse) {
      for (const l of [this.upL]) {
        l.classList.remove("pulse"); void l.offsetWidth; l.classList.add("pulse");
        l.addEventListener("animationend", () => l.classList.remove("pulse"), { once: true });  // or it can replay on a revisit
      }
    }
  }
}

// ------------------------------------------------------------------ A -> A^T
// The matrix's entries glide (on gentle arcs, so crossing entries pass each other) to their transposed
// places while the parentheses reshape. rot[i][j] turns an entry on the way (⋯ becomes ⋮).
class MatrixMorph {
  // the two labels have the same width (a phantom ⊤), so only the ⊤ fades in and the A stays put
  constructor(el, rows, { cw = 58, ch = 50, font = 30, label = ["A^{\\phantom{\\top}}", "A^\\top"], color = PINK, dims = null, rot = null } = {}) {
    Object.assign(this, { m: rows.length, n: rows[0].length, cw, ch, rot });
    const big = Math.max(this.m, this.n);
    this.W = big * cw + 170;
    this.H = big * ch + (dims ? 64 : 24);
    el.classList.add("mm");
    Object.assign(el.style, { width: `${this.W}px`, height: `${this.H}px`, fontSize: `${font}px` });
    this.cx = this.W - (big * cw) / 2 - 22;
    this.cy = (big * ch) / 2 + 12;
    const svg = svgEl("svg", { width: this.W, height: this.H }, el);
    const par = { fill: "none", stroke: "var(--ink)", "stroke-width": 2.5, "stroke-linecap": "round" };
    this.lp = svgEl("path", par, svg);
    this.rp = svgEl("path", par, svg);
    const span = (tex, cls) => { const d = document.createElement("div"); d.className = cls; Deck.tex(d, tex); el.appendChild(d); return d; };
    this.entries = rows.map((r) => r.map((tex) => span(tex, "e")));
    // "A =" as two pieces, so the symbol alone can fly elsewhere
    this.lab = label.map((l) => {
      const d = document.createElement("div");
      d.className = "ml";
      d.innerHTML = '<span class="s"></span><span class="q"></span>';
      Deck.tex(d.firstChild, kcol(color, l));
      Deck.tex(d.lastChild, "=");
      el.appendChild(d);
      return d;
    });
    this.dims = dims ? dims.map((d) => span(d, "md")) : null;
    this.set(0);
  }
  set(t) {
    const { m, n, cw, ch, cx, cy } = this;
    const w = lerp(n * cw, m * cw, t), h = lerp(m * ch, n * ch, t);
    this.entries.forEach((row, i) => row.forEach((e, j) => {
      const x0 = cx - (n * cw) / 2 + (j + 0.5) * cw, y0 = cy - (m * ch) / 2 + (i + 0.5) * ch;
      const x1 = cx - (m * cw) / 2 + (i + 0.5) * cw, y1 = cy - (n * ch) / 2 + (j + 0.5) * ch;
      const dx = x1 - x0, dy = y1 - y0, d = Math.hypot(dx, dy) || 1, bow = 0.22 * d * Math.sin(Math.PI * t);
      e.style.left = `${lerp(x0, x1, t) + (-dy / d) * bow}px`;
      e.style.top = `${lerp(y0, y1, t) + (dx / d) * bow}px`;
      e.style.transform = `translate(-50%, -50%) rotate(${this.rot ? this.rot[i][j] * t : 0}deg)`;
    }));
    const L = cx - w / 2 - 8, R = cx + w / 2 + 8, T = cy - h / 2 - 2, B = cy + h / 2 + 2, mid = (T + B) / 2;
    this.lp.setAttribute("d", `M${L + 5},${T} Q${L - 7},${mid} ${L + 5},${B}`);
    this.rp.setAttribute("d", `M${R - 5},${T} Q${R + 7},${mid} ${R - 5},${B}`);
    const f = Math.min(1, Math.max(0, (t - 0.3) / 0.4));
    this.lab.forEach((l, i) => Object.assign(l.style, { left: `${L - 14}px`, top: `${cy}px`, opacity: i ? f : 1 - f }));
    if (this.dims) this.dims.forEach((d, i) => Object.assign(d.style, { left: `${cx}px`, top: `${cy + (Math.max(m, n) * ch) / 2 + 30}px`, opacity: i ? f : 1 - f }));
    this.t = t;
  }
  play(dur = 1600) { const t0 = this.t; return Anim.tween(dur, (e) => this.set(lerp(t0, 1, e))); }
}

// ------------------------------------------------------------------ the little region above the bound bar
// Where the lower bounds come from: walk the corners (0,0) -> (5,0) -> (4,2) -> (2,5) with the profit line through
// the current one (shaded below, as on the sweep slide); an upper bound shows as a dashed white profit line.
const LB_PATH = [[0, 0], [5, 0], [4, 2], [2, 5]];
const LB_OFF = [[16, -14], [8, -16], [22, -2], [16, -16]];
class BoundPic {
  constructor(el) {
    const p = (this.p = bakeryPlot(el, { size: 300, xmax: 8.5, ymax: 8.5, margin: { l: 22, r: 8, t: 8, b: 18 }, xlabel: "", ylabel: "" }));
    el.classList.add("mini");
    setLines(p, true);
    for (const r of Bakery2D.res) { p.emphasize(r.key, "dim"); p.showLabel(`c-${r.key}`, false); }
    setRegion(p, true);
    setCorners(p, true, false);
    for (const q of CORNERS) cornerColor(p, q, "#fff", 5);
    LB_PATH.forEach((q, i) => p.html(`lv${i}`, q, fmt(Bakery2D.value(q)), { dx: LB_OFF[i][0], dy: LB_OFF[i][1], cls: "c-obj halo", hidden: true }));
    this.cur = { n: 0, up: null };
    this.jobs = new Jobs();
  }
  // n corners reached (t: progress along the last leg), upper bound line at `up`
  draw(n, t, up) {
    const p = this.p, c = Bakery2D.c;
    const pts = LB_PATH.slice(0, n);
    if (n >= 2 && t < 1) pts[n - 1] = lerpP(LB_PATH[n - 2], LB_PATH[n - 1], t);  // still walking the last leg
    const at = n ? pts[pts.length - 1] : null, z = at ? Geo.dot(c, at) : null;
    p.line("trail", n >= 2 ? pts : null, { stroke: C.obj, "stroke-width": 3.5, opacity: 0.9 }, "under");
    p.level("lo", c, z === null ? 0 : Math.max(z, 1e-3), { stroke: C.obj, "stroke-width": 2.5, "stroke-dasharray": "7 6", opacity: z === null ? 0 : 0.95 });
    p.poly("below", z === null ? null : Geo.clip(Bakery2D.region, c, z), { fill: C.obj, "fill-opacity": 0.16 });
    LB_PATH.forEach((q, i) => {
      const lit = i < n - 1 || (i === n - 1 && t >= 1);
      cornerColor(this.p, q, lit ? C.obj : "#fff", lit ? 6 : 5);
      p.showLabel(`lv${i}`, lit);
    });
    p.level("up", c, up === null ? 0 : up, { stroke: C.proof, "stroke-width": 2.5, "stroke-dasharray": "7 6", opacity: up === null ? 0 : 0.9 });
    // beyond the upper bound: profits no plan can reach, shaded and dragged along as the bound moves in
    const box = [[0, 0], [p.o.xmax, 0], [p.o.xmax, p.o.ymax], [0, p.o.ymax]];
    p.poly("above", up === null ? null : Geo.clip(box, [-c[0], -c[1]], -up), { fill: C.proof, "fill-opacity": 0.1 });
  }
  set({ n = 0, up = null }, animate = false) {
    this.jobs.cancel();
    this.p.line("ghost", null);
    const from = { ...this.cur };
    this.cur = { n, up };
    if (!animate) { this.draw(n, 1, up); return; }
    if (n === from.n + 1 && n >= 2) this.jobs.add(Anim.tween(700, (e) => this.draw(n, e, from.up)));
    else if (up !== from.up) {
      const u0 = from.up ?? 130;  // a new upper bound comes down from above, like on the bar
      this.jobs.add(Anim.tween(800, (e) => this.draw(n, 1, lerp(u0, up, e))));
    } else this.draw(n, 1, up);
  }
  // a beaten upper bound's profit line (light grey, dotted) drops in with the bar's marker, then fades away
  ghost(v) {
    const c = Bakery2D.c, draw = (z, o) => this.p.level("ghost", c, z, { stroke: "#c3c8d2", "stroke-width": 3, "stroke-dasharray": "1 7", opacity: o });
    this.jobs.add(Anim.wait(GHOST.wait)).then((ok) => {
      if (!ok) return;
      this.jobs.add(Anim.tween(GHOST.drop, (e) => draw(lerp(130, v, e), 1))).then((ok2) => {
        if (ok2) this.jobs.add(Anim.tween(GHOST.fade, (e) => draw(v, 1 - e)));
      });
    });
  }
}

// ------------------------------------------------------------------ slide: duality and bounds
const BD_LO = [null, 0, 45, 52, 58, 58, 58, 58];
Deck.register("bounds", {
  steps: 7,
  init(el) {
    this.bar = new BoundBar(el.querySelector("#bd-bar"), { h: 360 });
    this.pic = new BoundPic(el.querySelector("#bd-pic"));
    this.chips = [...el.querySelectorAll(".lb")];
  },
  render(k, animate) {
    // the newest lower bound is outlined; the ones it beat fade back
    const latest = Math.min(k, 4) - 1;
    this.chips.forEach((c, i) => { c.classList.toggle("cur", i === latest); c.classList.toggle("old", i < latest); });
    const lo = BD_LO[k];
    const loHist = [0, 45, 52].filter((v) => lo !== null && v < lo);
    this.bar.set({ lo, loHist, up: k >= 7 ? 80 : null }, animate);
    this.pic.set({ n: Math.min(k, 4), up: k >= 7 ? 80 : null }, animate);
  },
});

// ------------------------------------------------------------------ slide: understanding dual variables
// One resource at a time: its multiplier must cover both profits (flour 8, oven 4, labor 9).
const DV_GUESS = [null, [8, 0, 0], [0, 4, 0], [0, 0, 9], null];
Deck.register("dualvars", {
  steps: 4,
  init(el) {
    this.el = el;
    this.host = el.querySelector("#dv-lp");
    this.P = buildPrimal(this.host, { tagWidth: 150 });
    this.band = document.createElement("div");
    this.band.className = "rowband";
    this.host.prepend(this.band);
    this.scaled = el.querySelector("#dv-scaled");
    this.bar = new BoundBar(el.querySelector("#dv-bar"), { h: 360 });
    this.pic = new BoundPic(el.querySelector("#dv-pic"));
    this.jobs = new Jobs();
    this.tagJobs = new Jobs();  // the tags' entrance: separate, so clicking ahead doesn't cancel it
  },
  fill(y) {
    const R = Bakery2D.res, c = Bakery2D.c;
    if (!y) return;
    const i = y.findIndex((v) => v > 0), r = R[i], m = y[i], k = (s) => kcol(r.color, s);
    const a = r.a.map((v) => v * m), B = r.b * m;
    Deck.tex(this.scaled.querySelector(".l1"), `${k(m)} \\times (${k(r.tex)})`);
    Deck.tex(this.scaled.querySelector(".l1b"), `\\Rightarrow\\; ${term(a[0], "x_1")} + ${term(a[1], "x_2")} \\le ${B}`);
    this.scaled.querySelector(".l2").innerHTML = `covers the profit: ${a[0]} ≥ <span class="c-obj">${c[0]}</span> ✓ &nbsp; ${a[1]} ≥ <span class="c-obj">${c[1]}</span> ✓ &nbsp;⇒&nbsp; <b class="c-proof">z ≤ ${B}</b>`;
  },
  render(k, animate) {
    this.jobs.cancel();
    const R = Bakery2D.res, y = DV_GUESS[k];
    const act = y ? y.findIndex((v) => v > 0) : -1;
    this.P.rows.forEach((r, i) => {
      const v = y ? y[i] : null, kk = (s) => kcol(R[i].color, s);
      Deck.tex(r.tag, `(${kk(`y_${i + 1}`)}${v === null ? "" : kk(` = ${v}`)})`);
      r.tag.classList.toggle("on", i === act);
      for (const c of [...r.cells, r.tag]) c.classList.toggle("dim", act >= 0 && i !== act);
    });
    // a soft band behind the constraint being used
    if (act >= 0) {
      const rr = relRect(this.P.rows[act].t[0], this.host), rt = relRect(this.P.rows[act].tag, this.host);
      Object.assign(this.band.style, { top: `${rr.y - 6}px`, height: `${rr.h + 12}px`, left: `${rr.x - 14}px`, width: `${rt.x + rt.w - rr.x + 28}px`,
        background: `color-mix(in srgb, ${R[act].color} 14%, transparent)`, boxShadow: `inset 4px 0 0 ${R[act].color}`, opacity: 1 });
    } else this.band.style.opacity = 0;
    // the scaled constraint: cross-fade its contents when the guess changes
    const showBox = !!y;
    if (animate && showBox && this.scaled.style.opacity === "1") {
      this.scaled.style.opacity = 0;
      this.jobs.after(220, () => { this.fill(y); this.scaled.style.opacity = 1; });
    } else {
      this.fill(y);
      this.scaled.style.opacity = showBox ? 1 : 0;
    }
    // flour's 80 (from the last slide), then oven improves it to 64, then labor's 108 is worse
    const up = k >= 2 ? 64 : 80, upHist = k >= 3 ? [80, 108] : k >= 2 ? [80] : [];
    this.bar.set({ lo: 58, loHist: [0, 45, 52], up, upHist }, animate, { pulse: animate && k === 1 });
    this.pic.set({ n: 4, up }, animate);
    if (animate && k === 3) this.pic.ghost(108);  // labor's bound: shown, then discarded
  },
  // the (y_i) tags slide in one by one when the slide opens (hidden instantly first, so a revisit doesn't
  // show them fading out before they slide in)
  enter(k) {
    if (k !== 0) return;
    this.tagJobs.cancel();
    this.P.rows.forEach((r, i) => {
      r.tag.style.transition = "none";
      r.tag.classList.add("pre");
      void r.tag.offsetWidth;
      r.tag.style.transition = "";
      this.tagJobs.after(500 + 220 * i, () => r.tag.classList.remove("pre"));
    });
  },
  leave() {
    this.jobs.cancel();
    this.tagJobs.cancel();
    this.P.rows.forEach((r) => r.tag.classList.remove("pre"));
  },
});

// ------------------------------------------------------------------ slide: two readings of the same equations
// The profit line through (2, 5) for profit b x1 + 8 x2 (cake fixed at 8, as on the ties slide) is
// lambda * oven + mu * labor with lambda = (b - 4) / 2, mu = 6 - b / 2: both >= 0 exactly when 4 <= b <= 12.
// Click a ringed corner: the two constraints tight there (two resource lines, or one and an axis), read by rows
// (primal: where they meet) and by columns (dual: which multipliers of them add up to c), as equations and as row
// reduction of [objective | system]. Sign constraints are written like the others, -x_j <= 0, so a valid
// multiplier is >= 0 for every row; the multiplier on -x_j <= 0 is product j's dual slack d_j.
const WM_CORNERS = { "2,5": ["oven", "labor"], "4,2": ["flour", "oven"], "5,0": ["flour", "x2"], "0,6": ["labor", "x1"], "0,0": ["x1", "x2"] };
Deck.register("whymix", {
  init(el) {
    this.el = el;
    const p = (this.plot = bakeryPlot(el.querySelector("#wm-plot"), { size: 600 }));
    setLines(p, true);
    setRegion(p, true);
    setCorners(p, true, true);
    p.moveLabel("vl2,5", [2, 5], -52, 24);
    const pts = Object.keys(WM_CORNERS).map((k) => k.split(",").map(Number));
    const near = (t) => pts.find((q) => Math.hypot(t[0] - q[0], t[1] - q[1]) < 0.75);
    p.svg.addEventListener("pointerdown", (e) => { const q = near(p.toData(e)); if (q) this.select(q.join(",")); });
    p.svg.addEventListener("pointermove", (e) => { p.svg.style.cursor = near(p.toData(e)) ? "pointer" : "default"; });
    this.sel = "2,5";
  },
  select(key) {
    this.sel = key;
    const p = this.plot, R = Bakery2D.res, c = Bakery2D.c;
    const T = WM_CORNERS[key].map((k) => Bakery2D.all.find((r) => r.key === k));
    const mult = (r) => (r.product === undefined ? `y_${R.indexOf(r) + 1}` : `d_${r.product + 1}`);
    const x = key.split(",").map(Number), z = Geo.dot(c, x);
    const y = Geo.solve2([[T[0].a[0], T[1].a[0]], [T[0].a[1], T[1].a[1]]], c);  // A_Tᵀ y = c
    const ok = y.every((v) => v > -1e-9);
    const col = (r) => r.color.slice(1), tc = (r, s) => `\\textcolor{${col(r)}}{${s}}`;
    const yc = (i) => (y[i] < 0 ? `\\textcolor{d64545}{${fmt(y[i])}}` : tc(T[i], fmt(y[i])));
    // a·x = v, skipping zero terms ("x_2", "-x_2", "2x_1 + x_2")
    const lin = (a, v) => a.map((k, j) => [k, j]).filter(([k]) => k !== 0)
      .map(([k, j], n) => `${k < 0 ? (n ? " - " : "-") : n ? " + " : ""}${Math.abs(k) === 1 ? "" : Math.abs(k)}x_${j + 1}`).join("") + ` = ${v}`;
    // product j's column: its coefficients times the two multipliers add up to c_j (coefficients shown, zeros skipped)
    const colEq = (j) => T.map((r) => [r, r.a[j]]).filter(([, a]) => a !== 0)
      .map(([r, a], n) => `${a < 0 ? " - " : n ? " + " : ""}${tc(r, Math.abs(a))}${mult(r)}`).join("") + ` = \\OB{${c[j]}}`;
    // equations
    Deck.tex(this.el.querySelector("#wm-pe"), T.map((r) => tc(r, lin(r.a, r.b))).join(", \\quad "));
    Deck.tex(this.el.querySelector("#wm-pr"), `\\Rightarrow x = (${x[0]}, ${x[1]})`);
    // a tight sign constraint is written -x_j <= 0: every row stays "<=", as for maximizing
    const hasSign = T.some((r) => r.product !== undefined);
    this.el.querySelector("#wm-pr").insertAdjacentHTML("beforeend", `: where the lines meet${hasSign ? ". Keep constraint ≤ for maximizing." : ""}`);
    Deck.tex(this.el.querySelector("#wm-de"), [0, 1].map(colEq).join(", \\quad "));
    const dr = this.el.querySelector("#wm-dr");
    Deck.tex(dr, `\\Rightarrow ${mult(T[0])} = ${yc(0)},\\ ${mult(T[1])} = ${yc(1)}`);
    dr.insertAdjacentHTML("beforeend", ok ? ": multipliers of those lines that add up to <span class=\"c-obj\">c</span>"
      : `: they add up to <span class="c-obj">c</span>, but ${y.every((v) => v < 0) ? "both are" : "one is"} <b style="color:#d64545">negative</b>`);
    // matrices: [objective | 0] over the system, then its row-reduced form
    const mat = (rows) => `\\left[\\begin{array}{rr|r} ${rows.map((r) => r.join(" & ")).join(" \\\\ ")} \\end{array}\\right]`;
    const ob = (v) => `\\OB{${v}}`;
    // the top row is the objective as an equation, z - 9x_1 - 8x_2 = 0 (dual: w - b·y = 0), so it reduces to z (w)
    const neg = (v) => (v === 0 ? 0 : -v);
    Deck.tex(this.el.querySelector("#wm-pm"), mat([[ob(neg(c[0])), ob(neg(c[1])), 0], ...T.map((r) => [tc(r, r.a[0]), tc(r, r.a[1]), tc(r, r.b)])]));
    Deck.tex(this.el.querySelector("#wm-pm2"), mat([[0, 0, ob(fmt(z))], [1, 0, x[0]], [0, 1, x[1]]]));
    Deck.tex(this.el.querySelector("#wm-dm"), mat([[tc(T[0], neg(T[0].b)), tc(T[1], neg(T[1].b)), 0], ...[0, 1].map((j) => [tc(T[0], T[0].a[j]), tc(T[1], T[1].a[j]), ob(c[j])])]));
    Deck.tex(this.el.querySelector("#wm-dm2"), mat([[0, 0, ob(fmt(z))], [1, 0, yc(0)], [0, 1, yc(1)]]));
    const minus = (terms) => terms.filter(([k]) => k !== 0).map(([k, v]) => ` - ${k}${v}`).join("");
    Deck.tex(this.el.querySelector("#wm-pn"), `z${minus([[c[0], "x_1"], [c[1], "x_2"]])} = 0`);
    Deck.tex(this.el.querySelector("#wm-pn2"), `z = ${fmt(z)}`);
    Deck.tex(this.el.querySelector("#wm-dn"), `w${minus(T.map((r) => [r.b, mult(r)]))} = 0`);
    Deck.tex(this.el.querySelector("#wm-dn2"), `w = ${fmt(z)}`);
    this.alignEq();
    // plot: the tight lines bold (a tight sign constraint lights its axis), the selected corner gold, the other
    // clickable ones ringed; the profit line through the corner, dashed when it cuts into the region
    for (const r of R) p.emphasize(r.key, WM_CORNERS[key].includes(r.key) ? "bold" : "dim");
    for (const j of [0, 1]) {
      const on = T.some((r) => r.product === j);
      p.line(`signax${j}`, on ? (j === 0 ? [[0, 0], [0, 8.6]] : [[0, 0], [8.6, 0]]) : null, { stroke: "#d6d9df", "stroke-width": 6 });
    }
    for (const q of CORNERS) cornerColor(p, q, Geo.near(q, x) ? C.obj : "#fff", Geo.near(q, x) ? 9 : 7);
    for (const k of Object.keys(WM_CORNERS)) {
      const q = k.split(",").map(Number);
      p.line(`cue${k}`, ring(q, 0.38), { stroke: C.obj, "stroke-width": 2.5, "stroke-dasharray": k === key ? "" : "5 5", opacity: k === key ? 1 : 0.7 }, "top");
    }
    p.level("pline", c, z, { stroke: ok ? C.obj : C.muted, "stroke-width": ok ? 4 : 3, "stroke-dasharray": ok ? "" : "10 8" });
  },
  // centre each objective equation over its matrix's top-right 0 (measured, so it follows the font and the numbers)
  alignEq() {
    for (const [eq, m] of [["#wm-pn", "#wm-pm"], ["#wm-dn", "#wm-dm"]]) {
      const f = this.el.querySelector(eq), mat = this.el.querySelector(m), box = mat.closest(".wm-mat");
      const cols = mat.querySelectorAll("[class*='col-align']"), cell = cols[cols.length - 1].querySelector(".vlist > span");
      const g = (cell.lastElementChild || cell).getBoundingClientRect(), b = box.getBoundingClientRect();
      const scale = b.width / box.offsetWidth;
      if (!scale) return;
      f.style.left = `${(g.left + g.width / 2 - b.left) / scale - f.offsetWidth / 2}px`;
    }
  },
  render() { this.select(this.sel); document.fonts.ready.then(() => this.alignEq()); },
  enter() { this.select("2,5"); },
});

// ------------------------------------------------------------------ slide: formalizing the dual
// Clicks: 1-2 the primal's columns become the dual's rows; 3 the b bullet; 4 b fills the objective;
// 5 the matrix A appears; 6 the A^T bullet; 7 A transposes into A^T.
Deck.register("formdual", {
  steps: 7,
  init(el) {
    this.el = el;
    const pHost = el.querySelector("#fd-primal"), dHost = el.querySelector("#fd-dual");
    const P = (this.P = buildPrimal(pHost));
    const D = (this.D = buildDual(dHost));
    this.minNote = el.querySelector("#fd-min");
    this.boxes = [
      boxAround(pHost, [P.obj.t[0], ...P.rows.map((r) => r.t[0])]),            // 1: bread's column
      boxAround(pHost, [P.obj.t[1], ...P.rows.map((r) => r.t[1])]),            // 2: cake's column
      boxAround(pHost, P.rows.map((r) => r.rhs), "mf-b"),                      // 3: b
      boxAround(pHost, P.rows.flatMap((r) => [r.t[0], r.t[1]]), "mf-A"),       // 4: A ...
      boxAround(dHost, D.rows.flatMap((r) => r.t), "mf-A"),                    //    ... and A^T in the dual
    ];
    this.dRowBox = D.rows.map((r) => boxAround(dHost, [...r.t, r.rhs]));
    document.fonts.ready.then(() => this.fit());
    this.matEl = el.querySelector("#fd-mat");
    this.mat = new MatrixMorph(this.matEl, Bakery2D.res.map((r) => r.a.map((v) => kcol(r.color, v))), { dims: ["3 \\times 2", "2 \\times 3"] });
    this.jobs = new Jobs();
  },
  fit() { for (const b of [...this.boxes, ...this.dRowBox]) b.fit(); },
  boxesOn(k) {
    const on = [k === 1, k === 2, k === 3 || k === 4, k >= 5, k >= 6];  // columns, b, A, the dual's block
    this.boxes.forEach((b, i) => b.classList.toggle("on", on[i]));
    this.dRowBox.forEach((b, j) => b.classList.toggle("on", k === j + 1));
  },
  // which dual pieces are visible after step k
  state(k) {
    const D = this.D, show = (els, on) => els.forEach((e) => e.classList.toggle("hid", !on));
    D.rows.forEach((r, j) => show([r.lab, ...r.t, ...r.ops, r.rel, r.rhs], k >= j + 1));
    show([D.obj.lab, ...D.obj.t, ...D.obj.ops, D.signs], k >= 4);
    this.minNote.style.opacity = k >= 4 ? 1 : 0;
    this.boxesOn(k);
    this.matEl.style.opacity = k >= 5 ? 1 : 0;
    this.mat.set(k >= 7 ? 1 : 0);
  },
  render(k, animate) {
    this.jobs.cancel();
    this.fit();
    if (!animate) { this.state(k); return; }
    this.state(k - 1);
    const P = this.P, D = this.D, el = this.el, J = this.jobs;
    const reveal = (els, ms) => J.after(ms, () => els.forEach((e) => e.classList.remove("hid")));
    this.boxesOn(k);
    if (k === 1 || k === 2) {
      // a column of the primal becomes a row of the dual: its coefficients, then the profit it must cover
      const j = k - 1, row = D.rows[j];
      P.rows.forEach((r, i) => J.add(morph(el, r.t[j], row.t[i], { delay: 350 + 230 * i, bend: 40 })));
      J.add(morph(el, P.obj.t[j], row.rhs, { delay: 350 + 230 * 3, bend: 60 }));
      reveal([row.lab, ...row.ops, row.rel], 900);
    } else if (k === 4) {
      // each unit of y_i adds b_i to the bound
      P.rows.forEach((r, i) => J.add(morph(el, r.rhs, D.obj.t[i], { delay: 250 + 230 * i, bend: 70 })));
      reveal([D.obj.lab, ...D.obj.ops], 800);
      reveal([D.signs], 1400);
      J.after(1400, () => { this.minNote.style.opacity = 1; });
    } else if (k === 7) J.add(this.mat.play(1700));
    // clicks 3 (the b bullet), 5 (the matrix fades in) and 6 (the A^T bullet) are plain reveals
  },
});

// ------------------------------------------------------------------ slide: primal and dual, in general
// Everything starts in place (A^T already transposed); only the bullets step in.
const DG_ENTRIES = [
  ["a_{11}", "\\cdots", "a_{1n}"],
  ["\\vdots", "\\ddots", "\\vdots"],
  ["a_{m1}", "\\cdots", "a_{mn}"],
].map((r) => r.map((s) => kcol(PINK, s)));
const DG_ROT = [[0, 90, 0], [-90, 0, -90], [0, 90, 0]];  // ⋯ and ⋮ turn as they swap places
Deck.register("dualgeneral", {
  init(el) {
    this.mat = new MatrixMorph(el.querySelector("#dg-mat"), DG_ENTRIES, { cw: 66, ch: 54, rot: DG_ROT, dims: ["m \\times n", "n \\times m"] });
    this.mat.set(1);
  },
});

// ------------------------------------------------------------------ slide: dual slack
// Every crossing of two constraint lines has a basis B, so a dual y with B^T y = c_B: the multipliers of its two tight
// constraints that add up to c (Bakery2D.cornerProof). The plan point snaps to all ten crossings, inside the region
// (plans) or not. Inside, the plan is valid but the proof usually isn't; outside, the reverse; (2, 5) has both.
const DS_CROSS = (() => {
  const L = Bakery2D.all, out = [];
  for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
    const [a, b] = [L[i], L[j]], det = a.a[0] * b.a[1] - a.a[1] * b.a[0];
    if (Math.abs(det) < 1e-12) continue;
    const q = [(a.b * b.a[1] - a.a[1] * b.b) / det, (a.a[0] * b.b - a.b * b.a[0]) / det].map((v) => Math.round(v * 1e9) / 1e9);
    if (!out.some((r) => Geo.near(r, q))) out.push(q);
  }
  return out;
})();
const dsFeasible = (q) => Bakery2D.all.every((k) => Geo.dot(k.a, q) <= k.b + 1e-9);
// labels for the crossings outside the region, in the same style as the corners' labels
const DS_OUT_LAB = { "0,10": ["(0, 10)", 40, -8], "0,8": ["(0, 8)", 38, 14], "12,0": ["(12, 0)", 0, -22], "5.333333333,0": ["(5.33, 0)", 44, -20], "2.666666667,4.666666667": ["(2.67, 4.67)", 62, 8] };
const DS_STEPS = [[0, 0], [5, 0], [4, 2], [2, 5], [0, 8], [8 / 3, 14 / 3], [2, 5]];
// decimals: whole numbers as is, halves as 4.5, thirds rounded to 2.67
const fracTex = (v) => {
  if (Math.abs(v - Math.round(v)) < 1e-6) return tnum(Math.round(v));
  const one = Math.round(v * 10) / 10;
  return Math.abs(v - one) < 1e-6 ? tnum(one) : tnum(Number(v.toFixed(2)), 2);
};

// per product: how much the mix covers (gold) against the profit (white tick); over-cover hatched gold, shortfall hatched red
class CoverMeters {
  constructor(el, scale = 20) {
    this.scale = scale;
    this.rows = [["bread", 9], ["cake", 8]].map(([name, cj], j) => {
      const row = document.createElement("div");
      row.className = "meter dm";
      row.style.setProperty("--rc", C.obj);
      row.innerHTML = `<span class="mname">${name}</span><span class="track"><span class="cov"></span><span class="over"></span><span class="short"></span><span class="need"></span></span><span class="mval"></span>`;
      el.appendChild(row);
      row.querySelector(".need").style.left = `calc(${(100 * cj) / scale}% - 1px)`;
      return { row, cov: row.querySelector(".cov"), over: row.querySelector(".over"), short: row.querySelector(".short"), val: row.querySelector(".mval"), j, cj };
    });
  }
  set(d) {
    for (const { row, cov, over, short, val, j, cj } of this.rows) {
      const covers = cj + d[j], zero = Math.abs(d[j]) < 1e-9, w = (v) => `${(100 * Math.max(0, v)) / this.scale}%`;
      cov.style.width = w(Math.min(covers, cj));
      over.style.width = w(d[j]);
      short.style.width = w(-d[j]);
      row.classList.toggle("tight", zero);
      row.classList.toggle("bad", d[j] < -1e-9);
      Deck.tex(val, `d_${j + 1} = ${zero ? "0" : fracTex(d[j])}\\ \\text{(${zero ? "exact" : d[j] < 0 ? "short" : "over"})}`);
    }
  }
}

Deck.register("dualslack", {
  steps: 6,
  init(el) {
    const p = (this.plot = bakeryPlot(el.querySelector("#dualslack-plot"), { size: 620, xmax: 12.6, ymax: 10.6 }));
    setLines(p, true);
    setRegion(p, true);
    setCorners(p, true, true);
    for (const q of CORNERS) cornerColor(p, q, "#fff", 6);
    p.moveLabel("vl5,0", [5, 0], -34, -20);  // (16/3, 0) sits just right of (5, 0): its label goes right, this one left
    // the crossings outside the region: hollow, they aren't plans
    DS_CROSS.filter((q) => !dsFeasible(q)).forEach((q, i) => {
      const [txt, dx, dy] = DS_OUT_LAB[`${q[0]},${q[1]}`];
      const dot = p.dot(`ox${i}`, q, { color: C.bg, r: 6 });
      dot.setAttribute("stroke", "#fff");
      dot.setAttribute("stroke-width", 2.5);
      p.html(`oxl${i}`, q, txt, { dx, dy, cls: "muted small halo" });
    });
    p.html("drag", [0, 0], "drag me", { cls: "muted small halo", dx: 70, dy: -64 });
    this.meters = new CoverMeters(el.querySelector("#ds-meters"));
    this.planEl = el.querySelector("#ds-plan");
    this.xEl = el.querySelector("#ds-x");
    this.yEl = el.querySelector("#ds-y");
    this.q = [0, 0];
    let dragging = false;
    const near = (t) => DS_CROSS.reduce((a, b) => (Math.hypot(t[0] - b[0], t[1] - b[1]) < Math.hypot(t[0] - a[0], t[1] - a[1]) ? b : a));
    p.svg.addEventListener("pointerdown", (e) => {
      if (this.anim) this.anim.cancel();
      dragging = true;
      p.showLabel("drag", false);
      p.svg.setPointerCapture(e.pointerId);
      this.set(near(p.toData(e)));
    });
    p.svg.addEventListener("pointermove", (e) => { if (dragging) this.set(near(p.toData(e))); });
    p.svg.addEventListener("pointerup", () => { dragging = false; });
  },
  // draw the plan at q; at a crossing also its dual (y, d) and both verdicts, mid-glide just the point
  set(q, atCrossing = true) {
    const p = this.plot, inside = dsFeasible(q);
    this.q = q;
    p.line("ring", ring(q, 0.45), { stroke: C.obj, "stroke-width": 2.5, "stroke-dasharray": inside || !atCrossing ? "" : "5 5" }, "top");
    p.dot("plan", q, { color: C.obj, r: 9 });
    p.moveLabel("drag", q, 70, -64);
    if (!atCrossing) return;
    const pr = Bakery2D.cornerProof(q), y = pr.y, d = pr.slack;
    for (const r of Bakery2D.res) p.emphasize(r.key, Math.abs(Geo.dot(r.a, q) - r.b) < 1e-9 ? "bold" : "dim");
    const tname = (t) => (t.product !== undefined ? `x_${t.product + 1} = 0` : `\\textcolor{${t.color.slice(1)}}{\\text{${t.key}}}`);
    Deck.tex(this.planEl, `\\text{corner } (${fracTex(q[0])}, ${fracTex(q[1])})\\text{, tight: } ${pr.tight.map(tname).join(",\\ ")}`);
    const over = Bakery2D.res.filter((r) => Geo.dot(r.a, q) > r.b + 1e-9).map((r) => `\\text{${r.key} over by } ${fracTex(Geo.dot(r.a, q) - r.b)}`);
    Deck.tex(this.xEl, inside
      ? `\\textcolor{${C.obj.slice(1)}}{\\checkmark\\ \\text{primal valid: } x = (${fracTex(q[0])}, ${fracTex(q[1])}),\\ \\text{profit } ${fmt(Bakery2D.value(q))}}`
      : `\\textcolor{e06a6a}{\\times\\ \\text{primal invalid: } ${over.join(",\\ ")}}`);
    const yv = (v, col) => (v < -1e-9 ? `\\boxed{\\textcolor{e06a6a}{${fracTex(v)}}}` : `\\textcolor{${col.slice(1)}}{${fracTex(v)}}`);
    const yt = `y = (${yv(y[0], C.flour)},\\ ${yv(y[1], C.oven)},\\ ${yv(y[2], C.labor)})`;
    Deck.tex(this.yEl, pr.valid
      ? `\\checkmark\\ \\text{dual valid: } ${yt},\\ \\text{bound } ${fracTex(10 * y[0] + 16 * y[1] + 12 * y[2])}`
      : `\\textcolor{e06a6a}{\\times}\\ \\text{dual invalid: } ${yt}`);
    this.meters.set(d);
  },
  render(k, animate) {
    if (this.anim) this.anim.cancel();
    const target = DS_STEPS[k];
    this.plot.showLabel("drag", k === 0);
    if (animate && k >= 1) {
      const q0 = [...this.q];
      this.anim = Anim.tween(850, (e) => this.set(e === 1 ? target : lerpP(q0, target, e), e === 1));
    } else this.set(target);
  },
});

// ------------------------------------------------------------------ slide: primal and dual pairs at a corner
// Each primal variable and its dual partner: x_j <-> d_j, s_i <-> y_i. At a corner the 2 tight constraints are the
// primal's zeros, the other 3 its basis; the dual flips it: the basis' partners are 0, the other 2 are the multipliers
// of the tight constraints (Bakery2D.cornerProof).
const PR_ROUTE = [[0, 0], [0, 0], [0, 0], [5, 0], [4, 2], [0, 6], [2, 5]];  // every corner, the optimum last
const PR_PRIMAL = ["x_1", "x_2", "s_1", "s_2", "s_3"], PR_DUAL = ["d_1", "d_2", "y_1", "y_2", "y_3"];
const prCol = (j) => (j < 2 ? null : Bakery2D.res[j - 2].color);
const prTex = (t, j) => (prCol(j) ? `\\textcolor{${prCol(j).slice(1)}}{${t}}` : t);
Deck.register("pairs", {
  steps: 6,
  init(el) {
    this.el = el;
    const grid = el.querySelector("#pr-grid"), div = (cls, html = "") => { const d = document.createElement("div"); d.className = cls; d.innerHTML = html; grid.appendChild(d); return d; };
    const names = (arr) => { div(""); arr.forEach((t, j) => Deck.tex(div("nm"), prTex(t, j))); };
    names(PR_PRIMAL);
    div("rl", "primal");
    this.pbox = PR_PRIMAL.map(() => div("bx"));
    div("");
    this.prod = PR_PRIMAL.map((t, j) => { const d = div("pp"); Deck.tex(d, `${prTex(t, j)}\\cdot ${prTex(PR_DUAL[j], j)} = 0`); return d; });
    div("rl", "dual");
    this.dbox = PR_DUAL.map(() => div("bx"));
    names(PR_DUAL);
    this.cornerEl = el.querySelector("#pr-corner");
    const p = (this.plot = bakeryPlot(el.querySelector("#pairs-plot"), { size: 520 }));
    setLines(p, true);
    hideConstraintLabels(p);
    setRegion(p, true);
    setCorners(p, true, true);
    // where each tight constraint's multiplier is written
    const at = { flour: [1.5, 7.0, 14, 0, "l"], oven: [4.6, 1.15, 16, 0, "l"], labor: [6.6, 2.7, 0, -26, ""], x1: [0, 7.3, 14, 0, "l"], x2: [7.2, 0, 0, -22, ""] };
    for (const [k, [x, y, dx, dy, cls]] of Object.entries(at)) p.html(`m-${k}`, [x, y], "", { tex: true, dx, dy, cls: `halo ${cls}`, hidden: true });
    p.svg.addEventListener("pointerdown", (e) => {
      const t = p.toData(e), q = CORNERS.reduce((a, b) => (Math.hypot(t[0] - b[0], t[1] - b[1]) < Math.hypot(t[0] - a[0], t[1] - a[1]) ? b : a));
      if (Math.hypot(t[0] - q[0], t[1] - q[1]) < 1.2) this.show(q, Math.max(this.k, 1));
    });
  },
  show(q, k) {
    const p = this.plot, pr = Bakery2D.cornerProof(q);
    const s = Bakery2D.res.map((r) => r.b - Geo.dot(r.a, q));
    const primal = [q[0], q[1], ...s].map((v) => (Math.abs(v) < 1e-9 ? 0 : v));
    const dual = [...pr.slack, ...pr.y].map((v) => (Math.abs(v) < 1e-9 ? 0 : v));
    // the tight constraints are the primal's zeros: x_j = 0 on an axis, s_i = 0 on a resource line
    const tightKey = (j) => (j < 2 ? `x${j + 1}` : Bakery2D.res[j - 2].key);
    const tight = [0, 1, 2, 3, 4].filter((j) => pr.tight.some((t) => t.key === tightKey(j)));
    PR_PRIMAL.forEach((t, j) => {
      const z = tight.includes(j);
      this.pbox[j].className = `bx${z ? " zero" : " bas"}${!z && primal[j] < -1e-9 ? " neg" : ""}`;
      this.pbox[j].textContent = fmtT(z ? 0 : primal[j]);
      const dz = !z, show = k >= 1;
      this.dbox[j].className = `bx${dz ? " zero" : " bas"}${!dz && dual[j] < -1e-9 ? " neg" : ""}${show ? "" : " hid"}`;
      this.dbox[j].textContent = fmtT(dz ? 0 : dual[j]);
      this.prod[j].style.opacity = k >= 2 ? 1 : 0;
    });
    const ok = pr.valid;
    const names = pr.tight.map((t) => (t.product !== undefined ? `x${t.product ? "₂" : "₁"} = 0` : t.key)).join(" and ");
    this.cornerEl.innerHTML = `corner <span class="v">(${fmt(q[0])}, ${fmt(q[1])})</span> · tight: ${names}` + (k >= 2 ? (ok ? ` · both rows ≥ 0: <b class="c-obj">optimal</b>` : " · the dual has a negative: not optimal") : "");
    // the plot: the corner, its tight constraints bold, each labelled with its multiplier (the dual basic value)
    for (const r of Bakery2D.res) p.emphasize(r.key, pr.tight.includes(r) ? "bold" : "dim");
    hideConstraintLabels(p);  // emphasize() brings the names back; here the tight lines carry their multipliers instead
    const ax = { x1: [[0, 0], [0, 8.5]], x2: [[0, 0], [8.5, 0]] };
    for (const key of ["x1", "x2"]) p.line(`ax-${key}`, pr.tight.some((t) => t.key === key) ? ax[key] : null, { stroke: C.ink, "stroke-width": 6 }, "under");
    tight.forEach((j) => {
      const key = tightKey(j), v = dual[j];
      p.labels[`m-${key}`].innerHTML = "";
      Deck.tex(p.labels[`m-${key}`], `${prTex(PR_DUAL[j], j)} = ${v < -1e-9 ? `\\textcolor{e06a6a}{${tnum(v)}}` : tnum(v)}`);
    });
    for (const key of ["flour", "oven", "labor", "x1", "x2"]) p.showLabel(`m-${key}`, k >= 1 && tight.some((j) => tightKey(j) === key));
    for (const c of CORNERS) cornerColor(p, c, Geo.near(c, q) ? C.obj : "#fff", Geo.near(c, q) ? 9 : 7);
    p.line("ring", ring(q, 0.36), { stroke: C.obj, "stroke-width": 2.5 }, "top");
  },
  render(k) { this.k = k; this.show(PR_ROUTE[k], k); },
});
