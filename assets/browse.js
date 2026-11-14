// Browse programs page: reads filters from the URL, calls /api/programs, renders results.
(function () {
  "use strict";
  var t = function (k) { return window.GV ? window.GV.t(k) : k; };
  var FORMATS = ["online", "in_person", "abroad"];
  var state = { q: "", formats: [], country: "", field: "", sort: "reviewed", offset: 0 };
  var last = null;
  var VA_TOOL = "https://www.va.gov/education/gi-bill-comparison-tool/";
  function vaSearch(name) {
    var n = String(name || "").replace(/\s*-\s*Main Campus$/i, "").trim();
    return n ? VA_TOOL + "schools-and-employers?search=name&name=" + encodeURIComponent(n) : VA_TOOL;
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
  var officialTotal = 0;
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
    state.q = (p.get("q") || "").slice(0, 100);
    state.formats = (p.get("format") || "").split(",").filter(function (f) { return FORMATS.indexOf(f) >= 0; });
    state.country = p.get("country") || "";
    state.field = p.get("field") || "";
    state.sort = p.get("sort") === "rating" ? "rating" : "reviewed";
  }

  function writeUrl() {
    var p = new URLSearchParams();
    if (state.q) p.set("q", state.q);
    if (state.formats.length) p.set("format", state.formats.join(","));
    if (state.country) p.set("country", state.country);
    if (state.field) p.set("field", state.field);
    if (state.sort !== "reviewed") p.set("sort", state.sort);
    var qs = p.toString();
    history.replaceState(null, "", "/browse" + (qs ? "?" + qs : ""));
  }

  function query(offset) {
    var p = new URLSearchParams();
    if (state.q) p.set("q", state.q);
    if (state.formats.length) p.set("format", state.formats.join(","));
    if (state.country) p.set("country", state.country);
    if (state.field) p.set("field", state.field);
    p.set("sort", state.sort);
    p.set("offset", String(offset));
    return "/api/programs?" + p.toString();
  }

  function fillSelect(sel, values, current, label) {
    sel.innerHTML = "";
    var any = el("option", null, t("browse.any"));
    any.value = "";
    sel.appendChild(any);
    values.map(function (v) { return { value: v, text: label(v) }; })
      .sort(function (a, b) { return a.text.localeCompare(b.text); })
      .forEach(function (item) {
      var v = item.value;
      var o = el("option", null, item.text);
      o.value = v;
      if (v === current) o.selected = true;
      sel.appendChild(o);
    });
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
    actions.appendChild(link(t("find.checkVA") + " ↗", vaSearch(s.name), "btn btn-outline btn-sm", true));
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
  }

  // The count and message at the top. When nothing on GIVouch matches, they describe the
  // schools found in official data instead of saying "0 programs".
  function updateHeader() {
    if (!last) return;
    var list = document.getElementById("results");
    var count = document.getElementById("result-count");
    var old = document.getElementById("none-notice");
    if (old) old.remove();
    var gv = last.total;
    var gvText = gv + " " + t(gv === 1 ? "browse.program" : "browse.programs");
    if (officialPending) { count.textContent = (gv ? gvText + " · " : "") + t("browse.searching"); return; }
    if (official && official.length) {
      // Schools in official data, plus any GIVouch schools shown above that aren't in it (e.g. abroad).
      var names = {};
      official.forEach(function (s) { names[String(s.name).toLowerCase()] = true; });
      var extra = {};
      (last.programs || []).forEach(function (p) {
        var k = String(p.school || "").toLowerCase();
        if (k && !names[k]) extra[k] = true;
      });
      var more = Object.keys(extra).length;
      var total = officialTotal + more, shown = official.length + more;
      var rv = last.reviewed || 0;
      count.textContent = (total > shown ? shown + " " + t("browse.of") + " " + total : total) + " " +
        t(total === 1 ? "browse.schoolFound" : "browse.schoolsFound") + " | " +
        rv + " " + t(rv === 1 ? "browse.programReviewed" : "browse.programsReviewed");
      return;
    }
    count.textContent = gvText;
    if (gv) return;
    var none = el("p", "notice", t("browse.none"));
    none.id = "none-notice";
    list.appendChild(none);
  }

  function wantsOfficial() {
    if (state.q.length < 2) return false;
    if (state.country && state.country !== "United States") return false;
    if (state.formats.length && state.formats.indexOf("abroad") >= 0 && state.formats.length === 1) return false;
    return true;
  }

  function loadOfficial() {
    official = null;
    officialTotal = 0;
    officialPending = wantsOfficial();
    renderOfficial();
    if (!officialPending) return;
    var q = state.q;
    fetch("/api/find?q=" + encodeURIComponent(q))
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (q !== state.q) return;
        officialPending = false;
        official = (d && d.schools) || [];
        officialTotal = (d && d.total) || official.length;
        renderOfficial();
      })
      .catch(function () { if (q === state.q) { officialPending = false; renderOfficial(); } });
  }

  function render(data, append) {
    var list = document.getElementById("results");
    var count = document.getElementById("result-count");
    var more = document.getElementById("show-more");
    if (!append) list.innerHTML = "";
    data.programs.forEach(function (p) { list.appendChild(card(p)); });
    count.textContent = data.total + " " + t(data.total === 1 ? "browse.program" : "browse.programs");
    var shown = data.offset + data.programs.length;
    more.hidden = shown >= data.total;
    fillSelect(document.getElementById("f-country"), data.countries, state.country, countryLabel);
    fillSelect(document.getElementById("f-field"), data.fields, state.field, fieldLabel);
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
      .then(function (data) { last = data; render(data, append); if (!append) loadOfficial(); else updateHeader(); })
      .catch(function () {
        list.innerHTML = "";
        list.appendChild(el("p", "notice", t("browse.error")));
        document.getElementById("result-count").textContent = "";
        document.getElementById("show-more").hidden = true;
      });
  }

  function syncControls() {
    document.getElementById("q").value = state.q;
    document.querySelectorAll("input[name=format]").forEach(function (cb) {
      cb.checked = state.formats.indexOf(cb.value) >= 0;
    });
    document.getElementById("sort").value = state.sort;
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
    document.querySelectorAll("input[name=format]").forEach(function (cb) {
      cb.addEventListener("change", function () {
        state.formats = Array.prototype.filter.call(
          document.querySelectorAll("input[name=format]:checked"), function () { return true; }
        ).map(function (x) { return x.value; });
        refresh();
      });
    });
    document.getElementById("f-country").addEventListener("change", function (e) { state.country = e.target.value; refresh(); });
    document.getElementById("f-field").addEventListener("change", function (e) { state.field = e.target.value; refresh(); });
    document.getElementById("sort").addEventListener("change", function (e) { state.sort = e.target.value; refresh(); });
    document.getElementById("clear-all").addEventListener("click", function () {
      state = { q: state.q, formats: [], country: "", field: "", sort: "reviewed", offset: 0 };
      syncControls();
      refresh();
    });
    document.getElementById("show-more").addEventListener("click", function () { load(true); });
    document.addEventListener("gv:lang", function () { if (last) render(last, false); renderOfficial(); });

    load(false);
  });
})();
