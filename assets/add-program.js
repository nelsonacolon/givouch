// Add a program: /add-program — a visitor suggests a school/program that isn't listed yet.
(function () {
  "use strict";
  var t = function (k) { return window.GV ? window.GV.t(k) : k; };
  var lang = function () { return window.GV ? window.GV.lang() : "en"; };

  var FIELDS = ["Accounting", "Agriculture", "Architecture", "Arts", "Automotive", "Aviation", "Biology",
    "Business", "Communications", "Computer science", "Construction", "Criminal justice", "Culinary arts",
    "Cybersecurity", "Education", "Engineering", "Finance", "Health care", "History", "Hospitality",
    "Information technology", "Languages", "Law", "Liberal arts", "Management", "Marketing", "Mathematics",
    "Nursing", "Psychology", "Public administration", "Science", "Skilled trades", "Social work", "Welding", "Other"];
  var STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","DC","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA",
    "ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR",
    "PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","PR","GU","VI","AS","MP"];

  var f = { school: "", programName: "", schoolType: "", format: "", field: "", country: "United States",
            state: "", city: "", vaUrl: "", website: "" };
  var sending = false, done = false;
  var tsKey = null, tsReady = false, tsToken = "";

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined && text !== null) e.textContent = text;
    return e;
  }

  // Country list built from the browser's region names, stored in English, shown in the chosen language.
  function countries() {
    var out = [];
    try {
      var en = new Intl.DisplayNames(["en"], { type: "region" });
      var shown = new Intl.DisplayNames([lang()], { type: "region" });
      var A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ", seen = {};
      for (var i = 0; i < 26; i++) for (var j = 0; j < 26; j++) {
        var code = A[i] + A[j], name = en.of(code);
        if (!name || name === code || seen[name] || /Unknown|Outlying|Pseudo|^EU$|Eurozone|United Nations|world/i.test(name)) continue;
        if (["AA","QM","QN","QO","QP","QQ","QR","QS","QT","QU","QV","QW","QX","QY","QZ","XA","XB","XK","ZZ","EU","EZ","UN"].indexOf(code) >= 0) continue;
        seen[name] = 1;
        out.push({ value: name, text: shown.of(code) });
      }
    } catch (e) { out = [{ value: "United States", text: "United States" }]; }
    return out.sort(function (a, b) { return a.text.localeCompare(b.text, lang()); });
  }

  function valid() {
    var isUS = f.country === "United States";
    return f.school.trim().length >= 2 && f.programName.trim().length >= 2 && f.schoolType && f.format && f.field &&
      f.country && !(isUS && f.format === "abroad") && !(isUS && f.format !== "online" && !f.state) &&
      (!f.vaUrl.trim() || /^https:\/\/\S+\.\S+/.test(f.vaUrl.trim())) && (!tsKey || tsToken);
  }

  function update() {
    var b = document.getElementById("ap-submit");
    if (b) b.disabled = !valid() || sending;
  }

  function field(labelKey, control, hintKey) {
    var box = el("div", "ap-field");
    var l = el("label", "q-label", t(labelKey));
    l.htmlFor = control.id;
    box.appendChild(l);
    box.appendChild(control);
    if (hintKey) box.appendChild(el("p", "q-hint", t(hintKey)));
    return box;
  }

  function textInput(key, max, ph) {
    var i = el("input", "field-input");
    i.type = key === "vaUrl" ? "url" : "text";
    i.id = "ap-" + key; i.maxLength = max; i.value = f[key];
    if (ph) i.placeholder = ph;
    i.addEventListener("input", function () { f[key] = i.value; update(); });
    return i;
  }

  function select(key, items, onChange) {
    var s = el("select", "field-input");
    s.id = "ap-" + key;
    var blank = el("option", null, t("ap.choose")); blank.value = ""; s.appendChild(blank);
    items.forEach(function (it) {
      var o = el("option", null, it.text); o.value = it.value;
      if (it.value === f[key]) o.selected = true;
      s.appendChild(o);
    });
    s.addEventListener("change", function () { f[key] = s.value; if (onChange) onChange(); update(); });
    return s;
  }

  function choices(key, list) {
    var wrap = el("div", "choices");
    wrap.id = "ap-" + key;
    wrap.setAttribute("role", "radiogroup");
    list.forEach(function (c) {
      var b = el("button", "choice" + (f[key] === c[0] ? " on" : ""), t(c[1]));
      b.type = "button";
      b.setAttribute("role", "radio");
      b.setAttribute("aria-checked", String(f[key] === c[0]));
      b.addEventListener("click", function () { f[key] = c[0]; render(); });
      wrap.appendChild(b);
    });
    return wrap;
  }

  function loadTurnstile() {
    return fetch("/api/config").then(function (r) { return r.ok ? r.json() : {}; }).then(function (c) {
      tsKey = c.turnstileSiteKey || null;
      if (!tsKey) return;
      return new Promise(function (resolve) {
        window.gvTurnstileLoaded = function () { tsReady = true; resolve(); };
        var s = document.createElement("script");
        s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?onload=gvTurnstileLoaded&render=explicit";
        s.async = true; s.onerror = function () { resolve(); };
        document.head.appendChild(s);
        setTimeout(resolve, 8000);
      });
    }).catch(function () {});
  }

  function mountTurnstile(root) {
    if (!tsKey) return;
    var box = el("div", "ts-box");
    root.appendChild(box);
    tsToken = "";
    if (!tsReady || !window.turnstile) { box.appendChild(el("p", "muted small", t("rv.tsLoading"))); return; }
    window.turnstile.render(box, {
      sitekey: tsKey, language: lang(),
      theme: document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light",
      callback: function (tok) { tsToken = tok; update(); },
      "expired-callback": function () { tsToken = ""; update(); },
      "error-callback": function () { tsToken = ""; update(); }
    });
  }

  function render() {
    if (done) return;
    var root = document.getElementById("add-program");
    var focused = document.activeElement && document.activeElement.id;
    root.innerHTML = "";
    var back = el("a", "back-link", "‹ " + t("prog.back"));
    back.href = "/browse";
    root.appendChild(back);
    root.appendChild(el("h1", "rv-title", t("ap.title")));
    root.appendChild(el("p", "muted", t("ap.intro")));

    var card = el("div", "card ap-card");
    card.appendChild(field("ap.school", textInput("school", 120, t("ap.ph.school"))));
    card.appendChild(field("ap.programName", textInput("programName", 120, t("ap.ph.programName"))));

    var typeBox = el("div", "ap-field");
    typeBox.appendChild(el("p", "q-label", t("ap.schoolType")));
    typeBox.appendChild(choices("schoolType", [["college", "type.college"], ["trade", "type.trade"], ["flight", "type.flight"]]));
    card.appendChild(typeBox);

    var fieldItems = FIELDS.map(function (v) {
      return { value: v, text: v === "Other" ? t("ap.other") : (window.GVLabels ? window.GVLabels.field(v) : v) };
    }).sort(function (a, b) { return a.value === "Other" ? 1 : b.value === "Other" ? -1 : a.text.localeCompare(b.text, lang()); });
    card.appendChild(field("browse.field", select("field", fieldItems)));

    var fmtBox = el("div", "ap-field");
    fmtBox.appendChild(el("p", "q-label", t("browse.format")));
    fmtBox.appendChild(choices("format", [["online", "fmt.online"], ["in_person", "fmt.in_person"], ["abroad", "fmt.abroad"]]));
    fmtBox.appendChild(el("p", "q-hint", t("ap.hint.format")));
    card.appendChild(fmtBox);

    card.appendChild(field("browse.country", select("country", countries(), function () {
      if (f.country !== "United States") f.state = "";
      if (f.country !== "United States" && f.format === "in_person") f.format = "abroad";
      if (f.country === "United States" && f.format === "abroad") f.format = "in_person";
      render();
    })));
    if (f.country === "United States") {
      card.appendChild(field(f.format === "online" ? "ap.stateOptional" : "ap.state",
        select("state", STATES.map(function (s) { return { value: s, text: s }; }))));
    }
    card.appendChild(field("ap.city", textInput("city", 80)));
    card.appendChild(field("ap.vaUrl", textInput("vaUrl", 300, "https://www.va.gov/education/gi-bill-comparison-tool/..."), "ap.hint.vaUrl"));
    root.appendChild(card);

    var hp = el("input"); hp.type = "text"; hp.name = "website"; hp.tabIndex = -1; hp.autocomplete = "off";
    hp.className = "hp"; hp.setAttribute("aria-hidden", "true");
    hp.addEventListener("input", function () { f.website = hp.value; });
    root.appendChild(hp);

    if (!sending) mountTurnstile(root);
    var err = el("p", "form-error"); err.id = "ap-error"; err.hidden = true; root.appendChild(err);

    var nav = el("div", "rv-nav");
    nav.appendChild(el("span"));
    var submit = el("button", "btn btn-primary", sending ? t("rv.sending") : t("ap.submit"));
    submit.type = "button"; submit.id = "ap-submit";
    submit.addEventListener("click", send);
    nav.appendChild(submit);
    root.appendChild(nav);
    root.appendChild(el("p", "muted small", t("ap.reviewNote")));
    update();
    if (focused) { var x = document.getElementById(focused); if (x) x.focus(); }
  }

  function showError(key, link) {
    var e = document.getElementById("ap-error");
    if (!e) return;
    e.textContent = t(key) + " ";
    if (link) { var a = el("a", null, t("ap.seeIt")); a.href = link; e.appendChild(a); }
    e.hidden = false;
  }

  function send() {
    if (sending || !valid()) return;
    sending = true; render();
    var body = { school: f.school, programName: f.programName, schoolType: f.schoolType, format: f.format,
      field: f.field, country: f.country, state: f.state, city: f.city, vaUrl: f.vaUrl.trim(),
      website: f.website, turnstileToken: tsToken };
    fetch("/api/programs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().then(function (d) { return { status: r.status, d: d }; }); })
      .then(function (res) {
        sending = false;
        if (res.status === 201) return finish();
        render();
        if (res.status === 409) return showError("ap.err.duplicate", res.d.id ? "/program?id=" + res.d.id : null);
        if (res.d && res.d.fields && res.d.fields.indexOf("turnstile") >= 0) return showError("rv.err.turnstile");
        if (res.status === 400) return showError("ap.err.invalid");
        showError("rv.err.generic");
      })
      .catch(function () { sending = false; render(); showError("rv.err.generic"); });
  }

  function finish() {
    done = true;
    var root = document.getElementById("add-program");
    root.innerHTML = "";
    var box = el("div", "card thanks");
    box.appendChild(el("h1", null, t("ap.thanks")));
    box.appendChild(el("p", null, t("ap.thanksBody")));
    var a = el("a", "btn btn-primary", t("browse.title"));
    a.href = "/browse";
    box.appendChild(a);
    root.appendChild(box);
    window.scrollTo(0, 0);
  }

  document.addEventListener("DOMContentLoaded", function () {
    loadTurnstile().then(render);
    document.addEventListener("gv:lang", render);
  });
})();
