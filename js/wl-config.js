// Settings for the flight search, which Travelpayouts' White Label renders on
// the home page and on /he/search/. Language, currencies and colours are set in
// the Travelpayouts dashboard (White Label 23389), not here. Only the results
// page is: a search started from the home page's form lands on /he/search/.
// It loads before tpwgts.com/wl_web/main.js, which reads it on start.
window.TPWL_CONFIGURATION = Object.assign({}, window.TPWL_CONFIGURATION, {
  resultsURL: "https://pricelog.fyi/he/search/",
});
