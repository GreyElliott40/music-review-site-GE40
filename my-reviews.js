/* ============================================================
   my-reviews.js — the My reviews page (my-reviews.html).
   Reads every review from localStorage with loadAllReviews() (reviews.js),
   shows stats, a rating histogram, and a sortable, filterable grid of cards.
   This page makes NO MusicBrainz requests and never writes to storage.
   ============================================================ */


/* ---------- 1. Page parts and constants ---------- */
const statusMessage = document.getElementById("status-message");
const emptyState = document.getElementById("empty-state");
const statsSection = document.getElementById("stats");
const statCount = document.getElementById("stat-count");
const statAverage = document.getElementById("stat-average");
const statLiked = document.getElementById("stat-liked");
const histogram = document.getElementById("histogram");
const controlsSection = document.getElementById("review-controls");
const filterText = document.getElementById("filter-text");
const sortSelect = document.getElementById("sort-select");
const minRatingSelect = document.getElementById("min-rating-select");
const likedOnlyBox = document.getElementById("liked-only");
const resultsCount = document.getElementById("results-count");
const noMatches = document.getElementById("no-matches");
const clearFiltersButton = document.getElementById("clear-filters");
const reviewGrid = document.getElementById("review-grid");

const PREVIEW_LENGTH = 150; // characters of review text shown before "Read more"
const SORT_OPTIONS = ["recent", "highest", "lowest", "artist", "year"];

// Every possible rating: 0.5, 1, 1.5 ... 5.
const HALF_STEPS = [];
for (let step = 0.5; step <= 5; step += 0.5) {
  HALF_STEPS.push(step);
}


/* ---------- 2. State ----------
   allReviews: every saved review, as a list.
   view: the current sort and filters. It's read from the address on load and
   written back to the address whenever it changes, so refresh and Back keep it. */
let allReviews = [];
let view = readViewFromAddress();

// my-reviews.html?sort=highest&liked=1&min=3.5&q=beatles
function readViewFromAddress() {
  const params = new URLSearchParams(window.location.search);
  const sort = params.get("sort");
  const min = Number(params.get("min"));
  return {
    // Anything unexpected in the address falls back to the default.
    sort: SORT_OPTIONS.includes(sort) ? sort : "recent",
    likedOnly: params.get("liked") === "1",
    minRating: HALF_STEPS.includes(min) ? min : 0,
    text: params.get("q") || "",
  };
}

// Only non-default settings go in the address, so the plain page stays my-reviews.html.
// replaceState changes the address without reloading or adding a Back step.
function saveViewToAddress() {
  const params = new URLSearchParams();
  if (view.sort !== "recent") params.set("sort", view.sort);
  if (view.likedOnly) params.set("liked", "1");
  if (view.minRating > 0) params.set("min", view.minRating);
  if (view.text) params.set("q", view.text);
  const query = params.toString();
  history.replaceState(null, "", query ? "?" + query : window.location.pathname);
}

// Make the controls match the view (on load, and after "Clear filters").
function showViewInControls() {
  sortSelect.value = view.sort;
  minRatingSelect.value = String(view.minRating);
  likedOnlyBox.checked = view.likedOnly;
  filterText.value = view.text;
}


/* ---------- 3. Reading the reviews ----------
   Returns a list of reviews, or null if storage is blocked or the data is damaged.
   Object.values turns { id1: review1, id2: review2 } into [review1, review2].
   Entries that aren't proper reviews are skipped, not deleted. */
function readReviews() {
  const stored = loadAllReviews();
  if (stored === null) {
    return null;
  }
  return Object.values(stored).filter(function (review) {
    return review !== null && typeof review === "object" &&
           Boolean(review.albumId) && typeof review.rating === "number";
  });
}


/* ---------- 4. Stats and histogram (always for ALL reviews) ---------- */
function showStats(reviews) {
  let ratingTotal = 0;
  let likedCount = 0;
  for (const review of reviews) {
    ratingTotal += review.rating;
    if (review.liked) {
      likedCount += 1;
    }
  }
  statCount.textContent = reviews.length;
  // toFixed(1) rounds to one decimal place and always shows it: 4 → "4.0", 3.75 → "3.8".
  statAverage.textContent = (ratingTotal / reviews.length).toFixed(1) + " ★";
  statLiked.textContent = likedCount;
}

// One bar per half star. The tallest bar is the most common rating; the others
// are sized relative to it (so with counts 2 and 8, the bars are 25% and 100% tall).
function showHistogram(reviews) {
  const counts = {};
  for (const step of HALF_STEPS) {
    counts[step] = 0;
  }
  for (const review of reviews) {
    const step = Math.round(review.rating * 2) / 2; // snap to the nearest half, just in case
    if (step in counts) {
      counts[step] += 1;
    }
  }
  const biggest = Math.max(...Object.values(counts)); // "..." spreads the list into separate numbers

  histogram.innerHTML = "";
  for (const step of HALF_STEPS) {
    const count = counts[step];
    const bar = document.createElement("li");
    bar.className = "histogram-bar";
    bar.classList.toggle("empty", count === 0);
    bar.style.height = (count === 0 ? 0 : (count / biggest) * 100) + "%";

    // Hover text, plus hidden text for screen readers.
    const label = `${step} stars: ${count} ${count === 1 ? "album" : "albums"}`;
    bar.title = label;
    const hiddenLabel = document.createElement("span");
    hiddenLabel.className = "visually-hidden";
    hiddenLabel.textContent = label;
    bar.append(hiddenLabel);

    histogram.append(bar);
  }
}


/* ---------- 5. Filtering and sorting ---------- */

// Lowercase and remove accents, so "debi" matches "DeBÍ".
// normalize("NFD") splits "Í" into "I" + an accent mark; the replace removes the marks.
function simplifyText(text) {
  return String(text || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function matchesFilters(review) {
  if (view.likedOnly && !review.liked) return false;
  if (review.rating < view.minRating) return false;
  if (view.text) {
    const searchable = simplifyText(fixCapitalization(review.title || "") + " " + (review.artist || ""));
    if (!searchable.includes(simplifyText(view.text.trim()))) return false;
  }
  return true;
}

// Compares text A–Z, ignoring capitals and accents.
function compareText(a, b) {
  return String(a || "").localeCompare(String(b || ""), undefined, { sensitivity: "base" });
}

// For Artist A–Z, ignore a leading "The", like music apps do: "The Beatles" sorts under B.
function artistSortName(artist) {
  return String(artist || "").replace(/^the\s+/i, ""); // ^ = start, \s+ = spaces, i = any capitals
}

// A sort "compare function" gets two reviews and returns a negative number if
// a should come first, positive if b should, or 0 if it doesn't matter.
// "x || y" means: use x, but if it's 0 (a tie), use y instead.
function compareReviews(a, b) {
  const newestFirst = String(b.savedAt).localeCompare(String(a.savedAt)); // dates in ISO text sort correctly
  switch (view.sort) {
    case "highest":
      return b.rating - a.rating || newestFirst;
    case "lowest":
      return a.rating - b.rating || newestFirst;
    case "artist":
      return compareText(artistSortName(a.artist), artistSortName(b.artist)) || compareText(a.title, b.title);
    case "year": {
      const yearA = a.year || "";
      const yearB = b.year || "";
      if (yearA !== yearB) {
        if (!yearA) return 1;  // no year: goes last
        if (!yearB) return -1;
        return yearB.localeCompare(yearA); // newest year first
      }
      return compareText(a.artist, b.artist) || compareText(a.title, b.title);
    }
    default: // "recent"
      return newestFirst;
  }
}


/* ---------- 6. Building a review card ---------- */

// Shortens long text at a word boundary: "...the best 16 minutes in…"
function shortenText(text) {
  let short = text.slice(0, PREVIEW_LENGTH);
  const lastSpace = short.lastIndexOf(" ");
  if (lastSpace > PREVIEW_LENGTH - 30) {
    short = short.slice(0, lastSpace); // don't cut a word in half
  }
  return short.trimEnd() + "…";
}

// The review text, with "Read more" / "Show less" if it's long. null if there's no text.
function createReviewText(text) {
  if (!text) {
    return null;
  }
  const paragraph = document.createElement("p");
  paragraph.className = "review-card-text";

  if (text.length <= PREVIEW_LENGTH) {
    paragraph.textContent = text;
    return paragraph;
  }

  const shortText = shortenText(text);
  const textPart = document.createElement("span");
  textPart.textContent = shortText;

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "read-more";
  toggle.textContent = "Read more";
  toggle.setAttribute("aria-expanded", "false"); // tells screen readers whether it's open

  let expanded = false;
  toggle.addEventListener("click", function () {
    expanded = !expanded;
    textPart.textContent = expanded ? text : shortText;
    toggle.textContent = expanded ? "Show less" : "Read more";
    toggle.setAttribute("aria-expanded", String(expanded));
  });

  paragraph.append(textPart, " ", toggle);
  return paragraph;
}

// One card:
//   <article class="review-card">
//     <a class="review-card-cover"> cover </a>
//     <div class="review-card-info"> title (link), artist, year, stars + heart, text, date </div>
//   </article>
function createReviewCard(review) {
  const albumAddress = "album.html?" + new URLSearchParams({ id: review.albumId });
  const title = fixCapitalization(review.title || "Untitled");

  const card = document.createElement("article");
  card.className = "review-card";

  // The cover links to the album page too. tabIndex -1 and aria-hidden keep it out of
  // the Tab order and screen readers, since the title link right below goes to the same place.
  const coverLink = document.createElement("a");
  coverLink.className = "review-card-cover";
  coverLink.href = albumAddress;
  coverLink.tabIndex = -1;
  coverLink.setAttribute("aria-hidden", "true");
  const cover = createCoverFromUrl(review.coverUrl, "Cover of " + title); // musicbrainz.js
  if (cover.tagName === "IMG") {
    cover.loading = "lazy";
  }
  coverLink.append(cover);

  const info = document.createElement("div");
  info.className = "review-card-info";

  const heading = document.createElement("h3");
  heading.className = "album-title";
  const titleLink = document.createElement("a");
  titleLink.className = "review-card-title-link";
  titleLink.href = albumAddress;
  titleLink.textContent = title;
  heading.append(titleLink);

  const artist = document.createElement("p");
  artist.className = "album-artist";
  artist.textContent = review.artist || "Unknown artist";
  info.append(heading, artist);

  if (review.year) {
    const year = document.createElement("p");
    year.className = "album-year";
    year.textContent = review.year;
    info.append(year);
  }

  const ratingRow = document.createElement("div");
  ratingRow.className = "review-card-rating";
  ratingRow.append(createStarDisplay(review.rating)); // reviews.js, same stars as the album page
  if (review.liked) {
    const heart = document.createElement("span");
    heart.className = "review-card-heart";
    heart.textContent = "♥";
    heart.setAttribute("role", "img");
    heart.setAttribute("aria-label", "Liked");
    ratingRow.append(heart);
  }
  info.append(ratingRow);

  const text = createReviewText(review.text);
  if (text) {
    info.append(text);
  }

  const date = document.createElement("p");
  date.className = "review-card-date";
  date.textContent = "Reviewed " + formatReviewDate(review.savedAt); // reviews.js
  info.append(date);

  card.append(coverLink, info);
  return card;
}


/* ---------- 7. Drawing the list ---------- */
function render() {
  // filter() makes a new list, so sorting it doesn't reorder allReviews.
  const shown = allReviews.filter(matchesFilters).sort(compareReviews);

  reviewGrid.innerHTML = "";
  for (const review of shown) {
    reviewGrid.append(createReviewCard(review));
  }

  noMatches.hidden = shown.length > 0;
  if (shown.length === 0) {
    resultsCount.textContent = "";
  } else if (shown.length === allReviews.length) {
    resultsCount.textContent = shown.length + (shown.length === 1 ? " review" : " reviews");
  } else {
    resultsCount.textContent = `Showing ${shown.length} of ${allReviews.length} reviews`;
  }
}

// Called whenever a control changes.
function onViewChanged() {
  saveViewToAddress();
  render();
}


/* ---------- 8. Controls ---------- */

// Fill the rating filter: "Any rating", "0.5★ and up" ... "5★ only".
function fillMinRatingOptions() {
  minRatingSelect.append(new Option("Any rating", "0")); // new Option(text, value) makes an <option>
  for (const step of HALF_STEPS) {
    const label = step === 5 ? "5★ only" : step + "★ and up";
    minRatingSelect.append(new Option(label, String(step)));
  }
}

// "change" fires when you pick a different option or tick the box.
sortSelect.addEventListener("change", function () {
  view.sort = sortSelect.value;
  onViewChanged();
});

minRatingSelect.addEventListener("change", function () {
  view.minRating = Number(minRatingSelect.value);
  onViewChanged();
});

likedOnlyBox.addEventListener("change", function () {
  view.likedOnly = likedOnlyBox.checked;
  onViewChanged();
});

// "input" fires on every keystroke, so the list filters as you type.
filterText.addEventListener("input", function () {
  view.text = filterText.value;
  onViewChanged();
});

// Clears the filters but keeps the sort.
clearFiltersButton.addEventListener("click", function () {
  view.likedOnly = false;
  view.minRating = 0;
  view.text = "";
  showViewInControls();
  onViewChanged();
});


/* ---------- 9. Load the page ---------- */
function loadPage() {
  const reviews = readReviews();

  if (reviews === null) {
    statusMessage.textContent = "Your saved reviews couldn't be read. Private browsing or strict browser settings can block them, or the saved data may be damaged. Nothing has been changed or deleted.";
    statusMessage.classList.add("error");
    emptyState.hidden = true;
    statsSection.hidden = true;
    controlsSection.hidden = true;
    noMatches.hidden = true;
    resultsCount.textContent = "";
    reviewGrid.innerHTML = "";
    return;
  }

  allReviews = reviews;
  const hasReviews = allReviews.length > 0;
  emptyState.hidden = hasReviews;
  statsSection.hidden = !hasReviews;
  controlsSection.hidden = !hasReviews;

  if (!hasReviews) {
    noMatches.hidden = true;
    resultsCount.textContent = "";
    reviewGrid.innerHTML = "";
    return;
  }

  showStats(allReviews);
  showHistogram(allReviews);
  render();
}

fillMinRatingOptions();
showViewInControls();
loadPage();

// If you edit a review on the album page and press Back, the browser may show this
// page from memory without rerunning the script. "pageshow" with persisted = true
// means that happened, so reload the reviews to show your changes.
window.addEventListener("pageshow", function (event) {
  if (event.persisted) {
    loadPage();
  }
});
