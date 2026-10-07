// The bakery in standard form (slacks added), its simplex tableaux, and widgets to show them.
"use strict";

const Lin = {
  inv3(M) {
    const [[a, b, c], [d, e, f], [g, h, i]] = M;
    const A = e * i - f * h, B = -(d * i - f * g), Cc = d * h - e * g;
    const det = a * A + b * B + c * Cc;
    if (Math.abs(det) < 1e-12) throw new Error("singular basis");
    return [
      [A / det, -(b * i - c * h) / det, (b * f - c * e) / det],
      [B / det, (a * i - c * g) / det, -(a * f - c * d) / det],
      [Cc / det, -(a * h - b * g) / det, (a * e - b * d) / det],
    ];
  },
};

// A standard-form LP  A x = b, x >= 0 (3 rows, slacks last) and its simplex tableaux.
// Reduced costs use the dual-slack convention d_j = y.a_j - c_j (negative = worth entering).
function makeStd({ A, b, c, tex, color, resOf }) {
  const n = A[0].length, cols = [...Array(n).keys()], rows = [0, 1, 2];
  function tableau(basis) {
    const Bi = Lin.inv3(rows.map((i) => basis.map((j) => A[i][j])));
    const T = Bi.map((r) => cols.map((j) => r[0] * A[0][j] + r[1] * A[1][j] + r[2] * A[2][j]));
    const rhs = Bi.map((r) => r[0] * b[0] + r[1] * b[1] + r[2] * b[2]);
    const cB = basis.map((j) => c[j]);
    const y = rows.map((i) => cB[0] * Bi[0][i] + cB[1] * Bi[1][i] + cB[2] * Bi[2][i]);
    const d = cols.map((j) => y[0] * A[0][j] + y[1] * A[1][j] + y[2] * A[2][j] - c[j]);
    const z = cB.reduce((s, v, i) => s + v * rhs[i], 0);
    const x = cols.map(() => 0);
    basis.forEach((j, i) => { x[j] = rhs[i]; });
    if (x.some((v) => v < -1e-9)) throw new Error(`basis ${basis} is infeasible`);
    return { basis: [...basis], T, rhs, y, d, z, x, point: x.slice(0, n - 3) };
  }
  // ratio test for entering column q: null where the column entry is <= 0
  const ratios = (tb, q) => tb.T.map((r, i) => (r[q] > 1e-9 ? tb.rhs[i] / r[q] : null));
  function leavingRow(tb, q) {
    const r = ratios(tb, q);
    let best = -1;
    r.forEach((v, i) => { if (v !== null && (best < 0 || v < r[best] - 1e-12)) best = i; });
    if (best < 0) throw new Error("unbounded");
    return best;
  }
  function pivot(basis, q) {
    const tb = tableau(basis), row = leavingRow(tb, q), nb = [...basis];
    nb[row] = q;
    return { row, basis: nb };
  }
  return { n, cols, tex, color, resOf, A, b, c, tableau, ratios, leavingRow, pivot };
}

// Bread and cake: columns x1 x2 s1 s2 s3.
const BakeryStd = makeStd({
  A: [[2, 1, 1, 0, 0], [3, 2, 0, 1, 0], [1, 2, 0, 0, 1]], b: [10, 16, 12], c: [9, 8, 0, 0, 0],
  tex: ["x_1", "x_2", "s_1", "s_2", "s_3"], color: [C.ink, C.ink, C.flour, C.oven, C.labor],
  resOf: [null, null, "flour", "oven", "labor"],
});
// With cookies: columns x1 x2 x3 s1 s2 s3.
const BakeryStd3 = makeStd({
  A: [[2, 1, 1, 1, 0, 0], [3, 2, 1, 0, 1, 0], [1, 2, 1, 0, 0, 1]], b: [10, 16, 12], c: [9, 8, 5, 0, 0, 0],
  tex: ["x_1", "x_2", "x_3", "s_1", "s_2", "s_3"], color: [C.ink, C.ink, C.ink, C.flour, C.oven, C.labor],
  resOf: [null, null, null, "flour", "oven", "labor"],
});

// Pivot rules. Each picks an entering column among the improving ones (d_j < 0).
//   Dantzig: most negative reduced cost.  Bland: lowest index.
//   Greatest increment: largest actual gain |d_j| * t*_j (t*_j = ratio-test step).
//   Steepest edge: largest d_j^2 / (1 + |B^-1 a_j|^2), i.e. gain per unit length of the edge in all variables.
const Rules = {
  order: ["dantzig", "bland", "se", "gi"],
  name: { dantzig: "Dantzig", bland: "Bland", se: "Steepest edge", gi: "Greatest increment" },
  scores(model, tb) {
    const out = [];
    for (const j of model.cols) {
      if (tb.basis.includes(j) || tb.d[j] >= -1e-9) continue;
      const r = model.ratios(tb, j).filter((v) => v !== null);
      const t = r.length ? Math.min(...r) : Infinity;
      const len2 = 1 + tb.T.reduce((s, row) => s + row[j] * row[j], 0);
      out.push({ j, d: tb.d[j], t, gain: -tb.d[j] * t, len2, se: (tb.d[j] * tb.d[j]) / len2 });
    }
    return out;
  },
  pick(rule, sc) {
    const key = { dantzig: (c) => -c.d, bland: (c) => -c.j, gi: (c) => c.gain, se: (c) => c.se }[rule];
    return sc.reduce((b, c) => (key(c) > key(b) + 1e-12 ? c : b));
  },
  // Full run from basis0: [{basis, point, enter}] with one entry per corner visited.
  run(model, rule, basis0) {
    let basis = [...basis0];
    const steps = [{ basis, point: model.tableau(basis).point }];
    for (let k = 0; k < 64; k++) {
      const sc = Rules.scores(model, model.tableau(basis));
      if (!sc.length) return steps;
      const c = Rules.pick(rule, sc);
      basis = model.pivot(basis, c.j).basis;
      steps.push({ basis, enter: c.j, point: model.tableau(basis).point });
    }
    throw new Error(`${rule} did not converge`);
  },
};

// Klee–Minty cube in 3D: max 4x1 + 2x2 + x3  s.t.  x1 <= 5, 4x1 + x2 <= 25, 8x1 + 4x2 + x3 <= 125.
const KleeMintyStd = makeStd({
  A: [[1, 0, 0, 1, 0, 0], [4, 1, 0, 0, 1, 0], [8, 4, 1, 0, 0, 1]], b: [5, 25, 125], c: [4, 2, 1, 0, 0, 0],
  tex: ["x_1", "x_2", "x_3", "s_1", "s_2", "s_3"], color: [C.ink, C.ink, C.ink, C.muted, C.muted, C.muted],
  resOf: [null, null, null, null, null, null],
});

const round1 = (v) => Math.round(v * 10) / 10;

// Tableau numbers: whole numbers plain, halves with one decimal, everything else two.
function fmtT(v) {
  if (Math.abs(v) < 1e-9) v = 0;
  const a = Math.abs(v);
  let s;
  if (Math.abs(a - Math.round(a)) < 1e-9) s = String(Math.round(a));
  else if (Math.abs(2 * a - Math.round(2 * a)) < 1e-9) s = a.toFixed(1);
  else s = a.toFixed(2);
  return (v < 0 ? "−" : "") + s;
}

class TableauView {
  constructor(container, model = BakeryStd) {
    this.el = container;
    this.S = model;
    this.prev = null;
  }
  // o: {enter: col, leave: row (-1: none), ratios, negs, annotate, flash: bool, hide: [cols], mark: [cols],
  //      ratioCol: keep the ratio column even when empty (ratioHead: its header),
  //      side: {head, rows: [tex per row], z: tex} an extra column after the values (e.g. each row as an equation),
  //      tint: [cols] shade those columns' body cells (e.g. the slack block, which is B^-1)}
  set(tb, o = {}) {
    const S = this.S, hide = new Set(o.hide || []), cols = S.cols.filter((j) => !hide.has(j));
    const nx = S.n - 3, prodCols = cols.filter((j) => j < nx).length;
    const basic = new Set(tb.basis);
    const ratio = o.enter !== undefined && o.enter !== null && o.ratios ? S.ratios(tb, o.enter) : null;
    const rcol = !!(ratio || o.ratioCol), side = o.side || null;
    const minRow = ratio ? S.leavingRow(tb, o.enter) : -1;
    const cell = (v, cls, key) => `<td class="${cls}" data-k="${key}" data-v="${fmtT(v)}">${fmtT(v)}</td>`;
    let h = '<table class="tab"><thead><tr><th class="rlab">basic</th>';
    for (const j of cols) h += `<th class="${this.colCls(j, basic, o)}"><span data-tex="\\textcolor{${S.color[j].slice(1)}}{${S.tex[j]}}"></span></th>`;
    h += '<th class="rhs">value</th>' + (rcol ? `<th class="ratio">${o.ratioHead || "ratio"}</th>` : "")
      + (side ? `<th class="side">${side.head || ""}</th>` : "") + "</tr></thead><tbody>";
    tb.basis.forEach((bj, i) => {
      const leave = i === o.leave || (ratio && i === minRow && o.leave === undefined);
      const rc = S.resOf[bj] ? `var(--${S.resOf[bj]})` : "var(--ink)";
      h += `<tr class="${leave ? "leave" : ""}" style="--rc:${rc}"><td class="rlab"><span data-tex="\\textcolor{${S.color[bj].slice(1)}}{${S.tex[bj]}}"></span></td>`;
      for (const j of cols) {
        const piv = leave && j === o.enter;
        h += cell(tb.T[i][j], `${this.colCls(j, basic, o)}${piv ? " pivot" : ""}${(o.tint || []).includes(j) ? " tint" : ""}`, `${i},${j}`);
      }
      h += cell(tb.rhs[i], "rhs", `${i},r`);
      if (ratio) {
        const r = ratio[i];
        h += `<td class="ratio${leave ? " min" : ""}">${r === null ? "—" : `${fmtT(tb.rhs[i])} / ${fmtT(tb.T[i][o.enter])} = ${fmtT(r)}`}</td>`;
      } else if (rcol) h += '<td class="ratio"></td>';
      if (side) h += `<td class="side"><span data-tex="${side.rows[i].replace(/"/g, "&quot;")}"></span></td>`;
      h += "</tr>";
    });
    h += '</tbody><tfoot><tr class="bottom"><td class="rlab"><span data-tex="z"></span></td>';
    for (const j of cols) {
      const neg = o.negs && tb.d[j] < -1e-9;
      h += cell(tb.d[j], `${this.colCls(j, basic, o)}${neg ? " neg" : ""}`, `z,${j}`);
    }
    h += cell(tb.z, "rhs zval", "z,r") + (rcol ? "<td></td>" : "")
      + (side ? `<td class="side"><span data-tex="${side.z.replace(/"/g, "&quot;")}"></span></td>` : "") + "</tr>";
    if (o.annotate) {
      h += `<tr class="ann"><td></td><td colspan="${prodCols}"><div>reduced costs <b>d</b><br>= dual slacks</div></td>`
        + '<td colspan="3"><div>shadow prices <b>y</b><br>= dual variables</div></td><td><div>profit</div></td>' + (rcol ? "<td></td>" : "") + (side ? "<td></td>" : "") + "</tr>";
    }
    h += "</tfoot></table>";
    this.el.innerHTML = h;
    this.el.querySelectorAll("[data-tex]").forEach((s) => Deck.tex(s, s.dataset.tex));
    if (o.flash && this.prev) {
      this.el.querySelectorAll("td[data-k]").forEach((td) => {
        if (this.prev[td.dataset.k] !== undefined && this.prev[td.dataset.k] !== td.dataset.v) td.classList.add("flash");
      });
    }
    this.prev = {};
    this.el.querySelectorAll("td[data-k]").forEach((td) => { this.prev[td.dataset.k] = td.dataset.v; });
  }
  colCls(j, basic, o) {
    return `${basic.has(j) ? "basiccol" : ""}${j === o.enter ? " enter" : ""}${(o.mark || []).includes(j) ? " mark" : ""}`;
  }
}

// Three horizontal "how much of each resource is used" meters.
class ResourceMeters {
  constructor(container) {
    this.rows = Bakery2D.res.map((r, i) => {
      const row = document.createElement("div");
      row.className = "meter";
      row.style.setProperty("--rc", r.color);
      row.innerHTML = `<span class="mname">${r.name}</span><span class="track"><span class="used"></span></span><span class="mval"></span>`;
      container.appendChild(row);
      return { row, used: row.querySelector(".used"), val: row.querySelector(".mval"), r, i };
    });
  }
  set(p) {
    for (const { row, used, val, r, i } of this.rows) {
      const u = Geo.dot(r.a, p), s = r.b - u;
      used.style.width = `${(100 * Math.min(u, r.b)) / r.b}%`;
      const zero = Math.abs(s) < 0.05;
      row.classList.toggle("tight", zero);
      Deck.tex(val, `s_${i + 1} = ${zero ? "0" : tnum(round1(s))}${zero ? "\\ \\text{(tight)}" : ""}`);
    }
  }
}
