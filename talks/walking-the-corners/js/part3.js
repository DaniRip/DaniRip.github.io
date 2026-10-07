// Controllers for Part 5: cookies, the 3D lift, the cookie pivot, and the 3D proof.
"use strict";

// Scene states: the 2D look from above, the same floor tilted, and the full polyhedron.
const FLAT_TOP = { cam: Scene3D.TOP, lift: 0, solid: 0, flat: 1, tilt: 0 };
const FLAT_TILT = { cam: Scene3D.FLAT, lift: 0, solid: 0, flat: 1, tilt: 1 };
const SOLID = { cam: Scene3D.TILT, lift: 1, solid: 1, flat: 0, tilt: 1 };

function bakeryScene(container, opts, floorOpts = {}) {
  const s = new Scene3D(container, opts);
  s.floor(8.5, 8.5, 11, floorOpts);
  s.flatLook(Bakery2D.region, Bakery2D.res);
  s.polyhedron(Bakery3D.poly);
  return s;
}
const ring3 = (s, id, p, on) => s.dot(id, p, { r: 19, fill: "none", stroke: C.obj, "stroke-width": 2.5, opacity: on ? 1 : 0 });

// ------------------------------------------------------------------ cookies: price the new column
Deck.register("cookies", {
  steps: 4,
  init(el) {
    this.view = new TableauView(el.querySelector("#ck-view"), BakeryStd3);
    this.say = el.querySelector("#ck-say");
  },
  render(k, animate) {
    const tb = BakeryStd3.tableau([0, 1, 3]);  // the 2D optimum (2, 5) with cookies at 0
    if (k < 4) {
      this.view.set(tb, { hide: [2], annotate: true, tint: k === 3 ? [3, 4, 5] : [] });  // k = 3: B^-1 is the slack block
      this.say.innerHTML = "<b>optimal tableau for bread and cake</b>";
    } else {
      this.view.set(tb, { negs: true, mark: [2], annotate: true, flash: animate });
      this.say.innerHTML = "<b><span class='c-obj'>sub-</span>optimal tableau for bread<span class='c-obj'>,</span> cake and <span class='c-obj'>cookies</span></b>";
    }
  },
});

// ------------------------------------------------------------------ the lift into 3D
Deck.register("lift", {
  steps: 3,
  init(el) {
    const s = (this.scene = bakeryScene(el.querySelector("#lift-scene"), { width: 900, height: 700 }));
    s.dot("opt2", [2, 5, 0], { fill: C.obj, r: 10 });
    s.label("opt2l", [2, 5, 0], "58", { cls: "c-obj halo", dx: 26, dy: -22 });
  },
  render(k, animate) {
    const states = [FLAT_TOP, FLAT_TILT, SOLID, SOLID];
    this.scene.animateTo(states[k], animate && (k === 1 || k === 2) ? [0, 2200, 3200][k] : 0);
  },
});

// ------------------------------------------------------------------ the profit plane, in 3D
const SWEEP3 = { cam: Scene3D.SWEEP, lift: 1, solid: 1, flat: 0, tilt: 1 };
Deck.register("sweep3d", {
  steps: 3,
  init(el) {
    const s = (this.scene = bakeryScene(el.querySelector("#sweep3d-scene"), { width: 900, height: 700 }));
    s.animateTo(SWEEP3, 0);
    this.zEl = el.querySelector("#s3-z");
    const P = Bakery3D.poly;
    this.body = { points: P.verts.map((v) => v.p), edges: P.edges.map((e) => [e.i, e.j]) };
    this.box = boxBody(6.5, 7.5, 11);
    this.corners = P.verts.map((v) => v.p);
    this.corners.forEach((q, i) => s.label(`zv${i}`, q, fmt(V3.dot(Bakery3D.c, q)), { cls: "c-obj halo small", dx: 22, dy: -16 }));
    s.arrow("grad", [0, 0, 0], V3.mul(V3.unit(Bakery3D.c), 3.2), { color: C.obj, width: 5, head: 18 });
    this.z = 0;
  },
  apply(z, final = true) {
    const s = this.scene, c = Bakery3D.c;
    this.z = z;
    const past = z > 60 + 1e-9;
    s.line("plane", slicePolygon(this.box.points, this.box.edges, c, z),
      { fill: past ? C.muted : C.obj, "fill-opacity": 0.08, stroke: past ? C.muted : C.obj, "stroke-opacity": 0.45, "stroke-width": 1.5, "stroke-dasharray": past ? "8 7" : "" }, "mid", { closed: true });
    s.line("slice", slicePolygon(this.body.points, this.body.edges, c, z),
      { fill: C.obj, "fill-opacity": 0.42, stroke: C.obj, "stroke-width": 3 }, "mid", { closed: true });
    this.corners.forEach((q, i) => { s.items[`zv${i}`].el.style.opacity = V3.dot(c, q) <= z + 1e-9 ? 1 : 0; });
    this.zEl.textContent = `z = ${final ? fmt(z) : z.toFixed(1)}${past ? ": no plan" : ""}`;
  },
  render(k, animate) {
    if (this.anim) this.anim.cancel();
    const target = [0, 60, 60, 66][k];
    ring3(this.scene, "ring", [2, 4, 2], k >= 2);
    if (animate && (k === 1 || k === 3)) {
      const z0 = k === 1 ? 0 : 60;
      this.anim = Anim.tween(k === 1 ? 4500 : 900, (e) => this.apply(lerp(z0, target, e), e === 1), k === 1 ? "linear" : "smooth");
    } else this.apply(target);
  },
});

// ------------------------------------------------------------------ the cookie pivot
Deck.register("cookiepivot", {
  steps: 2,
  init(el) {
    this.view = new TableauView(el.querySelector("#cp-view"), BakeryStd3);
    this.say = el.querySelector("#cp-say");
    const s = (this.scene = bakeryScene(el.querySelector("#cookiepivot-scene"), { width: 760, height: 680 }));
    s.animateTo(SOLID, 0);
    s.label("zl", [2, 5, 0], "", { cls: "c-obj halo l", dx: 22, dy: -26 });
    s.label("flourl", [0.7, 1.6, 6.5], "flour runs out", { cls: "halo small", color: C.flour });
  },
  place(p) {
    const s = this.scene, z = Geo.dot(Bakery2D.c, p) + 5 * p[2];
    s.line("trail", [[2, 5, 0], p], { stroke: C.obj, "stroke-width": 5 }, "top");
    s.dot("walker", p, { fill: C.obj, r: 10 });
    s.label("zl", p, `z = ${fmt(z)}`, { cls: "c-obj halo l", dx: 22, dy: -26 });
  },
  render(k, animate) {
    const s = this.scene, S = BakeryStd3;
    if (this.anim) this.anim.cancel();
    s.setFace("flour", k === 0 ? "bold" : "normal");
    s.items.flourl.el.style.opacity = k === 0 ? 1 : 0;
    s.line("nextE", k === 0 ? [[2, 5, 0], [2, 4, 2]] : null, { stroke: C.obj, "stroke-width": 5, "stroke-dasharray": "2 11" }, "top");
    ring3(s, "ring", [2, 4, 2], k === 2);
    if (k === 0) {
      this.view.set(S.tableau([0, 1, 3]), { negs: true, enter: 2, ratios: true });
      this.say.innerHTML = "Cookies enter (d₃ = −1). Ratio test: <span class='c-flour'>flour</span> runs out after 1 ÷ 0.5 = <b>2 batches</b> ⇒ s₁ leaves.";
      this.place([2, 5, 0]);
      return;
    }
    const tb = S.tableau([0, 1, 2]);
    this.view.set(tb, k === 1 ? { flash: animate } : { annotate: true });
    this.say.innerHTML = k === 1
      ? "New corner <b>(2, 4, 2)</b>: two batches of cookies, one less of cake. Profit 58 + 1 × 2 = <span class='c-obj'>60</span>."
      : "Every entry ≥ 0: <b>optimal</b>. All three resources are used up, so all three have a price: <span class='c-flour'>2</span>, <span class='c-oven'>1</span>, <span class='c-labor'>2</span>.";
    if (k === 1 && animate) this.anim = Anim.tween(1500, (e) => this.place(V3.lerp([2, 5, 0], [2, 4, 2], e)));
    else this.place([2, 4, 2]);
  },
});

// ------------------------------------------------------------------ the 3D proof
Deck.register("proof3d", {
  steps: 4,
  init(el) {
    const s = (this.scene = bakeryScene(el.querySelector("#proof3d-scene"), { width: 800, height: 700 }));
    s.animateTo(SOLID, 0);
    s.dot("opt3", [2, 4, 2], { fill: C.obj, r: 10 });
    const p = [2, 4, 2];
    this.tips = Bakery3D.res.map((r) => V3.add(p, V3.mul(V3.unit(r.a), 3)));
    this.ctip = V3.add(p, V3.mul(V3.unit(Bakery3D.c), 3.7));
  },
  render(k, animate) {
    const s = this.scene, p = [2, 4, 2], keys = ["flour", "oven", "labor"];
    s.animateTo({ cam: k >= 4 ? Scene3D.SIDE : Scene3D.TILT }, animate && k === 4 ? 1800 : 0);
    keys.forEach((key, i) => s.setFace(key, k === i || k >= 3 ? "bold" : "dim"));
    ring3(s, "ring", p, k >= 3);
    const show = k >= 4;
    Bakery3D.res.forEach((r, i) => s.arrow(`n${i}`, show ? p : null, this.tips[i], { color: r.color, width: 4, head: 15 }));
    [[0, 1], [1, 2], [2, 0]].forEach(([i, j], t) => s.line(`cone${t}`, show ? [p, this.tips[i], this.tips[j]] : null,
      { fill: C.proof, "fill-opacity": 0.12, stroke: C.proof, "stroke-opacity": 0.3, "stroke-width": 1 }, "under", { closed: true }));
    s.arrow("cdir", show ? p : null, this.ctip, { color: C.obj, width: 5, head: 19 });
    s.label("cl", this.ctip, show ? "profit" : "", { cls: "c-obj halo small", dx: 14, dy: -14 });
  },
});
