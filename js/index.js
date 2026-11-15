/* The monthly price index (/he/index/<yyyy-mm>/, /en/index/<yyyy-mm>/).

   pricelog-scaner writes the page: the table as plain HTML, and every number
   the filters can reach as a JSON block (#ix-data), money already formatted,
   so rounding is decided there once. This script only chooses among those
   numbers - it computes none but the chart's scale and its trend line - and
   draws the filters, the three views and the sortable table.

   It requests nothing and stores nothing. Without it the page shows the
   round-trip table, the insights and the CSV; the filter bar and the chart
   stay `hidden`. A cut below the page's minimum has a count and no median in
   the data, and is shown as a dash, never estimated.
*/
(function () {
  "use strict";

  var block = document.getElementById("ix-data");
  if (!block) return;
  var data;
  try { data = JSON.parse(block.textContent); } catch (e) { return; }
  // A format this script does not know is left alone, not misread.
  if (!data || data.version !== 1) return;

  var W = data.words, L = W.labels, MIN = data.min;
  var rtl = document.documentElement.dir === "rtl";
  var SVG = "http://www.w3.org/2000/svg";
  var nf = new Intl.NumberFormat("en-US");
  var collator = new Intl.Collator(W.lang);
  var REGION_COLORS = {
    europe: "#0E6F8A", caucasus: "#CF4A23", gulf: "#FFB547", asia: "#13A574",
    north_america: "#0B2236", africa: "#7A5AA6", south_america: "#8A6D3B"
  };

  var DEFAULTS = { trip: "RT", stops: "all", nights: "all", region: "all" };
  var state = {
    trip: "RT", stops: "all", nights: "all", region: "all",
    view: "scatter", sort: "median", dir: 1, open: null, all: false
  };

  var bar = document.querySelector(".ix-bar");
  var filters = document.querySelector(".ix-filters");
  var chips = document.querySelector(".ix-chips");
  var sheet = document.querySelector(".ix-sheet");
  var sheetBody = document.querySelector(".ix-sheet-body");
  var chartCard = document.querySelector(".ix-chart-card");
  var views = document.querySelector(".ix-views");
  var plot = document.querySelector(".ix-plot");
  var legend = document.querySelector(".ix-legend");
  var table = document.querySelector(".ix-table");
  var tbody = table.tBodies[0];
  var more = document.querySelector(".ix-more");
  var sortBox = document.querySelector(".ix-sort");
  var narrow = window.matchMedia("(max-width: 760px)");

  function fmt(s, o) {
    return s.replace(/\{(\w+)\}/g, function (m, k) { return k in o ? o[k] : m; });
  }
  function h(tag, attrs, kids) {
    var e = document.createElement(tag);
    for (var k in attrs || {}) {
      if (k === "text") e.textContent = attrs[k];
      else if (k === "cls") e.className = attrs[k];
      else e.setAttribute(k, attrs[k]);
    }
    (kids || []).forEach(function (c) { if (c) e.appendChild(c); });
    return e;
  }
  function s(tag, attrs) {
    var e = document.createElementNS(SVG, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }
  function num(text) { return h("span", { cls: "num", dir: "ltr", text: text }); }

  // ---------------------------------------------------------------- data

  function key(stops, nights) {
    return state.trip + "/" + stops + "/" + (state.trip === "OW" ? "all" : nights);
  }
  function cut(d, stops, nights) {
    return d.cuts[key(stops === undefined ? state.stops : stops,
                      nights === undefined ? state.nights : nights)];
  }
  function est(c) { return !!c && typeof c.median === "number"; }
  function inRegion(d) { return state.region === "all" || d.region === state.region; }
  function listed() {
    return data.destinations.filter(function (d) { return inRegion(d) && est(cut(d)); });
  }

  // ---------------------------------------------------------------- filters

  filters.addEventListener("click", function (ev) {
    var b = ev.target.closest("button[data-f]");
    if (!b || b.disabled) return;
    var f = b.getAttribute("data-f");
    state[f] = b.getAttribute("data-v");
    // A one-way fare has no length: the length filter resets and rests.
    if (f === "trip" && state.trip === "OW") state.nights = "all";
    state.open = null;
    update();
  });

  function syncFilters() {
    ["trip", "stops", "nights", "region"].forEach(function (f) {
      filters.querySelectorAll('button[data-f="' + f + '"]').forEach(function (b) {
        b.setAttribute("aria-pressed", String(b.getAttribute("data-v") === state[f]));
      });
    });
    var ow = state.trip === "OW";
    filters.querySelectorAll('button[data-f="nights"]').forEach(function (b) { b.disabled = ow; });
    filters.querySelector(".ix-group--nights").classList.toggle("is-off", ow);
  }

  function labelOf(f) {
    var b = filters.querySelector('button[data-f="' + f + '"][data-v="' + state[f] + '"]');
    return b ? b.textContent : "";
  }

  function drawChips() {
    chips.textContent = "";
    var open = h("button", { type: "button", cls: "ix-chip-btn ix-chip-btn--main", "aria-haspopup": "dialog" }, [
      h("span", { "aria-hidden": "true", cls: "ix-chip-ico" }), document.createTextNode(W.filter)
    ]);
    chips.appendChild(open);
    [labelOf("trip"), fmt(W.chip_stops, { v: labelOf("stops") }),
     state.trip === "OW" ? null : fmt(W.chip_nights, { v: labelOf("nights") }),
     state.region === "all" ? null : labelOf("region")].forEach(function (t) {
      if (!t) return;
      chips.appendChild(h("button", { type: "button", cls: "ix-chip-btn", "aria-haspopup": "dialog" }, [
        document.createTextNode(t), h("span", { "aria-hidden": "true", cls: "ix-caret", text: "▾" })
      ]));
    });
  }

  chips.addEventListener("click", function (ev) {
    if (!ev.target.closest("button")) return;
    sheetBody.appendChild(filters);
    if (typeof sheet.showModal === "function") sheet.showModal();
    else sheet.setAttribute("open", "");
  });
  function closeSheet() {
    if (typeof sheet.close === "function" && sheet.open) sheet.close();
    else sheet.removeAttribute("open");
  }
  sheet.addEventListener("close", function () { bar.appendChild(filters); drawChips(); });
  // A click on the dimmed backdrop lands on the dialog itself.
  sheet.addEventListener("click", function (ev) { if (ev.target === sheet) closeSheet(); });
  sheet.querySelector(".ix-apply").addEventListener("click", closeSheet);
  sheet.querySelector(".ix-reset").addEventListener("click", function () {
    for (var k in DEFAULTS) state[k] = DEFAULTS[k];
    state.open = null;
    update();
  });

  // ---------------------------------------------------------------- views

  var VIEWS = [["scatter", W.view_scatter], ["rank", W.view_rank], ["dvs", W.view_dvs]];
  VIEWS.forEach(function (v) {
    views.appendChild(h("button", { type: "button", "data-view": v[0], "aria-pressed": "false", text: v[1] }));
  });
  views.addEventListener("click", function (ev) {
    var b = ev.target.closest("button[data-view]");
    if (!b) return;
    state.view = b.getAttribute("data-view");
    drawView();
  });

  function drawView() {
    views.querySelectorAll("button").forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.getAttribute("data-view") === state.view));
    });
    var title = { scatter: W.view_scatter, rank: W.view_rank, dvs: W.view_dvs }[state.view];
    var sub = { scatter: W.sub_scatter, rank: W.sub_rank, dvs: fmt(W.sub_dvs, { min: MIN }) }[state.view];
    chartCard.querySelector("#ix-view-h").textContent = title;
    chartCard.querySelector(".ix-view-sub").textContent = sub;
    plot.textContent = "";
    legend.hidden = state.view !== "scatter";
    if (state.view === "scatter") scatter(listed());
    else if (state.view === "rank") ranking(listed());
    else directVsStops();
  }

  function empty() {
    plot.appendChild(h("p", { cls: "ix-empty", text: fmt(W.empty, { min: MIN }) }));
  }

  function niceStep(max, intervals) {
    var steps = [50, 100, 150, 200, 250, 300, 500, 600, 1000, 1500, 2000, 2500, 5000, 10000];
    for (var i = 0; i < steps.length; i++) if (max / steps[i] <= intervals) return steps[i];
    return Math.ceil(max / intervals);
  }

  // Distance against median: every destination in the view with a distance.
  function scatter(list) {
    var pts = list.map(function (d) { return { d: d, km: d.km[state.trip], c: cut(d) }; })
      .filter(function (p) { return typeof p.km === "number"; });
    if (!pts.length) return empty();

    // Drawn at the plot's own width, so a phone gets 11px ticks, not 5px ones.
    var width = Math.max(280, Math.round(plot.clientWidth || 716));
    // The y labels sit on the page's start side, as on the site's price charts
    // (chart.py): the right in Hebrew, the left in English.
    var X0 = rtl ? 8 : 48, X1 = rtl ? width - 48 : width - 8, Y1 = narrow.matches ? 260 : 380;
    var maxKm = Math.max.apply(null, pts.map(function (p) { return p.km; }));
    var maxV = Math.max.apply(null, pts.map(function (p) { return p.c.median; }));
    var xStep = niceStep(maxKm, 4), xMax = Math.max(xStep, Math.ceil(maxKm / xStep) * xStep);
    var yStep = niceStep(maxV, 4), yMax = Math.max(yStep, Math.ceil(maxV / yStep) * yStep);
    // Distance grows to the right in both languages, as a chart's axis is read
    // in Hebrew too, and as the site's price charts run their dates.
    function sx(km) { return X0 + km / xMax * (X1 - X0); }
    function sy(v) { return Y1 - v / yMax * Y1; }
    var ns = pts.map(function (p) { return p.c.n; });
    var nMin = Math.min.apply(null, ns), nMax = Math.max.apply(null, ns);
    function r(n) { return 7 + 5.5 * Math.sqrt(nMax === nMin ? 0.5 : (n - nMin) / (nMax - nMin)); }

    var svg = s("svg", { viewBox: "-4 -14 " + (width + 16) + " " + (Y1 + 46), class: "ix-scatter", role: "group",
                         "aria-label": W.view_scatter + ". " + W.keys });
    for (var v = 0; v <= yMax; v += yStep) {
      svg.appendChild(s("rect", { x: X0, y: sy(v), width: X1 - X0, height: 1, class: "ix-gridline" }));
      var yl = s("text", { x: rtl ? width : 0, y: sy(v) + 4, class: "ix-tick", "text-anchor": rtl ? "end" : "start" });
      yl.textContent = "$" + nf.format(v);
      svg.appendChild(yl);
    }
    for (var k = 0; k <= xMax; k += xStep) {
      var xl = s("text", { x: sx(k), y: Y1 + 20, class: "ix-tick", "text-anchor": "middle", direction: rtl ? "rtl" : "ltr" });
      xl.textContent = fmt(W.km, { n: nf.format(k) });
      svg.appendChild(xl);
    }

    // Least squares through the dots shown, km against median.
    var trend = null;
    if (pts.length > 2) {
      var n = pts.length, mx = 0, my = 0;
      pts.forEach(function (p) { mx += p.km / n; my += p.c.median / n; });
      var sxy = 0, sxx = 0;
      pts.forEach(function (p) { sxy += (p.km - mx) * (p.c.median - my); sxx += (p.km - mx) * (p.km - mx); });
      if (sxx > 0) {
        var b = sxy / sxx, a = my - b * mx;
        trend = { a: a, b: b };
        var xa = 0, xb = xMax;
        // Kept inside the plot: where the line leaves it, it is cut.
        function clampX(y) { return b === 0 ? null : (y - a) / b; }
        if (a < 0) xa = clampX(0); else if (a > yMax) xa = clampX(yMax);
        var yEnd = a + b * xMax;
        if (yEnd < 0) xb = clampX(0); else if (yEnd > yMax) xb = clampX(yMax);
        var line = s("line", { x1: sx(xa), y1: sy(a + b * xa), x2: sx(xb), y2: sy(a + b * xb), class: "ix-trend" });
        line.appendChild(s("title", {})).textContent = W.trend;
        svg.appendChild(line);
      }
    }

    // Big dots first, so a small one is never hidden under a large one.
    var order = pts.slice().sort(function (p, q) { return q.c.n - p.c.n; });
    var dots = [];
    var g = s("g", {});
    order.forEach(function (p) {
      var c = s("circle", {
        cx: sx(p.km), cy: sy(p.c.median), r: r(p.c.n), fill: REGION_COLORS[p.d.region] || "#5E6B75",
        class: "ix-dot-mark", tabindex: "-1", role: "button",
        "aria-label": fmt(W.dot, { name: p.d.name, price: p.c.text, km: nf.format(p.km), n: nf.format(p.c.n) })
      });
      c.__p = p;
      g.appendChild(c);
      dots.push(c);
    });
    svg.appendChild(g);

    // Names for the dots that stand out: the cheapest, then those furthest
    // from the trend line, either way. Skipped where a name would collide.
    var resid = function (p) { return trend ? Math.abs(p.c.median - (trend.a + trend.b * p.km)) : p.c.median; };
    var byPrice = pts.slice().sort(function (p, q) { return p.c.median - q.c.median; });
    var pick = [byPrice[0]].concat(pts.slice().sort(function (p, q) { return resid(q) - resid(p); }));
    var boxes = [], named = 0;
    pick.forEach(function (p) {
      if (named >= (narrow.matches ? 6 : 10) || p.__labelled) return;
      p.__labelled = true;
      var w = p.d.name.length * 6.6, x = sx(p.km), y = sy(p.c.median) - r(p.c.n) - 4;
      var box = [x - w / 2 - 2, y - 13, x + w / 2 + 2, y + 3];
      var hit = boxes.some(function (o) { return !(box[2] < o[0] || box[0] > o[2] || box[3] < o[1] || box[1] > o[3]); });
      if (hit || box[1] < -12 || box[0] < X0 - 18 || box[2] > X1 + 18) return;
      boxes.push(box);
      named++;
      var t = s("text", { x: x, y: y, class: "ix-name", "text-anchor": "middle", "aria-hidden": "true" });
      t.textContent = p.d.name;
      svg.appendChild(t);
    });

    var wrap = h("div", { cls: "ix-plot-in" }, []);
    wrap.appendChild(svg);
    var tip = h("div", { cls: "ix-tip", "aria-hidden": "true", hidden: "" });
    wrap.appendChild(tip);
    plot.appendChild(wrap);

    // One stop in the tab order; the arrows walk the dots by distance.
    var walk = dots.slice().sort(function (p, q) { return p.__p.km - q.__p.km || p.__p.c.median - q.__p.c.median; });
    walk[0].setAttribute("tabindex", "0");
    function show(c) {
      var p = c.__p, box = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal;
      var scale = box.width / vb.width;
      tip.textContent = "";
      tip.appendChild(h("strong", { text: p.d.name + " · " + p.c.text }));
      tip.appendChild(h("span", { text: fmt(W.tip, { km: nf.format(p.km), n: nf.format(p.c.n) }) }));
      tip.hidden = false;
      var cx = (sx(p.km) - vb.x) * scale, cy = (sy(p.c.median) - vb.y) * scale;
      var tw = tip.offsetWidth, th = tip.offsetHeight;
      var left = Math.min(Math.max(cx - tw / 2, 0), box.width - tw);
      var top = cy - r(p.c.n) * scale - th - 8;
      if (top < 0) top = cy + r(p.c.n) * scale + 8;
      tip.style.insetInlineStart = "auto";
      tip.style.left = left + "px";
      tip.style.top = top + "px";
    }
    function hide() { tip.hidden = true; }
    dots.forEach(function (c) {
      c.addEventListener("mouseenter", function () { show(c); });
      c.addEventListener("mouseleave", hide);
      c.addEventListener("focus", function () { show(c); });
      c.addEventListener("blur", hide);
      c.addEventListener("click", function () { openRow(c.__p.d.code); });
      c.addEventListener("keydown", function (ev) {
        var i = walk.indexOf(c), to = null;
        var fwd = "ArrowRight", back = "ArrowLeft";
        if (ev.key === fwd || ev.key === "ArrowDown") to = walk[Math.min(i + 1, walk.length - 1)];
        else if (ev.key === back || ev.key === "ArrowUp") to = walk[Math.max(i - 1, 0)];
        else if (ev.key === "Home") to = walk[0];
        else if (ev.key === "End") to = walk[walk.length - 1];
        else if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); openRow(c.__p.d.code); return; }
        if (!to) return;
        ev.preventDefault();
        c.setAttribute("tabindex", "-1");
        to.setAttribute("tabindex", "0");
        to.focus();
      });
    });
  }

  // Each median as a bar from zero, cheapest first.
  function ranking(list) {
    if (!list.length) return empty();
    list = list.slice().sort(function (p, q) { return cut(p).median - cut(q).median; });
    var top = cut(list[list.length - 1]).median;
    var ol = h("ol", { cls: "ix-rank" });
    list.forEach(function (d) {
      var c = cut(d);
      var fill = h("span", {});
      fill.style.setProperty("--w", (c.median / top).toFixed(3));
      ol.appendChild(h("li", {}, [
        h("span", { cls: "ix-rank-name", text: d.name }),
        h("span", { cls: "ix-track", "aria-hidden": "true" }, [fill]),
        h("span", { cls: "ix-rank-v" }, [num(c.text)])
      ]));
    });
    plot.appendChild(ol);
  }

  // Direct against with stops, wherever both have enough prices, at the
  // chosen trip type, length and region. The stops filter does not apply:
  // the view is the comparison.
  function directVsStops() {
    var list = data.destinations.filter(function (d) {
      return inRegion(d) && est(cut(d, "direct")) && est(cut(d, "stops"));
    });
    if (!list.length) return empty();
    list.sort(function (p, q) {
      return Math.abs(cut(q, "stops").median - cut(q, "direct").median) -
             Math.abs(cut(p, "stops").median - cut(p, "direct").median);
    });
    var top = Math.max.apply(null, list.map(function (d) {
      return Math.max(cut(d, "direct").median, cut(d, "stops").median);
    }));
    var key = h("p", { cls: "ix-dvs-key" }, [
      h("span", { cls: "ix-dvs-dot ix-dvs-dot--direct", "aria-hidden": "true" }), document.createTextNode(L.direct + "  "),
      h("span", { cls: "ix-dvs-dot ix-dvs-dot--stops", "aria-hidden": "true" }), document.createTextNode(L.stops)
    ]);
    var ol = h("ol", { cls: "ix-dvs" });
    list.forEach(function (d) {
      var a = cut(d, "direct"), b = cut(d, "stops");
      var lo = Math.min(a.median, b.median) / top, hi = Math.max(a.median, b.median) / top;
      var span = h("span", { cls: "ix-dvs-span" });
      span.style.setProperty("--a", lo.toFixed(3));
      span.style.setProperty("--b", hi.toFixed(3));
      var da = h("span", { cls: "ix-dvs-dot ix-dvs-dot--direct" }), db = h("span", { cls: "ix-dvs-dot ix-dvs-dot--stops" });
      da.style.setProperty("--p", (a.median / top).toFixed(3));
      db.style.setProperty("--p", (b.median / top).toFixed(3));
      ol.appendChild(h("li", {}, [
        h("span", { cls: "ix-rank-name", text: d.name }),
        h("span", { cls: "ix-dvs-track", "aria-hidden": "true" }, [span, da, db]),
        h("span", { cls: "ix-dvs-v" }, [
          document.createTextNode(L.direct + " "), num(a.text),
          document.createTextNode(" · " + L.stops + " "), num(b.text)
        ])
      ]));
    });
    plot.appendChild(key);
    plot.appendChild(ol);
  }

  // ---------------------------------------------------------------- table

  var COLS = ["name", "region", "median", "direct", "stops", "n2_4", "n5_9", "n"];
  var heads = table.tHead.rows[0].cells;
  COLS.forEach(function (k, i) {
    var th = heads[i];
    var label = th.textContent;
    th.textContent = "";
    th.appendChild(h("button", { type: "button", "data-k": k }, [
      document.createTextNode(label), h("span", { cls: "ix-arrow", "aria-hidden": "true" })
    ]));
  });
  table.tHead.addEventListener("click", function (ev) {
    var b = ev.target.closest("button[data-k]");
    if (!b) return;
    sortBy(b.getAttribute("data-k"));
  });
  function sortBy(k) {
    if (state.sort === k) state.dir = -state.dir;
    else { state.sort = k; state.dir = 1; }
    drawTable();
  }

  // The narrow layout has no column headings to click: a menu sorts instead.
  var select = h("select", { id: "ix-sort-by" });
  COLS.forEach(function (k, i) {
    if (k === "region") return;
    select.appendChild(h("option", { value: k, text: W.columns[i] }));
  });
  sortBox.appendChild(h("label", { for: "ix-sort-by", text: W.sort + ":" }));
  sortBox.appendChild(select);
  select.addEventListener("change", function () { state.sort = select.value; state.dir = 1; drawTable(); });

  function value(d, k) {
    if (k === "name") return d.name;
    if (k === "region") return L[d.region];
    if (k === "n") { var c0 = cut(d); return c0 ? c0.n : null; }
    var c = k === "median" ? cut(d)
      : k === "direct" ? cut(d, "direct") : k === "stops" ? cut(d, "stops")
      : cut(d, undefined, k);
    return est(c) ? c.median : null;
  }

  function cell(c) {
    return est(c) ? num(c.text) : document.createTextNode("—");
  }

  function drawTable() {
    var rows = listed();
    var k = state.sort, dir = state.dir;
    rows.sort(function (p, q) {
      var a = value(p, k), b = value(q, k);
      // Dashes go last whichever way the column is sorted.
      if (a === null || b === null) return a === b ? 0 : a === null ? 1 : -1;
      var r = typeof a === "string" ? collator.compare(a, b) : a - b;
      return r * dir || collator.compare(p.name, q.name);
    });
    COLS.forEach(function (c, i) {
      if (c === k) heads[i].setAttribute("aria-sort", dir === 1 ? "ascending" : "descending");
      else heads[i].removeAttribute("aria-sort");
    });
    select.value = k === "region" ? "median" : k;
    table.classList.toggle("ix-ow", state.trip === "OW");

    var top = Math.max.apply(null, rows.map(function (d) { return cut(d).median; }).concat([1]));
    var limit = narrow.matches ? 10 : 12;
    var shown = state.all ? rows : rows.slice(0, limit);
    if (state.open && !rows.some(function (d) { return d.code === state.open; })) state.open = null;
    if (state.open && !shown.some(function (d) { return d.code === state.open; })) {
      state.all = true;
      shown = rows;
    }

    tbody.textContent = "";
    shown.forEach(function (d) {
      var c = cut(d), open = state.open === d.code, id = "ix-drill-" + d.code;
      var fill = h("span", {});
      fill.style.setProperty("--w", (c.median / top).toFixed(3));
      var name = h("button", { type: "button", cls: "ix-name-btn", "aria-expanded": String(open), "aria-controls": id, "data-code": d.code, text: d.name });
      var tr = h("tr", { "data-code": d.code, cls: open ? "is-open" : "" }, [
        h("th", { scope: "row" }, [name]),
        h("td", {}, [h("span", { cls: "ix-chip", text: L[d.region] })]),
        h("td", { cls: "ix-med" }, [h("span", { cls: "ix-med-v" }, [num(c.text)]),
                                    h("span", { cls: "ix-track", "aria-hidden": "true" }, [fill])]),
        h("td", {}, [cell(cut(d, "direct"))]),
        h("td", {}, [cell(cut(d, "stops"))]),
        h("td", {}, [cell(cut(d, undefined, "n2_4"))]),
        h("td", {}, [cell(cut(d, undefined, "n5_9"))]),
        h("td", { cls: "ix-n", text: nf.format(c.n) })
      ]);
      tbody.appendChild(tr);
      if (open) tbody.appendChild(drill(d, id));
    });

    if (rows.length > limit) {
      more.hidden = false;
      more.textContent = state.all ? W.less : fmt(W.more, { n: nf.format(rows.length) });
      more.setAttribute("aria-expanded", String(state.all));
    } else {
      more.hidden = true;
    }
  }

  function drill(d, id) {
    var stats = [["direct", "all"], ["stops", "all"]];
    if (state.trip === "RT") stats.push(["all", "n2_4"], ["all", "n5_9"]);
    var box = h("div", { cls: "ix-drill-in", role: "group", "aria-label": fmt(W.details, { name: d.name }) });
    stats.forEach(function (st) {
      var c = d.cuts[key(st[0], st[1] === "all" ? state.nights : st[1])];
      if (st[0] === "all") c = d.cuts[key(state.stops, st[1])];
      var label = st[0] === "all" ? L[st[1]] : L[st[0]];
      box.appendChild(h("div", { cls: "ix-stat" }, [
        h("span", { cls: "ix-stat-l", text: label }),
        h("strong", {}, [cell(c)]),
        h("span", { cls: "ix-stat-n", text: fmt(W.prices, { n: nf.format(c ? c.n : 0) }) })
      ]));
    });
    box.appendChild(h("a", { cls: "ix-drill-link", href: d.path }, [
      document.createTextNode(fmt(W.all_prices, { name: d.name }) + " "),
      h("span", { "aria-hidden": "true", text: rtl ? "←" : "→" })
    ]));
    return h("tr", { cls: "ix-drill", id: id }, [h("td", { colspan: "8" }, [box])]);
  }

  tbody.addEventListener("click", function (ev) {
    var b = ev.target.closest(".ix-name-btn");
    if (!b) return;
    var code = b.getAttribute("data-code");
    state.open = state.open === code ? null : code;
    drawTable();
    var again = tbody.querySelector('.ix-name-btn[data-code="' + code + '"]');
    if (again) again.focus();
  });

  more.addEventListener("click", function () {
    state.all = !state.all;
    drawTable();
  });

  function openRow(code) {
    state.open = code;
    drawTable();
    var b = tbody.querySelector('.ix-name-btn[data-code="' + code + '"]');
    if (!b) return;
    b.scrollIntoView({ block: "center" });
    b.focus({ preventScroll: true });
  }

  // ---------------------------------------------------------------- all of it

  function update() {
    syncFilters();
    var n = listed().length;
    bar.querySelector(".ix-count").textContent = nf.format(n);
    sheet.querySelector(".ix-apply").textContent = fmt(W.apply, { n: nf.format(n) });
    drawChips();
    drawView();
    drawTable();
  }

  document.querySelector(".ix-hint-js").textContent = W.hint;
  bar.hidden = false;
  chartCard.hidden = false;
  sortBox.hidden = false;
  narrow.addEventListener("change", function () { drawView(); drawTable(); });
  update();
})();
