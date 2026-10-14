// The flight search on the home page and on /he/search/ is Travelpayouts'
// White Label (23389). Loading it fetches their code and sets their cookies
// (Snowplow, among others), so it waits for a click on the gate's button. The
// click is remembered in this browser under "pricelog-search", and is the only
// thing this script stores. Language, currencies and colours are set in the
// Travelpayouts dashboard; the results page is set here.
(function () {
  var KEY = "pricelog-search";
  var WL = "https://tpwgts.com/wl_web/main.js?wl_id=23389";
  var gates = document.querySelectorAll("[data-search-gate]");
  var boxes = document.querySelectorAll("[data-search-box]");
  if (!gates.length) return;

  function remembered() {
    // Storage can be blocked outright; then the gate simply asks every time.
    try { return localStorage.getItem(KEY) === "on"; } catch (e) { return false; }
  }

  function load() {
    window.TPWL_CONFIGURATION = Object.assign({}, window.TPWL_CONFIGURATION, {
      resultsURL: "https://pricelog.fyi/he/search/",
    });
    gates.forEach(function (g) { g.hidden = true; });
    boxes.forEach(function (b) { b.hidden = false; });
    var s = document.createElement("script");
    s.type = "module";
    s.src = WL;
    document.head.appendChild(s);
  }

  if (remembered()) { load(); return; }

  gates.forEach(function (g) {
    var button = g.querySelector("button");
    button.hidden = false;
    button.addEventListener("click", function () {
      try { localStorage.setItem(KEY, "on"); } catch (e) { /* asks again next time */ }
      load();
      // The gate is gone; keyboard focus goes to the box the search draws in.
      boxes[0].focus();
    });
  });
})();
