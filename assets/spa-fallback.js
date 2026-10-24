/* 404.html fallback for deep links. Pages are served as clean URLs (/movers, /stock?c=...). If the host ever fails to map one to its
   .html file, it lands on 404.html; this sends it to the real page, keeping the query string and hash. Any other address stays on the
   normal "Page not found" screen. The target ends in .html, which never matches the pattern, so it cannot loop. */
(function () {
  var bp = (window.FFL_CONFIG && window.FFL_CONFIG.BASE_PATH) || '', p = location.pathname;
  if (bp && p.indexOf(bp + '/') === 0) p = p.slice(bp.length);
  var m = p.match(/^\/(movers|changes|stocks|houses|funds|stock|house|fund|evidence|about)\/?$/);
  if (!m) return;
  document.documentElement.style.visibility = 'hidden';
  location.replace(bp + '/' + m[1] + '.html' + location.search + location.hash);
})();
