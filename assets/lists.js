// Shared lists for the search filters (Find and Browse pages): fields of study, U.S. states,
// degree levels and countries. Exposed as window.GVLists.
(function () {
  "use strict";
  var L = {};
  L.FIELDS = ["Accounting", "Agriculture", "Architecture", "Arts", "Automotive", "Aviation", "Biology",
    "Business", "Communications", "Computer science", "Construction", "Criminal justice", "Culinary arts",
    "Cybersecurity", "Education", "Engineering", "Finance", "Health care", "History", "Hospitality",
    "Information technology", "Languages", "Law", "Liberal arts", "Management", "Marketing", "Mathematics",
    "Nursing", "Psychology", "Public administration", "Science", "Skilled trades", "Social work", "Welding"];
  L.STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","DC","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA",
    "ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR",
    "PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","PR","GU","VI","AS","MP"];
  L.LEVELS = ["certificate", "associate", "bachelor", "master", "doctoral", "grad_certificate"];
  L.LEVEL_NUM = { 1: "certificate", 2: "associate", 3: "bachelor", 4: "grad_certificate", 5: "master", 6: "doctoral", 7: "doctoral", 8: "grad_certificate" };

  L.countries = function (lang) {
    var out = [];
    try {
      var en = new Intl.DisplayNames(["en"], { type: "region" });
      var shown = new Intl.DisplayNames([lang], { type: "region" });
      var A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ", seen = {};
      for (var i = 0; i < 26; i++) for (var j = 0; j < 26; j++) {
        var code = A[i] + A[j], name = en.of(code);
        if (!name || name === code || seen[name] || code === "US" || /Unknown|Outlying|Pseudo|Eurozone|United Nations|world/i.test(name)) continue;
        if (["AA","QM","QN","QO","QP","QQ","QR","QS","QT","QU","QV","QW","QX","QY","QZ","XA","XB","XK","ZZ","EU","EZ","UN"].indexOf(code) >= 0) continue;
        seen[name] = 1;
        out.push([name, shown.of(code)]);
      }
    } catch (e) {}
    return out.sort(function (a, b) { return a[1].localeCompare(b[1], lang); });
  };
  window.GVLists = L;
})();
