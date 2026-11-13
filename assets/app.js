// GIVouch — shared behavior: language (EN/ES), light/dark theme, cookie consent.
(function () {
  "use strict";

  // Browser storage can be blocked; never let that break the page.
  function load(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
  function save(key, value) { try { localStorage.setItem(key, value); } catch (e) {} }

  var STRINGS = {
    en: {
      "nav.lang": "Español",
      "nav.theme.dark": "Dark",
      "nav.theme.light": "Light",
      "hero.eyebrow": "For veterans, service members and their families",
      "hero.title": "Honest reviews of GI Bill programs, from people who used them.",
      "hero.lead": "Before you spend your benefit months, see what veterans and military families say about the school and program, including approved schools abroad.",
      "hero.search": "Search a school, program or country",
      "hero.searchBtn": "Search",
      "hero.review": "Write a review",
      "hero.how": "How it works",
      "how.title": "How GIVouch works",
      "how.sub": "Built around the questions the official tools don't answer.",
      "how.1.title": "Find a program",
      "how.1.body": "Search by field or country, and filter by online, in person or abroad.",
      "how.2.title": "Read real reviews",
      "how.2.body": "Did GI Bill paperwork go through on time? Did credits transfer? Was it worth the months?",
      "how.3.title": "Check it with the VA",
      "how.3.body": "Every program links to the VA's official listing so you can confirm approval.",
      "how.4.title": "Share your experience",
      "how.4.body": "A short, structured review takes about three minutes and helps the next person choose.",
      "types.title": "Schools we cover",
      "types.sub": "Colleges and universities, trade and vocational schools, and flight schools, in the U.S. and abroad.",
      "types.1": "Colleges and universities",
      "types.2": "Trade and vocational schools",
      "types.3": "Flight schools",
      "types.4": "Approved schools abroad",
      "soon": "GIVouch is in early development. Search and reviews are coming soon.",
      "footer.tagline": "Honest GI Bill program reviews by veterans and military families.",
      "footer.privacy": "Privacy Policy",
      "footer.cookies": "Cookie Policy",
      "footer.prefs": "Cookie preferences",
      "footer.disclaimer": "GIVouch is an independent site and is not affiliated with or endorsed by the U.S. Department of Veterans Affairs or any government agency. Reviews reflect the personal experiences of their authors. Always confirm program approval and benefit details with the VA.",
      "cookie.text": "GIVouch uses only essential cookies to remember your language, theme and this choice. No analytics, tracking or advertising cookies.",
      "cookie.accept": "Accept All",
      "cookie.reject": "Reject All",
      "cookie.more": "Cookie Policy",
      "policy.esNote": ""
    },
    es: {
      "nav.lang": "English",
      "nav.theme.dark": "Oscuro",
      "nav.theme.light": "Claro",
      "hero.eyebrow": "Para veteranos, militares y sus familias",
      "hero.title": "Reseñas honestas de programas del GI Bill, de quienes los usaron.",
      "hero.lead": "Antes de gastar tus meses de beneficio, mira lo que dicen veteranos y familias militares sobre la escuela y el programa, incluidas las escuelas aprobadas en el extranjero.",
      "hero.search": "Busca una escuela, programa o país",
      "hero.searchBtn": "Buscar",
      "hero.review": "Escribir una reseña",
      "hero.how": "Cómo funciona",
      "how.title": "Cómo funciona GIVouch",
      "how.sub": "Pensado para las preguntas que las herramientas oficiales no responden.",
      "how.1.title": "Encuentra un programa",
      "how.1.body": "Busca por área o país, y filtra por en línea, presencial o en el extranjero.",
      "how.2.title": "Lee reseñas reales",
      "how.2.body": "¿Se tramitó el GI Bill a tiempo? ¿Se transfirieron los créditos? ¿Valió la pena los meses?",
      "how.3.title": "Confírmalo con el VA",
      "how.3.body": "Cada programa enlaza a la lista oficial del VA para que confirmes la aprobación.",
      "how.4.title": "Comparte tu experiencia",
      "how.4.body": "Una reseña corta y estructurada toma unos tres minutos y ayuda a la próxima persona a decidir.",
      "types.title": "Escuelas que cubrimos",
      "types.sub": "Colegios y universidades, escuelas técnicas y vocacionales, y escuelas de aviación, en EE. UU. y en el extranjero.",
      "types.1": "Colegios y universidades",
      "types.2": "Escuelas técnicas y vocacionales",
      "types.3": "Escuelas de aviación",
      "types.4": "Escuelas aprobadas en el extranjero",
      "soon": "GIVouch está en desarrollo. La búsqueda y las reseñas llegarán pronto.",
      "footer.tagline": "Reseñas honestas de programas del GI Bill por veteranos y familias militares.",
      "footer.privacy": "Política de privacidad",
      "footer.cookies": "Política de cookies",
      "footer.prefs": "Preferencias de cookies",
      "footer.disclaimer": "GIVouch es un sitio independiente y no está afiliado ni respaldado por el Departamento de Asuntos de Veteranos de EE. UU. ni por ninguna agencia del gobierno. Las reseñas reflejan las experiencias personales de sus autores. Confirma siempre la aprobación del programa y los detalles del beneficio con el VA.",
      "cookie.text": "GIVouch solo usa cookies esenciales para recordar tu idioma, tema y esta elección. Sin cookies de análisis, rastreo ni publicidad.",
      "cookie.accept": "Aceptar todo",
      "cookie.reject": "Rechazar todo",
      "cookie.more": "Política de cookies",
      "policy.esNote": "La versión en español de esta política estará disponible pronto. Por ahora se muestra en inglés."
    }
  };

  var root = document.documentElement;
  var lang = load("gv-lang") || ((navigator.language || "en").toLowerCase().indexOf("es") === 0 ? "es" : "en");
  var theme = load("gv-theme") ||
    (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");

  function applyLang() {
    var t = STRINGS[lang] || STRINGS.en;
    root.lang = lang;
    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      var v = t[el.getAttribute("data-i18n")];
      if (v !== undefined) el.textContent = v;
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach(function (el) {
      var v = t[el.getAttribute("data-i18n-placeholder")];
      if (v !== undefined) el.setAttribute("placeholder", v);
    });
    document.querySelectorAll("[data-i18n-hide-empty]").forEach(function (el) {
      el.hidden = !t[el.getAttribute("data-i18n-hide-empty")];
    });
    updateThemeLabel();
  }

  function applyTheme() {
    root.setAttribute("data-theme", theme);
    updateThemeLabel();
  }

  function updateThemeLabel() {
    var btn = document.getElementById("theme-toggle");
    if (!btn) return;
    var t = STRINGS[lang] || STRINGS.en;
    // Label shows the mode you would switch to.
    btn.textContent = theme === "dark" ? "☀ " + t["nav.theme.light"] : "☾ " + t["nav.theme.dark"];
  }

  function showBanner(show) {
    var banner = document.getElementById("cookie-banner");
    if (banner) banner.classList.toggle("show", show);
  }

  function setConsent(value) {
    save("gv-cookie-consent", value);
    showBanner(false);
  }

  applyTheme();

  document.addEventListener("DOMContentLoaded", function () {
    applyLang();
    applyTheme();

    var langBtn = document.getElementById("lang-toggle");
    if (langBtn) langBtn.addEventListener("click", function () {
      lang = lang === "en" ? "es" : "en";
      save("gv-lang", lang);
      applyLang();
    });

    var themeBtn = document.getElementById("theme-toggle");
    if (themeBtn) themeBtn.addEventListener("click", function () {
      theme = theme === "dark" ? "light" : "dark";
      save("gv-theme", theme);
      applyTheme();
    });

    var accept = document.getElementById("cookie-accept");
    var reject = document.getElementById("cookie-reject");
    if (accept) accept.addEventListener("click", function () { setConsent("all"); });
    if (reject) reject.addEventListener("click", function () { setConsent("essential"); });

    var prefs = document.getElementById("cookie-prefs");
    if (prefs) prefs.addEventListener("click", function () { showBanner(true); });

    if (!load("gv-cookie-consent")) showBanner(true);
  });
})();
