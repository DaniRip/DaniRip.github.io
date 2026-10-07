// Controllers for Part 7 (the embedded pivot-path viewer, the RL question) and the closing slide.
"use strict";

// Viewer frames load on first visit only (they're heavy, and most of the talk doesn't need them).
for (const id of ["tl-bakery", "tl-km", "tl-big"]) {
  Deck.register(id, { init(el) { const f = el.querySelector("iframe"); f.src = f.dataset.src; } });
}

// ------------------------------------------------------------------ pivot counts on the 40 x 40 LP
const ROUTE_LABEL = { astar: "A* (shortest)", greatest_increment: "Greatest increment", devex: "Devex",
  steepest: "Steepest edge", dantzig: "Dantzig", bland: "Bland" };
Deck.register("question", {
  steps: 3,
  init(el) {
    const prog = window.SIMPLEXRL_DATA.programs.find((p) => p.id === "traj_40x40");
    const rows = prog.routes.filter((r) => r.kind !== "rl")
      .map((r) => ({ name: r.name, label: ROUTE_LABEL[r.name], n: r.enters.length })).sort((a, b) => a.n - b.n);
    // learned policies (kind "rl") come last and appear with the last step; with none yet, a dashed "?" bar
    const learned = prog.routes.filter((r) => r.kind === "rl")
      .map((r) => ({ name: r.name, label: `learned policy (${r.label})`, n: r.enters.length, color: r.color, learned: true }));
    const last = learned.length ? learned : [{ name: "rl", label: "learned policy", n: null, learned: true }];
    const max = Math.max(...[...rows, ...last].map((r) => r.n || 0));
    const box = el.querySelector("#q-bars");
    this.bars = [...rows, ...last].map((r) => {
      const lab = document.createElement("div");
      lab.className = "bl";
      lab.textContent = r.label;
      const track = document.createElement("div");
      track.className = "bt";
      track.innerHTML = `<div class="bf${r.name === "astar" ? " best" : ""}${r.n === null ? " unknown" : ""}"></div><div class="bv"></div>`;
      box.append(lab, track);
      if (r.color) track.firstChild.style.background = r.color;
      const w = r.n === null ? 0.5 : r.n / max;  // the placeholder bar is just a dashed outline
      return { r, lab, fill: track.querySelector(".bf"), val: track.querySelector(".bv"), w };
    });
  },
  // bars grow in when the slide opens; the "learned policy" row appears with the last step
  render(k) {
    for (const b of this.bars) {
      const on = !b.r.learned || k >= 3;
      b.lab.style.opacity = on ? 1 : 0;
      b.fill.style.width = on ? `${88 * b.w}%` : "0%";
      b.val.style.left = on ? `calc(${88 * b.w}% + 12px)` : "0%";
      b.val.textContent = b.r.n === null ? "?" : b.r.n;
      b.val.style.opacity = on ? 1 : 0;
    }
  },
  enter() {
    for (const b of this.bars) { b.fill.style.width = "0%"; b.val.style.left = "0%"; }
    requestAnimationFrame(() => requestAnimationFrame(() => this.render(Deck.step)));
  },
});

// ------------------------------------------------------------------ inside SimplexRL: the model, on the bakery
// One 1456 x 300 stage: the LP as a graph (left), the candidates at the origin (middle), the pick (right).
// Every node carries a "vector", drawn as a strip of 6 coloured cells; message passing mixes neighbours' colours in.
const IN_VARS = [
  { id: "x1", x: 190, y: 30, tex: "x_1", col: C.ink, tag: "profit 9" },
  { id: "x2", x: 190, y: 88, tex: "x_2", col: "#b99cff", tag: "profit 8" },
  { id: "s1", x: 190, y: 146, tex: "\\FL{s_1}", col: C.flour },
  { id: "s2", x: 190, y: 204, tex: "\\OV{s_2}", col: C.oven },
  { id: "s3", x: 190, y: 262, tex: "\\LB{s_3}", col: C.labor },
];
const IN_CONS = [
  { id: "F", x: 420, y: 59, name: "flour", col: C.flour, tag: "≤ 10" },
  { id: "O", x: 420, y: 146, name: "oven", col: C.oven, tag: "≤ 16" },
  { id: "L", x: 420, y: 233, name: "labor", col: C.labor, tag: "≤ 12" },
];
const IN_EDGES = [["x1", "F", 2], ["x1", "O", 3], ["x1", "L", 1], ["x2", "F", 1], ["x2", "O", 2], ["x2", "L", 2],
  ["s1", "F", 1], ["s2", "O", 1], ["s3", "L", 1]];
// candidate tokens (x1, x2 at the origin) and row tokens (each row's basic variable is its slack)
const IN_CANDS = [{ id: "x1", top: 56, tex: "x_1", ft: "d = −9" }, { id: "x2", top: 160, tex: "x_2", ft: "d = −8" }];
const IN_ROWS = [{ id: "s1", top: 22, name: "flour", col: C.flour, tex: "s_1" }, { id: "s2", top: 114, name: "oven", col: C.oven, tex: "s_2" },
  { id: "s3", top: 206, name: "labor", col: C.labor, tex: "s_3" }];
const IN_CAND_X = 630, IN_CAND_W = 190, IN_CAND_H = 80, IN_ROW_X = 900, IN_ROW_W = 190, IN_ROW_H = 64;
const IN_BAR = { x: 1200, w: 240, fill: { x1: 0.32, x2: 0.68 } };  // illustrative scores

// The strip colours after each round of message passing. A node's "mix" says how much of each node's information
// it holds (round 0: only its own); each round keeps 60% of its mix and averages in 40% from its neighbours.
// A strip shows the mix as 6 cells (largest-remainder rounding), in a fixed source order.
function inRounds() {
  const all = [...IN_VARS, ...IN_CONS], ids = all.map((n) => n.id), nbr = Object.fromEntries(ids.map((id) => [id, []]));
  for (const [v, c] of IN_EDGES) { nbr[v].push(c); nbr[c].push(v); }
  const col = Object.fromEntries(all.map((n) => [n.id, n.col]));
  const cells = (w) => {
    const q = ids.map((s) => 6 * w[s]), n = q.map(Math.floor);
    const order = ids.map((_, i) => i).sort((a, b) => (q[b] - n[b]) - (q[a] - n[a]));
    const short = 6 - n.reduce((a, b) => a + b, 0);
    for (let k = 0; k < short; k++) n[order[k]]++;
    return ids.flatMap((s, i) => Array(n[i]).fill(col[s]));
  };
  let mix = Object.fromEntries(ids.map((v) => [v, Object.fromEntries(ids.map((s) => [s, s === v ? 1 : 0]))]));
  const out = [];
  for (let r = 0; r <= 4; r++) {
    out.push(Object.fromEntries(ids.map((v) => [v, cells(mix[v])])));
    const prev = mix;
    mix = Object.fromEntries(ids.map((v) => [v, Object.fromEntries(ids.map((s) =>
      [s, 0.6 * prev[v][s] + 0.4 * nbr[v].reduce((a, u) => a + prev[u][s], 0) / nbr[v].length]))]));
  }
  return out;
}

Deck.register("inside", {
  steps: 5,
  init(el) {
    const st = el.querySelector("#in-stage"), svg = el.querySelector("#in-svg");
    const div = (cls, x, y, html = "") => {
      const d = document.createElement("div");
      d.className = cls;
      d.style.left = `${x}px`;
      d.style.top = `${y}px`;
      d.innerHTML = html;
      st.appendChild(d);
      return d;
    };
    const strip = (x, y) => {
      const d = div("in-strip", x, y, "<span></span>".repeat(6));
      return { el: d, cells: [...d.children], at(px, py) { d.style.left = `${px}px`; d.style.top = `${py}px`; } };
    };
    this.rounds = inRounds();
    const node = Object.fromEntries([...IN_VARS, ...IN_CONS].map((n) => [n.id, n]));
    const layer = (name) => svgEl("g", { class: name }, svg);
    const gEdges = layer("edges"), gAtt = layer("att"), gPulse = layer("pulses"), gArrows = layer("arrows");

    // 1 · the graph: edges (width ~ |coefficient|), nodes, tags, strips
    this.pulses = IN_EDGES.map(([v, c, a], i) => {
      const P = [node[v].x + 23, node[v].y], Q = [node[c].x - 46, node[c].y];
      svgEl("line", { x1: P[0], y1: P[1], x2: Q[0], y2: Q[1], stroke: "#4a5060", "stroke-width": 1.5 * a }, gEdges);
      const dot = (fill) => svgEl("circle", { r: 4.5, fill, opacity: 0 }, gPulse);
      return { P, Q, out: dot(node[v].col), back: dot(node[c].col) };
    });
    for (const n of IN_VARS) {
      const d = div("in-var", n.x, n.y);
      d.style.setProperty("--c", n.col);
      Deck.tex(d, n.tex);
    }
    for (const n of IN_CONS) {
      const d = div("in-con", n.x, n.y, n.name);
      d.style.setProperty("--c", n.col);
    }
    this.tags = [];
    this.graphStrips = {};
    for (const n of IN_VARS) {
      if (n.tag) { const t = div("in-tag", n.x - 35, n.y, n.tag); t.style.transform = "translate(-100%, -50%)"; this.tags.push(t); }
      this.graphStrips[n.id] = strip(n.x - 35 - 88, n.y);
    }
    for (const n of IN_CONS) {
      this.tags.push(div("in-tag", n.x + 58, n.y, n.tag));
      this.graphStrips[n.id] = strip(n.x + 58, n.y);
    }

    // 2 · tokens: candidates and rows, with attention between them
    this.tokens = [];
    this.flyHome = {};
    this.flyTo = {};
    for (const c of IN_CANDS) {
      const d = div("in-tok", IN_CAND_X, c.top, `<div class="tl"></div><div class="ft">${c.ft}</div>`);
      d.style.width = `${IN_CAND_W}px`;
      d.style.height = `${IN_CAND_H}px`;
      Deck.tex(d.querySelector(".tl"), c.tex);
      this.tokens.push(d);
      this.flyTo[c.id] = [IN_CAND_X + 56, c.top + 26];
    }
    for (const r of IN_ROWS) {
      const d = div("in-tok", IN_ROW_X, r.top, `<div class="tl"><span style="color:${r.col}">${r.name}</span> <span class="faint" style="font-size: 16px;">row · basic</span> <span class="b"></span></div>`);
      d.style.width = `${IN_ROW_W}px`;
      d.style.height = `${IN_ROW_H}px`;
      Deck.tex(d.querySelector(".b"), r.tex);
      this.tokens.push(d);
      this.flyTo[r.id] = [IN_ROW_X + 14, r.top + 46];
    }
    this.fly = {};
    for (const id of Object.keys(this.flyTo)) {
      const n = node[id];
      this.flyHome[id] = n.x < 300 ? [n.x - 35 - 88, n.y] : [n.x + 58, n.y];
      this.fly[id] = strip(...this.flyHome[id]);
      this.fly[id].cells.forEach((cell, c) => { cell.style.backgroundColor = this.rounds[4][id][c]; });
    }
    const cy = (top, h) => top + h / 2;
    const attPath = (d) => svgEl("path", { d, fill: "none", stroke: C.muted, "stroke-width": 2, opacity: 0 }, gAtt);
    this.att = [];
    for (const c of IN_CANDS) {
      for (const r of IN_ROWS) {
        const a = [IN_CAND_X + IN_CAND_W, cy(c.top, IN_CAND_H)], b = [IN_ROW_X, cy(r.top, IN_ROW_H)];
        this.att.push(attPath(`M ${a[0]} ${a[1]} C ${a[0] + 40} ${a[1]}, ${b[0] - 40} ${b[1]}, ${b[0]} ${b[1]}`));
      }
    }
    const arc = (x, y1, y2, dx) => attPath(`M ${x} ${y1} C ${x + dx} ${y1 + 12}, ${x + dx} ${y2 - 12}, ${x} ${y2}`);
    const [c1, c2] = IN_CANDS.map((c) => cy(c.top, IN_CAND_H)), [r1, r2, r3] = IN_ROWS.map((r) => cy(r.top, IN_ROW_H));
    this.att.push(arc(IN_CAND_X, c1, c2, -18));  // shallow, so it stays clear of the arrow from the graph
    this.att.push(arc(IN_ROW_X + IN_ROW_W, r1, r2, 26));
    this.att.push(arc(IN_ROW_X + IN_ROW_W, r2, r3, 26));

    // arrows between the panels, and the loop back from the pick to the next corner
    const arrow = (d) => {
      const g = svgEl("g", { opacity: 0 }, gArrows);
      const path = svgEl("path", { d, fill: "none", stroke: C.faint, "stroke-width": 3 }, g);
      return { g, path };
    };
    this.arr12 = arrow("M 574 146 L 599 146 M 589 136 L 600 146 L 589 156");
    this.arr23 = arrow("M 1122 146 L 1150 146 M 1140 136 L 1151 146 L 1140 156");
    this.loop = arrow("M 1320 236 L 1320 290 L 725 290 L 725 246 M 715 258 L 725 245 L 735 258");
    const loopLab = svgEl("text", { x: 1022, y: 296, "text-anchor": "middle", "font-size": 17, fill: C.muted, stroke: C.bg, "stroke-width": 8, "paint-order": "stroke" }, this.loop.g);
    loopLab.textContent = "The solver pivots; repeat at the next corner";

    // 3 · scores
    this.bars = IN_CANDS.map((c) => {
      const y = cy(c.top, IN_CAND_H);
      const lab = div("in-lab", 1166, y - 14);
      Deck.tex(lab, c.tex);
      const track = div("in-track", IN_BAR.x, y - 12, `<div class="in-fill${c.id === "x2" ? " pick" : ""}"></div>`);
      track.style.width = `${IN_BAR.w}px`;
      return { id: c.id, lab, track, fill: track.firstChild };
    });
    const yPick = cy(IN_CANDS[1].top, IN_CAND_H);
    this.pick = div("in-lab", IN_BAR.x + IN_BAR.w * IN_BAR.fill.x2 + 10, yPick - 13, "<b style=\"color: var(--obj)\">pick</b>");
    this.dantzig = div("in-lab", IN_BAR.x + IN_BAR.w * IN_BAR.fill.x1 + 10, cy(IN_CANDS[0].top, IN_CAND_H) - 13, "<span class=\"muted\">Dantzig's pick</span>");
    this.illus = div("in-lab", IN_BAR.x, yPick + 20, "<span class=\"faint\" style=\"font-size: 15px;\">illustrative scores</span>");
  },

  paintGraph(r) {
    for (const [id, s] of Object.entries(this.graphStrips)) s.cells.forEach((cell, c) => { cell.style.backgroundColor = this.rounds[r][id][c]; });
  },
  setGraph(k) {
    const on = k >= 1;
    this.tags.forEach((t) => { t.style.opacity = on ? 0 : 1; });
    Object.values(this.graphStrips).forEach((s) => { s.el.style.opacity = on ? 1 : 0; });
    this.paintGraph(on ? 4 : 0);
    this.pulses.forEach((p) => { p.out.setAttribute("opacity", 0); p.back.setAttribute("opacity", 0); });
  },
  setTokens(k) {
    const on = k >= 2;
    this.tokens.forEach((t) => { t.style.opacity = on ? 1 : 0; });
    for (const [id, s] of Object.entries(this.fly)) {
      s.el.classList.remove("fly");
      s.at(...(on ? this.flyTo[id] : this.flyHome[id]));
      s.el.style.opacity = on ? 1 : 0;
    }
    this.att.forEach((a) => a.setAttribute("opacity", on ? 0.35 : 0));
    this.arr12.g.setAttribute("opacity", on ? 1 : 0);
  },
  setBars(k) {
    const on = k >= 3;
    for (const b of this.bars) {
      b.lab.style.opacity = on ? 1 : 0;
      b.track.style.opacity = on ? 1 : 0;
      b.fill.style.width = on ? `${100 * IN_BAR.fill[b.id]}%` : "0%";
    }
    for (const e of [this.pick, this.dantzig, this.illus]) e.style.opacity = on ? 1 : 0;
    this.arr23.g.setAttribute("opacity", on ? 1 : 0);
    this.loop.g.setAttribute("opacity", on ? 1 : 0);
  },

  render(k, animate) {
    if (this.seq) this.seq.cancel();
    this.setGraph(k);
    this.setTokens(k);
    this.setBars(k);
    if (!animate) return;
    this.seq = new Seq();
    if (k === 1) {
      // tags give way to vectors, then four rounds of messages along every edge, both ways
      this.paintGraph(0);
      const pulse = () => Anim.tween(560, (e) => {
        const o = Math.sin(Math.PI * e);
        for (const p of this.pulses) {
          p.out.setAttribute("cx", p.P[0] + e * (p.Q[0] - p.P[0]));
          p.out.setAttribute("cy", p.P[1] + e * (p.Q[1] - p.P[1]));
          p.back.setAttribute("cx", p.Q[0] + e * (p.P[0] - p.Q[0]));
          p.back.setAttribute("cy", p.Q[1] + e * (p.P[1] - p.Q[1]));
          p.out.setAttribute("opacity", o);
          p.back.setAttribute("opacity", o);
        }
      }, "linear");
      const steps = [() => Anim.wait(450)];
      for (let r = 1; r <= 4; r++) steps.push(pulse, () => { this.paintGraph(r); return Anim.wait(380); });
      this.seq.run(...steps);
    } else if (k === 2) {
      // each candidate's and each row's vector flies over from the graph; attention lines light up
      for (const [id, s] of Object.entries(this.fly)) { s.at(...this.flyHome[id]); s.el.style.opacity = 1; }
      this.att.forEach((a) => a.setAttribute("opacity", 0));
      void this.fly.x1.el.offsetWidth;
      for (const [id, s] of Object.entries(this.fly)) { s.el.classList.add("fly"); s.at(...this.flyTo[id]); }
      this.seq.run(() => Anim.wait(700), () => Anim.tween(2000, (e) => {
        const o = 0.35 + 0.4 * Math.abs(Math.sin(2 * Math.PI * e)) * (1 - e);
        this.att.forEach((a) => a.setAttribute("opacity", Math.min(1, o * Math.min(1, 4 * e))));
      }, "linear"));
    } else if (k === 3) {
      this.loop.g.setAttribute("opacity", 0);
      this.seq.run(() => Anim.wait(700), () => { this.loop.g.setAttribute("opacity", 1); return Anim.draw(this.loop.path, 900); });
    }
  },
});

// ------------------------------------------------------------------ closing: a slowly turning polyhedron
Deck.register("close", {
  init(el) {
    const s = (this.scene = bakeryScene(el.querySelector("#close-scene"), { width: 480, height: 440 }, { ticks: false, labels: ["", "", ""] }));
    s.animateTo({ ...SOLID, cam: { ...Scene3D.TILT, scale: 26, center: [2.4, 2.8, 4.6] } }, 0);
    const path = Rules.run(BakeryStd3, "dantzig", [3, 4, 5]).map((x) => x.point);
    s.line("trail", path, { stroke: C.obj, "stroke-width": 4 }, "top");
    s.dot("opt", [2, 4, 2], { fill: C.obj, r: 9 });
    s.onDrag = () => { this.spin = false; };
  },
  enter() {
    this.spin = true;
    const tick = () => {
      if (!this.spin) return;
      this.scene.cam.az += 0.0035;
      this.scene.render();
      this.raf = requestAnimationFrame(tick);
    };
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(tick);
  },
  leave() { this.spin = false; cancelAnimationFrame(this.raf); },
});
