// Controllers for Parts 3–4: slack variables, bases, the tableau, and pivoting.
"use strict";

const CONS = [...Bakery2D.res, ...Bakery2D.signs];
const ring = (p, r = 0.42) => Array.from({ length: 41 }, (_, i) => [p[0] + r * Math.cos((i * Math.PI) / 20), p[1] + r * Math.sin((i * Math.PI) / 20)]);

const hideConstraintLabels = (p) => { for (const r of Bakery2D.res) p.showLabel(`c-${r.key}`, false); };

// The point of the feasible region nearest to p (p itself when feasible).
function projectToRegion(p) {
  if (CONS.every((k) => Geo.dot(k.a, p) <= k.b + 1e-12)) return p;
  const R = Bakery2D.region;
  let best = null, bd = Infinity;
  R.forEach((a, i) => {
    const b = R[(i + 1) % R.length], ab = [b[0] - a[0], b[1] - a[1]];
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * ab[0] + (p[1] - a[1]) * ab[1]) / Geo.dot(ab, ab)));
    const q = lerpP(a, b, t), d = Math.hypot(p[0] - q[0], p[1] - q[1]);
    if (d < bd) { bd = d; best = q; }
  });
  return best;
}
// Snap to a nearby corner, else onto a nearby constraint line.
function snap(p) {
  for (const q of CORNERS) if (Math.hypot(p[0] - q[0], p[1] - q[1]) < 0.22) return [...q];
  let s = [...p];
  for (const k of CONS) {
    const n2 = Geo.dot(k.a, k.a), g = (Geo.dot(k.a, s) - k.b) / Math.sqrt(n2);
    if (Math.abs(g) < 0.1) s = [s[0] - (g * k.a[0]) / Math.sqrt(n2), s[1] - (g * k.a[1]) / Math.sqrt(n2)];
  }
  return s;
}

// ------------------------------------------------------------------ slack variables
// The last three clicks: a basis, shown. Setting 2 of the 5 variables to 0 puts us on 2 lines; solving the 3 equations
// for the other 3 gives their crossing. Variable j = 0 <=> line SV_LINE[j] is tight.
const SV_TEX = ["x_1", "x_2", "s_1", "s_2", "s_3"];
const SV_LINE = [Bakery2D.signs[0], Bakery2D.signs[1], ...Bakery2D.res];
const SV_ORDER = [[2, 3], [0, 3], [0, 1], [1, 2], [0, 4], [0, 2], [1, 3], [1, 4], [2, 4], [3, 4]];  // the two examples first, the best corner (2, 5) last
const svCross = (pair) => {
  const [L1, L2] = pair.map((j) => SV_LINE[j]);
  const x = Geo.solve2([[L1.a[0], L1.a[1]], [L2.a[0], L2.a[1]]], [L1.b, L2.b]);
  const vals = [x[0], x[1], ...Bakery2D.res.map((r) => r.b - Geo.dot(r.a, x))].map((v) => (Math.abs(v) < 1e-9 ? 0 : v));
  return { pair, x, vals, feasible: vals.every((v) => v >= -1e-9) };
};
const SV_CROSS = SV_ORDER.map(svCross);

Deck.register("slackvars", {
  steps: 6,
  init(el) {
    this.el = el;
    const p = (this.plot = bakeryPlot(el.querySelector("#slackvars-plot"), { size: 620 }));
    setLines(p, true);
    setRegion(p, true);
    setCorners(p, true, false);
    p.html("drag", [1, 2], "drag me", { cls: "muted small halo", dx: 0, dy: 34 });
    this.meters = new ResourceMeters(el.querySelector("#sv-meters"));
    this.planEl = el.querySelector("#sv-plan");
    this.p = [1, 2];
    let dragging = false;
    p.svg.addEventListener("pointerdown", (e) => {
      if (this.step >= 4) return;  // the plan point is only draggable before the bases clicks
      if (this.anim) this.anim.cancel();
      dragging = true;
      p.showLabel("drag", false);
      p.svg.setPointerCapture(e.pointerId);
      this.dragTo(p.toData(e));
    });
    p.svg.addEventListener("pointermove", (e) => { if (dragging) this.dragTo(p.toData(e)); });
    p.svg.addEventListener("pointerup", () => { dragging = false; });
    // crossings beyond the plot's edges sit on the edge, with an arrow pointing to where they really are
    SV_CROSS.forEach((c, k) => {
      if (c.x[0] <= p.o.xmax && c.x[1] <= p.o.ymax) return;
      const up = c.x[1] > p.o.ymax, at = [Math.min(c.x[0], p.o.xmax), Math.min(c.x[1], p.o.ymax)];
      c.at = at;
      p.arrow(`oa${k}`, at, up ? [at[0], at[1] + 0.55] : [at[0] + 0.55, at[1]], { color: "#e06a6a", width: 3, head: 11 }).setAttribute("opacity", 0);
      p.html(`ol${k}`, at, `(${fmt(c.x[0])}, ${fmt(c.x[1])})`, { cls: `small halo ${up ? "r" : ""}`, color: "#e06a6a", dx: up ? -16 : -10, dy: up ? -2 : -22, hidden: true });
    });
    // the equations, one column per variable, the resource on the right; under each column its value and "≥ 0"
    const grid = el.querySelector("#sv-grid"), A = BakeryStd.A;
    const cell = (cls = "", tex = null, html = "") => {
      const d = document.createElement("div");
      d.className = cls;
      if (tex !== null) Deck.tex(d, tex); else d.innerHTML = html;
      grid.appendChild(d);
      return d;
    };
    this.cols = SV_TEX.map(() => []);
    Bakery2D.res.forEach((r, row) => {
      const col = r.color.slice(1), k = (s) => `\\textcolor{${col}}{${s}}`;
      SV_TEX.forEach((t, jj) => {
        if (jj) {
          const plus = A[row][jj] && A[row].slice(0, jj).some((v) => v);
          this.cols[jj].push(cell("", plus ? k("+") : null));
        }
        if (A[row][jj]) this.cols[jj].push(cell("", k(`${A[row][jj] === 1 ? "" : A[row][jj]}${t}`)));
        else cell();
      });
      cell("", k("="));
      cell("rhs", k(String(BakeryStd.b[row])));
      cell("lab", null, `<span style="color:${r.color}">${r.key}</span>`);
    });
    this.vbox = []; this.ge = [];
    for (const [arr, cls, html] of [[this.vbox, "vbox clickable", ""], [this.ge, "ge", "≥ 0"]]) {
      SV_TEX.forEach((t, jj) => { if (jj) cell(); arr.push(cell(cls, null, html)); });
      cell(); cell();
      if (cls === "ge") cell();
      else cell("clr", null, '<button class="btn clickable" data-step="6">clear</button>').firstChild.addEventListener("click", () => this.pick(null));
    }
    // try it yourself: click 3 boxes to solve for; the other 2 are set to 0 and the corner is computed
    this.vbox.forEach((b, jj) => b.addEventListener("click", () => { if (this.step >= 6) this.pick(jj); }));
    this.why = el.querySelector(".sv-why");
    this.sel = []; this.cr = null; this.found = new Set();
    this.tallyEl = el.querySelector("#sv-tally");
    this.set(this.p);  // creates the plan point and its ring, even when the slide opens on a later step
  },
  dragTo(target) {
    this.set(projectToRegion(snap(projectToRegion(target))));
  },
  set(q) {
    const p = this.plot;
    this.p = q;
    p.line("ring", ring(q, 0.3), { stroke: C.obj, "stroke-width": 2.5 }, "top");
    p.dot("plan", q, { color: C.obj, r: 10 });
    p.moveLabel("drag", q, 0, 34);
    this.meters.set(q);
    for (const r of Bakery2D.res) p.emphasize(r.key, Math.abs(Geo.dot(r.a, q) - r.b) < 0.05 ? "bold" : "normal");
    Deck.tex(this.planEl, `\\text{plan: } x_1 = ${tnum(round1(q[0]))},\\ x_2 = ${tnum(round1(q[1]))}`);
  },
  // a box click (jj) or clear (null). The clicked boxes are the zeros: picking a 2nd box solves for the other 3;
  // a click after a solved corner starts a new pick.
  // Clear starts over completely: no picks, no corners found.
  pick(jj) {
    if (jj === null) this.found = new Set();  // clear also resets the corners found (dots and tally)
    if (jj === null || this.cr !== null) { this.sel = []; this.cr = null; }
    if (jj !== null) this.sel = this.sel.includes(jj) ? this.sel.filter((v) => v !== jj) : this.sel.length < 2 ? [...this.sel, jj] : this.sel;
    if (this.sel.length === 2) {
      this.cr = SV_CROSS.findIndex((c) => c.pair.every((v) => this.sel.includes(v)));
      this.found.add(this.cr);
    }
    this.draw();
  },
  // draw the current state on the plot and in the grid: a solved corner (this.cr) or a pick in progress (this.sel)
  draw() {
    const P = this.plot, c = this.cr === null ? null : SV_CROSS[this.cr], sel = this.sel;
    const zero = (j) => (c ? c.pair : sel).includes(j);
    // the zeroed variables' columns fade; solved ones show their value (negative = red, and its "≥ 0" fails)
    SV_TEX.forEach((t, jj) => {
      const v = c ? c.vals[jj] : 0, neg = c && !zero(jj) && v < -1e-9, picked = !c && sel.includes(jj);
      this.cols[jj].forEach((e) => e.classList.toggle("z", zero(jj)));
      this.vbox[jj].className = `vbox clickable${c && zero(jj) ? " zero" : ""}${neg ? " neg" : ""}${picked ? " pick" : ""}`;
      this.vbox[jj].textContent = c ? fmtT(zero(jj) ? 0 : v) : picked ? "0" : "";
      this.ge[jj].classList.toggle("bad", !!neg);
    });
    // the plot: the 2 tight lines bold (axes drawn over), corners found so far as dots (hollow = not feasible)
    Bakery2D.res.forEach((r, i) => P.emphasize(r.key, !c ? "normal" : c.pair.includes(2 + i) ? "bold" : "dim"));
    const ax = [[[0, 0], [0, P.o.ymax]], [[0, 0], [P.o.xmax, 0]]];
    [0, 1].forEach((j) => P.line(`ax${j}`, c && zero(j) ? ax[j] : null, { stroke: C.ink, "stroke-width": 6 }, "under"));
    SV_CROSS.forEach((q, k) => {
      const shown = this.found.has(k);
      const d = P.dot(`cr${k}`, q.at || q.x, { color: q.feasible ? C.obj : C.bg, r: k === this.cr ? 9 : 7 });
      d.setAttribute("stroke", q.feasible ? C.bg : "#e06a6a");
      d.setAttribute("stroke-width", 3);
      d.setAttribute("opacity", shown ? 1 : 0);
      if (q.at) { P.items[`oa${k}`].g.setAttribute("opacity", shown ? 1 : 0); P.showLabel(`ol${k}`, shown); }
    });
    P.line("ring", c ? ring(c.at || c.x, 0.32) : null, { stroke: c && c.feasible ? C.obj : "#e06a6a", "stroke-width": 2.5 }, "top");
    const seen = [...this.found].map((k) => SV_CROSS[k]);
    this.tallyEl.innerHTML = `corners found: <b>${seen.length}</b> of 10 &nbsp;·&nbsp; feasible (every variable ≥ 0): <b>${seen.filter((q) => q.feasible).length}</b>`;
  },
  render(k, animate) {
    if (this.anim) this.anim.cancel();
    this.step = k;
    const p = this.plot, bases = k >= 4;
    p.showLabel("drag", k === 0);
    for (const id of ["plan", "ring"]) p.items[id] && p.items[id].setAttribute("opacity", bases ? 0 : 1);
    if (!bases) {
      [0, 1].forEach((j) => p.line(`ax${j}`, null));
      SV_CROSS.forEach((c, i) => {
        if (p.items[`cr${i}`]) p.items[`cr${i}`].setAttribute("opacity", 0);
        if (c.at) { p.items[`oa${i}`].g.setAttribute("opacity", 0); p.showLabel(`ol${i}`, false); }
      });
      const target = [[1, 2], [3, 2], [4, 2], [4, 2]][k];
      if (animate && k <= 2) {
        const p0 = [...this.p];
        this.anim = Anim.tween(900, (e) => this.set(e === 1 ? target : lerpP(p0, target, e)));
      } else this.set(target);
      return;
    }
    p.items.ring.setAttribute("opacity", 1);
    this.why.classList.toggle("live", k >= 6);
    // clicks 4 and 5 show the two examples; click 6 keeps whatever is on screen and hands over the boxes
    if (k < 6) {
      this.found = new Set(k === 4 ? [0] : [0, 1]);
      this.sel = []; this.cr = k - 4;
    } else { this.found.add(0); this.found.add(1); if (this.cr === null && !this.sel.length) this.cr = 1; }
    this.draw();
  },
});

// ------------------------------------------------------------------ putting it all together: revised simplex
// Dantzig's rule from the origin. Each iteration: basis B -> primal x_B = B^-1 b -> dual y^T = c_B^T B^-1 ->
// pricing d_j = y^T a_j - c_j -> entering q -> direction u = B^-1 a_q -> ratio test -> leaving -> update.
const HS = (() => {
  const S = BakeryStd, out = [];
  let basis = [2, 3, 4];
  for (let it = 0; it < 8; it++) {
    const tb = S.tableau(basis), sc = Rules.scores(S, tb);
    if (!sc.length) { out.push({ basis, tb, enter: null }); return out; }
    const q = Rules.pick("dantzig", sc).j, row = S.leavingRow(tb, q), next = [...basis];
    next[row] = q;
    out.push({ basis, tb, enter: q, u: tb.T.map((r) => r[q]), ratios: S.ratios(tb, q), row, leave: basis[row], next, nextPoint: S.tableau(next).point });
    basis = next;
  }
  throw new Error("revised simplex did not stop");
})();
const hsNum = (v) => fmtT(v).replace("−", "-");
const hsVar = (j) => `\\textcolor{${BakeryStd.color[j].slice(1)}}{${BakeryStd.tex[j]}}`;
const hsVec = (a) => `(${a.map(hsNum).join(",\\ ")})`;

// A bracketed matrix or vector: an optional "label =" on its left, optional labels over its columns (heads; a vector's
// name goes here), optional names beside its rows (rowNames). Returns its cells.
function hsMatrix(host, { label = null, cols, rows, colW = 56, heads = null, rowNames = null }) {
  const div = (cls, parent) => { const d = document.createElement("div"); d.className = cls; if (parent) parent.appendChild(d); return d; };
  const blk = div("mblk", host);
  if (label) Deck.tex(div("mlab", blk), `${label} =`);
  const out = { blk, head: [], cells: [], names: [] };
  if (rowNames) {
    const col = div("mnames", blk);
    div("mh", col);
    out.names = rowNames.map((t) => { const d = div("", col); Deck.tex(d, t); return d; });
  }
  const body = div("", blk);
  const row = (cls, parent) => {
    const r = div(`mrow ${cls}`, parent);
    r.style.gridTemplateColumns = `repeat(${cols}, ${colW}px)`;
    return Array.from({ length: cols }, () => div("", r));
  };
  out.head = row("mhead", body);
  if (heads) heads.forEach((t, k) => Deck.tex(out.head[k], t));
  out.mat = div("mat", body);
  for (let i = 0; i < rows; i++) out.cells.push(row("", out.mat));
  return out;
}

// Every iteration is built one formula per click: basis, primal, dual, check, enter, direction, leave, update
// (the optimal one stops after its check); click 0 is blank and a last click adds the note on real solvers.
const HS_SCHED = (() => {
  const out = [{ it: 0, lv: -1 }];
  HS.forEach((I, it) => { for (let lv = 0; lv < (I.enter === null ? 5 : 8); lv++) out.push({ it, lv }); });
  out.push({ it: HS.length - 1, lv: 4, note: true });
  return out;
})();
Deck.register("howsimplex", {
  steps: HS_SCHED.length - 1,
  init(el) {
    const S = BakeryStd, $ = (s) => el.querySelector(s), host = $("#hs-mats");
    // A with its variables over the columns; the vectors x and c (one entry per variable), b and y (one per
    // resource, rows lined up with A's); then B and B⁻¹ for the current basis
    this.A = hsMatrix(host, { label: "A", cols: 5, rows: 3, colW: 50, heads: S.cols.map(hsVar) });
    S.A.forEach((r, i) => S.cols.forEach((j) => { this.A.cells[i][j].textContent = fmtT(r[j]); }));
    this.x = hsMatrix(host, { cols: 1, rows: 5, colW: 60, heads: ["x"], rowNames: S.cols.map(hsVar) });
    this.c = hsMatrix(host, { cols: 1, rows: 5, colW: 50, heads: ["c"] });
    S.cols.forEach((j) => { this.c.cells[j][0].textContent = fmtT(S.c[j]); });
    // the dual vector y, 5 long like x and row-aligned with it: each dual variable sits next to its primal partner
    // (x_j <-> dual slack d_j, s_i <-> y_i). It is the bottom row d_j = y^T a_j - c_j over all 5 columns.
    this.y = hsMatrix(host, { cols: 1, rows: 5, colW: 60, heads: ["y"],
      rowNames: ["d_1", "d_2", ...Bakery2D.res.map((r, i) => `\\textcolor{${r.color.slice(1)}}{y_${i + 1}}`)] });
    this.b = hsMatrix(host, { cols: 1, rows: 3, colW: 54, heads: ["b"] });
    S.b.forEach((v, i) => { this.b.cells[i][0].textContent = fmtT(v); });
    // B and B⁻¹ (the primal basis), with D, the dual's own 2 x 2 basis, under them
    const grp = document.createElement("div"), row1 = document.createElement("div"), row2 = document.createElement("div");
    grp.className = "hs-grp"; row1.className = row2.className = "hs-grow";
    grp.append(row1, row2);
    host.appendChild(grp);
    this.B = hsMatrix(row1, { label: "B", cols: 3, rows: 3, colW: 50, heads: ["", "", ""] });
    this.Bi = hsMatrix(row1, { label: "B^{-1}", cols: 3, rows: 3, colW: 66 });
    this.D = hsMatrix(row2, { label: "D", cols: 2, rows: 2, colW: 54, heads: ["", ""] });
    // formula lines
    this.itEl = $("#hs-it");
    this.noteEl = $("#hs-note");
    this.lines = ["basis", "primal", "dual", "price", "enter", "dir", "ratio", "update"].map((k) => {
      const kEl = document.createElement("div"), vEl = document.createElement("div");
      kEl.className = "k"; vEl.className = "v";
      kEl.textContent = { basis: "basis", primal: "primal", dual: "dual", price: "check", enter: "enter", dir: "direction", ratio: "leave", update: "update" }[k];
      $("#hs-steps").append(kEl, vEl);
      return { k: kEl, v: vEl };
    });
    // the little plot: where we are, the edge we are about to walk
    const p = (this.plot = bakeryPlot($("#hs-plot"), { size: 290, margin: { l: 14, r: 10, t: 8, b: 14 }, xlabel: "", ylabel: "" }));
    $("#hs-plot").classList.add("mini");
    setLines(p, true);
    for (const r of Bakery2D.res) p.showLabel(`c-${r.key}`, false);
    setRegion(p, true);
    setCorners(p, true, false);
    for (const q of CORNERS) cornerColor(p, q, "#fff", 5);
  },
  line(i, tex, note = "", state = "on") {
    const L = this.lines[i];
    Deck.tex(L.v, tex);
    if (note) L.v.insertAdjacentHTML("beforeend", `<span class="note">${note}</span>`);
    for (const e of [L.k, L.v]) { e.classList.toggle("off", state === "off"); }
    L.v.classList.toggle("cur", state === "cur");
  },
  render(k, animate) {
    // click 0 is blank; clicks 1-8 build iteration 1 one formula at a time (lv 0-7); then one click per iteration
    const S = BakeryStd, { it, lv, note } = HS_SCHED[k], I = HS[it], tb = I.tb;
    const done = I.enter === null, walked = !done && lv === 7;
    this.noteEl.classList.toggle("on", !!note);
    const uni = (t) => t.replace("_1", "₁").replace("_2", "₂").replace("_3", "₃");
    const name = (j) => hsVar(j);
    const pt = (a) => `(${a.map(fmt).join(", ")})`;
    this.itEl.textContent = `Iteration ${it + 1} · at corner ${pt(tb.point)}${done ? " · optimal" : ""}`;
    this.itEl.style.opacity = lv >= 0 ? 1 : 0;
    const st = (i) => (lv < i ? "off" : lv === i && !note ? "cur" : "on");
    this.line(0, `B = \\{${I.basis.map(name).join(",\\ ")}\\}`, "the 3 variables we solve for; the other 2, and their 3 dual partners, are 0", st(0));
    this.line(1, `B\\,x_B = b \\;\\Rightarrow\\; x_B = B^{-1}b = ${hsVec(tb.rhs)}`, `corner ${pt(tb.point)}, profit ${fmt(tb.z)}`, st(1));
    // the dual's basics: the partners of the primal nonbasics (x_j -> d_j, s_i -> y_i); D = their columns of [A^T | -I]
    const nb = S.cols.filter((j) => !I.basis.includes(j));
    const dTex = (j) => (j < 2 ? `d_${j + 1}` : `\\textcolor{${Bakery2D.res[j - 2].color.slice(1)}}{y_${j - 1}}`);
    const vecT = (a) => `(${a.join(",\\ ")})`;
    this.line(2, `D\\,${vecT(nb.map(dTex))}^\\top = ${vecT([9, 8])}^\\top \\;\\Rightarrow\\; ${vecT(nb.map(dTex))} = ${vecT(nb.map((j) => hsNum(tb.d[j])))}`,
      "the dual's 2 equations; the partners of B are 0", st(2));
    this.line(3, `\\text{dual basics} \\ge 0?\\ \\ ${nb.map((j) => `${dTex(j)} = ${hsNum(tb.d[j])}`).join(",\\ ")}`,
      done ? "all ≥ 0: dual feasible, <b>optimal</b>" : "some &lt; 0: not optimal yet", st(3));
    this.lines[4].k.textContent = done ? "stop" : "enter";
    if (done) {
      this.line(4, `c^\\top x = b^\\top y = ${fmt(tb.z)}`, "primal and dual agree: stop", st(4));
      for (const i of [5, 6, 7]) this.line(i, "", "", "off");
    } else {
      this.line(4, `${name(I.enter)}\\ \\text{enters}`, "most negative d<sub>j</sub> (Dantzig)", st(4));
      const rat = I.ratios.map((v) => (v === null ? "\\text{–}" : hsNum(v)));
      const t = Math.min(...I.ratios.filter((v) => v !== null));
      // u = B^-1 a_q: the entering column in terms of the basis, i.e. how fast each basic variable drops
      this.line(5, `B\\,u = a_{${S.tex[I.enter]}} \\;\\Rightarrow\\; u = B^{-1}a_{${S.tex[I.enter]}} = ${hsVec(I.u)}`,
        `per unit of ${uni(S.tex[I.enter])}, ${I.basis.map((j) => uni(S.tex[j])).join(", ")} drop by u`, st(5));
      this.line(6, `t^* = \\min_{u_i > 0} \\tfrac{(x_B)_i}{u_i} = \\min ${`(${rat.join(",\\ ")})`} = ${hsNum(t)} \\;\\Rightarrow\\; ${name(I.leave)}\\ \\text{leaves}`,
        "the first basic variable to hit 0", st(6));
      this.line(7, `B \\leftarrow \\{${I.next.map(name).join(",\\ ")}\\}`, `walk to ${pt(I.nextPoint)}, profit ${fmt(S.tableau(I.next).z)}`, st(7));
    }
    // the matrices: A's basic columns tinted (that's B), entering gold, leaving red; b, B, B⁻¹ for this basis
    const on = (els, cls, v) => els.forEach((e) => e.classList.toggle(cls, v));
    // A's column j, and row j of x and c, carry the same highlights: basic (tinted), entering (gold), leaving (red)
    const yRow = (j) => j;  // row-aligned with x: x_j's partner d_j, s_i's partner y_i
    const cellsOf = (j) => [this.A.head[j], ...this.A.cells.map((r) => r[j]), this.x.names[j], this.x.cells[j][0], this.c.cells[j][0], this.y.names[yRow(j)], this.y.cells[yRow(j)][0]];
    S.cols.forEach((j) => {
      const basic = I.basis.includes(j), cells = cellsOf(j);
      on(cells.slice(0, -2), "bas", basic && lv >= 0);
      on(cells.slice(-2), "bas", !basic && lv >= 0);  // in y, the tint marks the dual basics: the partners of the primal nonbasics
      on(cells, "ent", !done && lv >= 4 && j === I.enter);
      on(cells, "lev", !done && lv >= 6 && j === I.leave);
      // click 1 shows the nonbasic zeros, the primal step the solved x_B
      this.x.cells[j][0].textContent = lv >= 1 || (lv >= 0 && !basic) ? fmtT(tb.x[j]) : "";
    });
    // the partners of the basic variables are 0 by choice (complementary slackness), shown with the basis like
    // x's nonbasic zeros; the other 2 (the dual basics) are solved with D at the dual step
    S.cols.forEach((j) => {
      const show = I.basis.includes(j) ? lv >= 0 : lv >= 2, td = this.y.cells[yRow(j)][0];
      td.textContent = show ? fmtT(tb.d[j]) : "";
      td.classList.toggle("neg", show && tb.d[j] < -1e-9);
    });
    const Bm = [0, 1, 2].map((i) => I.basis.map((j) => S.A[i][j])), Bi = Lin.inv3(Bm);
    I.basis.forEach((j, k) => {
      Deck.tex(this.B.head[k], hsVar(j));
      [this.B.head[k], ...this.B.cells.map((r) => r[k])].forEach((c) => c.classList.toggle("lev", !done && lv >= 6 && j === I.leave));
    });
    for (let i = 0; i < 3; i++) for (let k = 0; k < 3; k++) {
      this.B.cells[i][k].textContent = fmtT(Bm[i][k]);
      this.Bi.cells[i][k].textContent = fmtT(Bi[i][k]);
    }
    const Dcol = (j) => (j < 2 ? [0, 1].map((r) => (r === j ? -1 : 0)) : [S.A[j - 2][0], S.A[j - 2][1]]);
    nb.forEach((j, k) => {
      Deck.tex(this.D.head[k], dTex(j));
      Dcol(j).forEach((v, r) => { this.D.cells[r][k].textContent = fmtT(v); });
      [this.D.head[k], ...this.D.cells.map((r) => r[k])].forEach((c) => c.classList.toggle("ent", !done && lv >= 4 && j === I.enter));
    });
    this.D.blk.classList.toggle("off", lv < 2);
    this.D.mat.classList.toggle("foc", lv === 2);
    this.Bi.blk.classList.toggle("off", lv < 1);
    this.B.blk.classList.toggle("off", lv < 0);
    this.b.mat.classList.toggle("foc", lv === 1);
    this.x.mat.classList.toggle("foc", lv === 1 || lv === 6);
    this.c.mat.classList.toggle("foc", lv === 2);
    this.y.mat.classList.toggle("foc", lv === 2 || lv === 3);
    this.Bi.mat.classList.toggle("foc", lv === 1 || lv === 5);
    // the plot
    const p = this.plot;
    if (this.anim) this.anim.cancel();
    const trail = HS.slice(0, it + 1).map((s) => s.tb.point);
    const draw = (e) => {
      const pts = walked ? [...trail, lerpP(tb.point, I.nextPoint, e)] : trail;
      p.line("trail", pts.length > 1 ? pts : null, { stroke: C.obj, "stroke-width": 4 }, "under");
      p.dot("now", pts[pts.length - 1], { color: C.obj, r: 8 });
    };
    p.line("edge", !done && lv >= 4 && !walked ? [tb.point, I.nextPoint] : null, { stroke: C.obj, "stroke-width": 4, "stroke-dasharray": "2 9" }, "under");
    if (walked && animate) this.anim = Anim.tween(900, draw);
    else draw(1);
  },
});

// ------------------------------------------------------------------ a corner = two zeros
const EDGE_LABELS = [
  { tex: "x_2 = 0", color: C.ink, from: [0, 0], to: [5, 0], at: [2.5, 0], dx: 0, dy: -22 },
  { tex: "s_1 = 0", color: C.flour, from: [5, 0], to: [4, 2], at: [4.5, 1], dx: 58, dy: 0 },
  { tex: "s_2 = 0", color: C.oven, from: [4, 2], to: [2, 5], at: [3, 3.5], dx: 54, dy: -6 },
  { tex: "s_3 = 0", color: C.labor, from: [2, 5], to: [0, 6], at: [1, 5.5], dx: 0, dy: -28 },
  { tex: "x_1 = 0", color: C.ink, from: [0, 6], to: [0, 0], at: [0, 3], dx: 48, dy: 0 },
];
const PAIR_OFF = { "0,0": [52, -24], "5,0": [64, -14], "4,2": [70, 0], "2,5": [46, -32], "0,6": [-72, 0] };
Deck.register("zeros", {
  steps: 3,
  init(el) {
    this.el = el;
    const p = (this.plot = bakeryPlot(el.querySelector("#zeros-plot"), { size: 640 }));
    setLines(p, true);
    for (const r of Bakery2D.res) p.emphasize(r.key, "dim");
    hideConstraintLabels(p);
    setRegion(p, true);
    setCorners(p, true, false);
    EDGE_LABELS.forEach((e, i) => {
      p.line(`edge${i}`, [e.from, e.to], { stroke: e.color, "stroke-width": 6, opacity: 0.9 }, "under");
      p.html(`el${i}`, e.at, `\\textcolor{${e.color.slice(1)}}{${e.tex}}`, { tex: true, dx: e.dx, dy: e.dy, cls: "halo" });
    });
    const T = BakeryStd.tex, col = BakeryStd.color;
    const v = (j) => `\\textcolor{${col[j].slice(1)}}{${T[j]}}`;
    const table = el.querySelector("#zr-table");
    this.rows = {};
    for (const q of CORNERS) {
      const x = [q[0], q[1], ...Bakery2D.res.map((r) => r.b - Geo.dot(r.a, q))];
      const zero = [0, 1, 2, 3, 4].filter((j) => Math.abs(x[j]) < 1e-9);
      const nz = [0, 1, 2, 3, 4].filter((j) => Math.abs(x[j]) >= 1e-9);
      p.html(`pair${ckey(q)}`, q, zero.map(v).join(",\\ "), { tex: true, dx: PAIR_OFF[ckey(q)][0], dy: PAIR_OFF[ckey(q)][1], cls: "halo small" });
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>(${q[0]}, ${q[1]})</td><td class="z"></td><td class="nz"></td>`;
      Deck.tex(tr.querySelector(".z"), zero.map(v).join(",\\ "));
      Deck.tex(tr.querySelector(".nz"), nz.map((j) => `${v(j)} = ${tnum(x[j])}`).join(",\\ "));
      tr.classList.add("clickable");
      tr.style.cursor = "pointer";
      tr.addEventListener("click", () => this.pick(q));
      table.appendChild(tr);
      this.rows[ckey(q)] = tr;
      const dot = p.items[`v${ckey(q)}`];
      dot.style.cursor = "pointer";
      dot.addEventListener("click", () => this.pick(q));
    }
  },
  pick(q) {
    for (const o of CORNERS) {
      const on = q && Geo.near(o, q);
      this.rows[ckey(o)].classList.toggle("on", !!on);
      cornerColor(this.plot, o, on ? C.obj : "#fff", on ? 10 : 7);
    }
  },
  render(k) {
    for (const q of CORNERS) this.plot.showLabel(`pair${ckey(q)}`, k >= 1);
    this.pick(null);
  },
});

// ------------------------------------------------------------------ the tableau
// each tableau row as an equation, basic variable first (the same order as the row)
const TB_EQS = {
  head: "as an equation",
  rows: ["\\FL{s_1 + 2x_1 + x_2 = 10}", "\\OV{s_2 + 3x_1 + 2x_2 = 16}", "\\LB{s_3 + x_1 + 2x_2 = 12}"],
  z: "\\OB{z - 9x_1 - 8x_2 = 0}",
};
Deck.register("tableau", {
  steps: 2,
  init(el) {
    this.wrap = el.querySelector("#tb-view");
    this.view = new TableauView(this.wrap);
    this.view.set(BakeryStd.tableau([2, 3, 4]), { negs: true, annotate: true, side: TB_EQS });
    const p = (this.plot = pivotPlot(el.querySelector("#tableau-plot"), 480));
    p.dot("walker", [0, 0], { color: C.obj, r: 9 });
  },
  render(k) { this.wrap.classList.toggle("nobasic", k < 1); },
});

// ------------------------------------------------------------------ one pivot, in detail
function pivotPlot(container, size = 540) {
  const p = bakeryPlot(container, { size });
  setLines(p, true);
  for (const r of Bakery2D.res) p.emphasize(r.key, "dim");
  hideConstraintLabels(p);
  setRegion(p, true);
  setCorners(p, true, true);
  return p;
}
// ------------------------------------------------------------------ pivoting: one click per step
// A pivoting slide: click 0 the start; then per iteration: entering variable, min ratio test, exiting variable, pivot;
// a last click for the recap. walk: [{basis, enter, at, next, enter_, ratio_, leave_, pivot_}]; ticks: the first ratio
// test marked on an axis ({lines: [[from, to, color]], labels: [[id, at, text, cls, color, dx, dy]], hide: corner label}).
function pivotWalk({ walk, startSay, endSay, ticks, ghost }) {
  const n = walk.length, path = [walk[0].at, ...walk.map((w) => w.next)];
  const S = BakeryStd, afterPivot = (w) => {
    const nb = [...w.basis];
    nb[S.leavingRow(S.tableau(w.basis), w.enter)] = w.enter;
    return nb;
  };
  return {
    steps: 4 * n + (endSay ? 1 : 0),
    init(el) {
      this.view = new TableauView(el.querySelector(".pv-view"));
      this.say = el.querySelector(".say");
      const p = (this.plot = pivotPlot(el.querySelector(".pv-plot"), 480));
      for (const [id, at, text, cls, color, dx, dy] of ticks.labels) p.html(id, at, text, { cls: `halo small ${cls}`, color, dx, dy, hidden: true });
    },
    render(k, animate) {
      const p = this.plot, base = { negs: true, annotate: true, ratioCol: true, ratioHead: "min ratio" };
      if (this.seq) this.seq.cancel();
      const it = k >= 1 && k <= 4 * n ? Math.floor((k - 1) / 4) : null, phase = it === null ? null : ["enter", "ratio", "leave", "pivot"][(k - 1) % 4];
      const w = it === null ? null : walk[it], reached = Math.min(n, Math.floor(k / 4));
      if (k === 0) {
        this.view.set(S.tableau(walk[0].basis), base);
        this.say.innerHTML = startSay;
      } else if (k > 4 * n) {
        this.view.set(S.tableau(afterPivot(walk[n - 1])), base);
        this.say.innerHTML = endSay;
      } else if (phase === "pivot") {
        this.view.set(S.tableau(afterPivot(w)), { ...base, flash: animate });
        this.say.innerHTML = w.pivot_;
      } else {
        this.view.set(S.tableau(w.basis), { ...base, enter: w.enter, ratios: phase !== "enter", leave: phase === "ratio" ? -1 : undefined });
        this.say.innerHTML = w[`${phase}_`];
      }
      // the plot: corners walked so far, the edge about to be walked, the first ratio test on its axis
      const first = it === 0 && (phase === "ratio" || phase === "leave");
      for (const l of ticks.labels) p.showLabel(l[0], first);
      for (const id of ticks.hide) p.showLabel(id, !first);
      ticks.lines.forEach(([a, b, color], i) => p.line(`tick${i}`, first ? [a, b] : null, { stroke: color, "stroke-width": 4 }, "top"));
      const done = path.slice(0, reached + 1);
      if (animate && phase === "pivot") {
        walkFinal(p, done.slice(0, -1), { trail: "trail", dot: "walker" });
        this.seq = new Seq();
        this.seq.run(...walkThunks(p, done, { trail: "trail", dot: "walker", ms: 900 }).slice(-2));
      } else walkFinal(p, done, { trail: "trail", dot: "walker" });
      p.line("nextE", w && phase !== "pivot" ? [w.at, w.next] : null, { stroke: C.obj, "stroke-width": 5, "stroke-dasharray": "2 11", opacity: 0.9 }, "under");
      p.line("ring", k >= 4 * n ? ring(path[n]) : null, { stroke: C.obj, "stroke-width": 2.5 }, "top");
      p.line("ghost", ghost && k > 4 * n ? ghost : null, { stroke: C.proof, "stroke-width": 3, "stroke-dasharray": "10 9" }, "under");
    },
  };
}

// Dantzig's route: bread first
Deck.register("walk2", pivotWalk({
  walk: [
    { basis: [2, 3, 4], enter: 0, at: [0, 0], next: [5, 0],
      enter_: "<b>Entering variable.</b> Any negative bottom-row entry can enter: raising it raises the profit. Dantzig's rule is <b>greedy</b>: it takes the most negative, the biggest gain per unit. Bread (−9) enters.",
      ratio_: "<b>Min ratio test.</b> How far can bread grow before a basic variable hits 0? For each positive entry in its column: value ÷ entry.",
      leave_: "<b>Exiting variable.</b> The smallest ratio is 5: <span class='c-flour'>flour</span> runs out first, so <b>s₁ leaves</b>.",
      pivot_: "<b>Pivot.</b> Row operations turn x₁'s column into the identity column s₁ had. New corner (5, 0), profit <span class='c-obj'>45</span>." },
    { basis: [0, 3, 4], enter: 1, at: [5, 0], next: [4, 2],
      enter_: "<b>Entering variable.</b> Only cake is still negative (−3.5): it enters.",
      ratio_: "<b>Min ratio test</b> for cake: value ÷ entry in each row with a positive entry.",
      leave_: "<b>Exiting variable.</b> Smallest ratio 2: <span class='c-oven'>oven</span> runs out first ⇒ <b>s₂ leaves</b>.",
      pivot_: "<b>Pivot.</b> New corner (4, 2), profit <span class='c-obj'>52</span>." },
    { basis: [0, 1, 4], enter: 2, at: [4, 2], next: [2, 5],
      enter_: "<b>Entering variable.</b> The s₁ column is −6: <span class='c-flour'>flour's</span> shadow price is negative, so stop using all the flour: s₁ enters.",
      ratio_: "<b>Min ratio test</b> for s₁. Only positive entries count: the x₂ row's −3 doesn't limit it.",
      leave_: "<b>Exiting variable.</b> Smallest ratio 1: <span class='c-labor'>labor</span> runs out first ⇒ <b>s₃ leaves</b>.",
      pivot_: "<b>Pivot.</b> New corner (2, 5), profit <span class='c-obj'>58</span>. Every bottom-row entry ≥ 0: <b>optimal</b>, after 3 pivots. The bottom row is the dual: shadow prices <span class='c-flour'>0</span>, <span class='c-oven'>2.5</span>, <span class='c-labor'>1.5</span>." },
  ],
  startSay: "At (0, 0) the bottom row has negative entries (−9, −8): the dual isn't feasible yet, so the profit can still go up.",
  ticks: {  // bread's ratio test on the x1 axis: flour runs out at 5, oven at 5.33
    lines: [[[5, -0.12], [5, 0.5], C.flour], [[16 / 3, -0.12], [16 / 3, 0.5], C.oven]],
    labels: [["mFlour", [5, 0], "flour runs out", "r", C.flour, -10, -58], ["mOven", [16 / 3, 0], "oven", "l", C.oven, 10, -58]],
    hide: ["vl5,0"],
  },
}));

// the other direction: cake first
Deck.register("walkcake", pivotWalk({
  walk: [
    { basis: [2, 3, 4], enter: 1, at: [0, 0], next: [0, 6],
      enter_: "<b>Entering variable.</b> Cake (−8) is negative too, so it can enter instead: not Dantzig's greedy pick, but just as allowed.",
      ratio_: "<b>Min ratio test.</b> How far can cake grow? For each positive entry in its column: value ÷ entry.",
      leave_: "<b>Exiting variable.</b> The smallest ratio is 6: <span class='c-labor'>labor</span> runs out first, so <b>s₃ leaves</b>.",
      pivot_: "<b>Pivot.</b> New corner (0, 6), profit <span class='c-obj'>48</span>." },
    { basis: [2, 3, 1], enter: 0, at: [0, 6], next: [2, 5],
      enter_: "<b>Entering variable.</b> Bread is now −5: labor is priced at 4 and a batch uses 1 hour, so it's worth 4 − 9 = −5 in the bottom row. Bread enters.",
      ratio_: "<b>Min ratio test</b> for bread: value ÷ entry in each row with a positive entry.",
      leave_: "<b>Exiting variable.</b> Smallest ratio 2: <span class='c-oven'>oven</span> runs out first ⇒ <b>s₂ leaves</b>.",
      pivot_: "<b>Pivot.</b> New corner (2, 5), profit <span class='c-obj'>58</span>. Every bottom-row entry ≥ 0: <b>optimal</b>, the same corner and the same dual." },
  ],
  startSay: "Back at (0, 0), the same tableau: −9 and −8 are both negative. This time, enter <b>cake</b>.",
  endSay: "Cake first: <b>2 pivots</b>. Dantzig's greedy choice took <b>3</b> (dashed). The biggest gain per unit isn't always the shortest route: which negative entry to pick is the <b>pivot rule</b>, and it's next.",
  ticks: {  // cake's ratio test on the x2 axis: labor runs out at 6, oven at 8
    lines: [[[-0.12, 6], [0.5, 6], C.labor], [[-0.12, 8], [0.5, 8], C.oven]],
    labels: [["mLabor", [0, 6], "labor runs out", "l", C.labor, 26, -14], ["mOven", [0, 8], "oven", "l", C.oven, 26, 0]],
    hide: ["vl0,6", "vl2,5"],
  },
  ghost: [[0, 0], [5, 0], [4, 2], [2, 5]],
}));
