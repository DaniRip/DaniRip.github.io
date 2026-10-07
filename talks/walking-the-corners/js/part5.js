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
    const rows = prog.routes.map((r) => ({ name: r.name, label: ROUTE_LABEL[r.name], n: r.enters.length }))
      .sort((a, b) => a.n - b.n);
    const max = Math.max(...rows.map((r) => r.n));
    const box = el.querySelector("#q-bars");
    this.bars = [...rows, { name: "rl", label: "learned policy", n: null }].map((r) => {
      const lab = document.createElement("div");
      lab.className = "bl";
      lab.textContent = r.label;
      const track = document.createElement("div");
      track.className = "bt";
      track.innerHTML = `<div class="bf${r.name === "astar" ? " best" : ""}${r.n === null ? " unknown" : ""}"></div><div class="bv"></div>`;
      box.append(lab, track);
      const w = r.n === null ? 0.5 : r.n / max;  // the placeholder bar is just a dashed outline
      return { r, lab, fill: track.querySelector(".bf"), val: track.querySelector(".bv"), w };
    });
  },
  // bars grow in when the slide opens; the "learned policy" row appears with the last step
  render(k) {
    for (const b of this.bars) {
      const on = b.r.n !== null || k >= 3;
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
