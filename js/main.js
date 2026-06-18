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

  /* ---------- interactive dashboard (data per reporting period) ---------- */
  const spark = $(".spark");
  const line = $(".spark-line");
  const area = $(".spark-area");
  const W = 320, H = 90, PAD = 6;

  // Coherent, internally-consistent demo data: Today < Week < Month.
  const dash = {
    "Today":      { revenue: 12450,  tx: 538,   customers: 47,   total: 84230,   deltas: ["▲ 18%", "▲ 9%", "▲ 6%"],  curve: [40, 38, 52, 47, 60, 55, 72, 68, 80, 76, 88, 84] },
    "This Week":  { revenue: 84230,  tx: 3612,  customers: 312,  total: 612400,  deltas: ["▲ 24%", "▲ 12%", "▲ 8%"], curve: [30, 45, 40, 58, 50, 65, 60, 74, 70, 62, 78, 90] },
    "This Month": { revenue: 312900, tx: 14820, customers: 1284, total: 1265430, deltas: ["▲ 36%", "▲ 21%", "▲ 15%"], curve: [20, 35, 30, 48, 55, 45, 62, 58, 70, 82, 75, 88] },
  };
  const kpiMap = {
    revenue: { el: $("#kpi-revenue"), prefix: "AED " },
    tx:      { el: $("#kpi-tx"),      prefix: "" },
    customers: { el: $("#kpi-customers"), prefix: "" },
  };
  const totalEl = $("#chart-total");
  const deltaEls = [$("#delta-revenue"), $("#delta-tx"), $("#delta-customers")];

  function buildPath(values) {
    const max = Math.max(...values), min = Math.min(...values);
    const span = max - min || 1;
    const stepX = (W - PAD * 2) / (values.length - 1);
    const pts = values.map((v, i) => [PAD + i * stepX, PAD + (1 - (v - min) / span) * (H - PAD * 2)]);
    const d = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
    const areaD = `${d} L${pts[pts.length - 1][0].toFixed(1)},${H} L${pts[0][0].toFixed(1)},${H} Z`;
    return { d, areaD };
  }

  function redrawSpark(curve, restart) {
    const { d, areaD } = buildPath(curve);
    if (line) line.setAttribute("d", d);
    if (area) area.setAttribute("d", areaD);
    if (restart && spark && !prefersReduced) {
      spark.classList.remove("drawn");
      void spark.offsetWidth; // reflow to restart the draw animation
      spark.classList.add("drawn");
    }
  }

  function applyRange(range, animate) {
    const data = dash[range] || dash["Today"];
    // KPIs
    Object.keys(kpiMap).forEach((k) => {
      const { el, prefix } = kpiMap[k];
      if (!el) return;
      el.dataset.count = data[k];
      el.dataset.prefix = prefix;
      if (animate) animateCount(el); else el.textContent = prefix + data[k].toLocaleString();
    });
    // total
    if (totalEl) {
      totalEl.dataset.count = data.total;
      if (animate) animateCount(totalEl); else totalEl.textContent = "AED " + data.total.toLocaleString();
    }
    // deltas
    deltaEls.forEach((d, i) => { if (d) d.textContent = data.deltas[i]; });
    // chart
    redrawSpark(data.curve, animate);
  }

  // initialise (no animation yet; count-up fires when scrolled into view)
  applyRange("Today", false);

  // tab switching
  $$(".dash-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      $$(".dash-tab").forEach((t) => {
        t.classList.remove("is-active");
        t.setAttribute("aria-pressed", "false");
      });
      tab.classList.add("is-active");
      tab.setAttribute("aria-pressed", "true");
      applyRange(tab.dataset.range, true);
    });
  });

  /* ---------- count-up + chart draw when scrolled into view ---------- */
  const countEls = $$("[data-count]");
  if ("IntersectionObserver" in window) {
    const cio = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { animateCount(e.target); cio.unobserve(e.target); }
      });
    }, { threshold: 0.5 });
    countEls.forEach((el) => cio.observe(el));

    if (spark) {
      const sio = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) { spark.classList.add("drawn"); sio.unobserve(e.target); }
        });
      }, { threshold: 0.4 });
      sio.observe(spark);
    }
  } else {
    countEls.forEach(animateCount);
    spark?.classList.add("drawn");
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
  wireForm("#contact-form", 'input[name="email"]', "#form-hint", "/api/lead", "Thanks, we'll be in touch within one business day.");
  wireForm("#subscribe-form", 'input[name="email"]', "#sub-hint", "/api/subscribe", "Subscribed. Welcome aboard.");

  /* ---------- demo booking calendar ---------- */
  initBooking();
  function initBooking() {
    const root = $("#booking");
    if (!root) return;

    const grid = $("#cal-grid");
    const title = $("#cal-title");
    const prev = $("#cal-prev");
    const next = $("#cal-next");
    const calStep = $("#cal-step");
    const slotsStep = $("#slots-step");
    const bookedStep = $("#booked-step");
    const slotsGrid = $("#slots-grid");
    const slotsDate = $("#slots-date");
    const bookForm = $("#book-form");
    const bookHint = $("#book-hint");
    const slotsBack = $("#slots-back");
    const bookAgain = $("#book-again");

    const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    let SLOTS = ["10:00", "11:00", "12:00", "14:00", "15:00", "16:00"];
    let TZ = "GST";
    let bookedSet = new Set();      // "YYYY-MM-DD|HH:mm"
    let selectedDate = null;        // "YYYY-MM-DD"
    let selectedTime = null;

    const pad = (n) => String(n).padStart(2, "0");
    const iso = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;
    // "today" in GST (UTC+4) so the client agrees with the server on the earliest bookable day
    const todayISO = (() => { const g = new Date(Date.now() + 4 * 3600 * 1000); return `${g.getUTCFullYear()}-${pad(g.getUTCMonth() + 1)}-${pad(g.getUTCDate())}`; })();

    let view = new Date(); view.setDate(1); view.setHours(0, 0, 0, 0);
    const minMonth = new Date(); minMonth.setDate(1); minMonth.setHours(0, 0, 0, 0);
    const maxMonth = new Date(minMonth); maxMonth.setMonth(maxMonth.getMonth() + 3); // nav window
    // exact 90-day horizon (same formula as the server) so no day is clickable then rejected
    const maxDateISO = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);

    async function loadAvailability(y, m) {
      const from = iso(y, m, 1);
      const to = iso(y, m, new Date(y, m + 1, 0).getDate());
      try {
        const res = await fetch(`/api/availability?from=${from}&to=${to}`);
        const data = await res.json();
        if (data.ok) {
          if (Array.isArray(data.slots) && data.slots.length) SLOTS = data.slots;
          if (data.timezone) TZ = data.timezone;
          bookedSet = new Set(data.booked || []);
        }
      } catch {
        bookedSet = new Set(); // offline: show all as available
      }
    }

    const humanDate = (dateStr) => {
      const d = new Date(dateStr + "T00:00:00");
      return `${WEEKDAY_LABELS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
    };

    function renderCalendar() {
      const y = view.getFullYear(), m = view.getMonth();
      title.textContent = `${MONTHS[m]} ${y}`;
      // bound navigation to the current..+3 month booking window
      prev.disabled = (y < minMonth.getFullYear()) || (y === minMonth.getFullYear() && m <= minMonth.getMonth());
      next.disabled = (y > maxMonth.getFullYear()) || (y === maxMonth.getFullYear() && m >= maxMonth.getMonth());
      grid.innerHTML = "";
      // Monday-first offset
      const firstDow = (new Date(y, m, 1).getDay() + 6) % 7;
      const daysInMonth = new Date(y, m + 1, 0).getDate();
      for (let i = 0; i < firstDow; i++) {
        const blank = document.createElement("div");
        blank.className = "cal-day is-empty";
        blank.setAttribute("aria-hidden", "true");
        grid.appendChild(blank);
      }
      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = iso(y, m, d);
        const dow = new Date(y, m, d).getDay();
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "cal-day";
        btn.textContent = d;
        const isWeekend = dow === 0 || dow === 6;
        const isPast = dateStr <= todayISO; // earliest bookable day is the next business day
        const beyondHorizon = dateStr > maxDateISO; // 90-day window, mirrors server
        // a day is full if every slot is booked
        const allBooked = SLOTS.every((s) => bookedSet.has(`${dateStr}|${s}`));
        if (isWeekend || isPast || beyondHorizon || allBooked) {
          btn.disabled = true;
          btn.setAttribute("aria-label", `${humanDate(dateStr)}, unavailable`);
        } else {
          btn.setAttribute("aria-label", `Choose ${humanDate(dateStr)}`);
          btn.addEventListener("click", () => selectDate(dateStr));
        }
        if (dateStr === todayISO) btn.classList.add("is-today");
        if (dateStr === selectedDate) btn.classList.add("is-selected");
        grid.appendChild(btn);
      }
    }

    // make step containers programmatically focusable so we can move focus on transition
    [calStep, slotsStep, bookedStep].forEach((el) => el && el.setAttribute("tabindex", "-1"));

    function showStep(step) {
      calStep.hidden = step !== "cal";
      slotsStep.hidden = step !== "slots";
      bookedStep.hidden = step !== "booked";
      // move focus to the newly-shown step so keyboard/SR users aren't stranded
      const target = step === "slots" ? slotsStep : step === "booked" ? bookedStep : calStep;
      if (target) requestAnimationFrame(() => target.focus());
    }

    function selectDate(dateStr) {
      selectedDate = dateStr;
      selectedTime = null;
      slotsDate.textContent = humanDate(dateStr);
      renderSlots();
      bookForm.hidden = true;
      setHint(bookHint, "", false);
      showStep("slots");
    }

    function renderSlots() {
      slotsGrid.innerHTML = "";
      const available = SLOTS.filter((s) => !bookedSet.has(`${selectedDate}|${s}`));
      if (!available.length) {
        const p = document.createElement("p");
        p.className = "slots-empty";
        p.textContent = "No times left on this day. Try another date.";
        slotsGrid.appendChild(p);
        return;
      }
      SLOTS.forEach((s) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "slot";
        btn.textContent = `${s} ${TZ}`;
        if (bookedSet.has(`${selectedDate}|${s}`)) {
          btn.disabled = true;
          btn.setAttribute("aria-label", `${s} unavailable`);
        } else {
          btn.addEventListener("click", () => {
            selectedTime = s;
            $$(".slot", slotsGrid).forEach((b) => { b.classList.remove("is-selected"); b.setAttribute("aria-pressed", "false"); });
            btn.classList.add("is-selected");
            btn.setAttribute("aria-pressed", "true");
            const wasHidden = bookForm.hidden;
            bookForm.hidden = false;
            setHint(bookHint, "", false);
            if (wasHidden) requestAnimationFrame(() => bookForm.name.focus());
          });
        }
        slotsGrid.appendChild(btn);
      });
    }

    async function refreshAndRender() {
      await loadAvailability(view.getFullYear(), view.getMonth());
      renderCalendar();
    }

    prev.addEventListener("click", () => {
      if (prev.disabled) return;
      view.setMonth(view.getMonth() - 1);
      refreshAndRender();
    });
    next.addEventListener("click", () => {
      if (next.disabled) return;
      view.setMonth(view.getMonth() + 1);
      refreshAndRender();
    });
    slotsBack.addEventListener("click", () => { showStep("cal"); renderCalendar(); });
    bookAgain.addEventListener("click", () => {
      selectedDate = selectedTime = null;
      refreshAndRender();
      showStep("cal");
    });

    bookForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = bookForm.name.value.trim();
      const email = bookForm.email.value.trim();
      const notes = bookForm.notes.value.trim();
      if (!name) { setHint(bookHint, "Please enter your name.", true); bookForm.name.focus(); return; }
      if (!isEmail(email)) { setHint(bookHint, "Please enter a valid email.", true); bookForm.email.focus(); return; }
      if (!selectedDate || !selectedTime) { setHint(bookHint, "Please pick a date and time.", true); return; }
      const btn = $("#book-submit");
      btn.disabled = true;
      setHint(bookHint, "Confirming…", false);
      try {
        const { ok, data } = await postJSON("/api/book", { name, email, notes, date: selectedDate, time: selectedTime });
        if (ok) {
          $("#booked-detail").textContent = `${humanDate(data.date)} at ${data.time} ${data.timezone || TZ}. We've sent a confirmation to ${email} and will follow up to lock in the details.`;
          $("#booked-ref").textContent = data.ref;
          showStep("booked");
          bookForm.reset();
        } else {
          setHint(bookHint, data.error || "Could not book that slot.", true);
          // a 409 means it was taken; refresh availability
          await loadAvailability(view.getFullYear(), view.getMonth());
          renderSlots();
        }
      } catch {
        setHint(bookHint, "Could not reach the booking service. Email us instead and we'll sort it.", true);
      } finally {
        btn.disabled = false;
      }
    });

    refreshAndRender();
  }

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
