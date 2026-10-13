/* Glintvex — interactions & motion.
   Lenis smooth scroll + GSAP ScrollTrigger/SplitText. Everything degrades to a
   fully readable static page if a library fails to load or reduced motion is set. */
(function () {
  "use strict";

  var CALENDLY_URL = "https://calendly.com/saudagarsaim/30min"; // swap for a company Calendly link when ready
  var CONTACT_MAIL = "info@glintvex.com";

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var hasGSAP = typeof window.gsap !== "undefined" && typeof window.ScrollTrigger !== "undefined";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ------------------------------------------------------------ year */
  $$("[data-year]").forEach(function (el) { el.textContent = new Date().getFullYear(); });

  /* ------------------------------------------------------------ Calendly booking */
  var calLoading = null;
  function loadCalendly() {
    if (window.Calendly) return Promise.resolve();
    if (calLoading) return calLoading;
    calLoading = new Promise(function (res, rej) {
      var s = document.createElement("script");
      s.src = "https://assets.calendly.com/assets/external/widget.js";
      s.async = true;
      s.onload = res;
      s.onerror = rej;
      document.head.appendChild(s);
      setTimeout(rej, 6000);
    });
    return calLoading;
  }
  function book() {
    var url = CALENDLY_URL + "?hide_gdpr_banner=1&primary_color=3e88ff";
    loadCalendly()
      .then(function () {
        if (window.Calendly) window.Calendly.initPopupWidget({ url: url });
        else throw new Error("no calendly");
      })
      .catch(function () {
        window.open(CALENDLY_URL, "_blank", "noopener");
      });
  }
  window.GVbook = book;
  document.addEventListener("click", function (e) {
    var t = e.target.closest("[data-book]");
    if (!t) return;
    e.preventDefault();
    closeMenu();
    book();
  });
  // warm up the widget script when someone shows intent
  document.addEventListener("pointerover", function warm(e) {
    if (e.target.closest && e.target.closest("[data-book]")) {
      loadCalendly().catch(function () {});
      document.removeEventListener("pointerover", warm);
    }
  });

  /* ------------------------------------------------------------ mobile menu */
  var burger = $("[data-menu]");
  var menu = $("#mobileMenu");
  function closeMenu() {
    if (!menu || menu.hidden) return;
    menu.hidden = true;
    burger.setAttribute("aria-expanded", "false");
  }
  window.GVcloseMenu = closeMenu;
  if (burger && menu) {
    burger.addEventListener("click", function () {
      var open = menu.hidden;
      menu.hidden = !open;
      burger.setAttribute("aria-expanded", String(open));
    });
    menu.addEventListener("click", function (e) {
      if (e.target.closest("a")) closeMenu();
    });
  }

  /* ------------------------------------------------------------ smooth scroll */
  var lenis = null;
  if (!reduce && typeof window.Lenis !== "undefined") {
    lenis = new window.Lenis({ duration: 1.1, smoothWheel: true, easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); } });
    window.GVlenis = lenis;
    if (hasGSAP) {
      lenis.on("scroll", window.ScrollTrigger.update);
      window.gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
      window.gsap.ticker.lagSmoothing(0);
    } else {
      var raf = function (t) { lenis.raf(t); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
    }
  }
  document.addEventListener("click", function (e) {
    var a = e.target.closest('a[href^="#"]');
    if (!a) return;
    var id = a.getAttribute("href");
    if (id.length < 2) return;
    var target = $(id);
    if (!target) return;
    e.preventDefault();
    closeMenu();
    if (lenis) lenis.scrollTo(target, { offset: id === "#top" ? 0 : -72 });
    else target.scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
    history.replaceState(null, "", id);
  });

  /* ------------------------------------------------------------ nav + progress + sticky CTA */
  var nav = $("#nav");
  var progress = $(".progress");
  var sticky = $(".sticky");
  var hero = $(".hero");
  var lastY = window.scrollY;
  function onScroll() {
    var y = window.scrollY;
    var max = document.documentElement.scrollHeight - window.innerHeight;
    if (progress) progress.style.transform = "scaleX(" + (max > 0 ? y / max : 0) + ")";
    nav.classList.toggle("is-scrolled", y > 24);
    var menuOpen = menu && !menu.hidden;
    nav.classList.toggle("is-hidden", !menuOpen && y > 600 && y > lastY + 4);
    if (y < lastY - 4) nav.classList.remove("is-hidden");
    if (sticky && hero) {
      var past = y > hero.offsetHeight * 0.75;
      var nearEnd = y > max - 700;
      sticky.classList.toggle("is-on", past && !nearEnd);
    }
    lastY = y;
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ------------------------------------------------------------ service card spotlight */
  $$(".svc").forEach(function (c) {
    c.addEventListener("pointermove", function (e) {
      var r = c.getBoundingClientRect();
      c.style.setProperty("--mx", e.clientX - r.left + "px");
      c.style.setProperty("--my", e.clientY - r.top + "px");
    });
  });

  /* ------------------------------------------------------------ number helpers */
  function fmt(v, dec) {
    return dec ? v.toFixed(dec) : Math.round(v).toLocaleString("en-US");
  }
  function countUp(el, to, dec, suffix, dur) {
    if (reduce || !hasGSAP) { el.textContent = fmt(to, dec) + (suffix || ""); return; }
    var o = { v: 0 };
    window.gsap.to(o, {
      v: to,
      duration: dur || 1.8,
      ease: "power3.out",
      onUpdate: function () { el.textContent = fmt(o.v, dec) + (suffix || ""); },
    });
  }

  /* ------------------------------------------------------------ contact form */
  var form = $("#contactForm");
  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var hint = $(".form__hint", form);
      var btn = $("button[type=submit]", form);
      var get = function (n) { return (form.elements[n] && form.elements[n].value.trim()) || ""; };
      var name = get("name"), email = get("email"), message = get("message");
      hint.className = "form__hint";
      if (name.length < 2) { hint.textContent = "Please add your name."; hint.classList.add("err"); return form.elements.name.focus(); }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { hint.textContent = "Please enter a valid email."; hint.classList.add("err"); return form.elements.email.focus(); }
      if (message.length < 10) { hint.textContent = "Tell us a little about the project (a sentence or two)."; hint.classList.add("err"); return form.elements.message.focus(); }
      btn.disabled = true;
      var label = btn.innerHTML;
      btn.textContent = "Sending…";
      var send = window.GVsendLead
        ? window.GVsendLead(
            { name: name, email: email, company: get("company"), budget: get("budget"), timeline: get("timeline"), message: message, source: "Contact form" },
            "New brief from glintvex.com — " + name
          )
        : Promise.resolve(false);
      send.then(function (ok) {
        btn.disabled = false;
        btn.innerHTML = label;
        if (ok) {
          form.reset();
          hint.textContent = "Thanks, " + name.split(" ")[0] + ". Your brief is in. A co-founder will reply within one business day.";
          hint.classList.add("ok");
        } else {
          hint.innerHTML = 'Something went wrong sending that. Please email us at <a href="mailto:' + CONTACT_MAIL + '">' + CONTACT_MAIL + "</a>.";
          hint.classList.add("err");
        }
      });
    });
  }

  /* ------------------------------------------------------------ static fallback */
  if (!hasGSAP || reduce) {
    $$("[data-count]").forEach(function (el) { el.textContent = el.dataset.count; });
    return;
  }

  /* ============================================================ MOTION */
  var gsap = window.gsap;
  var ST = window.ScrollTrigger;
  gsap.registerPlugin(ST);
  if (window.SplitText) gsap.registerPlugin(window.SplitText);
  document.documentElement.classList.add("js-motion");

  function ready(fn) {
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fn);
    else fn();
  }

  ready(function () {
    /* Headline line reveals */
    $$("[data-split]").forEach(function (el) {
      var inHero = !!el.closest(".hero");
      if (window.SplitText) {
        var split = new window.SplitText(el, { type: "lines", linesClass: "split-line", mask: "lines" });
        gsap.from(split.lines, {
          yPercent: 110,
          duration: 1.1,
          ease: "power4.out",
          stagger: 0.09,
          delay: inHero ? 0.15 : 0,
          scrollTrigger: inHero ? null : { trigger: el, start: "top 85%" },
        });
      } else {
        gsap.from(el, { y: 30, autoAlpha: 0, duration: 1, ease: "power3.out", scrollTrigger: inHero ? null : { trigger: el, start: "top 85%" } });
      }
    });

    /* Fade-ups, batched so grids cascade */
    gsap.set("[data-fade]", { autoAlpha: 0, y: 28 });
    gsap.to(".hero [data-fade]", { autoAlpha: 1, y: 0, duration: 1, ease: "power3.out", stagger: 0.1, delay: 0.35 });
    ST.batch("[data-fade]:not(.hero [data-fade])", {
      start: "top 90%",
      once: true,
      onEnter: function (els) {
        gsap.to(els, { autoAlpha: 1, y: 0, duration: 0.9, ease: "power3.out", stagger: 0.08, overwrite: true });
      },
    });

    /* Hero console */
    var con = $(".console");
    if (con) {
      gsap.from(con, { y: 60, autoAlpha: 0, rotateX: 8, transformPerspective: 1200, duration: 1.4, ease: "power3.out", delay: 0.35 });
      var line = $(".chart__line");
      if (line && line.getTotalLength) {
        var len = line.getTotalLength();
        gsap.fromTo(line, { strokeDasharray: len, strokeDashoffset: len }, { strokeDashoffset: 0, duration: 2.2, ease: "power2.inOut", delay: 0.7 });
        gsap.from(".chart__fill", { autoAlpha: 0, duration: 1.2, delay: 1.6 });
      }
      gsap.from(".log li", { x: -16, autoAlpha: 0, stagger: 0.12, duration: 0.6, delay: 1.2, ease: "power2.out" });
      $$("[data-tick]").forEach(function (el, k) {
        var to = parseFloat(el.dataset.tick);
        var dec = parseInt(el.dataset.dec || "0", 10);
        var suf = el.dataset.suffix || "";
        gsap.delayedCall(0.6 + k * 0.15, function () { countUp(el, to, dec, suf, 1.6); });
        // gentle "live" jitter afterwards
        gsap.delayedCall(3 + k, function jitter() {
          var spread = dec ? Math.pow(10, -dec) * 3 : Math.max(1, to * 0.05);
          var v = dec ? to - Math.random() * spread : Math.max(0, to + (Math.random() - 0.5) * 2 * spread);
          el.textContent = fmt(v, dec) + suf;
          gsap.delayedCall(2 + Math.random() * 2, jitter);
        });
      });
      // subtle parallax
      gsap.to(con, { yPercent: -8, ease: "none", scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true } });
      gsap.to(".orb--a", { yPercent: 40, ease: "none", scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true } });
    }

    /* Outcome counters */
    $$("[data-count]").forEach(function (el) {
      ST.create({
        trigger: el,
        start: "top 88%",
        once: true,
        onEnter: function () { countUp(el, parseFloat(el.dataset.count), 0, "", 2); },
      });
    });

    /* Process line */
    var stepLine = $(".steps__line i");
    if (stepLine) {
      gsap.fromTo(stepLine, { scaleX: 0 }, { scaleX: 1, ease: "none", scrollTrigger: { trigger: ".steps", start: "top 75%", end: "bottom 45%", scrub: true } });
    }

    /* Model cards lift-in */
    gsap.from(".model--hot", { scale: 0.96, duration: 1, ease: "power3.out", scrollTrigger: { trigger: ".models", start: "top 80%" } });

    /* Pinned horizontal case-study gallery (desktop) */
    var work = $(".work");
    var track = $(".work__track");
    var mm = gsap.matchMedia();
    mm.add("(min-width: 1040px)", function () {
      work.classList.add("is-pinned");
      var dist = function () { return Math.max(0, track.scrollWidth - window.innerWidth); };
      var tween = gsap.to(track, {
        x: function () { return -dist(); },
        ease: "none",
        scrollTrigger: {
          trigger: work,
          start: "top top",
          end: function () { return "+=" + dist(); },
          pin: ".work__pin",
          scrub: 0.6,
          invalidateOnRefresh: true,
          anticipatePin: 1,
        },
      });
      ST.refresh();
      return function () {
        tween.scrollTrigger && tween.scrollTrigger.kill();
        tween.kill();
        gsap.set(track, { clearProps: "transform" });
        work.classList.remove("is-pinned");
      };
    });

    window.addEventListener("load", function () { ST.refresh(); });
  });
})();
