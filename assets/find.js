// Find schools & programs: /find
// U.S. schools come from official College Scorecard data; schools abroad come from an
// AI web search and are clearly labeled as unverified.
(function () {
  "use strict";
  var t = function (k) { return window.GV ? window.GV.t(k) : k; };
  var lang = function () { return window.GV ? window.GV.lang() : "en"; };
  var VA_TOOL = "https://www.va.gov/education/gi-bill-comparison-tool/";
  // Opens the VA's GI Bill Comparison Tool already searching for this school.
  // Campus suffixes like "-Main Campus" are dropped so the VA's name search matches.
  function vaSearch(name) {
    var n = String(name || "").replace(/\s*-\s*Main Campus$/i, "").trim();
    if (!n) return VA_TOOL;
    return VA_TOOL + "schools-and-employers?search=name&name=" + encodeURIComponent(n);
  }

  var FIELDS = ["Accounting", "Agriculture", "Architecture", "Arts", "Automotive", "Aviation", "Biology",
    "Business", "Communications", "Computer science", "Construction", "Criminal justice", "Culinary arts",
    "Cybersecurity", "Education", "Engineering", "Finance", "Health care", "History", "Hospitality",
    "Information technology", "Languages", "Law", "Liberal arts", "Management", "Marketing", "Mathematics",
    "Nursing", "Psychology", "Public administration", "Science", "Skilled trades", "Social work", "Welding"];
  var STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","DC","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA",
    "ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR",
    "PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","PR","GU","VI","AS","MP"];
  var LEVELS = ["certificate", "associate", "bachelor", "master", "doctoral", "grad_certificate"];
  var LEVEL_NUM = { 1: "certificate", 2: "associate", 3: "bachelor", 4: "grad_certificate", 5: "master", 6: "doctoral", 7: "doctoral", 8: "grad_certificate" };

  var f = { where: "us", field: "", level: "", format: "", ownership: "", state: "", country: "" };
  var page = 0, loading = false, results = null, abroad = null;
  var tsKey = null, tsReady = false, tsToken = "";

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined && text !== null) e.textContent = text;
    return e;
  }
  function link(text, href, cls, external) {
    var a = el("a", cls, text);
    a.href = href;
    if (external) { a.target = "_blank"; a.rel = "noopener noreferrer"; }
    return a;
  }
  function safeUrl(u) {
    try { var x = new URL(u); return x.protocol === "https:" || x.protocol === "http:" ? x.href : null; } catch (e) { return null; }
  }
  function fieldLabel(v) { return window.GVLabels ? window.GVLabels.field(v) : v; }

  function select(id, items, value, onChange) {
    var s = el("select", "field-input");
    s.id = id;
    items.forEach(function (it) {
      var o = el("option", null, it[1]); o.value = it[0];
      if (it[0] === value) o.selected = true;
      s.appendChild(o);
    });
    s.addEventListener("change", function () { onChange(s.value); });
    return s;
  }
  function labeled(key, control) {
    var box = el("div", "ap-field");
    var l = el("label", "q-label", t(key)); l.htmlFor = control.id;
    box.appendChild(l); box.appendChild(control);
    return box;
  }

  function countries() {
    var out = [];
    try {
      var en = new Intl.DisplayNames(["en"], { type: "region" });
      var shown = new Intl.DisplayNames([lang()], { type: "region" });
      var A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ", seen = {};
      for (var i = 0; i < 26; i++) for (var j = 0; j < 26; j++) {
        var code = A[i] + A[j], name = en.of(code);
        if (!name || name === code || seen[name] || code === "US" || /Unknown|Outlying|Pseudo|Eurozone|United Nations|world/i.test(name)) continue;
        if (["AA","QM","QN","QO","QP","QQ","QR","QS","QT","QU","QV","QW","QX","QY","QZ","XA","XB","XK","ZZ","EU","EZ","UN"].indexOf(code) >= 0) continue;
        seen[name] = 1;
        out.push([name, shown.of(code)]);
      }
    } catch (e) {}
    return out.sort(function (a, b) { return a[1].localeCompare(b[1], lang()); });
  }

  function loadTurnstile() {
    if (tsKey !== null || tsReady) return Promise.resolve();
    return fetch("/api/config").then(function (r) { return r.ok ? r.json() : {}; }).then(function (c) {
      tsKey = c.turnstileSiteKey || "";
      if (!tsKey) return;
      return new Promise(function (resolve) {
        window.gvTurnstileLoaded = function () { tsReady = true; resolve(); };
        var s = document.createElement("script");
        s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?onload=gvTurnstileLoaded&render=explicit";
        s.async = true; s.onerror = function () { resolve(); };
        document.head.appendChild(s);
        setTimeout(resolve, 8000);
      });
    }).catch(function () { tsKey = ""; });
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
      callback: function (tok) { tsToken = tok; updateButton(); },
      "expired-callback": function () { tsToken = ""; updateButton(); },
      "error-callback": function () { tsToken = ""; updateButton(); }
    });
  }

  function canSearch() {
    if (f.where === "abroad") return Boolean(f.country) && (!tsKey || tsToken);
    return Boolean(f.field || f.level || f.format || f.ownership || f.state);
  }
  function updateButton() {
    var b = document.getElementById("find-btn");
    if (b) b.disabled = loading || !canSearch();
  }

  function form(root) {
    var card = el("div", "card ap-card");

    var whereBox = el("div", "ap-field");
    whereBox.appendChild(el("p", "q-label", t("find.where")));
    var choices = el("div", "choices");
    [["us", "find.whereUS"], ["abroad", "find.whereAbroad"]].forEach(function (c) {
      var b = el("button", "choice" + (f.where === c[0] ? " on" : ""), t(c[1]));
      b.type = "button";
      b.setAttribute("aria-pressed", String(f.where === c[0]));
      b.addEventListener("click", function () { f.where = c[0]; results = null; abroad = null; render(); });
      choices.appendChild(b);
    });
    whereBox.appendChild(choices);
    card.appendChild(whereBox);

    var any = t("find.any");
    var fieldItems = [["", any]].concat(FIELDS.map(function (v) { return [v, fieldLabel(v)]; })
      .sort(function (a, b) { return a[1].localeCompare(b[1], lang()); }));
    card.appendChild(labeled("browse.field", select("find-field", fieldItems, f.field, function (v) { f.field = v; updateButton(); })));
    card.appendChild(labeled("find.level", select("find-level", [["", any]].concat(LEVELS.map(function (l) { return [l, t("level." + l)]; })), f.level, function (v) { f.level = v; updateButton(); })));
    card.appendChild(labeled("find.format", select("find-format",
      [["", any], ["online", t("find.fmt.online")], ["in_person", t("find.fmt.in_person")], ["hybrid", t("find.fmt.hybrid")]],
      f.format, function (v) { f.format = v; updateButton(); })));

    if (f.where === "us") {
      card.appendChild(labeled("find.ownership", select("find-ownership",
        [["", any], ["public", t("own.public")], ["nonprofit", t("own.nonprofit")], ["forprofit", t("own.forprofit")]],
        f.ownership, function (v) { f.ownership = v; updateButton(); })));
      card.appendChild(labeled("ap.state", select("find-state", [["", t("find.anyState")]].concat(STATES.map(function (s) { return [s, s]; })),
        f.state, function (v) { f.state = v; updateButton(); })));
    } else {
      card.appendChild(labeled("browse.country", select("find-country", [["", t("ap.choose")]].concat(countries()),
        f.country, function (v) { f.country = v; updateButton(); })));
      card.appendChild(el("p", "q-hint", t("find.abroadHint")));
    }
    root.appendChild(card);

    if (f.where === "abroad" && !loading) mountTurnstile(root);

    var nav = el("div", "rv-nav");
    var reset = el("button", "link-btn", t("find.reset"));
    reset.type = "button";
    reset.addEventListener("click", function () {
      f = { where: f.where, field: "", level: "", format: "", ownership: "", state: "", country: "" };
      results = null; abroad = null; page = 0; render();
    });
    nav.appendChild(reset);
    var btn = el("button", "btn btn-primary", loading ? t("find.searching") : t("find.search"));
    btn.type = "button"; btn.id = "find-btn";
    btn.addEventListener("click", function () { page = 0; search(); });
    nav.appendChild(btn);
    root.appendChild(nav);
  }

  function addLink(school, program) {
    var p = new URLSearchParams();
    p.set("school", school.name);
    if (program) p.set("program", program);
    if (f.field) p.set("field", f.field);
    if (school.country) p.set("country", school.country);
    if (school.state) p.set("state", school.state);
    if (school.city) p.set("city", school.city);
    return "/add-program?" + p.toString();
  }

  function usCard(s) {
    var c = el("article", "program-card find-card");
    var main = el("div", "program-main");
    main.appendChild(el("h3", null, s.name));
    main.appendChild(el("p", "program-where", [[s.city, s.state].filter(Boolean).join(", "), s.ownership ? t("own." + s.ownership) : null].filter(Boolean).join(" · ")));

    if (s.programs && s.programs.length) {
      var ul = el("ul", "review-facts");
      s.programs.forEach(function (p) {
        var lvl = p.level && LEVEL_NUM[p.level] ? t("level." + LEVEL_NUM[p.level]) : (p.credential || "");
        var li = el("li");
        if (p.code && p.level && s.id) {
          li.appendChild(link(p.title + (lvl ? " — " + lvl : ""), "/review?" + new URLSearchParams({ school: String(s.id), cip: p.code, level: String(p.level) }).toString(), "program-link"));
        } else li.textContent = p.title + (lvl ? " — " + lvl : "");
        ul.appendChild(li);
      });
      main.appendChild(ul);
    }
    var facts = [];
    if (s.completionRate !== null && s.completionRate !== undefined) facts.push(t("find.completion") + ": " + s.completionRate + "%");
    if (s.avgNetPrice) facts.push(t("find.netPrice") + ": $" + s.avgNetPrice.toLocaleString("en-US"));
    if (facts.length) main.appendChild(el("p", "muted small", facts.join(" · ")));

    var actions = el("div", "find-actions");
    if (s.givouch && s.givouch.length) {
      s.givouch.slice(0, 3).forEach(function (g) {
        actions.appendChild(link(g.program + " — " + g.reviews + " " + t(g.reviews === 1 ? "browse.review" : "browse.reviews"), "/program?id=" + g.id, "btn btn-primary btn-sm"));
      });
    }
    actions.appendChild(link(t("find.checkVA") + " ↗", vaSearch(s.name), "btn btn-outline btn-sm", true));
    var site = safeUrl(s.url);
    if (site) actions.appendChild(link(t("find.website") + " ↗", site, "btn btn-outline btn-sm", true));
    main.appendChild(actions);
    c.appendChild(main);
    return c;
  }

  function abroadCard(s) {
    var c = el("article", "program-card find-card");
    var main = el("div", "program-main");
    var head = el("div", "review-head");
    head.appendChild(el("h3", null, s.name));
    head.appendChild(el("span", "tag tag-warn", t("find.unverified")));
    main.appendChild(head);
    main.appendChild(el("p", "program-where", [s.program, [s.city, window.GVLabels ? window.GVLabels.country(s.country) : s.country].filter(Boolean).join(", ")].filter(Boolean).join(" · ")));
    if (s.note) main.appendChild(el("p", "muted small", s.note));
    var actions = el("div", "find-actions");
    actions.appendChild(link("+ " + t("find.addToGivouch"), addLink(s, s.program), "btn btn-outline btn-sm"));
    actions.appendChild(link(t("find.checkVA") + " ↗", vaSearch(s.name), "btn btn-outline btn-sm", true));
    var site = s.url && safeUrl(s.url);
    if (site) actions.appendChild(link(t("find.website") + " ↗", site, "btn btn-outline btn-sm", true));
    var src = s.source && safeUrl(s.source);
    if (src && src !== site) actions.appendChild(link(t("find.source") + " ↗", src, "btn btn-outline btn-sm", true));
    main.appendChild(actions);
    c.appendChild(main);
    return c;
  }

  function resultsView(root) {
    if (loading && f.where === "abroad") { root.appendChild(el("p", "notice", t("find.abroadWait"))); return; }
    if (results) {
      root.appendChild(el("p", "notice", t("find.usSource") + (f.format === "online" || f.format === "hybrid" ? " " + t("find.fmtHint") : "")));
      root.appendChild(el("h2", "section-label", results.total + " " + t("find.schools")));
      if (!results.schools.length) root.appendChild(el("p", "notice", t("find.none")));
      results.schools.forEach(function (s) { root.appendChild(usCard(s)); });
      var pages = Math.ceil(results.total / results.perPage);
      if (pages > 1) {
        var nav = el("div", "rv-nav");
        var prev = el("button", "btn btn-outline", "‹ " + t("rv.back")); prev.type = "button";
        prev.style.visibility = page > 0 ? "visible" : "hidden";
        prev.addEventListener("click", function () { page--; search(); });
        var next = el("button", "btn btn-outline", t("rv.next") + " ›"); next.type = "button";
        next.style.visibility = page < pages - 1 && page < 50 ? "visible" : "hidden";
        next.addEventListener("click", function () { page++; search(); });
        nav.appendChild(prev); nav.appendChild(el("span", "muted small", (page + 1) + " / " + pages)); nav.appendChild(next);
        root.appendChild(nav);
      }
    }
    if (abroad) {
      root.appendChild(el("p", "notice notice-warn", t("find.abroadWarning")));
      if (!abroad.schools.length) root.appendChild(el("p", "notice", t("find.none")));
      abroad.schools.forEach(function (s) { root.appendChild(abroadCard(s)); });
      if (abroad.sources && abroad.sources.length) {
        var src = el("div", "find-sources");
        src.appendChild(el("p", "q-label", t("find.sources")));
        var ul = el("ul", "review-facts");
        abroad.sources.forEach(function (s) {
          var u = safeUrl(s.url); if (!u) return;
          var li = el("li"); li.appendChild(link(s.title || u, u, null, true)); ul.appendChild(li);
        });
        src.appendChild(ul);
        root.appendChild(src);
      }
    }
  }

  function render() {
    var root = document.getElementById("find");
    var focused = document.activeElement && document.activeElement.id;
    root.innerHTML = "";
    root.appendChild(el("h1", "rv-title", t("find.title")));
    root.appendChild(el("p", "muted", t("find.intro")));
    form(root);
    var err = el("p", "form-error"); err.id = "find-error"; err.hidden = true; root.appendChild(err);
    var out = el("div", "find-results"); out.id = "find-results";
    resultsView(out);
    root.appendChild(out);
    updateButton();
    if (focused) { var x = document.getElementById(focused); if (x) x.focus(); }
  }

  function showError(key) {
    var e = document.getElementById("find-error");
    if (e) { e.textContent = t(key); e.hidden = false; }
  }

  function search() {
    if (loading || !canSearch()) return;
    loading = true; results = null; abroad = null; render();
    var req;
    if (f.where === "us") {
      var p = new URLSearchParams();
      ["field", "level", "format", "ownership", "state"].forEach(function (k) { if (f[k]) p.set(k, f[k]); });
      p.set("page", String(page));
      req = fetch("/api/find?" + p.toString());
    } else {
      req = fetch("/api/find-abroad", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ country: f.country, field: f.field, level: f.level, format: f.format, lang: lang(), turnstileToken: tsToken }) });
    }
    req.then(function (r) { return r.json().then(function (d) { return { status: r.status, d: d }; }); })
      .then(function (res) {
        loading = false;
        if (res.status === 200) {
          if (f.where === "us") results = res.d; else abroad = res.d;
          render();
          var out = document.getElementById("find-results");
          if (out) out.scrollIntoView({ behavior: "smooth", block: "start" });
          return;
        }
        render();
        if (res.d && res.d.error === "turnstile") return showError("rv.err.turnstile");
        if (res.status === 429) return showError("find.err.busy");
        showError("find.err.generic");
      })
      .catch(function () { loading = false; render(); showError("find.err.generic"); });
  }

  document.addEventListener("DOMContentLoaded", function () {
    loadTurnstile().then(render);
    document.addEventListener("gv:lang", render);
  });
})();
