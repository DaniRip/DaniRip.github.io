// Slide engine: fixed 1600x900 stage, step-wise reveals, per-slide controllers.
//
// A slide is <section class="slide" id="..." data-part="...">. Elements with
// data-step="k" are shown once the slide's step >= k (and data-until="k" hides
// them after step k). A controller registered with Deck.register(id, {...}) can
// declare `steps`, and gets init(el) once, render(step, animate) on every step
// change (animate is true only when moving forward by one step on this slide),
// and enter(step) when the slide becomes active.
"use strict";

const C = {
  flour: "#3f8fe8",
  oven: "#e8632b",
  labor: "#1fae7c",
  obj: "#d9aa14",
  proof: "#f2f2f2",
  ink: "#ececec",
  muted: "#9aa0ad",
  faint: "#5b6170",
  bg: "#0e1015",
};

// Any uncaught error is shown on screen: a broken slide should be obvious, not a blank page.
function showFatal(msg) {
  let box = document.getElementById("fatal");
  if (!box) {
    box = document.createElement("div");
    box.id = "fatal";
    document.body.appendChild(box);
  }
  box.textContent += `${msg}\n`;
}
addEventListener("error", (e) => showFatal(`Error: ${e.message} (${(e.filename || "").split("/").pop()}:${e.lineno})`));
addEventListener("unhandledrejection", (e) => showFatal(`Error: ${e.reason}`));

const Anim = {
  ease: {
    smooth: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    linear: (t) => t,
    out: (t) => 1 - Math.pow(1 - t, 3),
    back: (t) => 1 + 2.7 * Math.pow(t - 1, 3) + 1.7 * Math.pow(t - 1, 2),  // overshoots, then settles
  },
  // Calls fn(easedT, rawT) every frame. Returns a promise with .cancel().
  tween(duration, fn, ease = "smooth") {
    const e = Anim.ease[ease];
    let raf = 0, start = null, cancelled = false, resolve;
    const p = new Promise((r) => (resolve = r));
    const frame = (ts) => {
      if (cancelled) return;
      if (start === null) start = ts;
      const t = Math.min(1, (ts - start) / duration);
      fn(e(t), t);
      if (t < 1) raf = requestAnimationFrame(frame);
      else resolve(true);
    };
    raf = requestAnimationFrame(frame);
    p.cancel = () => { cancelled = true; cancelAnimationFrame(raf); resolve(false); };
    return p;
  },
  // "Create": draw an SVG path/line from its start.
  draw(path, duration = 700) {
    const L = path.getTotalLength();
    path.style.strokeDasharray = `${L} ${L}`;
    path.style.strokeDashoffset = L;
    const p = Anim.tween(duration, (e) => { path.style.strokeDashoffset = L * (1 - e); });
    const done = p.then((r) => { path.style.strokeDasharray = ""; path.style.strokeDashoffset = ""; return r; });
    done.cancel = p.cancel;
    return done;
  },
  wait(ms) {
    let id, resolve;
    const p = new Promise((r) => { resolve = r; id = setTimeout(() => r(true), ms); });
    p.cancel = () => { clearTimeout(id); resolve(false); };
    return p;
  },
};

// Runs a chain of animation steps; cancelling stops the chain at the current step.
class Seq {
  constructor() { this.cur = null; this.dead = false; }
  async run(...fns) {
    for (const f of fns) {
      if (this.dead) return false;
      this.cur = f();
      const ok = await this.cur;
      if (!ok || this.dead) return false;
    }
    return true;
  }
  cancel() { this.dead = true; if (this.cur && this.cur.cancel) this.cur.cancel(); }
}

const Deck = (() => {
  const W = 1600, H = 900;
  const ctrls = {};
  let slides = [], cur = -1, step = 0, stage, chrome, notesEl, showHint = () => {};
  let jumpBuf = "", jumpTimer = 0, jumpEl, overviewEl;
  // ?static (used by tools/export_pdf.py): no looping/entrance animations, each slide drawn in its final state
  const STATIC = new URLSearchParams(location.search).has("static");

  const katexOpts = {
    throwOnError: true,
    macros: {
      // KaTeX takes 6-digit hex without "#" ("#" would be read as a macro argument)
      "\\FL": `\\textcolor{${C.flour.slice(1)}}{#1}`,
      "\\OV": `\\textcolor{${C.oven.slice(1)}}{#1}`,
      "\\LB": `\\textcolor{${C.labor.slice(1)}}{#1}`,
      "\\OB": `\\textcolor{${C.obj.slice(1)}}{#1}`,
      "\\PF": `\\textcolor{${C.proof.slice(1)}}{#1}`,
      "\\MU": `\\textcolor{${C.muted.slice(1)}}{#1}`,
    },
  };

  function tex(el, src, display = false) {
    katex.render(src, el, { ...katexOpts, displayMode: display });
  }

  function register(id, ctrl) { ctrls[id] = ctrl; }

  function maxStep(i) {
    const s = slides[i];
    let n = 0;
    s.querySelectorAll("[data-step]").forEach((e) => { n = Math.max(n, parseInt(e.dataset.step, 10)); });
    const c = ctrls[s.id];
    if (c && c.steps) n = Math.max(n, c.steps);
    return n;
  }

  function applyReveals(s, k) {
    s.querySelectorAll("[data-step]").forEach((e) => {
      const from = parseInt(e.dataset.step, 10);
      const until = e.dataset.until !== undefined ? parseInt(e.dataset.until, 10) : Infinity;
      e.classList.toggle("shown", k >= from && k <= until);
    });
    s.querySelectorAll("[data-until]:not([data-step])").forEach((e) => {
      e.classList.toggle("gone", k > parseInt(e.dataset.until, 10));
    });
  }

  function go(i, k, animate) {
    i = Math.max(0, Math.min(slides.length - 1, i));
    k = Math.max(0, Math.min(maxStep(i), k));
    const changed = i !== cur;
    if (changed) {
      if (cur >= 0) {
        slides[cur].classList.remove("active");
        const pc = ctrls[slides[cur].id];
        if (pc && pc.leave) pc.leave();
      }
      slides[i].classList.add("active");
      const c = ctrls[slides[i].id];
      if (c && !c._inited) { c._inited = true; if (c.init) c.init(slides[i]); }
    }
    cur = i; step = k;
    const s = slides[i];
    const c = ctrls[s.id];
    if (changed) {
      // arriving on a slide draws its state for step k instantly (reveals and anything the controller
      // styles): whatever an earlier visit left behind must not visibly fade while the slide fades in
      s.classList.add("snap");
      applyReveals(s, k);
      if (c && c.render) c.render(k, false);
      void s.offsetWidth;
      s.classList.remove("snap");
    } else {
      applyReveals(s, k);
      if (c && c.render) c.render(k, !!animate);
    }
    if (changed && c && c.enter && !STATIC) c.enter(k);
    if (STATIC && c && c.leave) c.leave();  // leave() puts looping slides in their final state
    chrome.querySelector(".part").textContent = s.dataset.part || "";
    chrome.querySelector(".num").textContent = `${i + 1} / ${slides.length}`;
    chrome.querySelector(".bar").style.width = `${(100 * (i + 1)) / slides.length}%`;
    const n = s.querySelector("aside.notes");
    notesEl.innerHTML = `<b>${i + 1}. ${s.querySelector("h2") ? s.querySelector("h2").textContent : s.id}</b> — step ${k}/${maxStep(i)}<br>${n ? n.innerHTML : "<i>no notes</i>"}`;
    history.replaceState(null, "", `#/${i + 1}${k ? "/" + k : ""}`);
  }

  function next() {
    if (step < maxStep(cur)) go(cur, step + 1, true);
    else if (cur < slides.length - 1) go(cur + 1, 0, true);
  }
  function prev() {
    if (step > 0) go(cur, step - 1, false);
    else if (cur > 0) go(cur - 1, maxStep(cur - 1), false);
  }

  // Scale to the layout viewport (clientWidth/Height), not innerWidth/Height: on phones those report the
  // zoomed-out visual viewport, and fitting to it leaves the slide off-centre and cropped.
  function fit() {
    const de = document.documentElement;
    const s = Math.min(de.clientWidth / W, de.clientHeight / H);
    stage.style.transform = `translate(-50%, -50%) scale(${s})`;
  }

  // Jump to a slide: type its number, then Enter.
  function jumpType(d) {
    jumpBuf = (jumpBuf + d).slice(-3);
    jumpEl.textContent = `go to slide ${jumpBuf}  ⏎`;
    jumpEl.classList.add("on");
    clearTimeout(jumpTimer);
    jumpTimer = setTimeout(jumpClear, 3000);
  }
  function jumpClear() { jumpBuf = ""; jumpEl.classList.remove("on"); }

  // Overview: every slide's number and title, grouped by part; click to jump.
  function toggleOverview(on = !overviewEl.classList.contains("on")) {
    if (on) {
      let html = "", part = null;
      slides.forEach((s, i) => {
        if ((s.dataset.part || "") !== part) {
          part = s.dataset.part || "";
          html += `<div class="ovpart">${part || "&nbsp;"}</div>`;
        }
        const h = s.querySelector("h2, h1");
        html += `<button data-i="${i}" class="${i === cur ? "cur" : ""}"><span>${i + 1}</span>${h ? h.textContent : s.id}</button>`;
      });
      overviewEl.querySelector(".ovlist").innerHTML = html;
    }
    overviewEl.classList.toggle("on", on);
  }

  function onKey(e) {
    const t = e.target;
    const inRange = t && t.tagName === "INPUT" && t.type === "range";
    if (inRange && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(e.key)) return;
    if (e.key === "Escape") { jumpClear(); toggleOverview(false); if (document.activeElement) document.activeElement.blur(); return; }
    if (/^[0-9]$/.test(e.key)) { jumpType(e.key); return; }
    if (e.key === "Enter" && jumpBuf) { e.preventDefault(); go(parseInt(jumpBuf, 10) - 1, 0, false); jumpClear(); return; }
    if (e.key === "o") { toggleOverview(); return; }
    if (["ArrowRight", "PageDown", " ", "ArrowDown"].includes(e.key)) { e.preventDefault(); e.shiftKey ? go(cur + 1, 0, false) : next(); }
    else if (["ArrowLeft", "PageUp", "ArrowUp"].includes(e.key)) { e.preventDefault(); e.shiftKey ? go(cur - 1, 0, false) : prev(); }
    else if (e.key === "Home") go(0, 0, false);
    else if (e.key === "End") go(slides.length - 1, 0, false);
    else if (e.key === "n") notesEl.classList.toggle("on");
    else if (e.key === "?") showHint();
    else if (e.key === "f") { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen(); }
  }

  function start() {
    stage = document.getElementById("stage");
    slides = [...stage.querySelectorAll("section.slide")];
    for (const [k, v] of Object.entries(C)) document.documentElement.style.setProperty(`--${k}`, v);
    chrome = document.createElement("div");
    chrome.id = "chrome";
    chrome.innerHTML = '<div class="part"></div><div class="num"></div><div class="bar"></div>';
    stage.appendChild(chrome);
    notesEl = document.createElement("div");
    notesEl.id = "notes";
    document.body.appendChild(notesEl);
    // mouse navigation: arrows appear while the mouse moves
    const nav = document.createElement("div");
    nav.id = "nav";
    nav.innerHTML = '<button aria-label="previous">‹</button><button aria-label="next">›</button>';
    nav.children[0].addEventListener("click", () => prev());
    nav.children[1].addEventListener("click", () => next());
    document.body.appendChild(nav);
    let navTimer = 0;
    addEventListener("mousemove", () => {
      nav.classList.add("on");
      clearTimeout(navTimer);
      navTimer = setTimeout(() => nav.classList.remove("on"), 2000);
    });
    const hint = document.createElement("div");
    hint.id = "hint";
    hint.innerHTML = "<b>→</b> / space / clicker: next &nbsp;·&nbsp; <b>←</b> back &nbsp;·&nbsp; <b>12 ⏎</b> go to slide 12 &nbsp;·&nbsp; <b>o</b> all slides &nbsp;·&nbsp; <b>f</b> fullscreen &nbsp;·&nbsp; <b>n</b> notes &nbsp;·&nbsp; <b>?</b> help";
    document.body.appendChild(hint);
    showHint = () => { hint.classList.add("on"); clearTimeout(hint.t); hint.t = setTimeout(() => hint.classList.remove("on"), 4000); };
    if (!STATIC) showHint();
    jumpEl = document.createElement("div");
    jumpEl.id = "jump";
    document.body.appendChild(jumpEl);
    overviewEl = document.createElement("div");
    overviewEl.id = "overview";
    overviewEl.innerHTML = '<div class="ovbox"><div class="ovhead">All slides <span class="faint">· click one, or Esc</span></div><div class="ovlist"></div></div>';
    overviewEl.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-i]");
      if (b) go(parseInt(b.dataset.i, 10), 0, false);
      toggleOverview(false);
    });
    document.body.appendChild(overviewEl);
    renderMathInElement(stage, { ...katexOpts, delimiters: [
      { left: "\\[", right: "\\]", display: true },
      { left: "\\(", right: "\\)", display: false },
    ] });
    // clicking empty stage space returns keyboard focus to the deck
    stage.addEventListener("mousedown", (e) => {
      if (!e.target.closest("input, button, select, .clickable")) document.activeElement && document.activeElement.blur();
    });
    addEventListener("keydown", onKey);
    // keys pressed inside an embedded viewer (talk/viewer) arrive as messages
    addEventListener("message", (m) => {
      if (m.data && m.data.deckKey) onKey({ key: m.data.deckKey, shiftKey: m.data.shiftKey, target: document.body, preventDefault() {} });
    });
    // touch: swipe left/right to change step (not when the swipe starts on a plot or a control)
    let touch = null;
    addEventListener("touchstart", (e) => {
      touch = e.touches.length === 1 && !e.target.closest("svg, input, button, select, .clickable, #overview")
        ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null;
    }, { passive: true });
    addEventListener("touchend", (e) => {
      if (!touch) return;
      const dx = e.changedTouches[0].clientX - touch.x, dy = e.changedTouches[0].clientY - touch.y;
      touch = null;
      if (Math.abs(dx) > 50 && Math.abs(dx) > 2 * Math.abs(dy)) dx < 0 ? next() : prev();
    });
    addEventListener("resize", fit);
    fit();
    const m = location.hash.match(/^#\/(\d+)(?:\/(\d+))?/);
    go(m ? parseInt(m[1], 10) - 1 : 0, m && m[2] ? parseInt(m[2], 10) : 0, false);
    // ?steps: publish each slide's number of steps (read by tools/export_pdf.py)
    if (new URLSearchParams(location.search).has("steps")) document.body.dataset.steps = JSON.stringify(slides.map((_, i) => maxStep(i)));
  }

  // ctrl(id) exposes a slide's controller for poking at from the browser console
  return { register, tex, start, go, next, prev, ctrl: (id) => ctrls[id], get step() { return step; } };
})();
