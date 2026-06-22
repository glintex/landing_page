/* Glintvex interactions */
(() => {
  "use strict";
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- header scroll state ---------- */
  const header = $(".site-header");
  const onScroll = () => header?.classList.toggle("scrolled", window.scrollY > 12);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  /* ---------- mobile menu (with focus management) ---------- */
  const toggle = $(".menu-toggle");
  const mobileNav = $(".mobile-nav");
  const isMenuOpen = () => toggle?.getAttribute("aria-expanded") === "true";
  const openMenu = () => {
    if (!toggle || !mobileNav) return;
    toggle.setAttribute("aria-expanded", "true");
    mobileNav.classList.add("open");
    mobileNav.querySelector("a")?.focus();
  };
  const closeMenu = (returnFocus) => {
    if (!toggle || !mobileNav) return;
    toggle.setAttribute("aria-expanded", "false");
    mobileNav.classList.remove("open");
    if (returnFocus) toggle.focus();
  };
  toggle?.addEventListener("click", () => (isMenuOpen() ? closeMenu() : openMenu()));
  $$(".mobile-nav a").forEach((a) => a.addEventListener("click", () => closeMenu()));
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || !isMenuOpen()) return;
    closeMenu(true); // return focus to toggle only when the menu was open
  });
  // simple focus trap while the mobile menu is open
  mobileNav?.addEventListener("keydown", (e) => {
    if (e.key !== "Tab" || !isMenuOpen()) return;
    const items = $$("a, button", mobileNav).filter((el) => el.offsetParent !== null);
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  /* ---------- reveal on scroll ---------- */
  const revealEls = $$(".reveal");
  if (prefersReduced || !("IntersectionObserver" in window)) {
    revealEls.forEach((el) => el.classList.add("in"));
  } else {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const delay = Number(entry.target.dataset.delay || 0);
            setTimeout(() => entry.target.classList.add("in"), delay);
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.16, rootMargin: "0px 0px -8% 0px" }
    );
    revealEls.forEach((el) => io.observe(el));
  }

  /* ---------- cursor glow (pointer devices only) ---------- */
  const glow = $(".cursor-glow");
  if (glow && window.matchMedia("(pointer: fine)").matches && !prefersReduced) {
    let raf = null;
    window.addEventListener("mousemove", (e) => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        glow.style.transform = `translate(${e.clientX}px, ${e.clientY}px) translate(-50%,-50%)`;
        glow.style.opacity = "1";
        raf = null;
      });
    });
    document.addEventListener("mouseleave", () => (glow.style.opacity = "0"));
  }

  /* ---------- count-up helper ---------- */
  function animateCount(el) {
    const target = parseFloat(el.dataset.count);
    if (isNaN(target)) return;
    const decimals = Number(el.dataset.decimals || 0);
    const prefix = el.dataset.prefix || "";
    const suffix = el.dataset.suffix || "";
    const fmt = (n) => prefix + n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + suffix;
    if (prefersReduced) { el.textContent = fmt(target); return; }
    const dur = 1200;
    let start = null;
    const tick = (ts) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / dur, 1);
      const val = target * (1 - Math.pow(1 - p, 3));
      el.textContent = fmt(val);
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  /* ---------- interactive tech-stack orbital ---------- */
  initOrbital();
  function initOrbital() {
    const root = $("#orbital");
    if (!root) return;
    const SVGNS = "http://www.w3.org/2000/svg";
    const VIEW = 800, C = 400, R_INNER = 215, R_OUTER = 335;
    const INNER = [
      { n: "React", c: "#61DAFB" }, { n: "Next.js", c: "#cbd5e1" }, { n: "Node.js", c: "#83CD29" },
      { n: "TypeScript", c: "#3178C6" }, { n: "PostgreSQL", c: "#5b8def" }, { n: "AWS", c: "#FF9900" },
    ];
    const OUTER = [
      { n: "Stripe", c: "#635BFF" }, { n: "Docker", c: "#2496ED" }, { n: "Kubernetes", c: "#326CE5" },
      { n: "GraphQL", c: "#E535AB" }, { n: "Flutter", c: "#54C5F8" }, { n: "Python", c: "#FFD43B" },
      { n: "Redis", c: "#FF6B5E" }, { n: "Terraform", c: "#9C6BE8" },
    ];
    const ALL = [
      ...INNER.map((d, i) => ({ ...d, ring: "inner", idx: i, total: INNER.length })),
      ...OUTER.map((d, i) => ({ ...d, ring: "outer", idx: i, total: OUTER.length })),
    ];
    const pos = (node) => {
      const r = node.ring === "inner" ? R_INNER : R_OUTER;
      const offset = node.ring === "outer" ? Math.PI / OUTER.length : 0;
      const a = (node.idx / node.total) * 2 * Math.PI - Math.PI / 2 + offset;
      return { x: C + r * Math.cos(a), y: C + r * Math.sin(a) };
    };
    const curvePath = (x, y, i) => {
      const dx = C - x, dy = C - y, mx = x + dx * 0.5, my = y + dy * 0.5;
      const len = Math.hypot(-dy, dx) || 1, off = 26 * (i % 2 ? -1 : 1);
      return `M ${x.toFixed(1)} ${y.toFixed(1)} Q ${(mx + (-dy / len) * off).toFixed(1)} ${(my + (dx / len) * off).toFixed(1)} ${C} ${C}`;
    };
    const rotor = document.createElement("div");
    rotor.className = "orbital-rotor";
    const svg = document.createElementNS(SVGNS, "svg");
    svg.setAttribute("viewBox", `0 0 ${VIEW} ${VIEW}`);
    const ringCircle = (r) => {
      const c = document.createElementNS(SVGNS, "circle");
      c.setAttribute("cx", C); c.setAttribute("cy", C); c.setAttribute("r", r); c.setAttribute("class", "orbital-ring");
      return c;
    };
    svg.append(ringCircle(R_INNER), ringCircle(R_OUTER));
    const flows = [];
    ALL.forEach((node, i) => {
      const p = pos(node);
      const path = document.createElementNS(SVGNS, "path");
      path.setAttribute("d", curvePath(p.x, p.y, i));
      path.setAttribute("class", "orbital-flow");
      path.id = `orb-flow-${i}`;
      svg.appendChild(path);
      flows[i] = path;
      if (!prefersReduced) {
        const dur = (6 + ((i * 0.7) % 3)).toFixed(2), begin = `${((i * 0.5) % 5).toFixed(2)}s`;
        const dot = document.createElementNS(SVGNS, "circle");
        dot.setAttribute("r", "2.6"); dot.setAttribute("fill", "#8AAAD9");
        const am = document.createElementNS(SVGNS, "animateMotion");
        am.setAttribute("dur", `${dur}s`); am.setAttribute("repeatCount", "indefinite"); am.setAttribute("begin", begin);
        const mp = document.createElementNS(SVGNS, "mpath");
        mp.setAttribute("href", `#orb-flow-${i}`);
        mp.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", `#orb-flow-${i}`);
        am.appendChild(mp); dot.appendChild(am);
        const op = document.createElementNS(SVGNS, "animate");
        op.setAttribute("attributeName", "opacity"); op.setAttribute("values", "0;1;1;0"); op.setAttribute("keyTimes", "0;0.1;0.9;1");
        op.setAttribute("dur", `${dur}s`); op.setAttribute("repeatCount", "indefinite"); op.setAttribute("begin", begin);
        dot.appendChild(op);
        svg.appendChild(dot);
      }
    });
    rotor.appendChild(svg);
    ALL.forEach((node, i) => {
      const p = pos(node);
      const wrap = document.createElement("div");
      wrap.className = "orbital-node";
      wrap.style.left = `${((p.x / VIEW) * 100).toFixed(2)}%`;
      wrap.style.top = `${((p.y / VIEW) * 100).toFixed(2)}%`;
      const inner = document.createElement("div");
      inner.className = "orbital-node-inner";
      const pill = document.createElement("div");
      pill.className = "orbital-pill";
      const dot = document.createElement("span");
      dot.className = "orbital-dot";
      dot.style.background = node.c; dot.style.color = node.c;
      pill.append(dot, document.createTextNode(node.n));
      inner.appendChild(pill); wrap.appendChild(inner); rotor.appendChild(wrap);
      const hot = (on) => {
        wrap.classList.toggle("is-hot", on);
        flows[i].classList.toggle("is-hot", on);
        if (on) flows[i].setAttribute("stroke", node.c); else flows[i].removeAttribute("stroke");
      };
      wrap.addEventListener("mouseenter", () => hot(true));
      wrap.addEventListener("mouseleave", () => hot(false));
    });
    const core = document.createElement("div");
    core.className = "orbital-core";
    core.innerHTML = "<span>glintvex</span>";
    root.append(rotor, core);
  }

  /* ---------- work carousel arrow ---------- */
  const workArrow = $("#work-arrow");
  const workGrid = $(".work-grid");
  if (workArrow && workGrid) {
    workArrow.addEventListener("click", () => {
      const card = workGrid.querySelector(".work-card");
      const step = card ? card.getBoundingClientRect().width + 20 : workGrid.clientWidth * 0.8;
      const atEnd = workGrid.scrollLeft + workGrid.clientWidth >= workGrid.scrollWidth - 8;
      workGrid.scrollBy({ left: atEnd ? -workGrid.scrollWidth : step, behavior: prefersReduced ? "auto" : "smooth" });
    });
  }

  /* ---------- count-up when scrolled into view ---------- */
  const countEls = $$("[data-count]");
  if ("IntersectionObserver" in window) {
    const cio = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { animateCount(e.target); cio.unobserve(e.target); }
      });
    }, { threshold: 0.5 });
    countEls.forEach((el) => cio.observe(el));
  } else {
    countEls.forEach(animateCount);
  }

  /* ---------- live clock + jittered ping ---------- */
  const clock = $("#clock");
  const ping = $("#ping");
  function tickClock() {
    if (clock) {
      const now = new Date();
      clock.textContent = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    }
  }
  const tickPing = () => { if (ping) ping.textContent = (11 + Math.floor(Math.random() * 9)) + "ms"; };
  let clockTimer = null, pingTimer = null;
  function startTimers() {
    tickClock();
    if (clockTimer == null) clockTimer = setInterval(tickClock, 1000);
    if (ping && pingTimer == null) pingTimer = setInterval(tickPing, 3200);
  }
  function stopTimers() {
    clearInterval(clockTimer); clearInterval(pingTimer);
    clockTimer = pingTimer = null;
  }
  startTimers();
  // pause background work when the tab isn't visible (saves battery / wakeups)
  document.addEventListener("visibilitychange", () => {
    document.hidden ? stopTimers() : startTimers();
  });

  /* ---------- forms (client-side demo handling) ---------- */
  function isEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }

  async function postJSON(endpoint, payload) {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    let data = {};
    try { data = await res.json(); } catch {/* ignore */}
    return { ok: res.ok && data.ok !== false, data };
  }

  function setHint(hint, msg, isError) {
    if (!hint) return;
    hint.textContent = msg;
    hint.style.color = isError ? "#ff8c8c" : "";
  }

  // Email-capture forms (lead + subscribe) wired to the backend, with graceful fallback.
  function wireForm(formSel, inputSel, hintSel, endpoint, fallbackMsg) {
    const form = $(formSel);
    if (!form) return;
    const input = $(inputSel, form);
    const hint = $(hintSel);
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const v = (input.value || "").trim();
      if (!isEmail(v)) {
        setHint(hint, "Please enter a valid email address.", true);
        input.setAttribute("aria-invalid", "true");
        if (hint && hint.id) input.setAttribute("aria-describedby", hint.id);
        input.focus();
        return;
      }
      input.removeAttribute("aria-invalid");
      input.removeAttribute("aria-describedby");
      const btn = $("button[type=submit]", form);
      if (btn) btn.disabled = true;
      setHint(hint, "Sending…", false);
      const payload = { email: v };
      const msgField = $('textarea[name="message"]', form);
      if (msgField) payload.message = msgField.value.trim();
      try {
        const { ok, data } = await postJSON(endpoint, payload);
        if (ok) { setHint(hint, data.message || fallbackMsg, false); form.reset(); }
        else { setHint(hint, data.error || "Something went wrong. Please try again.", true); }
      } catch {
        // backend unreachable (e.g. opened as a static file): still acknowledge.
        setHint(hint, fallbackMsg, false);
        form.reset();
      } finally {
        if (btn) btn.disabled = false;
      }
    });
  }
  wireForm("#subscribe-form", 'input[name="email"]', "#sub-hint", "/api/subscribe", "Subscribed. Welcome aboard.");

  /* ---------- smooth-scroll offset for sticky header ---------- */
  $$('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      const id = a.getAttribute("href");
      if (id.length < 2) return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      const offset = id === "#top" ? 0 : (header?.offsetHeight || 76) + 12;
      const y = target.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top: Math.max(0, y), behavior: prefersReduced ? "auto" : "smooth" });
    });
  });
})();
