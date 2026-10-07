// 3D LP geometry + an SVG scene with an orthographic camera (top-down view = the 2D plot).
"use strict";

const V3 = {
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  mul: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  unit: (a) => V3.mul(a, 1 / Math.hypot(a[0], a[1], a[2])),
  lerp: (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t],
  near: (a, b, tol = 1e-7) => Math.abs(a[0] - b[0]) < tol && Math.abs(a[1] - b[1]) < tol && Math.abs(a[2] - b[2]) < tol,
};

// The polyhedron {x : a.x <= b for every constraint}: vertices (with their tight sets),
// faces (vertex indices counter-clockwise seen from outside) and edges (with their two faces).
function buildPolyhedron(cons) {
  const verts = [];
  for (let i = 0; i < cons.length; i++) for (let j = i + 1; j < cons.length; j++) for (let k = j + 1; k < cons.length; k++) {
    const M = [cons[i].a, cons[j].a, cons[k].a];
    const det = V3.dot(M[0], V3.cross(M[1], M[2]));
    if (Math.abs(det) < 1e-12) continue;
    const Mi = Lin.inv3(M), rhs = [cons[i].b, cons[j].b, cons[k].b];
    const p = Mi.map((r) => r[0] * rhs[0] + r[1] * rhs[1] + r[2] * rhs[2]).map((v) => Math.round(v * 1e9) / 1e9);
    if (!cons.every((c) => V3.dot(c.a, p) <= c.b + 1e-7)) continue;
    if (verts.some((v) => V3.near(v.p, p))) continue;
    verts.push({ p, tight: cons.map((c, ci) => (Math.abs(V3.dot(c.a, p) - c.b) < 1e-7 ? ci : -1)).filter((ci) => ci >= 0) });
  }
  for (const v of verts) if (v.tight.length !== 3) throw new Error(`degenerate vertex ${v.p}`);
  const faces = [];
  cons.forEach((c, ci) => {
    const idx = verts.map((v, vi) => (v.tight.includes(ci) ? vi : -1)).filter((vi) => vi >= 0);
    if (idx.length < 3) return;
    const cen = V3.mul(idx.reduce((s, vi) => V3.add(s, verts[vi].p), [0, 0, 0]), 1 / idx.length);
    const n = V3.unit(c.a), u = V3.unit(V3.sub(verts[idx[0]].p, cen)), w = V3.cross(n, u);
    const ang = (vi) => { const q = V3.sub(verts[vi].p, cen); return Math.atan2(V3.dot(q, w), V3.dot(q, u)); };
    idx.sort((p, q) => ang(p) - ang(q));
    faces.push({ ci, key: c.key, color: c.color, idx, normal: c.a });
  });
  const edges = [];
  for (let i = 0; i < verts.length; i++) for (let j = i + 1; j < verts.length; j++) {
    const shared = verts[i].tight.filter((t) => verts[j].tight.includes(t));
    if (shared.length === 2) edges.push({ i, j, faces: shared.map((ci) => faces.findIndex((f) => f.ci === ci)) });
  }
  return { verts, faces, edges, cons };
}

// Polygon where the plane n.x = z cuts a convex body given by its vertices and edges
// (pairs of indices); ordered around its centroid. Empty when the plane misses the body.
function slicePolygon(points, edges, n, z) {
  const pts = [];
  const add = (p) => { if (!pts.some((q) => V3.near(p, q, 1e-7))) pts.push(p); };
  for (const [i, j] of edges) {
    const a = V3.dot(n, points[i]) - z, b = V3.dot(n, points[j]) - z;
    if (Math.abs(a) < 1e-9) add(points[i]);
    if (Math.abs(b) < 1e-9) add(points[j]);
    if (a * b < 0) add(V3.lerp(points[i], points[j], a / (a - b)));
  }
  if (pts.length < 3) return pts;
  const cen = V3.mul(pts.reduce((s, p) => V3.add(s, p), [0, 0, 0]), 1 / pts.length);
  const nu = V3.unit(n), u = V3.unit(V3.cross(nu, Math.abs(nu[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0])), w = V3.cross(nu, u);
  const ang = (p) => { const q = V3.sub(p, cen); return Math.atan2(V3.dot(q, w), V3.dot(q, u)); };
  return pts.sort((p, q) => ang(p) - ang(q));
}
function boxBody(X, Y, Z) {
  const points = [];
  for (const x of [0, X]) for (const y of [0, Y]) for (const z of [0, Z]) points.push([x, y, z]);
  const edges = [];
  for (let i = 0; i < 8; i++) for (let j = i + 1; j < 8; j++) {
    const d = V3.sub(points[i], points[j]);
    if ([d[0], d[1], d[2]].filter((v) => v !== 0).length === 1) edges.push([i, j]);
  }
  return { points, edges };
}

// The Klee–Minty cube drawn with each axis rescaled to length 6 (x1/5, x2/25, x3/125), so it looks like a
// squashed cube instead of a needle. kmShow maps an original point to these display coordinates.
const kmShow = (p) => [(6 * p[0]) / 5, (6 * p[1]) / 25, (6 * p[2]) / 125];
const KleeMinty3D = (() => {
  const grey = "#9aa0ad";
  const cons = [
    { key: "k1", a: [1, 0, 0], b: 6, color: grey },
    { key: "k2", a: [0.8, 1, 0], b: 6, color: grey },
    { key: "k3", a: [0.32, 0.8, 1], b: 6, color: grey },
    ...[0, 1, 2].map((j) => ({ key: `x${j + 1}`, a: [0, 1, 2].map((i) => (i === j ? -1 : 0)), b: 0, color: grey })),
  ];
  return { poly: buildPolyhedron(cons) };
})();

// The bakery with cookies. Sign constraints are written -x_j <= 0.
const Bakery3D = (() => {
  const c = [9, 8, 5];
  const res = [
    { key: "flour", name: "flour", a: [2, 1, 1], b: 10, color: C.flour },
    { key: "oven", name: "oven hours", a: [3, 2, 1], b: 16, color: C.oven },
    { key: "labor", name: "labor hours", a: [1, 2, 1], b: 12, color: C.labor },
  ];
  const signs = [0, 1, 2].map((j) => ({ key: `x${j + 1}`, a: [0, 1, 2].map((i) => (i === j ? -1 : 0)), b: 0, color: C.muted }));
  return { c, res, signs, poly: buildPolyhedron([...res, ...signs]) };
})();

class Scene3D {
  constructor(container, opts = {}) {
    this.o = Object.assign({ width: 820, height: 680 }, opts);
    const { width: W, height: H } = this.o;
    container.classList.add("plot");
    container.style.width = `${W}px`;
    container.style.height = `${H}px`;
    this.svg = svgEl("svg", { width: W, height: H, viewBox: `0 0 ${W} ${H}` }, container);
    this.svg.style.overflow = "hidden";
    this.ov = document.createElement("div");
    this.ov.className = "ov";
    this.ov.style.overflow = "hidden";
    container.appendChild(this.ov);
    const L = (n) => svgEl("g", { class: n }, this.svg);
    // "mid" sits between back and front faces, so things drawn there read as inside the polyhedron
    this.g = { grid: L("grid"), flat: L("flat"), back: L("back"), axes: L("axes"), mid: L("mid"), faces: L("faces"),
      edges: L("edges"), under: L("under"), top: L("top"), pts: L("pts") };
    this.cam = { ...Scene3D.TOP };
    this.lift = 1;      // x3 is drawn scaled by this (the "rising" animation)
    this.solid = 1;     // opacity of the polyhedron
    this.flat = 0;      // opacity of the 2D look (floor region outline + constraint lines)
    this.tilt = 1;      // opacity of things that only make sense in 3D (x3 axis)
    this.items = {};
    this.faceMode = {};
    this.rotatable = true;
    let drag = null;
    this.svg.addEventListener("pointerdown", (e) => {
      if (!this.rotatable) return;
      if (this.camAnim) this.camAnim.cancel();
      drag = { x: e.clientX, y: e.clientY, az: this.cam.az, el: this.cam.el };
      this.svg.setPointerCapture(e.pointerId);
      if (this.onDrag) this.onDrag();
    });
    this.svg.addEventListener("pointermove", (e) => {
      if (!drag) return;
      const s = this.svg.getScreenCTM().a;  // stage scale
      this.cam.az = drag.az - (e.clientX - drag.x) / s / 220;
      this.cam.el = Math.max(0.02, Math.min(Math.PI / 2, drag.el + (e.clientY - drag.y) / s / 220));
      this.render();
    });
    this.svg.addEventListener("pointerup", () => { drag = null; });
    this.svg.style.cursor = "grab";
    this.svg.style.touchAction = "none";
  }

  // world point -> [px, py, depth]; x3 is scaled by the lift unless lifted = false
  P(p, lifted = true) {
    const { az, el, scale, center } = this.cam;
    const q = [p[0] - center[0], p[1] - center[1], p[2] * (lifted ? this.lift : 1) - center[2]];
    const ca = Math.cos(az), sa = Math.sin(az), ce = Math.cos(el), se = Math.sin(el);
    const sx = q[0] * ca + q[1] * sa, h = -q[0] * sa + q[1] * ca;
    const sy = se * h + ce * q[2];
    return [this.o.width / 2 + scale * sx, this.o.height / 2 - scale * sy, ce * h - se * q[2]];
  }
  d(pts, close = false) {
    return pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join("") + (close ? "Z" : "");
  }

  // ---- persistent items, re-projected on every render ----
  item(id, kind, layer, make) {
    if (!this.items[id]) this.items[id] = { kind, ...make(this.g[layer]) };
    return this.items[id];
  }
  line(id, pts, attrs = {}, layer = "top", { lifted = true, closed = false } = {}) {
    const it = this.item(id, "line", layer, (g) => ({ el: svgEl("path", { fill: "none", "stroke-linecap": "round", "stroke-linejoin": "round" }, g) }));
    for (const [k, v] of Object.entries(attrs)) it.el.setAttribute(k, v);
    Object.assign(it, { pts, lifted, closed });
    this.draw(it);
    return it.el;
  }
  dot(id, p, attrs = {}) {
    const it = this.item(id, "dot", "pts", (g) => ({ el: svgEl("circle", { r: 7, fill: "#fff", stroke: C.bg, "stroke-width": 3 }, g) }));
    for (const [k, v] of Object.entries(attrs)) it.el.setAttribute(k, v);
    it.p = p;
    this.draw(it);
    return it.el;
  }
  arrow(id, p, q, { color = C.obj, width = 4, head = 15, layer = "top", lifted = true } = {}) {
    const it = this.item(id, "arrow", layer, (g) => {
      const grp = svgEl("g", {}, g);
      return { el: grp, shaft: svgEl("path", { fill: "none", "stroke-linecap": "round" }, grp), tip: svgEl("path", {}, grp) };
    });
    Object.assign(it, { p, q, color, width, head, lifted });
    this.draw(it);
    return it.el;
  }
  label(id, p, content, { tex = false, cls = "", dx = 0, dy = 0, color = null, lifted = true } = {}) {
    const it = this.item(id, "label", "top", () => {
      const el = document.createElement("div");
      this.ov.appendChild(el);
      return { el };
    });
    it.el.className = `lab ${cls}`;
    if (color) it.el.style.color = color;
    if (tex) Deck.tex(it.el, content); else it.el.textContent = content;
    Object.assign(it, { p, dx, dy, lifted });
    this.draw(it);
    return it.el;
  }
  draw(it) {
    if (it.kind === "line") it.el.setAttribute("d", it.pts ? this.d(it.pts.map((p) => this.P(p, it.lifted)), it.closed) : "");
    else if (it.kind === "dot") { const [x, y] = this.P(it.p); it.el.setAttribute("cx", x); it.el.setAttribute("cy", y); }
    else if (it.kind === "label") { const [x, y] = this.P(it.p, it.lifted); it.el.style.left = `${x + it.dx}px`; it.el.style.top = `${y + it.dy}px`; }
    else if (it.kind === "arrow") {
      if (!it.p) { it.shaft.setAttribute("d", ""); it.tip.setAttribute("d", ""); return; }
      const [x1, y1] = this.P(it.p, it.lifted), [x2, y2] = this.P(it.q, it.lifted);
      const ang = Math.atan2(y2 - y1, x2 - x1), L = Math.hypot(x2 - x1, y2 - y1), h = Math.min(it.head, L * 0.6);
      it.shaft.setAttribute("d", L > 1 ? `M${x1},${y1}L${x2 - Math.cos(ang) * h * 0.8},${y2 - Math.sin(ang) * h * 0.8}` : "");
      it.shaft.setAttribute("stroke", it.color);
      it.shaft.setAttribute("stroke-width", it.width);
      const a1 = ang + Math.PI * 0.85, a2 = ang - Math.PI * 0.85;
      it.tip.setAttribute("d", L > 1 ? `M${x2},${y2}L${x2 + Math.cos(a1) * h},${y2 + Math.sin(a1) * h}L${x2 + Math.cos(a2) * h},${y2 + Math.sin(a2) * h}Z` : "");
      it.tip.setAttribute("fill", it.color);
    }
  }

  // ---- the floor: grid, x1/x2 axes and ticks (same look as the 2D plot), plus the x3 axis ----
  floor(xmax = 8.5, ymax = 8.5, zmax = 11, { ticks = true, labels = ["bread  x₁", "cake  x₂", "cookies  x₃"] } = {}) {
    // tick labels sit just outside the axes in world units, so they follow the camera
    for (let v = 1; v <= Math.floor(xmax); v++) {
      this.line(`gx${v}`, [[v, 0, 0], [v, ymax, 0]], { stroke: "var(--grid)", "stroke-width": 1 }, "grid", { lifted: false });
      if (ticks) this.label(`tx${v}`, [v, -0.42, 0], String(v), { cls: "tick3", lifted: false });
    }
    for (let v = 1; v <= Math.floor(ymax); v++) {
      this.line(`gy${v}`, [[0, v, 0], [xmax, v, 0]], { stroke: "var(--grid)", "stroke-width": 1 }, "grid", { lifted: false });
      if (ticks) this.label(`ty${v}`, [-0.42, v, 0], String(v), { cls: "tick3", lifted: false });
    }
    const ax = { stroke: "var(--axis)", "stroke-width": 2 };
    this.line("ax1", [[0, 0, 0], [xmax, 0, 0]], ax, "axes", { lifted: false });
    this.line("ax2", [[0, 0, 0], [0, ymax, 0]], ax, "axes", { lifted: false });
    this.line("ax3", [[0, 0, 0], [0, 0, zmax]], ax, "axes", { lifted: false });
    this.label("lx1", [xmax + 0.5, -0.9, 0], labels[0], { cls: "muted small", lifted: false });
    this.label("lx2", [-0.9, ymax + 0.5, 0], labels[1], { cls: "muted small", lifted: false });
    this.label("lx3", [0, 0, zmax + 0.6], labels[2], { cls: "muted small zt", lifted: false });
  }

  // The 2D look: floor region outline + resource lines on the floor (fade with this.flat).
  flatLook(region2d, res2d) {
    this.line("flatRegion", region2d.map((p) => [p[0], p[1], 0]), { fill: "#ffffff", "fill-opacity": 0.07, stroke: "#fff", "stroke-width": 2 }, "flat", { lifted: false, closed: true });
    for (const r of res2d) {
      const ends = [];
      for (const x of [0, 8.5]) { const y = (r.b - r.a[0] * x) / r.a[1]; if (y >= 0 && y <= 8.5) ends.push([x, y, 0]); }
      for (const y of [0, 8.5]) { const x = (r.b - r.a[1] * y) / r.a[0]; if (x >= 0 && x <= 8.5) ends.push([x, y, 0]); }
      this.line(`flat-${r.key}`, ends.slice(0, 2), { stroke: r.color, "stroke-width": 3.5 }, "flat", { lifted: false });
    }
  }

  polyhedron(poly) {
    this.poly = poly;
    this.faceEls = poly.faces.map((f) => svgEl("path", { "stroke-linejoin": "round" }, this.g.back));
    this.edgeEls = poly.edges.map(() => svgEl("path", { fill: "none", "stroke-linecap": "round" }, this.g.edges));
    this.cornerEls = poly.verts.map(() => svgEl("circle", { r: 5, fill: "#fff", stroke: C.bg, "stroke-width": 2 }, this.g.edges));
    this.drawPoly();
  }
  // mode per face key: "normal" | "bold" | "dim"
  setFace(key, mode) { this.faceMode[key] = mode; this.drawPoly(); }
  drawPoly() {
    if (!this.poly) return;
    const { verts, faces, edges } = this.poly;
    const P = verts.map((v) => this.P(v.p));
    const front = faces.map((f) => {
      const q = f.idx.map((i) => P[i]);
      let a = 0;
      for (let i = 0; i < q.length; i++) { const u = q[i], w = q[(i + 1) % q.length]; a += u[0] * w[1] - w[0] * u[1]; }
      return a < -1e-3;  // screen y points down, so counter-clockwise-from-outside shows as negative area
    });
    faces.forEach((f, i) => {
      const el = this.faceEls[i], mode = this.faceMode[f.key] || "normal";
      const isRes = !f.key.startsWith("x");
      const base = isRes ? (front[i] ? 0.17 : 0.06) : (front[i] ? 0.05 : 0.03);
      const op = { normal: base, bold: isRes ? 0.42 : 0.12, dim: base * 0.35 }[mode];
      el.setAttribute("d", this.d(f.idx.map((vi) => P[vi]), true));
      el.setAttribute("fill", isRes ? f.color : "#ffffff");
      el.setAttribute("fill-opacity", op * this.solid);
      el.setAttribute("stroke", "none");
      (front[i] ? this.g.faces : this.g.back).appendChild(el);
    });
    edges.forEach((e, k) => {
      const vis = front[e.faces[0]] || front[e.faces[1]];
      const el = this.edgeEls[k];
      el.setAttribute("d", this.d([P[e.i], P[e.j]]));
      el.setAttribute("stroke", "#ffffff");
      el.setAttribute("stroke-width", vis ? 2.2 : 1.4);
      el.setAttribute("stroke-dasharray", vis ? "" : "6 6");
      el.setAttribute("stroke-opacity", (vis ? 0.9 : 0.35) * this.solid);
    });
    this.cornerEls.forEach((el, i) => {
      el.setAttribute("cx", P[i][0]);
      el.setAttribute("cy", P[i][1]);
      el.setAttribute("opacity", this.solid);
    });
  }

  render() {
    for (const it of Object.values(this.items)) this.draw(it);
    this.g.flat.setAttribute("opacity", this.flat);
    for (const id of ["ax3", "lx3"]) this.items[id] && (this.items[id].el.style.opacity = this.tilt);
    this.ov.querySelectorAll(".zt").forEach((e) => { e.style.opacity = this.tilt; });
    this.ov.querySelectorAll(".tick3").forEach((e) => { e.style.opacity = 1 - 0.7 * this.solid; });
    this.drawPoly();
  }
  // Tween camera (and optionally lift/solid/flat/tilt) to a target state.
  animateTo(target, ms) {
    if (this.camAnim) this.camAnim.cancel();
    const c0 = { ...this.cam, center: [...this.cam.center] }, s0 = { lift: this.lift, solid: this.solid, flat: this.flat, tilt: this.tilt };
    const apply = (e) => {
      if (target.cam) {
        const t = target.cam;
        this.cam = { az: lerp(c0.az, t.az, e), el: lerp(c0.el, t.el, e), scale: lerp(c0.scale, t.scale, e), center: V3.lerp(c0.center, t.center, e) };
      }
      for (const k of ["lift", "solid", "flat", "tilt"]) if (target[k] !== undefined) this[k] = lerp(s0[k], target[k], e);
      this.render();
    };
    if (!ms) { apply(1); return null; }
    this.camAnim = Anim.tween(ms, apply);
    return this.camAnim;
  }
}
// Straight down the x3 axis: identical framing to the 2D plots.
Scene3D.TOP = { az: 0, el: Math.PI / 2, scale: 62, center: [4.25, 4.0, 0] };
// The floor tilted toward the viewer, x1 still pointing roughly right.
Scene3D.FLAT = { az: 0.5, el: 0.75, scale: 54, center: [4.0, 3.6, 2.2] };
// Looking into the positive octant, so the resource planes face the viewer.
Scene3D.TILT = { az: 2.35, el: 0.38, scale: 47, center: [2.4, 2.8, 4.3] };
// Close to the optimal corner, about 50° off the profit direction: the cone of normals fans out.
// From the bread side: the profit plane is seen at an angle as it sweeps through.
Scene3D.SWEEP = { az: 1.15, el: 0.4, scale: 46, center: [2.6, 3.2, 4.3] };
Scene3D.SIDE = { az: 1.3, el: 0.72, scale: 92, center: [3.1, 5.0, 2.7] };
