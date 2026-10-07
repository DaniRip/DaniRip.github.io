// 2D LP geometry + an SVG plot with an HTML label overlay (so labels can hold KaTeX).
"use strict";

const SVGNS = "http://www.w3.org/2000/svg";
function svgEl(tag, attrs = {}, parent = null) {
  const e = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (parent) parent.appendChild(e);
  return e;
}

const Geo = {
  dot: (a, b) => a[0] * b[0] + a[1] * b[1],
  // Keep the part of a convex polygon with a.x <= b (Sutherland–Hodgman, one edge).
  clip(poly, a, b) {
    const out = [];
    for (let i = 0; i < poly.length; i++) {
      const P = poly[i], Q = poly[(i + 1) % poly.length];
      const fp = Geo.dot(a, P) - b, fq = Geo.dot(a, Q) - b;
      if (fp <= 1e-9) out.push(P);
      if ((fp < -1e-9 && fq > 1e-9) || (fp > 1e-9 && fq < -1e-9)) {
        const t = fp / (fp - fq);
        out.push([P[0] + t * (Q[0] - P[0]), P[1] + t * (Q[1] - P[1])]);
      }
    }
    return out;
  },
  // Solve [[a,b],[c,d]] [x,y] = [e,f].
  solve2(M, v) {
    const det = M[0][0] * M[1][1] - M[0][1] * M[1][0];
    if (Math.abs(det) < 1e-12) throw new Error("singular 2x2 system");
    return [(v[0] * M[1][1] - M[0][1] * v[1]) / det, (M[0][0] * v[1] - v[0] * M[1][0]) / det];
  },
  near: (p, q, tol = 1e-7) => Math.abs(p[0] - q[0]) < tol && Math.abs(p[1] - q[1]) < tol,
};

// The bakery, 2D. Constraints are a.x <= b; the two sign constraints are written
// -x_j <= 0 so every constraint has an outward normal a.
const Bakery2D = (() => {
  const c = [9, 8];
  const res = [
    { key: "flour", name: "flour", a: [2, 1], b: 10, color: C.flour, tex: "2x_1 + x_2 \\le 10" },
    { key: "oven", name: "oven hours", a: [3, 2], b: 16, color: C.oven, tex: "3x_1 + 2x_2 \\le 16" },
    { key: "labor", name: "labor hours", a: [1, 2], b: 12, color: C.labor, tex: "x_1 + 2x_2 \\le 12" },
  ];
  const signs = [
    { key: "x1", name: "x₁ ≥ 0", a: [-1, 0], b: 0, color: C.muted, product: 0 },
    { key: "x2", name: "x₂ ≥ 0", a: [0, -1], b: 0, color: C.muted, product: 1 },
  ];
  const all = [...res, ...signs];
  let region = [[0, 0], [100, 0], [100, 100], [0, 100]];
  for (const r of res) region = Geo.clip(region, r.a, r.b);
  region = region.map((p) => [Math.round(p[0] * 1e9) / 1e9, Math.round(p[1] * 1e9) / 1e9]);
  const tightAt = (p) => all.filter((k) => Math.abs(Geo.dot(k.a, p) - k.b) < 1e-7);

  // The candidate proof at a corner: write c as a combination of the outward
  // normals of the two constraints tight there. Resource multipliers are shadow
  // prices y_i; the multiplier on "x_j >= 0" is product j's dual slack
  // (= reduced cost) a_j.y - c_j. Every other entry is zero.
  function cornerProof(p, obj = c) {
    const T = tightAt(p);
    if (T.length !== 2) throw new Error(`corner ${p} is degenerate (${T.length} tight)`);
    const lam = Geo.solve2([[T[0].a[0], T[1].a[0]], [T[0].a[1], T[1].a[1]]], obj);
    const y = res.map((r) => { const i = T.indexOf(r); return i < 0 ? 0 : lam[i]; });
    const slack = [0, 1].map((j) => res.reduce((s, r, i) => s + r.a[j] * y[i], 0) - obj[j]);
    return { tight: T, lam, y, slack, valid: y.every((v) => v >= -1e-9) && slack.every((v) => v >= -1e-9) };
  }

  return { c, res, signs, all, region, tightAt, cornerProof, value: (p, obj = c) => Geo.dot(obj, p) };
})();

class Plot2D {
  // opts: {size, xmax, ymax, margin, xlabel, ylabel}
  constructor(container, opts) {
    this.o = Object.assign({ size: 720, xmin: 0, ymin: 0, xmax: 8.5, ymax: 8.5, margin: { l: 70, r: 24, t: 24, b: 66 } }, opts);
    const { size, margin: m, xmin, ymin, xmax, ymax } = this.o;
    this.k = Math.min((size - m.l - m.r) / (xmax - xmin), (size - m.t - m.b) / (ymax - ymin));
    this.box = [[xmin, ymin], [xmax, ymin], [xmax, ymax], [xmin, ymax]];
    container.classList.add("plot");
    container.style.width = `${size}px`;
    container.style.height = `${size}px`;
    this.svg = svgEl("svg", { width: size, height: size, viewBox: `0 0 ${size} ${size}` }, container);
    this.ov = document.createElement("div");
    this.ov.className = "ov";
    container.appendChild(this.ov);
    this.defs = svgEl("defs", {}, this.svg);
    const L = (n) => svgEl("g", { class: n }, this.svg);
    this.g = { grid: L("grid"), shade: L("shade"), fill: L("fill"), region: L("region"), lines: L("lines"),
      under: L("under"), level: L("level"), arrows: L("arrows"), pts: L("pts"), top: L("top") };
    this.items = {};
    this.labels = {};
    this.drawAxes();
  }
  px(x) { return this.o.margin.l + (x - this.o.xmin) * this.k; }
  py(y) { return this.o.size - this.o.margin.b - (y - this.o.ymin) * this.k; }
  P(p) { return [this.px(p[0]), this.py(p[1])]; }
  path(poly, close = true) {
    if (!poly.length) return "";
    return poly.map((p, i) => `${i ? "L" : "M"}${this.px(p[0]).toFixed(2)},${this.py(p[1]).toFixed(2)}`).join("") + (close ? "Z" : "");
  }
  // segment of a.x = b inside the plot box
  segment(a, b, lim = this.o) {
    const { xmin: X0, ymin: Y0, xmax: X, ymax: Y } = lim, pts = [];
    if (Math.abs(a[1]) > 1e-12) { pts.push([X0, (b - a[0] * X0) / a[1]]); pts.push([X, (b - a[0] * X) / a[1]]); }
    if (Math.abs(a[0]) > 1e-12) { pts.push([(b - a[1] * Y0) / a[0], Y0]); pts.push([(b - a[1] * Y) / a[0], Y]); }
    const inside = pts.filter((p) => p[0] >= X0 - 1e-9 && p[0] <= X + 1e-9 && p[1] >= Y0 - 1e-9 && p[1] <= Y + 1e-9);
    const uniq = [];
    for (const p of inside) if (!uniq.some((q) => Geo.near(p, q, 1e-6))) uniq.push(p);
    if (uniq.length < 2) return null;
    uniq.sort((p, q) => p[0] - q[0] || q[1] - p[1]);
    return [uniq[0], uniq[uniq.length - 1]];
  }

  drawAxes() {
    const { xmin, ymin, xmax, ymax } = this.o;
    const gl = { stroke: "var(--grid)", "stroke-width": 1 };
    for (let v = Math.ceil(xmin); v <= Math.floor(xmax); v++) {
      if (v === 0) continue;
      svgEl("line", { ...gl, x1: this.px(v), y1: this.py(ymin), x2: this.px(v), y2: this.py(ymax) }, this.g.grid);
      if (v > 0) svgEl("text", { x: this.px(v), y: this.py(0) + 30, class: "tick", "text-anchor": "middle" }, this.g.grid).textContent = v;
    }
    for (let v = Math.ceil(ymin); v <= Math.floor(ymax); v++) {
      if (v === 0) continue;
      svgEl("line", { ...gl, x1: this.px(xmin), y1: this.py(v), x2: this.px(xmax), y2: this.py(v) }, this.g.grid);
      if (v > 0) svgEl("text", { x: this.px(0) - 16, y: this.py(v) + 6, class: "tick", "text-anchor": "end" }, this.g.grid).textContent = v;
    }
    svgEl("text", { x: this.px(0) - 16, y: this.py(0) + 30, class: "tick", "text-anchor": "end" }, this.g.grid).textContent = 0;
    const ax = { stroke: "var(--axis)", "stroke-width": 2 };
    svgEl("line", { ...ax, x1: this.px(xmin), y1: this.py(0), x2: this.px(xmax) + 10, y2: this.py(0) }, this.g.grid);
    svgEl("line", { ...ax, x1: this.px(0), y1: this.py(ymin), x2: this.px(0), y2: this.py(ymax) - 10 }, this.g.grid);
    if (this.o.xlabel) this.html("xlab", [xmax, 0], this.o.xlabel, { dx: -4, dy: 56, cls: "r muted small" });
    if (this.o.ylabel) this.html("ylab", [0, ymax], this.o.ylabel, { dx: 14, dy: -6, cls: "l muted small" });
  }

  // Data coordinates of a pointer event (accounts for the stage's CSS scaling).
  toData(evt) {
    const pt = this.svg.createSVGPoint();
    pt.x = evt.clientX; pt.y = evt.clientY;
    const q = pt.matrixTransform(this.svg.getScreenCTM().inverse());
    return [this.o.xmin + (q.x - this.o.margin.l) / this.k, this.o.ymin + (this.o.size - this.o.margin.b - q.y) / this.k];
  }

  // HTML label at data point p (+ pixel offset). `content` is plain text unless opts.tex.
  html(id, p, content, opts = {}) {
    let el = this.labels[id];
    if (!el) {
      el = document.createElement("div");
      this.ov.appendChild(el);
      this.labels[id] = el;
    }
    el.className = `lab ${opts.cls || ""}`;
    if (opts.color) el.style.color = opts.color;
    if (opts.tex) Deck.tex(el, content); else el.textContent = content;
    this.moveLabel(id, p, opts.dx || 0, opts.dy || 0);
    if (opts.hidden) el.style.opacity = 0;
    return el;
  }
  moveLabel(id, p, dx = 0, dy = 0) {
    const el = this.labels[id];
    el.style.left = `${this.px(p[0]) + dx}px`;
    el.style.top = `${this.py(p[1]) + dy}px`;
  }
  showLabel(id, on) { this.labels[id].style.opacity = on ? 1 : 0; }

  // Soft glow (blurred copy under the shape); returns the filter url.
  glow(id = "glow", std = 7) {
    if (!this.defs.querySelector(`#${id}`)) {
      const f = svgEl("filter", { id, x: "-100%", y: "-100%", width: "300%", height: "300%" }, this.defs);
      svgEl("feGaussianBlur", { in: "SourceGraphic", stdDeviation: std, result: "b" }, f);
      const m = svgEl("feMerge", {}, f);
      svgEl("feMergeNode", { in: "b" }, m);
      svgEl("feMergeNode", { in: "SourceGraphic" }, m);
    }
    return `url(#${id})`;
  }

  // A thin white hatched strip just outside each axis and in the corner between them (x1 < 0 and x2 < 0
  // are ruled out), in the same
  // style as the constraints' infeasible sides, drawn under the tick numbers. width is in data units.
  signStrips(width = 0.55) {
    const fill = this.hatch(`xh${Math.random().toString(36).slice(2, 8)}`, "#ffffff");
    const { xmax, ymax } = this.o, first = this.g.grid.firstChild;
    // the left strip runs down through the (-,-) corner behind the "0"
    return [[[-width, -width], [0, -width], [0, ymax], [-width, ymax]], [[0, -width], [xmax, -width], [xmax, 0], [0, 0]]]
      .map((poly) => this.g.grid.insertBefore(svgEl("path", { d: this.path(poly), fill, class: "fade" }), first));
  }

  hatch(id, color) {
    const pat = svgEl("pattern", { id, width: 12, height: 12, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" }, this.defs);
    svgEl("rect", { width: 12, height: 12, fill: color, "fill-opacity": 0.06 }, pat);
    svgEl("line", { x1: 0, y1: 0, x2: 0, y2: 12, stroke: color, "stroke-opacity": 0.28, "stroke-width": 2 }, pat);
    return `url(#${id})`;
  }

  // A resource constraint: line + infeasible-side hatching + label.
  addConstraint(r, labelAt, labelOpts = {}) {
    // constraint lines can be limited to the positive quadrant (opts.linesPositive)
    const lim = this.o.linesPositive ? { ...this.o, xmin: 0, ymin: 0 } : this.o;
    const seg = this.segment(r.a, r.b, lim);
    const bad = Geo.clip(this.box, [-r.a[0], -r.a[1]], -r.b);
    const uid = `h${Math.random().toString(36).slice(2, 8)}`;
    const shade = svgEl("path", { d: this.path(bad), fill: this.hatch(uid, r.color), class: "fade", opacity: 0 }, this.g.shade);
    const line = svgEl("path", { d: this.path(seg, false), stroke: r.color, "stroke-width": 3.5, fill: "none", "stroke-linecap": "round", opacity: 0 }, this.g.lines);
    this.items[r.key] = { line, shade, r };
    if (labelAt) this.html(`c-${r.key}`, labelAt, r.label || r.name, { color: r.color, hidden: true, cls: `halo ${labelOpts.cls || ""}`, dx: labelOpts.dx, dy: labelOpts.dy, tex: labelOpts.tex });
    return this.items[r.key];
  }
  // Show/hide a constraint; returns an animation promise when animated.
  constraint(key, on, animate = false, { shade = true } = {}) {
    const it = this.items[key];
    it.line.setAttribute("opacity", on ? 1 : 0);
    it.shade.setAttribute("opacity", on && shade ? 1 : 0);
    if (this.labels[`c-${key}`]) this.showLabel(`c-${key}`, on);
    if (on && animate) return Anim.draw(it.line, 800);
    return null;
  }
  emphasize(key, mode) {
    // mode: "normal" | "bold" | "dim"
    const it = this.items[key];
    it.line.setAttribute("stroke-width", mode === "bold" ? 6 : 3.5);
    it.line.setAttribute("opacity", mode === "dim" ? 0.28 : 1);
    if (this.labels[`c-${key}`]) this.labels[`c-${key}`].style.opacity = mode === "dim" ? 0.35 : 1;
  }

  regionShape(poly) {
    if (!this.regionEl) {
      this.regionEl = svgEl("path", { fill: "#ffffff", "fill-opacity": 0.07, stroke: "#ffffff", "stroke-opacity": 0.85, "stroke-width": 2, "stroke-linejoin": "round", class: "fade", opacity: 0 }, this.g.region);
    }
    this.regionEl.setAttribute("d", this.path(poly));
    return this.regionEl;
  }

  dot(id, p, { r = 7, color = "#fff", hidden = false } = {}) {
    let el = this.items[id];
    if (!el) {
      el = svgEl("circle", { r, fill: color, stroke: C.bg, "stroke-width": 3, class: "fade" }, this.g.pts);
      this.items[id] = el;
    }
    el.setAttribute("cx", this.px(p[0]));
    el.setAttribute("cy", this.py(p[1]));
    el.setAttribute("fill", color);
    el.setAttribute("r", r);
    if (hidden) el.setAttribute("opacity", 0);
    return el;
  }

  // Generic line/polyline by id.
  line(id, pts, attrs = {}, layer = "level") {
    let el = this.items[id];
    if (!el) { el = svgEl("path", { fill: "none", "stroke-linecap": "round", "stroke-linejoin": "round" }, this.g[layer]); this.items[id] = el; }
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    el.setAttribute("d", pts ? this.path(pts, false) : "");
    return el;
  }
  poly(id, pts, attrs = {}, layer = "fill") {
    let el = this.items[id];
    if (!el) { el = svgEl("path", {}, this.g[layer]); this.items[id] = el; }
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    el.setAttribute("d", pts && pts.length ? this.path(pts) : "");
    return el;
  }

  // Level set c.x = z clipped to the box.
  level(id, c, z, attrs = {}) {
    const seg = this.segment(c, z);
    return this.line(id, seg, { stroke: C.obj, "stroke-width": 3.5, ...attrs });
  }

  // Arrow from p to q in data coordinates (head drawn as its own path so colour can change).
  arrow(id, p, q, { color = C.obj, width = 4, head = 16, layer = "arrows" } = {}) {
    let it = this.items[id];
    if (!it) {
      const g = svgEl("g", { class: "fade" }, this.g[layer]);
      it = { g, shaft: svgEl("path", { fill: "none", "stroke-linecap": "round" }, g), tip: svgEl("path", {}, g) };
      this.items[id] = it;
    }
    const [x1, y1] = this.P(p), [x2, y2] = this.P(q);
    const ang = Math.atan2(y2 - y1, x2 - x1), L = Math.hypot(x2 - x1, y2 - y1);
    const hx = x2 - Math.cos(ang) * head * 0.8, hy = y2 - Math.sin(ang) * head * 0.8;
    it.shaft.setAttribute("d", L > head * 0.8 ? `M${x1},${y1}L${hx},${hy}` : "");
    it.shaft.setAttribute("stroke", color);
    it.shaft.setAttribute("stroke-width", width);
    const a1 = ang + Math.PI * 0.85, a2 = ang - Math.PI * 0.85;
    it.tip.setAttribute("d", L > 1 ? `M${x2},${y2}L${x2 + Math.cos(a1) * head},${y2 + Math.sin(a1) * head}L${x2 + Math.cos(a2) * head},${y2 + Math.sin(a2) * head}Z` : "");
    it.tip.setAttribute("fill", color);
    return it.g;
  }
}
