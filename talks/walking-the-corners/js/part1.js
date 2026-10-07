// Controllers for Parts 0–2: hook, the 2D bakery, and the proof (duality).
"use strict";

const fmt = (v, d = 1) => {
  if (Math.abs(v) < 1e-9) v = 0;
  const r = Math.round(v);
  const s = Math.abs(v - r) < 1e-9 ? String(Math.abs(r)) : Math.abs(v).toFixed(d);
  return (v < 0 ? "−" : "") + s;
};
const tnum = (v, d = 1) => fmt(v, d).replace("−", "-");
const lerp = (a, b, t) => a + (b - a) * t;
const lerpP = (p, q, t) => [lerp(p[0], q[0], t), lerp(p[1], q[1], t)];
const ckey = (p) => `${Math.round(p[0])},${Math.round(p[1])}`;

const CORNERS = [[0, 0], [5, 0], [4, 2], [2, 5], [0, 6]];
const CORNER_LABEL_OFF = { "0,0": [36, -22], "5,0": [34, -20], "4,2": [48, 0], "2,5": [34, -26], "0,6": [44, -24] };
const CONSTRAINT_LABEL = {
  flour: [[1.5, 7.0], { dx: 14, cls: "l" }],
  oven: [[4.53, 1.2], { dx: 16, cls: "l" }],
  labor: [[7.6, 2.2], { dy: -24 }],
};
const RES = Object.fromEntries(Bakery2D.res.map((r) => [r.key, r]));

// A plot of the bakery with every element present but hidden; slides switch things on.
function bakeryPlot(container, opts = {}) {
  const plot = new Plot2D(container, Object.assign({ xlabel: "bread  x₁", ylabel: "cake  x₂" }, opts));
  for (const r of Bakery2D.res) {
    const [p, o] = (opts.labels && opts.labels[r.key]) || CONSTRAINT_LABEL[r.key];
    plot.addConstraint(r, p, o);
  }
  plot.regionShape(Bakery2D.region);
  for (const p of CORNERS) {
    const k = ckey(p), [dx, dy] = CORNER_LABEL_OFF[k];
    plot.dot(`v${k}`, p, { hidden: true });
    plot.html(`vl${k}`, p, `(${p[0]}, ${p[1]})`, { dx, dy, cls: "muted small halo", hidden: true });
  }
  return plot;
}
function setLines(plot, on, shade = false) {
  for (const r of Bakery2D.res) plot.constraint(r.key, on, false, { shade });
}
function setRegion(plot, on) { plot.regionEl.setAttribute("opacity", on ? 1 : 0); }
function setCorners(plot, on, labels = on) {
  for (const p of CORNERS) {
    plot.items[`v${ckey(p)}`].setAttribute("opacity", on ? 1 : 0);
    plot.showLabel(`vl${ckey(p)}`, labels);
  }
}
function cornerColor(plot, p, color, r = 7) { plot.dot(`v${ckey(p)}`, p, { color, r }); }

// Walk a polyline with a trail + moving dot; returns the list of animation thunks for a Seq.
function walkThunks(plot, pts, { trail, dot, color = C.obj, ms = 750, onPoint = null, attrs = {} }) {
  const thunks = [];
  for (let i = 0; i < pts.length - 1; i++) {
    thunks.push(() => Anim.tween(ms, (e) => {
      const p = lerpP(pts[i], pts[i + 1], e);
      plot.line(trail, [...pts.slice(0, i + 1), p], { stroke: color, "stroke-width": 5, opacity: 1, ...attrs }, "under");
      plot.dot(dot, p, { color, r: 9 });
      if (onPoint) onPoint(p);
    }));
    thunks.push(() => Anim.wait(220));
  }
  return thunks;
}
function walkFinal(plot, pts, { trail, dot, color = C.obj, attrs = {} }) {
  plot.line(trail, pts, { stroke: color, "stroke-width": 5, opacity: 1, ...attrs }, "under");
  plot.dot(dot, pts[pts.length - 1], { color, r: 9 }).setAttribute("opacity", 1);
}

const DANTZIG_2D = [[0, 0], [5, 0], [4, 2], [2, 5]];
const SHORT_2D = [[0, 0], [0, 6], [2, 5]];

// ------------------------------------------------------------------ title
// Five-pointed star around p (data units), one point straight up.
function starPts(p, R = 0.62, r = 0.26) {
  return Array.from({ length: 10 }, (_, i) => {
    const a = Math.PI / 2 + (i * Math.PI) / 5, rad = i % 2 ? r : R;
    return [p[0] + rad * Math.cos(a), p[1] + rad * Math.sin(a)];
  });
}
Deck.register("title", {
  init(el) {
    const p = (this.plot = bakeryPlot(el.querySelector("#title-plot"), { size: 560, xlabel: "", ylabel: "" }));
    setRegion(p, true);
    setCorners(p, true, false);
    p.g.grid.setAttribute("opacity", 0.35);
    // layers: trail ("under") < star ("arrows") < node ("pts"), so the star covers the path but not the node
    this.star = p.poly("star", null, { fill: C.obj, "fill-opacity": 1, stroke: "#000000", "stroke-width": 2.5, "stroke-linejoin": "round" }, "arrows");
  },
  reset() {
    this.plot.line("trail", null, {}, "under");
    this.plot.dot("walker", [0, 0], { color: C.obj, r: 9 }).setAttribute("stroke", C.bg);
    this.star.setAttribute("d", "");
  },
  // e in [0, 1]: a solid star grows out from behind the optimal node, whose outline turns gold as it starts
  lightUp(e) {
    this.plot.poly("star", e > 0 ? starPts([2, 5], 0.78 * e, 0.33 * e) : null);
    this.plot.items.walker.setAttribute("stroke", e > 0 ? C.obj : C.bg);
  },
  // Walk Dantzig's path, light up the optimum, hold 2 s, repeat until the slide is left.
  enter() {
    if (this.seq) this.seq.cancel();
    const seq = (this.seq = new Seq());
    const loop = async () => {
      while (!seq.dead) {
        this.reset();
        const ok = await seq.run(() => Anim.wait(500),
          ...walkThunks(this.plot, DANTZIG_2D, { trail: "trail", dot: "walker" }),
          () => Anim.tween(650, (e) => this.lightUp(e), "back"),
          () => Anim.wait(2000));
        if (!ok) return;
      }
    };
    loop();
  },
  leave() {
    if (this.seq) this.seq.cancel();
    walkFinal(this.plot, DANTZIG_2D, { trail: "trail", dot: "walker" });
    this.lightUp(1);
  },
});

// ------------------------------------------------------------------ walk (simplex in one picture)
Deck.register("walk", {
  steps: 4,
  init(el) {
    const p = (this.plot = bakeryPlot(el.querySelector("#walk-plot"), { size: 640 }));
    setLines(p, true);
    setRegion(p, true);
    setCorners(p, true, false);
    for (const r of Bakery2D.res) p.emphasize(r.key, "dim");
    p.html("zlab", [0, 0], "", { cls: "c-obj halo l", dx: 16, dy: -22 });
  },
  render(k, animate) {
    const p = this.plot;
    if (this.seq) this.seq.cancel();
    const z = (q) => `z = ${fmt(Bakery2D.value(q))}`;
    // arrows along the two profit-improving edges at the origin
    p.arrow("up1", [0, 0], [1.8, 0], { color: C.obj }).setAttribute("opacity", k === 1 ? 1 : 0);
    p.arrow("up2", [0, 0], [0, 1.8], { color: C.obj }).setAttribute("opacity", k === 1 ? 1 : 0);
    // the shorter route via cake: a thick white path with an arrowhead on each edge (tips stop short of the corners)
    p.line("ghost", k >= 4 ? SHORT_2D : null, { stroke: C.proof, "stroke-width": 6, opacity: 0.95 }, "under");
    const heads = [[[0, 5.05], [0, 5.68]], [[1.07, 5.465], [1.62, 5.19]]];
    heads.forEach(([q0, q1], i) => p.arrow(`gh${i}`, q0, q1, { color: C.proof, width: 6, head: 22 }).setAttribute("opacity", k >= 4 ? 1 : 0));
    p.line("ring", null);
    if (k <= 1) {
      p.line("trail", null);
      p.dot("walker", [0, 0], { color: C.obj, r: 9 }).setAttribute("opacity", 1);
      p.labels.zlab.textContent = z([0, 0]);
      p.moveLabel("zlab", [0, 0], 18, -24);
      return;
    }
    const setZ = (q) => { p.labels.zlab.textContent = z(q); p.moveLabel("zlab", q, 38, -30); };
    if (k === 2 && animate) {
      this.seq = new Seq();
      this.seq.run(...walkThunks(p, DANTZIG_2D, { trail: "trail", dot: "walker", onPoint: setZ }));
      return;
    }
    walkFinal(p, DANTZIG_2D, { trail: "trail", dot: "walker" });
    setZ([2, 5]);
    if (k >= 3) {
      const ring = [];
      for (let i = 0; i <= 40; i++) ring.push([2 + 0.42 * Math.cos((i / 40) * 2 * Math.PI), 5 + 0.42 * Math.sin((i / 40) * 2 * Math.PI)]);
      p.line("ring", ring, { stroke: C.obj, "stroke-width": 2.5, opacity: 0.9 });
    }
    if (k === 4 && animate) {
      heads.forEach((_, i) => p.items[`gh${i}`].g.setAttribute("opacity", 0));
      this.seq = new Seq();
      this.seq.run(() => Anim.draw(p.items.ghost, 1100), () => {
        heads.forEach((_, i) => p.items[`gh${i}`].g.setAttribute("opacity", 1));
        return Anim.wait(1);
      });
    }
  },
});

// ------------------------------------------------------------------ bakery LP
Deck.register("bakery", {
  init(el) { this.rows = [...el.querySelectorAll("#bk-table tr.rrow")]; this.el = el; },
  render(k) {
    const at = { profit: 2, flour: 4, oven: 5, labor: 6 };  // step 3 is the profit footnote
    for (const r of this.rows) r.classList.toggle("lit", k >= at[r.dataset.res]);
    this.el.querySelector("#bk-noneg").classList.toggle("on", k >= 8);  // "(why?)" step
  },
});

// ------------------------------------------------------------------ the bakery as max c'x s.t. Ax <= b
Deck.register("matrixform", {
  steps: 4,
  init(el) {
    const wrap = el.querySelector(".mf-tablewrap");
    const wr = wrap.getBoundingClientRect(), scale = wr.width / wrap.offsetWidth;  // undo the stage scaling
    this.boxes = {};
    for (const g of ["c", "A", "b"]) {
      const rs = [...wrap.querySelectorAll(`td[data-g="${g}"]`)].map((td) => td.getBoundingClientRect());
      const L = Math.min(...rs.map((r) => r.left)), T = Math.min(...rs.map((r) => r.top));
      const R = Math.max(...rs.map((r) => r.right)), B = Math.max(...rs.map((r) => r.bottom));
      const box = document.createElement("div");
      box.className = `mfbox mf-${g}`;
      Object.assign(box.style, { left: `${(L - wr.left) / scale - 2}px`, top: `${(T - wr.top) / scale - 2}px`,
        width: `${(R - L) / scale + 4}px`, height: `${(B - T) / scale + 4}px` });
      wrap.appendChild(box);
      this.boxes[g] = box;
    }
  },
  render(k) {
    this.boxes.c.classList.toggle("on", k === 1 || k === 4);
    this.boxes.A.classList.toggle("on", k === 2 || k === 4);
    this.boxes.b.classList.toggle("on", k === 3 || k === 4);
  },
});

// ------------------------------------------------------------------ feasible region
Deck.register("region", {
  steps: 5,
  init(el) {
    this.el = el;
    this.plot = bakeryPlot(el.querySelector("#region-plot"), { size: 640 });
    this.strips = this.plot.signStrips();  // x1, x2 >= 0: hatch the strips just outside the positive quadrant
  },
  // click 1: x1, x2 >= 0; clicks 2-4: flour, oven, labor; click 5: the region and its corners
  render(k, animate) {
    const p = this.plot;
    if (this.anim) this.anim.cancel();
    for (const s of this.strips) s.setAttribute("opacity", k >= 1 ? 1 : 0);
    const order = ["flour", "oven", "labor"];
    order.forEach((key, i) => {
      const a = p.constraint(key, k >= i + 2, animate && k === i + 2);
      if (a) this.anim = a;
    });
    setRegion(p, k >= 5);
    setCorners(p, k >= 5);
    for (const d of this.el.querySelectorAll("#rg-list > div")) {
      const need = { sign: 1, flour: 2, oven: 3, labor: 4 }[d.dataset.k];
      d.classList.toggle("lit", k >= need);
    }
  },
});

// ------------------------------------------------------------------ objective sweep
Deck.register("sweep", {
  steps: 3,
  init(el) {
    const p = (this.plot = bakeryPlot(el.querySelector("#sweep-plot"), { size: 640 }));
    this.zEl = el.querySelector("#sw-z");
    setLines(p, true);
    for (const r of Bakery2D.res) p.emphasize(r.key, "dim");
    setRegion(p, true);
    setCorners(p, true, false);
    const c = Bakery2D.c, n = Math.hypot(...c);
    p.arrow("grad", [0.25, 0.25], [0.25 + (1.9 * c[0]) / n, 0.25 + (1.9 * c[1]) / n], { color: C.obj, width: 5, head: 20 });
    for (const q of CORNERS) {
      const k = ckey(q), [dx, dy] = CORNER_LABEL_OFF[k];
      p.html(`zv${k}`, q, fmt(Bakery2D.value(q)), { dx, dy, cls: "c-obj halo", hidden: true });
    }
    p.html("zline", [0, 0], "", { cls: "c-obj halo l small" });
    this.z = 0;
    // free play: drag the profit level (snaps to 58, the last feasible profit)
    this.slider = el.querySelector("#sw-slider");
    this.slider.addEventListener("input", () => {
      if (this.anim) this.anim.cancel();
      let z = parseFloat(this.slider.value);
      if (Math.abs(z - 58) < 0.75) z = 58;
      this.apply(z, false);
    });
  },
  apply(z, final = true) {
    const p = this.plot, c = Bakery2D.c;
    this.z = z;
    const past = z > 58 + 1e-9;
    p.level("lvl", c, Math.max(z, 1e-3), past
      ? { stroke: C.muted, "stroke-dasharray": "10 9", "stroke-width": 3 }
      : { stroke: C.obj, "stroke-dasharray": "", "stroke-width": 4 });
    p.poly("below", Geo.clip(Bakery2D.region, c, Math.min(z, 58)), { fill: C.obj, "fill-opacity": 0.16 });
    for (const q of CORNERS) {
      const hit = Bakery2D.value(q) <= z + 1e-9;
      p.showLabel(`zv${ckey(q)}`, hit);
      cornerColor(p, q, hit ? C.obj : "#fff");
    }
    this.zEl.textContent = `z = ${final ? fmt(z) : z.toFixed(1)}`;
    this.slider.value = z;
    const seg = p.segment(c, Math.max(z, 1e-3));
    if (seg && z > 0) { p.moveLabel("zline", seg[1], 10, 14); p.labels.zline.textContent = past ? `z = ${fmt(z)}: no plan` : ""; }
    else p.labels.zline.textContent = "";
  },
  render(k, animate) {
    if (this.anim) this.anim.cancel();
    const target = [0, 58, 58, 64][k];
    const ring = k >= 2;
    this.plot.line("ring", ring ? Array.from({ length: 41 }, (_, i) => [2 + 0.42 * Math.cos(i * Math.PI / 20), 5 + 0.42 * Math.sin(i * Math.PI / 20)]) : null,
      { stroke: C.obj, "stroke-width": 2.5 });
    if (animate && (k === 1 || k === 3)) {
      const z0 = k === 1 ? 0 : 58;
      this.anim = Anim.tween(k === 1 ? 3400 : 900, (e) => this.apply(lerp(z0, target, e), e === 1), k === 1 ? "linear" : "smooth");
    } else this.apply(target);
  },
});

// ------------------------------------------------------------------ parallel objective
// Cake stays at 8; only bread's profit moves. Bread 12 / 16 / 4 makes the profit line parallel to oven / flour / labor.
const CAKE = 8, BREAD0 = 9, BREAD_TIES = [12, 16, 4];
Deck.register("parallel", {
  steps: 5,
  init(el) {
    const p = (this.plot = bakeryPlot(el.querySelector("#parallel-plot"), { size: 640 }));
    setLines(p, true);
    setRegion(p, true);
    setCorners(p, true, true);
    this.objEl = el.querySelector("#pa-obj");
    this.relEl = el.querySelector("#pa-rel");
    this.msgEl = el.querySelector("#pa-msg");
    this.valEl = el.querySelector("#pa-val");
    this.slider = el.querySelector("#pa-bread");
    const lo = +this.slider.min, hi = +this.slider.max;
    el.querySelector("#pa-start").style.setProperty("--at", (BREAD0 - lo) / (hi - lo));
    this.slider.addEventListener("input", () => {
      if (this.anim) this.anim.cancel();
      let b = parseFloat(this.slider.value);
      for (const t of [BREAD0, ...BREAD_TIES]) if (Math.abs(b - t) < 0.4) b = t;
      this.apply(b);
    });
  },
  // bread always shows one decimal (12.0, not 12) so the objective and readout don't jump in width
  apply(bread) {
    bread = Math.round(bread * 10) / 10;  // compute with the shown value, so z matches the displayed objective
    const p = this.plot, c = [bread, CAKE];
    const num = bread.toFixed(1);
    const vals = CORNERS.map((q) => Geo.dot(c, q));
    const best = Math.max(...vals);
    const win = CORNERS.filter((q, i) => vals[i] >= best - 1e-9);
    for (const q of CORNERS) cornerColor(p, q, win.some((w) => Geo.near(w, q)) ? C.obj : "#fff", win.some((w) => Geo.near(w, q)) ? 9 : 7);
    p.line("tie", win.length === 2 ? win : null, { stroke: C.obj, "stroke-width": 9, opacity: 0.85 }, "under");
    p.level("lvl", c, best, { stroke: C.obj, "stroke-width": 3, "stroke-dasharray": "10 8", opacity: 0.8 });
    const mid = win.length === 2 ? lerpP(win[0], win[1], 0.5) : win[0];
    const u = [c[0] / Math.hypot(...c), c[1] / Math.hypot(...c)];
    p.arrow("dir", mid, [mid[0] + 1.6 * u[0], mid[1] + 1.6 * u[1]], { color: C.obj, width: 5, head: 20 });
    Deck.tex(this.objEl, `\\max\\ \\OB{z = ${num}x_1 + ${CAKE}x_2}`);
    this.relEl.innerHTML = Math.abs(bread - BREAD0) < 1e-9 ? "" : `(bread <b>${bread > BREAD0 ? "↑" : "↓"}</b>)`;
    if (win.length === 2) {
      const name = (q) => `(${fmt(q[0])}, ${fmt(q[1])})`;
      this.msgEl.innerHTML = `<b>Tie.</b> Every plan on the edge ${name(win[0])}–${name(win[1])} earns z = $${best.toFixed(1)}.`;
      this.msgEl.classList.add("verdict", "ok");
    } else {
      this.msgEl.innerHTML = `Best plan: one corner, <b>(${fmt(win[0][0])}, ${fmt(win[0][1])})</b>, earns z = $${best.toFixed(1)}.`;
      this.msgEl.classList.remove("verdict", "ok");
    }
    this.slider.value = bread;
    this.valEl.textContent = num;
    this.bread = bread;
  },
  render(k, animate) {
    if (this.anim) this.anim.cancel();
    // clicks 1-3 turn to each tie, click 4 (the rule) keeps the last one, click 5 turns back to the original profit
    const target = [BREAD0, ...BREAD_TIES, BREAD_TIES[2], BREAD0][k];
    if (animate && this.bread !== undefined && Math.abs(this.bread - target) > 1e-9) {
      const b0 = this.bread;
      this.anim = Anim.tween(1600, (e) => this.apply(e === 1 ? target : lerp(b0, target, e)));
    } else this.apply(target);
  },
});

// ------------------------------------------------------------------ proof builder (bound game)
// What each click of the bound game is doing, and where its multipliers come from.
// The game opens on labor's loose bound (the line far from the region), drops to oven's, then mixes.
const GAME_Y = [[0, 0, 9], [0, 4, 0], [0, 3, 1], [0, 2.5, 1.5]];
const PROOF_WHY = [
  "<b>Labor alone</b>: 9 × labor covers both profits, but its bound, 108, is far from every plan.",
  "<b>Oven alone</b>: 4 × oven, bound 64, much closer. It <b>over-covers</b> bread (12 &gt; 9). Can a mix do better?",
  "Use 3 × oven to cover bread exactly, then top up cake's missing 2 with <b>1 × labor</b>: bound 60.",
  "Cover <b>both exactly</b>: 3y₂ + y₃ = 9, 2y₂ + 2y₃ = 8 ⇒ y₂ = 2.5, y₃ = 1.5. Flour gets 0: it has a spare unit, so weight on flour would raise the bound but not the profit.",
];
// buttons for free play: start over, or jump to the best proof (the single-constraint guesses are on slide 11)
const PRESETS = [
  { y: [0, 0, 0], label: "reset" },
  { y: [0, 2.5, 1.5], label: "2.5 oven + 1.5 labor" },
];
class NumberLine {
  constructor(container, { width = 560, max = 120 } = {}) {
    this.w = width; this.max = max; this.x0 = 20; this.x1 = width - 20;
    container.classList.add("plot");
    container.style.width = `${width}px`;
    container.style.height = "120px";
    this.svg = svgEl("svg", { width, height: 120, viewBox: `0 0 ${width} 120` }, container);
    this.ov = document.createElement("div"); this.ov.className = "ov"; container.appendChild(this.ov);
    const y = 62;
    this.y = y;
    svgEl("line", { x1: this.x0, y1: y, x2: this.x1, y2: y, stroke: "var(--axis)", "stroke-width": 2 }, this.svg);
    for (let v = 0; v <= max; v += 20) {
      svgEl("line", { x1: this.X(v), y1: y - 5, x2: this.X(v), y2: y + 5, stroke: "var(--axis)", "stroke-width": 2 }, this.svg);
      svgEl("text", { x: this.X(v), y: y + 26, "text-anchor": "middle", class: "tick" }, this.svg).textContent = v;
    }
    this.gap = svgEl("rect", { y: y - 9, height: 18, fill: C.proof, "fill-opacity": 0.14 }, this.svg);
    this.plan = svgEl("path", { fill: C.obj }, this.svg);
    this.bound = svgEl("path", { fill: "none", stroke: C.proof, "stroke-width": 2.5, "stroke-linejoin": "round" }, this.svg);
    this.planLab = this.lab("c-obj"); this.boundLab = this.lab("c-proof");
  }
  X(v) { return this.x0 + ((this.x1 - this.x0) * Math.min(v, this.max)) / this.max; }
  lab(cls) { const d = document.createElement("div"); d.className = `lab small ${cls}`; this.ov.appendChild(d); return d; }
  set(plan, bound) {
    // both markers sit above the axis: plans approach from the left, proofs from the right
    const y = this.y, xp = this.X(plan), lift = 12;
    this.plan.setAttribute("d", `M${xp},${y - lift}l-9,-16h18z`);
    Object.assign(this.planLab.style, { left: `${xp - 14}px`, top: `${y - 40}px` });
    this.planLab.className = "lab small c-obj r";
    this.planLab.textContent = `primal: ${fmt(plan)}`;
    if (bound === null) {
      this.bound.setAttribute("d", "");
      this.gap.setAttribute("width", 0);
      Object.assign(this.boundLab.style, { left: `${this.X(90)}px`, top: `${y - 40}px`, opacity: 0.6 });
      this.boundLab.className = "lab small c-proof";
      this.boundLab.textContent = "no valid bound yet";
      return;
    }
    const xb = this.X(bound);
    this.bound.setAttribute("d", `M${xb},${y - lift}l-9,-16h18z`);
    this.gap.setAttribute("x", xp); this.gap.setAttribute("width", Math.max(0, xb - xp));
    // near the right end the label goes on the marker's left so it stays inside the slide
    const flip = xb > this.w - 190;
    Object.assign(this.boundLab.style, { left: `${flip ? xb - 14 : xb + 14}px`, top: `${y - 40}px`, opacity: 1 });
    this.boundLab.className = `lab small c-proof ${flip ? "r" : "l"}`;
    this.boundLab.textContent = bound - plan < 1e-9 ? `dual: z ≤ ${fmt(bound)} · gap 0` : `dual: z ≤ ${fmt(bound)}`;
  }
}
Deck.register("proof", {
  steps: 3,
  init(el) {
    this.el = el;
    this.y = [0, 0, 0];
    const rows = el.querySelector(".pf-rows");
    this.rows = Bakery2D.res.map((r, i) => {
      const row = document.createElement("div");
      row.className = "yrow";
      row.style.setProperty("--rc", r.color);
      row.innerHTML = `<input type="range" class="yslider" min="0" max="10" step="0.5" value="0"><span class="yv num"></span><span class="ctex"></span>`;
      Deck.tex(row.querySelector(".ctex"), `\\times\\ \\textcolor{${r.color}}{(${r.tex})}\\quad\\MU{\\text{${r.key}}}`);
      const s = row.querySelector("input");
      s.addEventListener("input", () => { if (this.anim) this.anim.cancel(); this.y[i] = parseFloat(s.value); this.apply(); });
      rows.appendChild(row);
      return { row, s, yv: row.querySelector(".yv") };
    });
    const pre = el.querySelector(".pf-presets");
    PRESETS.forEach((ps) => {
      const b = document.createElement("button");
      b.className = "btn"; b.textContent = ps.label;
      b.addEventListener("click", () => this.animateTo(ps.y));
      pre.appendChild(b);
    });
    const p = (this.plot = bakeryPlot(el.querySelector(".pf-plot"), { size: 500 }));
    setLines(p, true);
    setRegion(p, true);
    setCorners(p, true, false);
    cornerColor(p, [2, 5], C.obj, 9);
    p.html("best", [2, 5], "58", { cls: "c-obj halo", dx: 30, dy: -22 });
    p.html("blab", [0, 0], "", { cls: "halo small l c-proof" });
    this.nl = new NumberLine(el.querySelector(".pf-nl"));
  },
  apply() {
    const y = this.y, R = Bakery2D.res, c = Bakery2D.c;
    const cov = [0, 1].map((j) => R.reduce((s, r, i) => s + y[i] * r.a[j], 0));
    const B = R.reduce((s, r, i) => s + y[i] * r.b, 0);
    const sl = cov.map((v, j) => v - c[j]);
    const valid = sl.every((v) => v >= -1e-9);
    this.rows.forEach((o, i) => {
      o.s.value = y[i];
      o.yv.textContent = fmt(y[i]);
      o.row.classList.toggle("used", y[i] > 0);
      this.plot.emphasize(R[i].key, y.every((v) => v === 0) ? "normal" : y[i] > 0 ? "bold" : "dim");
    });
    Deck.tex(this.el.querySelector(".pf-sum"), `${tnum(cov[0])}\\,x_1 + ${tnum(cov[1])}\\,x_2 \\le \\PF{${tnum(B)}}`);
    for (const j of [0, 1]) {
      this.el.querySelector(`.pf-c${j}`).textContent = fmt(cov[j]);
      const ok = sl[j] >= -1e-9;
      this.el.querySelector(`.pf-s${j}`).innerHTML = `${fmt(sl[j])} ${ok ? "✓" : "✗"}`;
    }
    const v = this.el.querySelector(".pf-verdict");
    if (valid) {
      const tight = Math.abs(B - 58) < 1e-9;
      v.innerHTML = tight
        ? `✓ <b>Valid dual: z ≤ 58.</b> The primal (2, 5) earns exactly 58, so it is <b>optimal</b>.`
        : `✓ <b>Valid dual:</b> no plan earns more than ${fmt(B)}.`;
      v.classList.add("ok");
    } else {
      const short = [0, 1].filter((j) => sl[j] < -1e-9).map((j) => `${["bread", "cake"][j]} is short by ${fmt(-sl[j])}`);
      v.innerHTML = `✗ Not a valid dual yet: ${short.join(", ")}.`;
      v.classList.remove("ok");
    }
    const p = this.plot;
    // beyond a valid bound: profits no plan can reach, shaded and dragged along as the bound moves (as on slides 9-10)
    const box = [[0, 0], [p.o.xmax, 0], [p.o.xmax, p.o.ymax], [0, p.o.ymax]];
    p.poly("above", valid ? Geo.clip(box, [-c[0], -c[1]], -B) : null, { fill: C.proof, "fill-opacity": 0.1 });
    if (valid) {
      p.level("bound", c, B, { stroke: C.proof, "stroke-width": 3, "stroke-dasharray": "10 8", opacity: 0.95 });  // upper bounds are white, as on slides 9-10
      const seg = p.segment(c, B);
      if (seg) { p.moveLabel("blab", seg[1], 8, -20); p.labels.blab.textContent = `z = ${fmt(B)}`; }
      else p.labels.blab.textContent = "";
    } else { p.line("bound", null); p.labels.blab.textContent = ""; }
    this.nl.set(58, valid ? B : null);
  },
  animateTo(target, ms = 800) {
    if (this.anim) this.anim.cancel();
    const y0 = [...this.y];
    this.anim = Anim.tween(ms, (e) => {
      this.y = y0.map((v, i) => (e === 1 ? target[i] : lerp(v, target[i], e)));
      this.apply();
    });
  },
  render(k, animate) {
    this.el.querySelector(".pf-why").innerHTML = PROOF_WHY[k];
    const t = GAME_Y[k];
    if (animate) this.animateTo(t);
    else { if (this.anim) this.anim.cancel(); this.y = [...t]; this.apply(); }
  },
});

// ------------------------------------------------------------------ zero slack
Deck.register("slack", {
  steps: 5,
  init(el) {
    const p = (this.plot = bakeryPlot(el.querySelector("#slack-plot"), { size: 640 }));
    setLines(p, true);
    setRegion(p, true);
    setCorners(p, true, false);
    p.html("spare", [2, 5], "flour: 9 of 10 used", { cls: "halo small r", color: C.flour, dx: -24, dy: 44, hidden: true });
  },
  render(k) {
    const p = this.plot;
    p.emphasize("flour", k >= 1 ? "dim" : "normal");
    p.emphasize("oven", k >= 3 ? "bold" : "normal");
    p.emphasize("labor", k >= 3 ? "bold" : "normal");
    if (k >= 2) p.level("bound", Bakery2D.c, 58, { stroke: C.obj, "stroke-width": 3, "stroke-dasharray": "10 8" });
    else p.line("bound", null);
    cornerColor(p, [2, 5], k >= 3 ? C.obj : "#fff", k >= 3 ? 10 : 7);
    p.showLabel("spare", k >= 4);
    if (k >= 4) {
      // the gap between (2,5) and the flour line, measured along x1
      p.line("gapseg", [[2, 5], [2.5, 5]], { stroke: C.flour, "stroke-width": 4 }, "top");
    } else p.line("gapseg", null);
  },
});
