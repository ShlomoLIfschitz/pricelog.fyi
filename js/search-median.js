// The median panel on /he/search/ and /en/search/: beside a search from Tel
// Aviv, the numbers PriceLog collected for that destination and trip type. They come from
// /he/flights/medians.json, which pricelog-scaner writes with the destination
// pages, from the same baselines, so the panel and the page it links to agree.
//
// Nothing here is a guess. A search this script cannot read exactly, a
// destination or trip type the file does not list, or a file whose numbers do
// not hold together, all end the same way: no panel at all. The panel is built
// with textContent only, and reads nothing but the address and that file. It
// is ours, not the White Label's, so it does not wait for the search's gate.
(function () {
  var panel = document.querySelector("[data-median]");
  if (!panel) return;

  var FILE = "/he/flights/medians.json";
  var VERSION = 1;
  // One file for both pages: the numbers once, the words in each language
  // (name/name_en, path/path_en, trip_name/trip_name_en). The page's own
  // <html lang> picks them.
  var EN = document.documentElement.lang === "en";
  var KEY = EN ? { name: "name_en", path: "path_en", trip: "trip_name_en" }
               : { name: "name", path: "path", trip: "trip_name" };
  var PATH = EN ? /^\/en\/flights\/[a-z-]+\/$/ : /^\/he\/flights\/[a-z-]+\/$/;
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var ORIGIN = "TLV";
  // The compact form only: TLV2012LCA25121 (back on 25.12, one passenger) or
  // TLV2012LCA1 (one way). The White Label also writes other shapes, such as
  // legs joined by "-" after a swap (checked 2026-10-14); those get no panel
  // rather than a reading of what they might mean.
  var CODE = /^([A-Z]{3})(\d{2})(\d{2})([A-Z]{3})(?:(\d{2})(\d{2}))?(\d)$/;
  var TIME = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jerusalem", day: "numeric", month: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  });

  var file = null;
  function medians() {
    if (!file) {
      file = fetch(FILE, { cache: "no-cache" }).then(function (r) {
        if (!r.ok) throw new Error(FILE + " answered " + r.status);
        return r.json();
      });
    }
    return file;
  }

  function day(dd, mm) {
    var d = Number(dd), m = Number(mm);
    return d >= 1 && d <= 31 && m >= 1 && m <= 12;
  }

  // {destination, trip} for a search the panel may speak about, or null.
  function search() {
    var code = new URLSearchParams(location.search).get("flightSearch");
    var m = code && CODE.exec(code);
    if (!m || m[1] !== ORIGIN || m[4] === ORIGIN || !day(m[2], m[3])) return null;
    if (m[5] !== undefined && !day(m[5], m[6])) return null;
    return { destination: m[4], trip: m[5] === undefined ? "OW" : "RT" };
  }

  function money(text, value) {
    // The text is the scanner's rounding of the value; if they part, neither
    // can be trusted.
    var digits = String(text).replace(/[^0-9]/g, "");
    return digits !== "" && Number(digits) === Math.round(value);
  }

  // The entry and segment for this search, checked, or null.
  function numbers(data, s) {
    if (!data || data.version !== VERSION || !data.destinations) return null;
    var d = data.destinations[s.destination];
    var seg = d && d.segments && d.segments[s.trip];
    if (!seg) return null;
    var median = Number(seg.median), p10 = Number(seg.p10), n = seg.observations;
    var at = new Date(data.checked_at);
    var ok = Number.isInteger(n) && n >= 200 &&
      isFinite(median) && isFinite(p10) && p10 > 0 && p10 <= median &&
      money(seg.median_text, median) && money(seg.p10_text, p10) &&
      typeof d[KEY.name] === "string" && d[KEY.name] !== "" &&
      typeof seg[KEY.trip] === "string" && seg[KEY.trip] !== "" &&
      PATH.test(d[KEY.path]) && !isNaN(at);
    return ok ? { d: d, seg: seg, at: at, name: d[KEY.name], path: d[KEY.path],
                  trip: seg[KEY.trip] } : null;
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function num(text) {
    var e = el("span", "num", text);
    e.dir = "ltr";
    return e;
  }

  function moment(at) {
    var p = {};
    TIME.formatToParts(at).forEach(function (x) { p[x.type] = x.value; });
    if (EN) {
      // "15 Oct 2026": 15.10 reads one way in Israel and another in America.
      return Number(p.day) + " " + MONTHS[Number(p.month) - 1] + " " + p.year + ", " +
        p.hour + ":" + p.minute;
    }
    return Number(p.day) + "." + Number(p.month) + "." + p.year + ", " + p.hour + ":" + p.minute;
  }

  // The words, by the page's language. The English follow the English pages:
  // "collected", "lowest 10%", and nothing about a price being current.
  var W = EN ? {
    tag: "From PriceLog's data",
    median: ["Median price of ", " prices collected"],
    note: function (name, trip) {
      return "The median of all the prices PriceLog collected for " + name + ", " + trip +
        ", across every departure date, not only the dates of this search. Half the" +
        " prices are below it.";
    },
    low: ["Lowest 10%: ", " of the prices collected are below it"],
    link: "Destination page: ",
    updated: "Updated on ",
  } : {
    tag: "מהנתונים של PriceLog",
    median: ["מחיר חציוני של ", " מחירים שנאספו"],
    note: function (name, trip) {
      return "החציון של כל המחירים ש־PriceLog אסף ל" + name + ", " + trip +
        ", בכל תאריכי ההמראה, ולא רק בתאריכים שבחיפוש. חצי מהמחירים נמוכים ממנו.";
    },
    low: ["העשירון התחתון: ", " מהמחירים שנאספו נמוכים ממנו"],
    link: "לעמוד היעד: ",
    updated: "עודכן ב־",
  };

  function draw(x) {
    var seg = x.seg;
    var count = seg.observations.toLocaleString("en-US");
    panel.replaceChildren();

    panel.append(el("p", "median-tag", W.tag));
    var h = el("h2", null, x.name + " · " + x.trip);
    h.id = "median-title";
    panel.append(h);

    var line = el("p", "median-line");
    var big = el("strong");
    big.append(num(seg.median_text));
    var label = el("span", null, W.median[0]);
    label.append(num(count), W.median[1]);
    line.append(big, label);
    panel.append(line);

    panel.append(el("p", "median-note", W.note(x.name, x.trip)));

    var low = el("p", "median-low");
    var lowTitle = el("b", null, W.low[0]);
    lowTitle.append(num(seg.p10_text));
    var lowNote = el("small");
    lowNote.append(num("10%"), W.low[1]);
    low.append(lowTitle, lowNote);
    panel.append(low);

    var link = el("a", "median-link", W.link + x.name);
    link.href = x.path;
    panel.append(link);

    var asof = el("p", "price-asof", W.updated);
    var t = el("time");
    t.dateTime = x.at.toISOString();
    t.append(num(moment(x.at)));
    asof.append(t);
    panel.append(asof);

    panel.hidden = false;
  }

  var shown = null;
  function update() {
    var key = location.search;
    if (key === shown) return;
    shown = key;
    var s = search();
    if (!s) { panel.hidden = true; return; }
    medians().then(function (data) {
      if (location.search !== key) return;  // a newer search took over
      var x = numbers(data, s);
      if (x) draw(x); else panel.hidden = true;
    }).catch(function () {
      panel.hidden = true;
      file = null;  // the next search asks again
    });
  }

  // A new search inside the White Label rewrites the address without a reload
  // (history, checked 2026-10-14), and nothing announces it to this page.
  update();
  window.addEventListener("popstate", update);
  setInterval(update, 700);
})();
