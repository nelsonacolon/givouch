// Review form: /review?program=123 — a short step-by-step form (wireframe page 7).
(function () {
  "use strict";
  var t = function (k) { return window.GV ? window.GV.t(k) : k; };
  var programId = parseInt(new URLSearchParams(location.search).get("program"), 10);
  var program = null;
  var step = 0;
  var sending = false;
  var a = { overall: 0, recommend: null, paperwork: 0, paidOnTime: "", credits: "", worth: 0,
            job: "", startYear: "", reviewer: "", benefit: "", comment: "", displayName: "",
            email: "", attest: false, website: "" };

  // Each step holds one or two questions. "required" lists what must be answered to continue.
  var STEPS = [
    { qs: ["overall", "recommend"], required: ["overall", "recommend"] },
    { qs: ["paperwork", "paidOnTime"], required: ["paperwork", "paidOnTime"] },
    { qs: ["credits", "worth"], required: ["credits", "worth"] },
    { qs: ["job", "startYear"], required: ["job"] },
    { qs: ["reviewer", "benefit"], required: ["reviewer", "benefit"] },
    { qs: ["comment", "displayName"], required: [] },
    { qs: ["email", "attest"], required: ["email", "attest"] }
  ];

  var CHOICES = {
    recommend: [[true, "rv.yes"], [false, "rv.no"]],
    paidOnTime: [["always", "paid.always"], ["usually", "paid.usually"], ["rarely", "paid.rarely"], ["not_applicable", "paid.not_applicable"]],
    credits: [["yes", "credits.yes"], ["partly", "credits.partly"], ["no", "credits.no"], ["not_applicable", "credits.not_applicable"]],
    job: [["field", "job.field"], ["other_field", "job.other_field"], ["studying", "job.studying"], ["looking", "job.looking"], ["not_looking", "job.not_looking"]],
    reviewer: [["veteran", "who.veteran"], ["service_member", "who.service_member"], ["spouse", "who.spouse"], ["child", "who.child"]],
    benefit: [["post911", "benefit.post911"], ["montgomery", "benefit.montgomery"], ["vre", "benefit.vre"], ["dea", "benefit.dea"], ["other", "benefit.other"]]
  };

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined && text !== null) e.textContent = text;
    return e;
  }

  function answered(key) {
    var v = a[key];
    if (key === "recommend") return v === true || v === false;
    if (key === "attest") return v === true;
    if (key === "email") return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
    return v !== "" && v !== 0 && v !== null;
  }

  function stars(key) {
    var wrap = el("div", "stars");
    wrap.setAttribute("role", "radiogroup");
    for (var i = 1; i <= 5; i++) (function (n) {
      var s = el("button", "star" + (a[key] >= n ? " on" : ""), a[key] >= n ? "★" : "☆");
      s.type = "button";
      s.setAttribute("role", "radio");
      s.setAttribute("aria-checked", String(a[key] === n));
      s.setAttribute("aria-label", n + " / 5");
      s.addEventListener("click", function () { a[key] = n; render(); });
      wrap.appendChild(s);
    })(i);
    return wrap;
  }

  function choices(key) {
    var wrap = el("div", "choices");
    wrap.setAttribute("role", "radiogroup");
    CHOICES[key].forEach(function (c) {
      var b = el("button", "choice" + (a[key] === c[0] ? " on" : ""), t(c[1]));
      b.type = "button";
      b.setAttribute("role", "radio");
      b.setAttribute("aria-checked", String(a[key] === c[0]));
      b.addEventListener("click", function () { a[key] = c[0]; render(); });
      wrap.appendChild(b);
    });
    return wrap;
  }

  function input(key, type, max) {
    var i = el(type === "textarea" ? "textarea" : "input", "field-input");
    if (type !== "textarea") i.type = type;
    if (max) i.maxLength = max;
    i.value = a[key];
    i.id = "f-" + key;
    i.addEventListener("input", function () { a[key] = i.value; updateNext(); });
    return i;
  }

  function question(key) {
    var box = el("div", "question card");
    var label = el("label", "q-label", t("rv.q." + key));
    box.appendChild(label);
    if (["overall", "paperwork", "worth"].indexOf(key) >= 0) box.appendChild(stars(key));
    else if (CHOICES[key]) box.appendChild(choices(key));
    else if (key === "startYear") {
      var y = input("startYear", "number");
      y.min = 1944; y.max = new Date().getFullYear(); y.placeholder = "2022"; y.inputMode = "numeric";
      label.htmlFor = y.id; box.appendChild(y);
    } else if (key === "comment") {
      var c = input("comment", "textarea", 2000);
      c.rows = 5; c.placeholder = t("rv.ph.comment");
      label.htmlFor = c.id; box.appendChild(c);
    } else if (key === "displayName") {
      var d = input("displayName", "text", 40);
      d.placeholder = t("rv.ph.displayName");
      label.htmlFor = d.id; box.appendChild(d);
    } else if (key === "email") {
      var e = input("email", "email", 254);
      e.autocomplete = "email"; e.placeholder = "name@example.com";
      label.htmlFor = e.id; box.appendChild(e);
    } else if (key === "attest") {
      box.innerHTML = "";
      var lab = el("label", "attest");
      var cb = el("input");
      cb.type = "checkbox"; cb.checked = a.attest;
      cb.addEventListener("change", function () { a.attest = cb.checked; updateNext(); });
      lab.appendChild(cb);
      lab.appendChild(el("span", null, t("rv.q.attest")));
      box.appendChild(lab);
    }
    var hint = t("rv.hint." + key);
    if (hint && hint !== "rv.hint." + key) box.appendChild(el("p", "q-hint", hint));
    return box;
  }

  function updateNext() {
    var next = document.getElementById("rv-next");
    if (!next) return;
    var ok = STEPS[step].required.every(answered);
    next.disabled = !ok || sending;
  }

  function render() {
    var root = document.getElementById("review");
    var focused = document.activeElement && document.activeElement.id;
    root.innerHTML = "";

    var top = el("div", "rv-top");
    top.appendChild(el("p", "muted rv-count", t("rv.step") + " " + (step + 1) + " " + t("rv.of") + " " + STEPS.length));
    var cancel = el("a", "link-btn", t("rv.cancel"));
    cancel.href = "/program?id=" + programId;
    top.appendChild(cancel);
    root.appendChild(top);
    var bar = el("div", "progress"); var fill = el("div", "progress-fill");
    fill.style.width = Math.round(((step + 1) / STEPS.length) * 100) + "%";
    bar.appendChild(fill); root.appendChild(bar);

    root.appendChild(el("h1", "rv-title", t("rv.title") + " " + program.program_name));
    root.appendChild(el("p", "program-where", [program.school, [program.city, program.state,
      window.GVLabels ? window.GVLabels.country(program.country) : program.country].filter(Boolean).join(", ")].filter(Boolean).join(" · ")));

    STEPS[step].qs.forEach(function (k) { root.appendChild(question(k)); });

    // Honeypot field, hidden from people.
    var hp = el("input"); hp.type = "text"; hp.name = "website"; hp.tabIndex = -1; hp.autocomplete = "off";
    hp.className = "hp"; hp.setAttribute("aria-hidden", "true");
    hp.addEventListener("input", function () { a.website = hp.value; });
    root.appendChild(hp);

    var err = el("p", "form-error"); err.id = "rv-error"; err.hidden = true; root.appendChild(err);

    var nav = el("div", "rv-nav");
    var back = el("button", "btn btn-outline", t("rv.back"));
    back.type = "button";
    back.style.visibility = step === 0 ? "hidden" : "visible";
    back.addEventListener("click", function () { step--; render(); window.scrollTo(0, 0); });
    nav.appendChild(back);
    var last = step === STEPS.length - 1;
    var next = el("button", "btn btn-primary", last ? (sending ? t("rv.sending") : t("rv.submit")) : t("rv.next"));
    next.type = "button"; next.id = "rv-next";
    next.addEventListener("click", function () {
      if (last) return submit();
      step++; render(); window.scrollTo(0, 0);
    });
    nav.appendChild(next);
    root.appendChild(nav);
    if (last) root.appendChild(el("p", "muted small", t("rv.privacyNote")));
    updateNext();
    if (focused) { var f = document.getElementById(focused); if (f) f.focus(); }
  }

  function showError(key) {
    var e = document.getElementById("rv-error");
    if (!e) return;
    e.textContent = t(key);
    e.hidden = false;
  }

  function submit() {
    if (sending) return;
    sending = true; render();
    var body = {
      programId: programId, overall: a.overall, recommend: a.recommend, paperwork: a.paperwork,
      paidOnTime: a.paidOnTime, credits: a.credits, worth: a.worth, job: a.job,
      startYear: a.startYear === "" ? null : a.startYear, reviewer: a.reviewer, benefit: a.benefit,
      comment: a.comment, displayName: a.displayName, email: a.email.trim(), attest: a.attest, website: a.website
    };
    fetch("/api/reviews", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().then(function (d) { return { status: r.status, d: d }; }); })
      .then(function (res) {
        sending = false;
        if (res.status === 201) return done();
        render();
        if (res.status === 409) return showError("rv.err.duplicate");
        if (res.status === 400) return showError("rv.err.invalid");
        showError("rv.err.generic");
      })
      .catch(function () { sending = false; render(); showError("rv.err.generic"); });
  }

  function done() {
    var root = document.getElementById("review");
    root.innerHTML = "";
    var box = el("div", "card thanks");
    box.appendChild(el("h1", null, t("rv.thanks")));
    box.appendChild(el("p", null, t("rv.thanksBody")));
    var back = el("a", "btn btn-primary", t("rv.backToProgram"));
    back.href = "/program?id=" + programId;
    box.appendChild(back);
    root.appendChild(box);
    window.scrollTo(0, 0);
  }

  function fail(key) {
    var root = document.getElementById("review");
    root.innerHTML = "";
    var link = el("a", "back-link", "‹ " + t("prog.back"));
    link.href = "/browse";
    root.appendChild(link);
    root.appendChild(el("p", "notice", t(key)));
  }

  document.addEventListener("DOMContentLoaded", function () {
    if (!programId || programId <= 0) return fail("prog.notFound");
    fetch("/api/program?id=" + programId)
      .then(function (r) { if (r.status === 404) throw new Error("404"); if (!r.ok) throw new Error("x"); return r.json(); })
      .then(function (d) { program = d.program; render(); })
      .catch(function (e) { fail(e.message === "404" ? "prog.notFound" : "browse.error"); });
    document.addEventListener("gv:lang", function () {
      if (program && document.querySelector(".rv-nav")) render();
    });
  });
})();
