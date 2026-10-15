// The flight search on the home page, /he/search/ and /en/search/ is
// Travelpayouts' White Label (23389). Loading it fetches their code and sets
// their cookies (Snowplow, among others), so it waits for a click on the gate's
// button. The click is remembered in this browser under "pricelog-search", and
// is the only thing this script stores; it is one choice for both languages.
// Currencies and colours are set in the Travelpayouts dashboard; the language
// and the results page are set here, from the page's own <html lang>.
(function () {
  var KEY = "pricelog-search";
  var WL = "https://tpwgts.com/wl_web/main.js?wl_id=23389";
  var LANGS = ["he", "en"];
  var LANG = document.documentElement.lang === "en" ? "en" : "he";
  var gates = document.querySelectorAll("[data-search-gate]");
  var boxes = document.querySelectorAll("[data-search-box]");
  if (!gates.length) return;

  function remembered() {
    // Storage can be blocked outright; then the gate simply asks every time.
    try { return localStorage.getItem(KEY) === "on"; } catch (e) { return false; }
  }

  // A language picked inside the White Label moves to the search page in that
  // language, with the same search, so the page around it agrees. The White
  // Label calls this by the name set in its dashboard ("onLocaleChange"), and
  // only when the visitor picks a language, not when it starts.
  window.tpwlLocaleChange = function (picked) {
    var lang = String(picked).slice(0, 2).toLowerCase();
    if (lang === LANG || LANGS.indexOf(lang) < 0) return;
    location.assign("/" + lang + "/search/" + location.search);
  };

  function load() {
    // The White Label picks its language from ?language= first, then from a
    // tpwl_locale cookie it writes itself, for a year, across the domain, and
    // only then from its dashboard default (Hebrew). It also writes the one it
    // picked into <html lang dir>. So without the parameter, one visit to the
    // English page turned the Hebrew page's search English and its direction
    // left-to-right (read from their code, 2026-10-15). It removes the
    // parameter from the address itself once read.
    var url = new URL(location.href);
    url.searchParams.set("language", LANG);
    history.replaceState(history.state, "", url);
    window.TPWL_CONFIGURATION = Object.assign({}, window.TPWL_CONFIGURATION, {
      resultsURL: "https://pricelog.fyi/" + LANG + "/search/",
    });
    gates.forEach(function (g) { g.hidden = true; });
    boxes.forEach(function (b) { b.hidden = false; });
    var s = document.createElement("script");
    s.type = "module";
    s.src = WL;
    document.head.appendChild(s);
    if (LANG === "he") boxes.forEach(hintEnglish);
  }

  // The White Label finds places by their English names only: "רומא" finds
  // nothing, and says nothing either (checked 2026-10-15, ours and another
  // site's). So on the Hebrew pages its two place fields say so in their
  // placeholders. It draws inside an open shadow root and may redraw at any
  // time, so this watches and puts the text back. Only a field still showing
  // the White Label's own words is touched: if they change them, this does
  // nothing and the search works as before, just without the hint.
  // Short on purpose: in the one-line banner the field leaves about 14
  // characters for it, and "לאן? באנגלית, למשל Rome" was cut after "באנגלי".
  var HINTS = {
    "יציאה מ": "מאיפה? באנגלית",
    "הגעה אל": "לאן? באנגלית",
  };
  function hintEnglish(box) {
    function apply(root) {
      root.querySelectorAll("input[placeholder]").forEach(function (input) {
        var hint = HINTS[input.placeholder];
        if (hint) input.placeholder = hint;
      });
    }
    function watch(root) {
      apply(root);
      new MutationObserver(function () { apply(root); })
        .observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ["placeholder"] });
    }
    // The White Label attaches its shadow root to the box itself, once its
    // code has arrived; nothing in the page announces that, so this looks
    // again on each frame until it is there, for at most half a minute.
    var tries = 0;
    (function find() {
      if (box.shadowRoot) { watch(box.shadowRoot); return; }
      if (++tries < 1800) requestAnimationFrame(find);
    })();
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
