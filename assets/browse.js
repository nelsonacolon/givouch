// Browse programs page: reads filters from the URL, calls /api/programs, renders results.
(function () {
  "use strict";
  var t = function (k) { return window.GV ? window.GV.t(k) : k; };
  var FORMATS = ["online", "in_person", "abroad"];
  var state = { q: "", formats: [], country: "", field: "", sort: "reviewed", offset: 0 };
  var last = null;

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

  function fillSelect(sel, values, current) {
    sel.innerHTML = "";
    var any = el("option", null, t("browse.any"));
    any.value = "";
    sel.appendChild(any);
    values.forEach(function (v) {
      var o = el("option", null, v);
      o.value = v;
      if (v === current) o.selected = true;
      sel.appendChild(o);
    });
  }

  function card(p) {
    var c = el("article", "program-card");
    var left = el("div", "program-main");
    left.appendChild(el("h3", null, p.program_name));
    var where = [p.school, [p.city, p.country].filter(Boolean).join(", ")].filter(Boolean).join(" · ");
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

  function render(data, append) {
    var list = document.getElementById("results");
    var count = document.getElementById("result-count");
    var more = document.getElementById("show-more");
    if (!append) list.innerHTML = "";
    data.programs.forEach(function (p) { list.appendChild(card(p)); });
    count.textContent = data.total + " " + t("browse.programs");
    if (!data.total) list.appendChild(el("p", "notice", t("browse.none")));
    var shown = data.offset + data.programs.length;
    more.hidden = shown >= data.total;
    fillSelect(document.getElementById("f-country"), data.countries, state.country);
    fillSelect(document.getElementById("f-field"), data.fields, state.field);
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
      .then(function (data) { last = data; render(data, append); })
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
    document.addEventListener("gv:lang", function () { if (last) render(last, false); });

    load(false);
  });
})();
