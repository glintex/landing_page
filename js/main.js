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

  /* ------------------------------------------------------------ showreel playback */
  var video = $(".reel__video");
  if (video) {
    if (reduce) {
      video.controls = true;
    } else if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (es) {
        es.forEach(function (en) {
          if (en.isIntersecting) { var pr = video.play(); if (pr && pr.catch) pr.catch(function () { video.controls = true; }); }
          else video.pause();
        });
      }, { threshold: 0.25 }).observe(video);
    }
    $(".reel__frame").addEventListener("click", function () {
      if (video.paused) video.play(); else video.pause();
    });
  }

  /* ------------------------------------------------------------ globe (canvas 2D, dotted land) */
  var globeCanvas = $("#globe");
  if (globeCanvas && window.GV_LAND && "IntersectionObserver" in window) {
    var G = globeCanvas.getContext("2d");
    var RAD = Math.PI / 180;
    var land = window.GV_LAND;
    var pts = [];
    for (var k = 0; k < land.length; k += 2) {
      var la = land[k] * RAD, lo = -land[k + 1] * RAD;
      pts.push([Math.cos(la) * Math.cos(lo), Math.sin(la), Math.cos(la) * Math.sin(lo)]);
    }
    var toV = function (lat, lon) { var la = lat * RAD, lo = -lon * RAD; return [Math.cos(la) * Math.cos(lo), Math.sin(la), Math.cos(la) * Math.sin(lo)]; };
    var places = [toV(-33.87, 151.21), toV(25.2, 55.27), toV(51.5, -0.13), toV(40.71, -74.0)];
    // great-circle arcs linking client regions in a loop, lifted off the surface
    var arcs = places.map(function (pv, idx) {
      var a = pv, b = places[(idx + 1) % places.length], seg = [];
      var dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
      var om = Math.acos(Math.max(-1, Math.min(1, dot)));
      for (var i = 0; i <= 48; i++) {
        var t = i / 48, s1 = Math.sin((1 - t) * om) / Math.sin(om), s2 = Math.sin(t * om) / Math.sin(om);
        var lift = 1 + Math.sin(Math.PI * t) * Math.min(0.22, 0.12 * om);
        seg.push([(a[0] * s1 + b[0] * s2) * lift, (a[1] * s1 + b[1] * s2) * lift, (a[2] * s1 + b[2] * s2) * lift]);
      }
      return seg;
    });
    var rotY = 0.9, tilt = 0.38, vel = 0, dragging = false, lastX = 0, running = false, visible = false, t0 = performance.now();
    function proj(v, cx, cy, r) {
      // rotate around Y, then tilt around X
      var cy_ = Math.cos(rotY), sy = Math.sin(rotY);
      var x = v[0] * cy_ - v[2] * sy, z = v[0] * sy + v[2] * cy_, y = v[1];
      var ct = Math.cos(tilt), st = Math.sin(tilt);
      var y2 = y * ct - z * st, z2 = y * st + z * ct;
      return [cx + x * r, cy - y2 * r, z2];
    }
    function draw(now) {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var w = globeCanvas.clientWidth;
      if (!w) return;
      if (globeCanvas.width !== Math.round(w * dpr)) { globeCanvas.width = globeCanvas.height = Math.round(w * dpr); }
      var S = globeCanvas.width, cx = S / 2, cy = S / 2, r = S * 0.4;
      G.clearRect(0, 0, S, S);
      // sphere body + rim light
      var body = G.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r);
      body.addColorStop(0, "rgba(255,255,255,1)");
      body.addColorStop(1, "rgba(220,226,234,1)");
      G.fillStyle = body;
      G.beginPath(); G.arc(cx, cy, r, 0, Math.PI * 2); G.fill();
      G.strokeStyle = "rgba(18,72,166,0.25)"; G.lineWidth = S * 0.0025; G.stroke();
      // land dots
      var ds = S * 0.0034;
      for (var i = 0; i < pts.length; i++) {
        var p = proj(pts[i], cx, cy, r);
        if (p[2] < 0) continue;
        var a = 0.18 + p[2] * 0.75;
        G.fillStyle = "rgba(18,72,166," + (a * 0.85).toFixed(3) + ")";
        G.fillRect(p[0] - ds / 2, p[1] - ds / 2, ds, ds);
      }
      // arcs with travelling pulse
      var tt = ((now - t0) / 2600) % 1;
      arcs.forEach(function (seg, j) {
        G.lineWidth = S * 0.0028;
        G.beginPath();
        var started = false;
        for (var i = 0; i < seg.length; i++) {
          var p = proj(seg[i], cx, cy, r);
          if (p[2] < -0.05) { started = false; continue; }
          if (!started) { G.moveTo(p[0], p[1]); started = true; } else G.lineTo(p[0], p[1]);
        }
        G.strokeStyle = "rgba(62,136,255,0.75)";
        G.stroke();
        var ph = (tt + j * 0.23) % 1, idx = Math.floor(ph * (seg.length - 1));
        var q = proj(seg[idx], cx, cy, r);
        if (q[2] > -0.05) {
          G.fillStyle = "#1248a6";
          G.beginPath(); G.arc(q[0], q[1], S * 0.006, 0, Math.PI * 2); G.fill();
        }
      });
      // markers
      var pulse = (now % 2000) / 2000;
      places.forEach(function (v) {
        var p = proj(v, cx, cy, r);
        if (p[2] < 0) return;
        G.fillStyle = "rgba(62,136,255," + (0.35 * (1 - pulse)).toFixed(3) + ")";
        G.beginPath(); G.arc(p[0], p[1], S * (0.012 + pulse * 0.03), 0, Math.PI * 2); G.fill();
        G.fillStyle = "#1248a6";
        G.beginPath(); G.arc(p[0], p[1], S * 0.009, 0, Math.PI * 2); G.fill();
      });
    }
    function loop(now) {
      if (!visible) { running = false; return; }
      if (!dragging) { rotY += (reduce ? 0 : 0.0022) + vel; vel *= 0.94; }
      draw(now);
      requestAnimationFrame(loop);
    }
    new IntersectionObserver(function (es) {
      visible = es[0].isIntersecting;
      if (visible && !running) { running = true; globeCanvas.classList.add("is-on"); requestAnimationFrame(loop); }
    }, { rootMargin: "100px" }).observe(globeCanvas);
    globeCanvas.addEventListener("pointerdown", function (e) { dragging = true; lastX = e.clientX; vel = 0; globeCanvas.setPointerCapture(e.pointerId); });
    globeCanvas.addEventListener("pointermove", function (e) {
      if (!dragging) return;
      var d = (e.clientX - lastX) * 0.006;
      rotY += d; vel = d * 0.5; lastX = e.clientX;
    });
    var endDrag = function () { dragging = false; };
    globeCanvas.addEventListener("pointerup", endDrag);
    globeCanvas.addEventListener("pointercancel", endDrag);
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

    /* Hero: real-product stack */
    var scene = $(".stack__scene");
    if (scene) {
      var shots = $$(".shot");
      var chips = $$(".chip");
      var intro = gsap.timeline({ delay: 0.25 });
      intro
        .from(shots.slice().reverse(), { y: 160, autoAlpha: 0, rotateX: -18, duration: 1.4, ease: "power4.out", stagger: 0.14 })
        .from(chips, { scale: 0.6, autoAlpha: 0, duration: 0.8, ease: "back.out(1.8)", stagger: 0.12 }, "-=0.7");

      // mouse parallax (desktop pointers only)
      if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
        var rx = gsap.quickTo(scene, "rotateY", { duration: 1.2, ease: "power3.out" });
        var ry = gsap.quickTo(scene, "rotateX", { duration: 1.2, ease: "power3.out" });
        gsap.set(scene, { rotateX: 14, rotateY: -18, rotateZ: 4 });
        var layers = $$("[data-depth]", scene).map(function (el) {
          return { d: parseFloat(el.dataset.depth), x: gsap.quickTo(el, "x", { duration: 1, ease: "power3.out" }) };
        });
        $(".hero").addEventListener("pointermove", function (e) {
          var nx = e.clientX / window.innerWidth - 0.5;
          var ny = e.clientY / window.innerHeight - 0.5;
          rx(-18 + nx * 10);
          ry(14 - ny * 8);
          layers.forEach(function (l) { l.x(nx * 26 * l.d); });
        });
      }

      // scroll: the stack fans out and flattens as you leave the hero
      var fan = gsap.timeline({ scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: 0.8 } });
      fan
        .to(".shot--3", { yPercent: -28, ease: "none" }, 0)
        .to(".shot--2", { yPercent: -10, ease: "none" }, 0)
        .to(".shot--1", { yPercent: 14, ease: "none" }, 0)
        .to(".chip--a", { yPercent: 120, ease: "none" }, 0)
        .to(".chip--c", { yPercent: -160, ease: "none" }, 0);
      gsap.to(".aurora", { yPercent: 25, ease: "none", scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true } });
    }

    /* Showreel: scale up into place */
    var reelFrame = $(".reel__frame");
    if (reelFrame) {
      gsap.fromTo(reelFrame, { scale: 0.86, borderRadius: 32 }, { scale: 1, borderRadius: 22, ease: "none", scrollTrigger: { trigger: ".reel", start: "top 95%", end: "top 20%", scrub: true } });
    }

    /* Custom cursor + magnetic buttons */
    if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
      var cur = $(".cursor");
      var label = $(".cursor__label");
      if (cur) {
        var cx = gsap.quickTo(cur, "x", { duration: 0.35, ease: "power3.out" });
        var cy = gsap.quickTo(cur, "y", { duration: 0.35, ease: "power3.out" });
        window.addEventListener("pointermove", function (e) {
          cur.classList.add("is-on");
          cx(e.clientX);
          cy(e.clientY);
          var t = e.target.closest ? e.target : null;
          var lab = t && t.closest("[data-cursor]");
          var hov = t && t.closest("a, button, summary, input, select, textarea, label");
          if (lab && !hov) {
            label.textContent = lab.getAttribute("data-cursor");
            cur.classList.add("is-label");
            cur.classList.remove("is-hover");
          } else {
            cur.classList.remove("is-label");
            cur.classList.toggle("is-hover", !!hov);
          }
        }, { passive: true });
        document.addEventListener("pointerleave", function () { cur.classList.remove("is-on"); });
      }
      $$("[data-magnetic]").forEach(function (btn) {
        var mx = gsap.quickTo(btn, "x", { duration: 0.6, ease: "elastic.out(1, 0.45)" });
        var my = gsap.quickTo(btn, "y", { duration: 0.6, ease: "elastic.out(1, 0.45)" });
        btn.addEventListener("pointermove", function (e) {
          var r = btn.getBoundingClientRect();
          mx((e.clientX - r.left - r.width / 2) * 0.3);
          my((e.clientY - r.top - r.height / 2) * 0.4);
        });
        btn.addEventListener("pointerleave", function () { mx(0); my(0); });
      });
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

    function toHash() {
      if (location.hash.length < 2) return;
      var t = document.querySelector(location.hash);
      if (!t) return;
      if (lenis) lenis.scrollTo(t, { offset: -72, immediate: true, force: true });
      else t.scrollIntoView();
    }
    window.addEventListener("load", function () { ST.refresh(); setTimeout(toHash, 60); });
    if (document.readyState === "complete") setTimeout(toHash, 60);
  });
})();
