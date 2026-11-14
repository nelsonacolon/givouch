// Program page: details, review summary and reviews for /program?id=123
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
  var data = null;
  var sort = "newest";

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined && text !== null) e.textContent = text;
    return e;
  }

  function countryLabel(name) {
    if (!name || lang() === "en" || !window.GVLabels) return name;
    return window.GVLabels.country(name);
  }

  // Use a translation when one exists, otherwise show the stored text as is.
  function label(key, fallback) {
    var v = t(key);
    return v && v !== key ? v : fallback;
  }

  function safeUrl(u) {
    try {
      var url = new URL(u);
      return url.protocol === "https:" ? url.href : VA_TOOL;
    } catch (e) { return VA_TOOL; }
  }

  function stat(value, labelKey, suffix) {
    var box = el("div", "stat");
    box.appendChild(el("div", "stat-value", value === null || value === undefined ? "–" : value + (suffix || "")));
    box.appendChild(el("div", "stat-label", t(labelKey)));
    return box;
  }

  function formatDate(iso) {
    try {
      return new Date(iso).toLocaleDateString(lang() === "es" ? "es" : "en-US", { year: "numeric", month: "short", day: "numeric" });
    } catch (e) { return ""; }
  }

  function reviewCard(r) {
    var c = el("article", "review-card");
    var head = el("div", "review-head");
    head.appendChild(el("strong", null, r.display_name || t("prog.verified")));
    head.appendChild(el("span", "tag tag-gold", t("prog.verified")));
    c.appendChild(head);

    var meta = [];
    if (r.start_year) meta.push(t("prog.started") + " " + r.start_year);
    if (r.reviewer_status) meta.push(t("who." + r.reviewer_status));
    if (r.benefit) meta.push(label("benefit." + r.benefit, r.benefit));
    if (meta.length) c.appendChild(el("p", "review-meta", meta.join(" · ")));

    var verdict = r.overall_rating + " / 5";
    if (r.would_recommend === true) verdict += " · " + t("prog.recommends");
    if (r.would_recommend === false) verdict += " · " + t("prog.notRecommend");
    c.appendChild(el("p", "review-verdict", verdict));

    var facts = el("ul", "review-facts");
    if (r.paperwork_rating) facts.appendChild(el("li", null, t("prog.paperwork") + ": " + r.paperwork_rating + " / 5"));
    if (r.paid_on_time) facts.appendChild(el("li", null, t("prog.paidOnTime") + ": " + t("paid." + r.paid_on_time)));
    if (r.credits_transferred) facts.appendChild(el("li", null, t("prog.credits") + ": " + t("credits." + r.credits_transferred)));
    if (r.worth_months) facts.appendChild(el("li", null, t("prog.worth") + ": " + r.worth_months + " / 5"));
    if (r.instruction_rating) facts.appendChild(el("li", null, t("prog.instruction") + ": " + r.instruction_rating + " / 5"));
    if (r.job_assistance) facts.appendChild(el("li", null, t("prog.jobHelp") + ": " + t("jobhelp." + r.job_assistance)));
    if (r.vet_support) facts.appendChild(el("li", null, t("prog.vetSupport") + ": " + t("vetsupport." + r.vet_support)));
    if (r.yellow_ribbon) facts.appendChild(el("li", null, t("prog.yellowRibbon") + ": " + t("yellow." + r.yellow_ribbon)));
    if (r.job_outcome) facts.appendChild(el("li", null, t("prog.job") + ": " + label("job." + r.job_outcome, r.job_outcome)));
    if (facts.children.length) c.appendChild(facts);

    if (r.comment) c.appendChild(el("p", "review-comment", r.comment));
    var foot = el("div", "review-foot");
    foot.appendChild(el("span", null, formatDate(r.created_at)));
    if (r.is_sample) foot.appendChild(el("span", "tag tag-warn", t("browse.sample")));
    c.appendChild(foot);
    return c;
  }

  function render() {
    var root = document.getElementById("program");
    root.innerHTML = "";
    var p = data.program, s = data.summary;
    document.title = p.program_name + " — GIVouch";

    var main = el("div", "program-detail");
    var back = el("a", "back-link", "‹ " + t("prog.back"));
    back.href = document.referrer && document.referrer.indexOf("/browse") >= 0 ? document.referrer : "/browse";
    main.appendChild(back);
    main.appendChild(el("h1", null, p.program_name));
    main.appendChild(el("p", "program-where", [p.school, [p.city, p.state, countryLabel(p.country)].filter(Boolean).join(", ")].filter(Boolean).join(" · ")));

    var tags = el("div", "tags");
    tags.appendChild(el("span", "tag", t("fmt." + p.format)));
    tags.appendChild(el("span", "tag", t("type." + p.school_type)));
    if (p.gi_bill_approved) tags.appendChild(el("span", "tag tag-gold", t("browse.approved")));
    if (p.is_sample) tags.appendChild(el("span", "tag tag-warn", t("browse.sample")));
    main.appendChild(tags);

    main.appendChild(el("p", "notice", t("prog.notice")));

    var rhead = el("div", "results-head");
    rhead.appendChild(el("h2", "section-label", t("prog.reviews")));
    var sel = el("select");
    sel.id = "review-sort";
    sel.setAttribute("aria-label", "Sort reviews");
    [["newest", "prog.sortNewest"], ["highest", "prog.sortHighest"]].forEach(function (o) {
      var opt = el("option", null, t(o[1]));
      opt.value = o[0];
      if (o[0] === sort) opt.selected = true;
      sel.appendChild(opt);
    });
    sel.addEventListener("change", function () { sort = sel.value; load(); });
    if (data.reviews.length > 1) rhead.appendChild(sel);
    main.appendChild(rhead);

    if (!data.reviews.length) main.appendChild(el("p", "notice", t("prog.noReviews")));
    data.reviews.forEach(function (r) { main.appendChild(reviewCard(r)); });

    var side = el("aside", "program-side");
    var box = el("div", "card summary-card");
    var big = el("div", "summary-top");
    big.appendChild(el("span", "summary-score", s.review_count ? Number(s.avg_rating).toFixed(1) : "–"));
    big.appendChild(el("span", "summary-sub", t("prog.outOf") + " · " + s.review_count + " " + t(s.review_count === 1 ? "browse.review" : "browse.reviews")));
    box.appendChild(big);
    var grid = el("div", "stat-grid");
    grid.appendChild(stat(s.pct_recommend, "prog.statRecommend", "%"));
    grid.appendChild(stat(s.pct_paid_on_time, "prog.statPaid", "%"));
    grid.appendChild(stat(s.avg_paperwork, "prog.statPaperwork"));
    grid.appendChild(stat(s.avg_worth, "prog.statWorth"));
    grid.appendChild(stat(s.avg_instruction, "prog.statInstruction"));
    grid.appendChild(stat(s.pct_job_help, "prog.statJobHelp", "%"));
    box.appendChild(grid);
    side.appendChild(box);

    var write = el("a", "btn btn-primary btn-block", t("hero.review"));
    write.href = "/review?program=" + encodeURIComponent(p.id);
    side.appendChild(write);

    var va = el("a", "btn btn-outline btn-block", t("prog.verifyVA") + " ↗");
    va.href = p.va_listing_url ? safeUrl(p.va_listing_url) : vaSearch(p.school);
    va.target = "_blank";
    va.rel = "noopener noreferrer";
    side.appendChild(va);

    var layout = el("div", "program-layout");
    layout.appendChild(main);
    layout.appendChild(side);
    root.appendChild(layout);
  }

  function showMessage(key) {
    var root = document.getElementById("program");
    root.innerHTML = "";
    var a = el("a", "back-link", "‹ " + t("prog.back"));
    a.href = "/browse";
    root.appendChild(a);
    root.appendChild(el("p", "notice", t(key)));
  }

  function load() {
    var id = parseInt(new URLSearchParams(location.search).get("id"), 10);
    if (!id || id <= 0) return showMessage("prog.notFound");
    fetch("/api/program?id=" + id + "&sort=" + sort)
      .then(function (r) {
        if (r.status === 404) throw new Error("404");
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then(function (d) { data = d; render(); })
      .catch(function (e) { showMessage(e.message === "404" ? "prog.notFound" : "browse.error"); });
  }

  document.addEventListener("DOMContentLoaded", function () {
    load();
    document.addEventListener("gv:lang", function () { if (data) render(); });
  });
})();
