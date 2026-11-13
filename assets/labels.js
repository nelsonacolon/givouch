// Display-only translations for data stored in English (countries, fields of study).
(function () {
  "use strict";
  // Countries and fields are stored in English. These translate them for display only;
  // the stored value is what gets sent back to the server.
  var COUNTRY_CODES = null;
  function countryCodes() {
    if (COUNTRY_CODES) return COUNTRY_CODES;
    COUNTRY_CODES = {};
    try {
      var en = new Intl.DisplayNames(["en"], { type: "region" });
      var A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
      for (var i = 0; i < 26; i++) for (var j = 0; j < 26; j++) {
        var code = A[i] + A[j];
        var name = en.of(code);
        if (name && name !== code) COUNTRY_CODES[name.toLowerCase()] = code;
      }
    } catch (e) {}
    COUNTRY_CODES["usa"] = "US";
    COUNTRY_CODES["united states of america"] = "US";
    return COUNTRY_CODES;
  }
  function countryLabel(name) {
    if (!name) return name;
    var lang = window.GV ? window.GV.lang() : "en";
    if (lang === "en") return name;
    try {
      var code = countryCodes()[name.toLowerCase()];
      return code ? new Intl.DisplayNames([lang], { type: "region" }).of(code) : name;
    } catch (e) { return name; }
  }

  var FIELDS_ES = {
    "accounting": "Contabilidad",
    "agriculture": "Agricultura",
    "architecture": "Arquitectura",
    "arts": "Artes",
    "automotive": "Automotriz",
    "aviation": "Aviación",
    "biology": "Biología",
    "business": "Negocios",
    "communications": "Comunicaciones",
    "computer science": "Ciencias de la computación",
    "construction": "Construcción",
    "criminal justice": "Justicia penal",
    "culinary arts": "Artes culinarias",
    "cybersecurity": "Ciberseguridad",
    "education": "Educación",
    "engineering": "Ingeniería",
    "finance": "Finanzas",
    "health care": "Salud",
    "healthcare": "Salud",
    "history": "Historia",
    "hospitality": "Hotelería y turismo",
    "information technology": "Tecnología de la información",
    "languages": "Idiomas",
    "law": "Derecho",
    "liberal arts": "Artes liberales",
    "management": "Administración",
    "marketing": "Mercadeo",
    "mathematics": "Matemáticas",
    "nursing": "Enfermería",
    "psychology": "Psicología",
    "public administration": "Administración pública",
    "science": "Ciencias",
    "skilled trades": "Oficios técnicos",
    "social work": "Trabajo social",
    "welding": "Soldadura"
  };
  function fieldLabel(name) {
    if (!name || (window.GV && window.GV.lang() !== "es")) return name;
    return FIELDS_ES[name.toLowerCase()] || name;
  }

  window.GVLabels = { country: countryLabel, field: fieldLabel };
})();
