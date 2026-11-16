// The flight search on the home page, /he/search/ and /en/search/ is
// Travelpayouts' White Label (23389). Loading it fetches their code and sets
// their cookies (Snowplow, among others), so it waits for a choice in a banner
// at the bottom of the page: "accept" loads it, "no cookies" leaves it off and
// says so in the search's own box, with a button that is the same accept. The
// banner is not a wall: the page works under it, and every other page of the
// site has no script and no banner, because nothing there sets a cookie.
// The choice is remembered in this browser under "pricelog-search" ("on" or
// "off"), and is the only thing this script stores; it is one choice for both
// languages. Currencies and colours are set in the Travelpayouts dashboard; the
// language and the results page are set here, from the page's own <html lang>.
(function () {
  var KEY = "pricelog-search";
  var WL = "https://tpwgts.com/wl_web/main.js?wl_id=23389";
  var LANGS = ["he", "en"];
  var LANG = document.documentElement.lang === "en" ? "en" : "he";
  var gates = document.querySelectorAll("[data-search-gate]");
  var boxes = document.querySelectorAll("[data-search-box]");
  if (!gates.length) return;

  // All the words this script shows, in one place for the four pages. The
  // generated home pages and the static search pages carry only the gate's
  // empty box and its <noscript> line, so the copy cannot drift between them.
  var TEXT = {
    he: {
      bannerTitle: "חיפוש הטיסות באתר מגיע מ־Travelpayouts",
      bannerBody: "כדי שהחיפוש יעבוד, הדפדפן טוען את הקוד שלהם, והם שומרים עוגיות (קוקיז). בלי אישור, כל השאר באתר עובד כרגיל, רק בלי חיפוש.",
      bannerLink: "פרטים בדף הפרטיות",
      accept: "אישור",
      decline: "בלי עוגיות",
      pendingTitle: "החיפוש ייטען אחרי אישור",
      pendingBody: "אפשר לאשר או לסרב בבאנר למטה. בינתיים כל השאר באתר עובד כרגיל.",
      offTitle: "החיפוש כבוי",
      offBody: "בחרת בלי עוגיות, ולכן החיפוש לא נטען. הטיסות שנמצאו ודפי היעדים עובדים כרגיל.",
      turnOn: "להפעלת החיפוש",
      turnOnNote: "ההפעלה היא אותו אישור שבבאנר.",
    },
    en: {
      bannerTitle: "The flight search on this site comes from Travelpayouts",
      bannerBody: "For the search to work, your browser loads their code, and they store cookies. Without your OK, the rest of the site works as usual, just without the search.",
      bannerLink: "Details on the privacy page",
      accept: "Accept",
      decline: "No cookies",
      pendingTitle: "The search loads once you accept",
      pendingBody: "You can accept or decline in the banner below. Meanwhile, the rest of the site works as usual.",
      offTitle: "The search is off",
      offBody: "You chose no cookies, so the search did not load. Flights found and destination pages work as usual.",
      turnOn: "Turn on the search",
      turnOnNote: "Turning it on is the same as accepting in the banner.",
    },
  }[LANG];

  function stored() {
    // Storage can be blocked outright; then the banner simply asks every time.
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }

  function store(value) {
    try { localStorage.setItem(KEY, value); } catch (e) { /* asks again next time */ }
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

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text) e.textContent = text;
    return e;
  }

  var PLANE = '<svg class="gate-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/></svg>';

  // Draws the search's box before a choice ("pending") or after "no cookies"
  // ("off"). Everything but the <noscript> line goes first: a home page
  // generated before this script changed still carries the old gate's text and
  // button, and must not show them beside the new ones.
  function drawGate(state) {
    gates.forEach(function (g) {
      Array.prototype.slice.call(g.children).forEach(function (c) {
        if (c.tagName !== "NOSCRIPT") g.removeChild(c);
      });
      g.insertAdjacentHTML("afterbegin", PLANE);
      g.appendChild(el("p", "gate-title", state === "off" ? TEXT.offTitle : TEXT.pendingTitle));
      g.appendChild(el("p", "gate-body", state === "off" ? TEXT.offBody : TEXT.pendingBody));
      if (state === "off") {
        var b = el("button", "btn btn--dark", TEXT.turnOn);
        b.type = "button";
        b.addEventListener("click", accept);
        g.appendChild(b);
        g.appendChild(el("p", "gate-note", TEXT.turnOnNote));
      }
    });
  }

  var banner = null;

  // Not a dialog: nothing is trapped and focus stays where it is, so the page
  // reads and works as before. It sits last in the document, after the
  // footer; the search's box says it is "below".
  function showBanner() {
    banner = el("section", "consent");
    banner.setAttribute("aria-labelledby", "consent-title");
    var inner = el("div", "consent-in");
    var text = el("div", "consent-text");
    var title = el("p", "consent-title", TEXT.bannerTitle);
    title.id = "consent-title";
    var link = el("a", "consent-link", TEXT.bannerLink);
    link.href = "/" + LANG + "/privacy#search";
    text.appendChild(title);
    text.appendChild(el("p", "consent-body", TEXT.bannerBody));
    text.appendChild(link);
    // The same size on purpose: saying no must be as easy as saying yes.
    var buttons = el("div", "consent-buttons");
    var yes = el("button", "btn btn--dark", TEXT.accept);
    var no = el("button", "btn btn--line", TEXT.decline);
    yes.type = no.type = "button";
    yes.addEventListener("click", accept);
    no.addEventListener("click", decline);
    // First in the document is first in reading order: on the right in Hebrew.
    buttons.appendChild(yes);
    buttons.appendChild(no);
    inner.appendChild(text);
    inner.appendChild(buttons);
    banner.appendChild(inner);
    document.body.appendChild(banner);
    // Room at the end of the page, so the banner never covers the footer.
    document.documentElement.classList.add("consent-open");
  }

  function closeBanner() {
    if (!banner) return;
    banner.remove();
    banner = null;
    document.documentElement.classList.remove("consent-open");
  }

  function accept() {
    store("on");
    closeBanner();
    load();
    // The box and the banner are gone; keyboard focus goes to the box the
    // search draws in, as the old gate's button did.
    boxes[0].focus();
  }

  function decline() {
    store("off");
    closeBanner();
    drawGate("off");
    // The button that had focus is gone with the banner; the box that now
    // explains the choice takes it, so a keyboard is not sent back to the top.
    gates[0].setAttribute("tabindex", "-1");
    gates[0].focus();
  }

  var choice = stored();
  if (choice === "on") { load(); return; }
  drawGate(choice === "off" ? "off" : "pending");
  if (choice !== "off") showBanner();
})();
