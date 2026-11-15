// Browse programs page: reads filters from the URL, calls /api/programs, renders results.
(function () {
  "use strict";
  var t = function (k) { return window.GV ? window.GV.t(k) : k; };
  var L = window.GVLists;
  var FORMATS = ["online", "in_person", "hybrid"];
  var OWNERSHIP = ["public", "nonprofit", "forprofit"];
  // The same filters as the Find page. Field and state apply to programs on GIVouch and to
  // schools from official data; degree level and type of school apply to official data only.
  function blank(q) {
    return { q: q || "", where: "us", field: "", level: "", format: "", ownership: "", usState: "", country: "", sort: "reviewed" };
  }
  var state = blank();
  var last = null;
  var VA_TOOL = "https://www.va.gov/education/gi-bill-comparison-tool/";
  function vaSearch(name) {
    var n = String(name || "").replace(/\s*-\s*Main Campus$/i, "").trim();
    return n ? VA_TOOL + "schools-and-employers?search=name&name=" + encodeURIComponent(n) : VA_TOOL;
  }
  // Opens the school's own page in the VA's GI Bill Comparison Tool (via /api/va, which finds
  // its VA facility code), or the tool's name search if it can't be found.
  function vaLink(s) {
    var p = new URLSearchParams();
    if (s.id) p.set("id", String(s.id));
    p.set("name", s.name || s.school || "");
    if (s.state) p.set("state", s.state);
    return "/api/va?" + p.toString();
  }
  function safeUrl(u) {
    try { var x = new URL(u); return x.protocol === "https:" || x.protocol === "http:" ? x.href : null; } catch (e) { return null; }
  }
  function link(text, href, cls, external) {
    var a = el("a", cls, text);
    a.href = href;
    if (external) { a.target = "_blank"; a.rel = "noopener noreferrer"; }
    return a;
  }
  var official = null; // official-data matches for the current search
  var va = null, vaPending = false, vaPage = 0; // schools from the VA's list that the Scorecard doesn't have
  var VA_PER_PAGE = 10;
  var officialTotal = 0;
  var officialPage = 0, officialPerPage = 10;
  var officialPending = false;
  var LEVEL_NUM = { 1: "certificate", 2: "associate", 3: "bachelor", 4: "grad_certificate", 5: "master", 6: "doctoral", 7: "doctoral", 8: "grad_certificate" };
  var LEVEL_ORDER = ["certificate", "associate", "bachelor", "grad_certificate", "master", "doctoral"];
  function reviewLink(s, p) {
    return "/review?" + new URLSearchParams({ school: String(s.id), cip: p.code, level: String(p.level) }).toString();
  }
  // Every program the school offers, grouped by degree level; each one opens the review form.
  function programList(s) {
    var box = el("details", "official-programs");
    var sum = el("summary", null, t("browse.programsOffered").replace("{n}", s.programs.length));
    box.appendChild(sum);
    var groups = {};
    s.programs.forEach(function (p) {
      var k = LEVEL_NUM[p.level] || "other";
      (groups[k] = groups[k] || []).push(p);
    });
    LEVEL_ORDER.concat(["other"]).forEach(function (k) {
      if (!groups[k]) return;
      box.appendChild(el("h4", "level-head", k === "other" ? t("browse.otherLevel") : t("level." + k)));
      var ul = el("ul", "program-links");
      groups[k].forEach(function (p) {
        var li = el("li");
        li.appendChild(link(p.title, reviewLink(s, p), "program-link"));
        ul.appendChild(li);
      });
      box.appendChild(ul);
    });
    return box;
  }

  function countryLabel(n) { return window.GVLabels ? window.GVLabels.country(n) : n; }
  function fieldLabel(n) { return window.GVLabels ? window.GVLabels.field(n) : n; }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text; // textContent keeps user data from running as HTML
    return e;
  }

  function readUrl() {
    var p = new URLSearchParams(location.search);
    state = blank((p.get("q") || "").slice(0, 100));
    var fmt = p.get("format") || "";
    state.where = p.get("where") === "abroad" || fmt === "abroad" ? "abroad" : "us";
    state.format = FORMATS.indexOf(fmt) >= 0 ? fmt : "";
    state.field = L.FIELDS.indexOf(p.get("field")) >= 0 ? p.get("field") : "";
    state.level = L.LEVELS.indexOf(p.get("level")) >= 0 ? p.get("level") : "";
    state.ownership = OWNERSHIP.indexOf(p.get("type")) >= 0 ? p.get("type") : "";
    state.usState = L.STATES.indexOf(p.get("state")) >= 0 ? p.get("state") : "";
    state.country = state.where === "abroad" ? (p.get("country") || "").slice(0, 60) : "";
    state.sort = p.get("sort") === "rating" ? "rating" : "reviewed";
  }

  function writeUrl() {
    var p = new URLSearchParams();
    if (state.q) p.set("q", state.q);
    if (state.where === "abroad") p.set("where", "abroad");
    if (state.field) p.set("field", state.field);
    if (state.level) p.set("level", state.level);
    if (state.format) p.set("format", state.format);
    if (state.where === "us" && state.ownership) p.set("type", state.ownership);
    if (state.where === "us" && state.usState) p.set("state", state.usState);
    if (state.where === "abroad" && state.country) p.set("country", state.country);
    if (state.sort !== "reviewed") p.set("sort", state.sort);
    var qs = p.toString();
    history.replaceState(null, "", "/browse" + (qs ? "?" + qs : ""));
  }

  function query(offset) {
    var p = new URLSearchParams();
    if (state.q) p.set("q", state.q);
    p.set("where", state.where);
    if (state.format === "online" || state.format === "in_person") p.set("format", state.format);
    if (state.field) p.set("field", state.field);
    if (state.where === "us" && state.usState) p.set("state", state.usState);
    if (state.where === "abroad" && state.country) p.set("country", state.country);
    p.set("sort", state.sort);
    p.set("offset", String(offset));
    return "/api/programs?" + p.toString();
  }

  function select(id, items, value, onChange) {
    var sel = el("select");
    sel.id = id;
    items.forEach(function (it) {
      var o = el("option", null, it[1]); o.value = it[0];
      if (it[0] === value) o.selected = true;
      sel.appendChild(o);
    });
    sel.addEventListener("change", function () { onChange(sel.value); });
    return sel;
  }
  function labeled(key, control) {
    var l = el("label", "select-label");
    l.appendChild(el("span", null, t(key)));
    l.appendChild(control);
    return l;
  }

  // The filter pane: same choices as the Find page.
  function renderFilters() {
    var box = document.getElementById("filter-body");
    if (!box) return;
    box.innerHTML = "";
    var lang = window.GV ? window.GV.lang() : "en";
    var any = t("find.any");

    var whereBox = el("div", "filter-where");
    whereBox.appendChild(el("span", "filter-label", t("find.where")));
    var choices = el("div", "choices");
    [["us", "find.whereUS"], ["abroad", "find.whereAbroad"]].forEach(function (c) {
      var b = el("button", "choice" + (state.where === c[0] ? " on" : ""), t(c[1]));
      b.type = "button";
      b.setAttribute("aria-pressed", String(state.where === c[0]));
      b.addEventListener("click", function () {
        if (state.where === c[0]) return;
        state.where = c[0]; state.usState = ""; state.ownership = ""; state.country = "";
        renderFilters(); refresh();
      });
      choices.appendChild(b);
    });
    whereBox.appendChild(choices);
    box.appendChild(whereBox);

    var fields = [["", any]].concat(L.FIELDS.map(function (v) { return [v, fieldLabel(v)]; })
      .sort(function (a, b) { return a[1].localeCompare(b[1], lang); }));
    box.appendChild(labeled("browse.field", select("f-field", fields, state.field, function (v) { state.field = v; refresh(); })));
    box.appendChild(labeled("find.level", select("f-level", [["", any]].concat(L.LEVELS.map(function (l) { return [l, t("level." + l)]; })),
      state.level, function (v) { state.level = v; refresh(); })));
    box.appendChild(labeled("find.format", select("f-format",
      [["", any], ["online", t("find.fmt.online")], ["in_person", t("find.fmt.in_person")], ["hybrid", t("find.fmt.hybrid")]],
      state.format, function (v) { state.format = v; refresh(); })));
    if (state.where === "us") {
      box.appendChild(labeled("find.ownership", select("f-type",
        [["", any]].concat(OWNERSHIP.map(function (o) { return [o, t("own." + o)]; })),
        state.ownership, function (v) { state.ownership = v; refresh(); })));
      box.appendChild(labeled("ap.state", select("f-state", [["", t("find.anyState")]].concat(L.STATES.map(function (x) { return [x, x]; })),
        state.usState, function (v) { state.usState = v; refresh(); })));
    } else {
      box.appendChild(labeled("browse.country", select("f-country", [["", any]].concat(L.countries(lang)),
        state.country, function (v) { state.country = v; refresh(); })));
      var hint = el("p", "muted small");
      hint.appendChild(document.createTextNode(t("browse.abroadHint") + " "));
      hint.appendChild(link(t("find.cta"), "/find", null));
      box.appendChild(hint);
    }
  }

  function card(p) {
    var c = el("article", "program-card");
    var left = el("div", "program-main");
    var h = el("h3");
    var link = el("a", "program-link", p.program_name);
    link.href = "/program?id=" + encodeURIComponent(p.id);
    h.appendChild(link);
    left.appendChild(h);
    var where = [p.school, [p.city, p.state, countryLabel(p.country)].filter(Boolean).join(", ")].filter(Boolean).join(" · ");
    left.appendChild(el("p", "program-where", where));
    var tags = el("div", "tags");
    tags.appendChild(el("span", "tag", t("fmt." + p.format)));
    if (p.gi_bill_approved) tags.appendChild(el("span", "tag tag-gold", t("browse.approved")));
    if (p.is_sample) tags.appendChild(el("span", "tag tag-warn", t("browse.sample")));
    left.appendChild(tags);
    c.appendChild(left);

    var right = el("div", "program-score");
    if (p.review_count > 0) {
      right.appendChild(el("div", "score", Number(p.avg_rating).toFixed(1)));
      right.appendChild(el("div", "score-sub", p.review_count + " " + t(p.review_count === 1 ? "browse.review" : "browse.reviews")));
    } else {
      right.appendChild(el("div", "score-sub", t("browse.noReviews")));
    }
    c.appendChild(right);
    return c;
  }

  // Schools from official U.S. data that matched the search but aren't on GIVouch yet.
  function officialCard(s) {
    var c = el("article", "program-card find-card");
    var main = el("div", "program-main");
    main.appendChild(el("h3", null, s.name));
    main.appendChild(el("p", "program-where", [[s.city, s.state].filter(Boolean).join(", "), s.ownership ? t("own." + s.ownership) : null].filter(Boolean).join(" · ")));
    var facts = [];
    if (s.completionRate !== null && s.completionRate !== undefined) facts.push(t("find.completion") + ": " + s.completionRate + "%");
    if (s.avgNetPrice) facts.push(t("find.netPrice") + ": $" + s.avgNetPrice.toLocaleString("en-US"));
    if (facts.length) main.appendChild(el("p", "muted small", facts.join(" · ")));
    var onSite = s.givouch && s.givouch.length;
    main.appendChild(el("span", onSite ? "tag tag-gold" : "tag", t(onSite ? "browse.onGivouch" : "browse.noReviewsYet")));
    if (s.programs && s.programs.length) main.appendChild(programList(s));
    var actions = el("div", "find-actions");
    actions.appendChild(link(t("find.checkVA") + " ↗", vaLink(s), "btn btn-outline btn-sm", true));
    var site = s.url && safeUrl(s.url);
    if (site) actions.appendChild(link(t("find.website") + " ↗", site, "btn btn-outline btn-sm", true));
    main.appendChild(actions);
    c.appendChild(main);
    return c;
  }

  function renderOfficial() {
    var box = document.getElementById("official-results");
    if (!box) return;
    box.innerHTML = "";
    updateHeader();
    if (!official || !official.length) return;
    box.appendChild(el("h2", "section-label official-head", t("browse.officialTitle")));
    box.appendChild(el("p", "muted small", t("browse.officialNote")));
    official.forEach(function (s) { box.appendChild(officialCard(s)); });
    // Page through every matching school, 10 at a time.
    var pages = Math.min(Math.ceil(officialTotal / officialPerPage), 50);
    if (pages > 1) {
      var nav = el("div", "rv-nav official-pages");
      var prev = el("button", "btn btn-outline btn-sm", "‹ " + t("browse.prevPage")); prev.type = "button";
      prev.style.visibility = officialPage > 0 ? "visible" : "hidden";
      prev.addEventListener("click", function () { loadOfficial(officialPage - 1, true); });
      var next = el("button", "btn btn-outline btn-sm", t("browse.nextPage") + " ›"); next.type = "button";
      next.style.visibility = officialPage < pages - 1 ? "visible" : "hidden";
      next.addEventListener("click", function () { loadOfficial(officialPage + 1, true); });
      nav.appendChild(prev);
      nav.appendChild(el("span", "muted small", t("browse.page") + " " + (officialPage + 1) + " " + t("browse.of") + " " + pages));
      nav.appendChild(next);
      box.appendChild(nav);
    }
  }

  // The count and message at the top. When nothing on GIVouch matches, they describe the
  // schools found in official data instead of saying "0 programs".
  // One stat box: a big number with a label under it.
  function stat(num, label, cls) {
    var b = el("div", "stat-box" + (cls ? " " + cls : ""));
    b.appendChild(el("span", "stat-num", String(num)));
    b.appendChild(el("span", "stat-label", label));
    return b;
  }
  function setStats(boxes) {
    var count = document.getElementById("result-count");
    count.innerHTML = "";
    boxes.forEach(function (b) { count.appendChild(b); });
  }

  function updateHeader() {
    if (!last) return;
    var list = document.getElementById("results");
    var old = document.getElementById("none-notice");
    if (old) old.remove();
    var gv = last.total;
    var gvBox = function () { return stat(gv, t(gv === 1 ? "browse.program" : "browse.programs")); };
    if (officialPending || vaPending) {
      setStats((gv ? [gvBox()] : []).concat([el("span", "muted stat-wait", t("browse.searching"))]));
      return;
    }
    var vaCount = vaShown().length;
    if ((official && official.length) || vaCount) {
      // Schools in official data and the VA's list, plus any GIVouch schools shown above that
      // aren't in either (e.g. abroad).
      var names = {};
      (official || []).concat(vaShown()).forEach(function (s) { names[normName(s.name)] = true; });
      var extra = {};
      (last.programs || []).forEach(function (p) {
        var k = normName(p.school);
        if (k && !names[k]) extra[k] = true;
      });
      var more = Object.keys(extra).length;
      var total = officialTotal + more + vaCount;
      var rv = last.reviewed || 0;
      var label = t(total === 1 ? "browse.schoolFound" : "browse.schoolsFound");
      setStats([
        stat(total, label),
        stat(rv, t(rv === 1 ? "browse.programReviewed" : "browse.programsReviewed"), "stat-gold")
      ]);
      return;
    }
    setStats([gvBox()]);
    if (gv) return;
    var none = el("p", "notice", t("browse.none"));
    none.id = "none-notice";
    list.appendChild(none);
  }

  // Official data covers U.S. schools; it's searched for a school name or any filter.
  function wantsOfficial() {
    if (state.where !== "us") return false;
    return state.q.length >= 2 || Boolean(state.field || state.level || state.format || state.ownership || state.usState);
  }
  function officialQuery(page) {
    var p = new URLSearchParams();
    if (state.q.length >= 2) p.set("q", state.q);
    if (state.field) p.set("field", state.field);
    if (state.level) p.set("level", state.level);
    if (state.format) p.set("format", state.format);
    if (state.ownership) p.set("ownership", state.ownership);
    if (state.usState) p.set("state", state.usState);
    p.set("page", String(page));
    return p.toString();
  }

  // VA-listed schools apply to a school-name search in the U.S. (state filter included);
  // field, level, format and type come from Department of Education data, which these lack.
  function wantsVA() {
    return state.where === "us" && state.q.length >= 2 && !state.field && !state.level && !state.format && !state.ownership;
  }
  function vaShown() {
    if (!va) return [];
    var seen = {};
    (official || []).forEach(function (s) { seen[normName(s.name)] = true; });
    return va.filter(function (s) { return (!state.usState || s.state === state.usState) && !seen[normName(s.name)]; });
  }
  function normName(n) { return String(n || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }
  function vaType(s) {
    if (/FLIGHT/.test(s.type || "")) return t("vatype.flight");
    if (/OJT|APPRENTICE/.test(s.type || "")) return t("vatype.ojt");
    return t("vatype.other");
  }
  function vaCard(s) {
    var c = el("article", "program-card find-card");
    var main = el("div", "program-main");
    main.appendChild(el("h3", null, s.name));
    main.appendChild(el("p", "program-where", [s.city, s.state].filter(Boolean).join(", ")));
    var tags = el("div", "tags");
    tags.appendChild(el("span", "tag tag-gold", vaType(s)));
    var onSite = (last && last.programs || []).some(function (p) { return normName(p.school) === normName(s.name); });
    tags.appendChild(el("span", "tag", t(onSite ? "browse.onGivouch" : "browse.noReviewsYet")));
    main.appendChild(tags);
    var actions = el("div", "find-actions");
    actions.appendChild(link(t("browse.writeReview"), "/review?va=" + encodeURIComponent(s.code), "btn btn-primary btn-sm"));
    var page = safeUrl(s.vaUrl);
    if (page) actions.appendChild(link(t("browse.vaPage") + " ↗", page, "btn btn-outline btn-sm", true));
    var site = s.website && safeUrl(s.website);
    if (site) actions.appendChild(link(t("find.website") + " ↗", site, "btn btn-outline btn-sm", true));
    main.appendChild(actions);
    c.appendChild(main);
    return c;
  }
  function renderVA() {
    var box = document.getElementById("va-results");
    if (!box) return;
    box.innerHTML = "";
    var list = vaShown();
    updateHeader();
    if (!list.length) return;
    box.appendChild(el("h2", "section-label official-head", t("browse.vaTitle")));
    box.appendChild(el("p", "muted small", t("browse.vaNote")));
    var pages = Math.ceil(list.length / VA_PER_PAGE);
    if (vaPage >= pages) vaPage = pages - 1;
    list.slice(vaPage * VA_PER_PAGE, (vaPage + 1) * VA_PER_PAGE).forEach(function (s) { box.appendChild(vaCard(s)); });
    if (pages > 1) {
      var nav = el("div", "rv-nav official-pages");
      var prev = el("button", "btn btn-outline btn-sm", "‹ " + t("browse.prevPage")); prev.type = "button";
      prev.style.visibility = vaPage > 0 ? "visible" : "hidden";
      prev.addEventListener("click", function () { vaPage--; renderVA(); box.scrollIntoView({ behavior: "smooth", block: "start" }); });
      var next = el("button", "btn btn-outline btn-sm", t("browse.nextPage") + " ›"); next.type = "button";
      next.style.visibility = vaPage < pages - 1 ? "visible" : "hidden";
      next.addEventListener("click", function () { vaPage++; renderVA(); box.scrollIntoView({ behavior: "smooth", block: "start" }); });
      nav.appendChild(prev);
      nav.appendChild(el("span", "muted small", t("browse.page") + " " + (vaPage + 1) + " " + t("browse.of") + " " + pages));
      nav.appendChild(next);
      box.appendChild(nav);
    }
  }
  function loadVA() {
    va = null; vaPage = 0;
    vaPending = wantsVA();
    renderVA();
    if (!vaPending) return;
    var q = state.q;
    fetch("/api/va?op=search&q=" + encodeURIComponent(q))
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (q !== state.q) return;
        vaPending = false;
        va = (d && d.available && d.schools) || [];
        renderVA();
      })
      .catch(function () { if (q === state.q) { vaPending = false; renderVA(); } });
  }

  function loadOfficial(page, scroll) {
    page = page || 0;
    if (!scroll) { official = null; officialTotal = 0; }
    officialPending = wantsOfficial();
    if (!scroll) renderOfficial();
    if (!officialPending) return;
    var q = officialQuery(page);
    var box = document.getElementById("official-results");
    if (scroll && box) box.setAttribute("aria-busy", "true");
    fetch("/api/find?" + q)
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (q !== officialQuery(page)) return;
        officialPending = false;
        official = (d && d.schools) || [];
        officialTotal = (d && d.total) || official.length;
        officialPage = page;
        if (d && d.perPage) officialPerPage = d.perPage;
        renderOfficial();
        renderVA();
        if (box) box.removeAttribute("aria-busy");
        if (scroll && box) box.scrollIntoView({ behavior: "smooth", block: "start" });
      })
      .catch(function () { if (box) box.removeAttribute("aria-busy"); if (q === officialQuery(page)) { officialPending = false; renderOfficial(); } });
  }

  function render(data, append) {
    var list = document.getElementById("results");
    var count = document.getElementById("result-count");
    var more = document.getElementById("show-more");
    if (!append) list.innerHTML = "";
    data.programs.forEach(function (p) { list.appendChild(card(p)); });
    var shown = data.offset + data.programs.length;
    more.hidden = shown >= data.total;
  }

  function load(append) {
    var offset = append && last ? last.offset + last.programs.length : 0;
    var list = document.getElementById("results");
    if (!append) {
      list.innerHTML = "";
      list.appendChild(el("p", "muted", t("browse.loading")));
    }
    fetch(query(offset))
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (data) { last = data; render(data, append); if (!append) { loadOfficial(); loadVA(); } else updateHeader(); })
      .catch(function () {
        list.innerHTML = "";
        list.appendChild(el("p", "notice", t("browse.error")));
        document.getElementById("result-count").textContent = "";
        document.getElementById("show-more").hidden = true;
      });
  }

  function syncControls() {
    document.getElementById("q").value = state.q;
    document.getElementById("sort").value = state.sort;
    renderFilters();
  }

  function refresh() { writeUrl(); load(false); }

  document.addEventListener("DOMContentLoaded", function () {
    readUrl();
    syncControls();

    document.getElementById("search-form").addEventListener("submit", function (e) {
      e.preventDefault();
      state.q = document.getElementById("q").value.trim().slice(0, 100);
      refresh();
    });
    document.getElementById("sort").addEventListener("change", function (e) { state.sort = e.target.value; refresh(); });
    document.getElementById("clear-all").addEventListener("click", function () {
      state = blank(state.q);
      syncControls();
      refresh();
    });
    document.getElementById("show-more").addEventListener("click", function () { load(true); });
    document.addEventListener("gv:lang", function () { renderFilters(); if (last) render(last, false); renderOfficial(); renderVA(); });

    load(false);
  });
})();
