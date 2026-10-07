// Controllers for Part 6: pivot rules at one corner, the four-way race, Klee–Minty.
"use strict";

// ------------------------------------------------------------------ one corner, four rules
const PRODUCT_EDGE = [[5, 0, 0], [0, 6, 0], [0, 0, 10]];  // where each axis edge from the origin ends
const PRODUCT_NAME = ["bread", "cake", "cookies"];
Deck.register("rules", {
  steps: 5,
  init(el) {
    const tb = BakeryStd3.tableau([3, 4, 5]);
    const sc = Rules.scores(BakeryStd3, tb);  // columns 0, 1, 2: bread, cake, cookies
    this.pickOf = Object.fromEntries(Rules.order.map((r) => [r, Rules.pick(r, sc).j]));
    const cells = {
      d: (c) => fmt(c.d), dantzig: (c) => fmt(c.d), t: (c) => fmt(c.t), gi: (c) => fmt(c.gain),
      len2: (c) => fmt(c.len2), se: (c) => fmtT(c.se), bland: (c) => (c.j === this.pickOf.bland ? "first" : ""),
    };
    for (const [row, f] of Object.entries(cells)) {
      const tds = el.querySelectorAll(`#rt tr[data-row="${row}"] td:not(.rowh)`);
      sc.forEach((c, i) => {
        tds[i].textContent = f(c);
        if (this.pickOf[row] === c.j) tds[i].classList.add("win");
      });
    }
    const s = (this.scene = bakeryScene(el.querySelector("#rules-scene"), { width: 600, height: 640 }, { labels: ["", "", ""] }));
    s.animateTo({ ...SOLID, cam: { ...Scene3D.TILT, scale: 40, center: [2.4, 2.8, 4.6] } }, 0);
    s.dot("o", [0, 0, 0], { fill: C.obj, r: 10 });
    PRODUCT_EDGE.forEach((q, j) => s.label(`pl${j}`, q, PRODUCT_NAME[j], { cls: "halo", dx: [0, 10, 0][j], dy: [34, 34, -30][j] }));
  },
  render(k) {
    const s = this.scene;
    const rule = [null, "dantzig", "gi", "se", "bland", null][k];
    const chosen = rule ? this.pickOf[rule] : null;
    PRODUCT_EDGE.forEach((q, j) => {
      const on = k === 5 || chosen === j;
      s.line(`cand${j}`, [[0, 0, 0], q], on
        ? { stroke: C.obj, "stroke-width": 6, "stroke-dasharray": "", opacity: 1 }
        : { stroke: C.obj, "stroke-width": 3, "stroke-dasharray": "3 9", opacity: 0.7 }, "top");
      s.arrow(`ca${j}`, on && k !== 5 ? [0, 0, 0] : null, V3.mul(q, 0.45), { color: C.obj, width: 6, head: 18 });
      const who = Rules.order.filter((r) => this.pickOf[r] === j).map((r) => Rules.name[r]).join(" · ");
      const lab = s.items[`pl${j}`].el;
      lab.textContent = k === 5 ? `${PRODUCT_NAME[j]}: ${who}` : PRODUCT_NAME[j];
      lab.style.color = on ? C.obj : C.ink;
      lab.style.fontWeight = on ? 700 : 400;
    });
  },
});

// ------------------------------------------------------------------ lanes: one small scene per rule
// A lane walks its path one edge per beat; all lanes share the beat so the race is fair.
function laneSet(lane, k, e) {
  const n = lane.path.length - 1, s = lane.scene;
  const at = k < n && e > 0 ? V3.lerp(lane.path[k], lane.path[k + 1], e) : lane.path[Math.min(k, n)];
  s.line("trail", [...lane.path.slice(0, Math.min(k, n) + 1), at], { stroke: C.obj, "stroke-width": 4 }, "top");
  s.dot("walker", at, { fill: C.obj, r: 8 });
  const done = k >= n;
  s.dot("ring", lane.path[n], { r: 15, fill: "none", stroke: C.obj, "stroke-width": 2.5, opacity: done ? 1 : 0 });
  const piv = Math.min(k, n);
  lane.count.textContent = `${piv} pivot${piv === 1 ? "" : "s"}${done ? " ✓" : ""}`;
  lane.count.classList.toggle("done", done);
  if (lane.onPoint) lane.onPoint(at);
}
function raceThunks(lanes, ms = 900) {
  const beats = Math.max(...lanes.map((L) => L.path.length - 1));
  const th = [];
  for (let b = 0; b < beats; b++) {
    th.push(() => Anim.tween(ms, (e) => lanes.forEach((L) => { if (b < L.path.length - 1) laneSet(L, b, e); })));
    th.push(() => { lanes.forEach((L) => laneSet(L, Math.min(b + 1, L.path.length - 1), 0)); return Anim.wait(220); });
  }
  return th;
}
const raceController = (build) => ({
  steps: 2,
  init(el) { this.lanes = build(el); },
  render(k, animate) {
    if (this.seq) this.seq.cancel();
    if (k === 0) this.lanes.forEach((L) => laneSet(L, 0, 0));
    else if (k === 1 && animate) {
      this.lanes.forEach((L) => laneSet(L, 0, 0));
      this.seq = new Seq();
      this.seq.run(...raceThunks(this.lanes, this.ms));
    } else this.lanes.forEach((L) => laneSet(L, L.path.length - 1, 0));
  },
});

Deck.register("race", raceController((el) => [...el.querySelectorAll(".lane")].map((lane) => {
  const rule = lane.dataset.rule;
  const scene = bakeryScene(lane.querySelector(".lscene"), { width: 318, height: 400 }, { ticks: false, labels: ["", "", ""] });
  scene.animateTo({ ...SOLID, cam: { ...Scene3D.TILT, scale: 23, center: [2.4, 2.8, 4.6] } }, 0);
  return { rule, scene, count: lane.querySelector(".lcount"), path: Rules.run(BakeryStd3, rule, [3, 4, 5]).map((s) => s.point) };
})));

// ------------------------------------------------------------------ Klee–Minty
const KM_CAM = { az: 2.35, el: 0.4, scale: 42, center: [2.8, 2.8, 3.4] };
const kmCtrl = raceController((el) => [...el.querySelectorAll(".lane")].map((lane) => {
  const rule = lane.dataset.rule;
  const scene = new Scene3D(lane.querySelector(".lscene"), { width: 690, height: 420 });
  scene.floor(6.8, 6.8, 7.4, { ticks: false, labels: ["x₁ ÷ 5", "x₂ ÷ 25", "x₃ ÷ 125"] });
  scene.polyhedron(KleeMinty3D.poly);
  scene.animateTo({ cam: KM_CAM, lift: 1, solid: 1, flat: 0, tilt: 1 }, 0);
  const pts = Rules.run(KleeMintyStd, rule, [3, 4, 5]).map((s) => s.point);
  const L = { rule, scene, count: lane.querySelector(".lcount"), path: pts.map(kmShow) };
  // profit label rides along with the walker (convert back from display coordinates)
  L.onPoint = (q) => scene.label("z", q, `z = ${fmt(4 * (5 * q[0]) / 6 + 2 * (25 * q[1]) / 6 + (125 * q[2]) / 6)}`, { cls: "c-obj halo small l", dx: 16, dy: -20 });
  return L;
}));
kmCtrl.ms = 700;
Deck.register("kleeminty", kmCtrl);
