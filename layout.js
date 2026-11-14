/* ============================================================
   layout.js — the header and footer, shared by every page.
   Each page has two empty placeholders:
     <header class="site-header" id="site-header"></header>
     <footer class="site-footer" id="site-footer"></footer>
   and loads this file first; it fills them in. To change the header or
   footer on every page, change it here.
   ============================================================ */


// The links in the header, in order. Add a page here and it appears everywhere.
const NAV_LINKS = [
  { href: "index.html", label: "Search" },
  { href: "my-reviews.html", label: "My reviews" },
];


// Which page are we on? The last part of the address, e.g. "my-reviews.html".
// On GitHub Pages the home page can be just ".../music-review-site-GE40/",
// whose last part is "" — that's index.html.
function getCurrentPageName() {
  const lastPart = window.location.pathname.split("/").pop();
  return lastPart || "index.html";
}


function fillHeader() {
  const currentPage = getCurrentPageName();

  // Build the nav links. The current page's link gets aria-current="page", which
  // tells screen readers "you are here" and is what style.css uses to highlight it.
  let navLinks = "";
  for (const link of NAV_LINKS) {
    const current = link.href === currentPage ? ' aria-current="page"' : "";
    navLinks += `<a href="${link.href}"${current}>${link.label}</a>`;
  }

  // innerHTML is fine here because every bit of this text is ours. Never use it
  // with text from MusicBrainz or from the user (use textContent for those).
  document.getElementById("site-header").innerHTML = `
    <div class="container header-inner">
      <a href="index.html" class="logo">Spin</a>
      <nav>${navLinks}</nav>
    </div>`;
}


function fillFooter() {
  // MusicBrainz asks apps that use its data to credit it.
  document.getElementById("site-footer").innerHTML = `
    <div class="container">
      <p>Album data from <a href="https://musicbrainz.org">MusicBrainz</a> and the
         <a href="https://coverartarchive.org">Cover Art Archive</a>.</p>
    </div>`;
}


fillHeader();
fillFooter();
