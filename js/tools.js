/* Glintvex — lead tools: Project Cost Estimator + Scale-Readiness Scorecard.
   Both open in #modal, gate results behind name + email, and send the lead to
   info@glintvex.com via FormSubmit (the same channel the contact form uses). */
(function () {
  "use strict";

  var CONTACT_MAIL = "info@glintvex.com";
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  /* ------------------------------------------------------------ lead sender */
  // NOTE: never add a honeypot named "_honey" — browsers autofill it and FormSubmit then drops the mail silently.
  function sendLead(fields, subject) {
    var body = new FormData();
    Object.keys(fields).forEach(function (k) {
      if (fields[k] !== undefined && fields[k] !== "") body.append(k, fields[k]);
    });
    body.append("_subject", subject);
    if (fields.email) body.append("_replyto", fields.email);
    body.append("_template", "table");
    body.append("_captcha", "false");
    return fetch("https://formsubmit.co/ajax/" + encodeURIComponent(CONTACT_MAIL), {
      method: "POST",
      headers: { Accept: "application/json" },
      body: body,
    })
      .then(function (r) {
        return r.json().catch(function () {
          return {};
        });
      })
      .then(function (d) {
        return d.success === true || d.success === "true";
      })
      .catch(function () {
        return false;
      });
  }
  window.GVsendLead = sendLead;

  function remember(k, v) {
    try {
      if (v === undefined) return sessionStorage.getItem(k);
      sessionStorage.setItem(k, v);
    } catch (e) {
      return null;
    }
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function money(n) {
    return "$" + Math.round(n / 1000) + "k";
  }

  /* ------------------------------------------------------------ modal shell */
  var modal = document.getElementById("modal");
  var bodyEl = document.getElementById("modalBody");
  var lastFocus = null;
  var keyHandler = null;

  function openModal(render) {
    lastFocus = document.activeElement;
    modal.hidden = false;
    document.documentElement.style.overflow = "hidden";
    if (window.GVlenis) window.GVlenis.stop();
    render();
    var f = modal.querySelector(".modal__body button, .modal__body input");
    if (f) f.focus({ preventScroll: true });
  }
  function closeModal() {
    modal.hidden = true;
    bodyEl.innerHTML = "";
    keyHandler = null;
    document.documentElement.style.overflow = "";
    if (window.GVlenis) window.GVlenis.start();
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }
  window.GVcloseModal = closeModal;

  modal.addEventListener("click", function (e) {
    if (e.target.closest("[data-close]")) closeModal();
  });
  document.addEventListener("keydown", function (e) {
    if (modal.hidden) return;
    if (e.key === "Escape") return closeModal();
    var tag = (e.target && e.target.tagName) || "";
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    if (keyHandler && /^[1-9]$|^Enter$/.test(e.key)) {
      e.preventDefault();
      keyHandler(e);
    }
  });

  function head(title, right, pct) {
    return (
      '<div class="tool-head"><span>' + title + "</span><span>" + right + "</span></div>" +
      '<div class="tool-bar"><i style="width:' + pct + '%"></i></div>'
    );
  }

  function gateHTML(id, q, hint, cta) {
    return (
      '<form class="gate" novalidate>' +
      '<h2 class="tool-q">' + q + "</h2>" +
      '<p class="tool-hint">' + hint + "</p>" +
      '<label class="tool-field">First name<input name="name" autocomplete="given-name" required></label>' +
      '<label class="tool-field">Work email<input name="email" type="email" autocomplete="email" required></label>' +
      '<label class="tool-field">Company or product URL (optional)<input name="company" autocomplete="organization" placeholder="yourcompany.com"></label>' +
      '<p class="tool-err" aria-live="polite"></p>' +
      '<button class="btn btn--block" type="submit">' + cta + ' <span class="arr">→</span></button>' +
      '<p class="fine">No spam. One email with your results from a Glintvex co-founder.</p>' +
      "</form>"
    );
  }

  function bindGate(onValid) {
    var form = bodyEl.querySelector("form.gate");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var el = form.elements;
      var name = el.name.value.trim();
      var email = el.email.value.trim();
      var err = form.querySelector(".tool-err");
      if (name.length < 2) {
        err.textContent = "Add your first name.";
        return el.name.focus();
      }
      if (!EMAIL_RE.test(email)) {
        err.textContent = "Enter a valid work email.";
        return el.email.focus();
      }
      var btn = form.querySelector("button[type=submit]");
      btn.disabled = true;
      btn.textContent = "Preparing your results…";
      remember("gv_lead", "1");
      onValid({ name: name, email: email, company: el.company.value.trim() });
    });
  }

  function bookBtn(label) {
    return '<button class="btn" data-book-modal>' + label + ' <span class="arr">→</span></button>';
  }
  function bindBook() {
    bodyEl.querySelectorAll("[data-book-modal]").forEach(function (b) {
      b.addEventListener("click", function () {
        closeModal();
        if (window.GVbook) window.GVbook();
      });
    });
  }

  /* ======================================================== ESTIMATOR */
  var EST = [
    {
      id: "type",
      q: "What are you building?",
      hint: "Pick the closest match. You can refine everything on the call.",
      opts: [
        { l: "A new SaaS product or MVP", s: "From idea or prototype to production", lo: 12000, hi: 22000, w: [6, 10] },
        { l: "A FinTech or payments platform", s: "Ledgers, wallets, payouts, trading, lending", lo: 25000, hi: 45000, w: [10, 16] },
        { l: "Rebuild or scale an existing platform", s: "Legacy code, slow, fragile or outgrown", lo: 18000, hi: 35000, w: [8, 14] },
        { l: "A new feature, integration or module", s: "Added to a product you already run", lo: 8000, hi: 15000, w: [4, 8] },
      ],
    },
    {
      id: "platforms",
      multi: true,
      q: "Which surfaces does it need?",
      hint: "Select all that apply.",
      opts: [
        { l: "Customer web app", s: "Browser-based product", f: 0 },
        { l: "Admin / operations dashboard", s: "Internal tools, reporting, back office", f: 0.15 },
        { l: "iOS & Android apps", s: "Cross-platform mobile", f: 0.4 },
        { l: "Public API for partners", s: "Documented, versioned, rate-limited", f: 0.15 },
      ],
    },
    {
      id: "integrations",
      q: "How many third-party integrations?",
      hint: "Payments, auth, banking, CRMs, ERPs, data providers…",
      opts: [
        { l: "None or one simple one", s: "e.g. email or analytics", f: 0 },
        { l: "A few standard ones", s: "e.g. Stripe, Auth0, HubSpot", f: 0.1 },
        { l: "Many, or complex ones", s: "Open banking, KYC, ERPs, market data", f: 0.25 },
      ],
    },
    {
      id: "compliance",
      q: "Any regulatory or security requirements?",
      hint: "This shapes architecture, audit trails and testing.",
      opts: [
        { l: "Standard best practice", s: "Auth, encryption, backups", f: 0 },
        { l: "GDPR / SOC 2-ready", s: "Data residency, access logs, policies", f: 0.08 },
        { l: "Financial-grade", s: "PCI-DSS, KYC/AML, FCA/ADGM-style audits", f: 0.2 },
      ],
    },
    {
      id: "timeline",
      q: "When do you need it live?",
      hint: "Faster timelines mean a larger team working in parallel.",
      opts: [
        { l: "Flexible, quality first", s: "We optimise for cost", f: -0.05, wf: 1.1 },
        { l: "Within 3–4 months", s: "Standard pace", f: 0, wf: 1 },
        { l: "ASAP", s: "Larger parallel team", f: 0.15, wf: 0.8 },
      ],
    },
  ];

  function estimator() {
    var i = 0;
    var ans = {};

    function calc() {
      var t = EST[0].opts[ans.type];
      var mult = 1;
      (ans.platforms || [0]).forEach(function (n) {
        mult += EST[1].opts[n].f;
      });
      mult += EST[2].opts[ans.integrations].f + EST[3].opts[ans.compliance].f + EST[4].opts[ans.timeline].f;
      var wf = EST[4].opts[ans.timeline].wf * (1 + (mult - 1) * 0.5);
      var lo = Math.round((t.lo * mult) / 1000) * 1000;
      var hi = Math.round((t.hi * mult) / 1000) * 1000;
      var w0 = Math.max(3, Math.round(t.w[0] * wf));
      var w1 = Math.max(w0 + 2, Math.round(t.w[1] * wf));
      var model =
        hi > 60000 || (ans.platforms || []).length > 2
          ? "Dedicated Engineering Team"
          : ans.type === 2
          ? "Discovery & Architecture Sprint, then a Fixed-Scope Build"
          : "Fixed-Scope Build";
      return { lo: lo, hi: hi, w0: w0, w1: w1, model: model };
    }

    function summary() {
      return EST.map(function (s) {
        var v = ans[s.id];
        var label = s.multi
          ? (v || []).map(function (n) {
              return s.opts[n].l;
            }).join(", ")
          : s.opts[v].l;
        return { k: s.id, q: s.q, v: label };
      });
    }

    function renderStep() {
      var s = EST[i];
      var sel = ans[s.id];
      var html =
        head("Project Cost Estimator", String(i + 1).padStart(2, "0") + " / " + EST.length, (i / EST.length) * 100) +
        '<h2 class="tool-q">' + s.q + "</h2><p class=\"tool-hint\">" + s.hint + "</p><div class=\"opts\">" +
        s.opts
          .map(function (o, n) {
            var on = s.multi ? (sel || []).indexOf(n) > -1 : sel === n;
            return (
              '<button class="opt" data-n="' + n + '" aria-pressed="' + on + '"><span>' + o.l + "<small>" + o.s + "</small></span>" +
              (s.multi ? '<span class="tick">✓</span>' : "<kbd>" + (n + 1) + "</kbd>") +
              "</button>"
            );
          })
          .join("") +
        '</div><div class="tool-nav">' +
        (i > 0 ? '<button class="tool-back" data-back>← Back</button>' : "<span></span>") +
        (s.multi ? '<button class="btn btn--sm" data-next' + ((sel || []).length ? "" : " disabled") + ">Continue →</button>" : "") +
        "</div>";
      bodyEl.innerHTML = html;

      bodyEl.querySelectorAll(".opt").forEach(function (b) {
        b.addEventListener("click", function () {
          pick(+b.dataset.n);
        });
      });
      var back = bodyEl.querySelector("[data-back]");
      if (back)
        back.addEventListener("click", function () {
          i--;
          renderStep();
        });
      var next = bodyEl.querySelector("[data-next]");
      if (next) next.addEventListener("click", advance);
      keyHandler = function (e) {
        var n = parseInt(e.key, 10);
        if (n >= 1 && n <= s.opts.length) pick(n - 1);
        else if (e.key === "Enter" && s.multi && (ans[s.id] || []).length) advance();
      };
    }

    function pick(n) {
      var s = EST[i];
      if (s.multi) {
        var cur = (ans[s.id] || []).slice();
        var at = cur.indexOf(n);
        if (at > -1) cur.splice(at, 1);
        else cur.push(n);
        ans[s.id] = cur.sort();
        renderStep();
      } else {
        ans[s.id] = n;
        setTimeout(advance, 140);
        bodyEl.querySelectorAll(".opt").forEach(function (b) {
          b.setAttribute("aria-pressed", String(+b.dataset.n === n));
        });
      }
    }

    function advance() {
      if (i < EST.length - 1) {
        i++;
        renderStep();
      } else if (remember("gv_lead") === "1" && window.GVlastLead) {
        deliver(window.GVlastLead);
      } else gate();
    }

    function gate() {
      keyHandler = null;
      bodyEl.innerHTML =
        head("Project Cost Estimator", "Last step", 100) +
        gateHTML("est", "Your estimate is ready.", "See it instantly on the next screen. We'll also email you the breakdown so you can share it with your team.", "Show my estimate");
      bindGate(deliver);
      bodyEl.querySelector("input").focus();
    }

    function deliver(lead) {
      window.GVlastLead = lead;
      var r = calc();
      var sum = summary();
      var fields = {
        name: lead.name,
        email: lead.email,
        company: lead.company,
        source: "Project Cost Estimator",
        estimate: money(r.lo) + " – " + money(r.hi),
        timeline: r.w0 + "–" + r.w1 + " weeks",
        recommended: r.model,
      };
      sum.forEach(function (s) {
        fields[s.k] = s.v;
      });
      sendLead(fields, "Estimator lead: " + lead.name + " (" + money(r.lo) + "–" + money(r.hi) + ")");
      result(r, sum);
    }

    function result(r, sum) {
      keyHandler = null;
      bodyEl.innerHTML =
        head("Project Cost Estimator", "Your estimate", 100) +
        '<p class="result-label">Ballpark investment</p>' +
        '<p class="result-big"><span class="grad">' + money(r.lo) + " – " + money(r.hi) + "</span></p>" +
        '<p class="result-sub">Typically <b>' + r.w0 + "–" + r.w1 + " weeks</b> to launch. Recommended engagement: <b>" + r.model + "</b>.</p>" +
        '<ul class="result-rows">' +
        sum
          .map(function (s) {
            return "<li><span>" + s.q.replace("?", "") + "</span><span>" + esc(s.v) + "</span></li>";
          })
          .join("") +
        "</ul>" +
        '<div class="tool-cta">' + bookBtn("Turn this into a fixed quote") + '<button class="btn btn--ghost" data-restart>Start over</button></div>' +
        '<p class="fine">A range based on comparable Glintvex projects, not a quote. After a 30-minute discovery call we send a fixed scope, timeline and price in writing.</p>';
      bindBook();
      bodyEl.querySelector("[data-restart]").addEventListener("click", function () {
        i = 0;
        ans = {};
        renderStep();
      });
    }

    openModal(renderStep);
  }

  /* ======================================================== SCORECARD */
  var SQ = [
    ["Security", "Is every API endpoint protected by server-side auth and role checks?", "Not just hidden buttons in the UI. The backend itself refuses the request.", "Authorization lives in the UI", "Move permission checks into backend guards or middleware with role-based access on every route."],
    ["Security", "Are secrets (API keys, DB passwords, Stripe keys) kept out of the codebase?", "Stored in a secrets manager or environment config, and rotated when people leave.", "Secrets exposed in code or shared docs", "Pull secrets into a secrets manager and rotate anything a past developer touched."],
    ["Security", "Has the app been checked against the OWASP Top 10 in the last 12 months?", "Injection, broken auth, insecure direct object references and friends.", "No recent security review", "Run an OWASP Top 10 pass before your next raise or enterprise deal. It's the first thing due diligence asks for."],
    ["Performance", "Do your main API endpoints respond in under ~200ms under normal load?", "The ones your dashboard or mobile app hits on every screen.", "Slow core endpoints", "Profile the slowest five endpoints, add missing indexes and remove N+1 queries. Usually the biggest win per hour spent."],
    ["Performance", "Is frequently-read data cached instead of hitting the database every time?", "Redis or similar for sessions, lookups, dashboards and feeds.", "Database takes every hit", "Add a caching layer for hot reads so traffic spikes don't land directly on the database."],
    ["Performance", "If a payment or webhook fails, are you alerted and is it retried automatically?", "Stripe/PayPal webhooks, payouts, third-party callbacks.", "Silent payment failures", "Log, alert and idempotently retry every payment webhook. Failed payments are revenue you never see leave."],
    ["Scalability", "Could you run two or more copies of your backend behind a load balancer today?", "No sessions or files stored on a single server's disk or memory.", "Backend can't scale horizontally", "Make the API stateless (sessions and uploads off the box) so you add instances instead of re-architecting."],
    ["Scalability", "Do deploys run through an automated pipeline you can roll back in minutes?", "CI/CD rather than someone SSH-ing in and pulling the latest code.", "Manual, risky deploys", "Set up CI/CD with a staging environment and one-click rollback so shipping stops being scary."],
    ["Scalability", "Would you know within 5 minutes if production went down at 3am?", "Uptime checks, error tracking and alerts that reach a human.", "No monitoring or alerting", "Add uptime monitoring, error tracking and alert routing. Find outages before your customers do."],
  ];
  var SOPTS = [
    ["Yes, confidently", 2],
    ["Partly / not sure", 1],
    ["No", 0],
  ];
  var PILLARS = ["Security", "Performance", "Scalability"];
  function colorFor(v) {
    return v >= 80 ? "#16a34a" : v >= 55 ? "#d97706" : "#e8620c";
  }
  function verdict(s) {
    if (s >= 80) return ["Built to scale.", "Your foundations are solid. The gains now are in fine-tuning before the next growth step."];
    if (s >= 55) return ["Holding, for now.", "It works today, but a few gaps will surface the moment traffic, a big client or due diligence arrives."];
    return ["At risk under growth.", "These gaps typically turn into outages, lost payments or a painful rebuild. Worth fixing before you push for growth."];
  }

  function scorecard() {
    var i = 0;
    var ans = [];

    function intro() {
      keyHandler = null;
      bodyEl.innerHTML =
        head("Scale-Readiness Scorecard", "~90 sec", 0) +
        '<h2 class="tool-q">Will your platform survive 10× the traffic?</h2>' +
        '<p class="tool-hint">Nine quick questions across Security, Performance and Scalability. You get a score, the risks most likely to break first, and the fix for each. It\'s the same checklist we run on paid platform audits.</p>' +
        '<ul class="result-rows"><li><span>Security</span><span>3 questions</span></li><li><span>Performance</span><span>3 questions</span></li><li><span>Scalability</span><span>3 questions</span></li></ul>' +
        '<button class="btn btn--block" data-start>Start the scorecard <span class="arr">→</span></button>';
      bodyEl.querySelector("[data-start]").addEventListener("click", step);
    }

    function step() {
      var q = SQ[i];
      bodyEl.innerHTML =
        head("Scale-Readiness Scorecard", String(i + 1).padStart(2, "0") + " / " + SQ.length, (i / SQ.length) * 100) +
        '<p class="result-label">' + q[0] + "</p>" +
        '<h2 class="tool-q" style="margin-top:8px">' + q[1] + "</h2><p class=\"tool-hint\">" + q[2] + '</p><div class="opts">' +
        SOPTS.map(function (o, n) {
          return '<button class="opt" data-v="' + o[1] + '" aria-pressed="' + (ans[i] === o[1]) + '"><span>' + o[0] + "</span><kbd>" + (n + 1) + "</kbd></button>";
        }).join("") +
        "</div>" +
        '<div class="tool-nav">' + (i > 0 ? '<button class="tool-back" data-back>← Previous question</button>' : "<span></span>") + "</div>";
      bodyEl.querySelectorAll(".opt").forEach(function (b) {
        b.addEventListener("click", function () {
          answer(+b.dataset.v);
        });
      });
      var back = bodyEl.querySelector("[data-back]");
      if (back)
        back.addEventListener("click", function () {
          i--;
          step();
        });
      keyHandler = function (e) {
        var n = parseInt(e.key, 10);
        if (n >= 1 && n <= 3) answer(SOPTS[n - 1][1]);
      };
    }

    function answer(v) {
      ans[i] = v;
      if (i < SQ.length - 1) {
        i++;
        step();
      } else if (remember("gv_lead") === "1" && window.GVlastLead) deliver(window.GVlastLead);
      else {
        keyHandler = null;
        bodyEl.innerHTML =
          head("Scale-Readiness Scorecard", "Last step", 100) +
          gateHTML("sc", "Your score is ready.", "See it instantly on the next screen. We'll also email you the full fix plan to share with your team.", "Show my score");
        bindGate(deliver);
        bodyEl.querySelector("input").focus();
      }
    }

    function calc() {
      var pillars = {};
      PILLARS.forEach(function (p) {
        var got = 0,
          n = 0;
        SQ.forEach(function (q, k) {
          if (q[0] === p) {
            got += ans[k];
            n++;
          }
        });
        pillars[p] = Math.round((got / (n * 2)) * 100);
      });
      var total = Math.round((ans.reduce(function (s, a) { return s + a; }, 0) / (SQ.length * 2)) * 100);
      var risks = SQ.map(function (q, k) {
        return { risk: q[3], fix: q[4], a: ans[k] };
      })
        .filter(function (r) { return r.a < 2; })
        .sort(function (a, b) { return a.a - b.a; });
      return { pillars: pillars, total: total, risks: risks };
    }

    function deliver(lead) {
      window.GVlastLead = lead;
      var r = calc();
      sendLead(
        {
          name: lead.name,
          email: lead.email,
          company: lead.company,
          source: "Scale-Readiness Scorecard",
          score: r.total + " / 100",
          security: r.pillars.Security,
          performance: r.pillars.Performance,
          scalability: r.pillars.Scalability,
          risks: r.risks.map(function (x) { return x.risk; }).join("; ") || "None",
        },
        "Scorecard lead: " + lead.name + " (" + r.total + "/100)"
      );
      result(r);
    }

    function result(r) {
      keyHandler = null;
      var v = verdict(r.total);
      var C = 2 * Math.PI * 56;
      bodyEl.innerHTML =
        head("Scale-Readiness Scorecard", "Your results", 100) +
        '<div class="gauge"><div class="gauge__num"><svg width="130" height="130" viewBox="0 0 130 130"><circle cx="65" cy="65" r="56" fill="none" stroke="rgba(15,18,24,.08)" stroke-width="10"/>' +
        '<circle class="gauge__arc" cx="65" cy="65" r="56" fill="none" stroke="' + colorFor(r.total) + '" stroke-width="10" stroke-linecap="round" stroke-dasharray="' + C + '" stroke-dashoffset="' + C + '" style="transition:stroke-dashoffset 1.4s cubic-bezier(.2,.7,.1,1)"/></svg><b>' + r.total + "</b></div>" +
        "<div><h3>" + v[0] + "</h3><p>" + v[1] + "</p></div></div>" +
        '<div class="bars">' +
        PILLARS.map(function (p) {
          return '<div class="bar"><span>' + p + '</span><div class="bar__t"><i data-w="' + Math.max(r.pillars[p], 3) + '" style="background:' + colorFor(r.pillars[p]) + '"></i></div><span>' + r.pillars[p] + "</span></div>";
        }).join("") +
        "</div>" +
        (r.risks.length
          ? '<p class="result-label" style="margin-bottom:10px">What will break first</p><ul class="risks">' +
            r.risks.slice(0, 3).map(function (x) {
              return "<li><b>" + x.risk + "</b>" + x.fix + "</li>";
            }).join("") +
            "</ul>"
          : '<p class="tool-hint">No red flags on the fundamentals. The next step is load testing and cost tuning.</p>') +
        '<div class="tool-cta">' + bookBtn("Talk through these fixes") + '<button class="btn btn--ghost" data-restart>Retake</button></div>' +
        '<p class="fine">Book a free 30-minute call and a co-founder will walk through your results and tell you honestly what needs fixing now and what can wait.</p>';
      bindBook();
      bodyEl.querySelector("[data-restart]").addEventListener("click", function () {
        ans = [];
        i = 0;
        step();
      });
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          var arc = bodyEl.querySelector(".gauge__arc");
          if (arc) arc.style.strokeDashoffset = String(C * (1 - r.total / 100));
          bodyEl.querySelectorAll(".bar__t i").forEach(function (el) {
            el.style.width = el.dataset.w + "%";
          });
        });
      });
    }

    openModal(intro);
  }

  /* ------------------------------------------------------------ triggers */
  document.addEventListener("click", function (e) {
    var t = e.target.closest("[data-open]");
    if (!t) return;
    e.preventDefault();
    var menu = document.getElementById("mobileMenu");
    if (menu && !menu.hidden && window.GVcloseMenu) window.GVcloseMenu();
    if (t.dataset.open === "estimator") estimator();
    else if (t.dataset.open === "scorecard") scorecard();
  });
  window.GVopen = function (k) {
    if (k === "estimator") estimator();
    else scorecard();
  };
})();
