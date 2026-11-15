/* ============================================================
   album.js — the album page (album.html).
   Reads the album id from the address, asks MusicBrainz for the album
   and its tracklist, builds the page, and runs the "Your review" box.
   Shared helpers (fetchFromMusicBrainz, getArtistName, getYear,
   createCoverImage) live in musicbrainz.js, and saveReview / loadAllReviews /
   deleteReview live in reviews.js. Both load before this file.
   ============================================================ */


/* ---------- 1. Find the parts of the page we need ---------- */
const albumHeaderArea = document.getElementById("album-header-area");
const tracklistArea = document.getElementById("tracklist-area");
const statusMessage = document.getElementById("status-message");
const backLink = document.getElementById("back-link");

function showMessage(text) {
  statusMessage.textContent = text;
}


/* ---------- 2. Read the address ----------
   For the address  album.html?id=abc123&q=radiohead
   window.location.search is "?id=abc123&q=radiohead", and
   URLSearchParams lets us pull out each value by name. */
const addressParams = new URLSearchParams(window.location.search);
const albumId = addressParams.get("id");     // "abc123"
const searchText = addressParams.get("q");   // "radiohead" (or null if it's missing)

// If we know what you searched, "Back to search" brings those results back.
if (searchText) {
  backLink.href = "index.html?" + new URLSearchParams({ q: searchText });
}


/* ---------- 3. Pick which edition to get the tracklist from ----------
   One album (a "release group") has many editions ("releases"): the original
   vinyl, CD reissues, deluxe versions... Their tracklists can differ.
   We pick the EARLIEST OFFICIAL edition, which is usually the original album. */
function pickOriginalRelease(releases) {
  // Keep only official releases (no bootlegs). If there are none, use them all.
  let candidates = [];
  for (const release of releases) {
    if (release.status === "Official") {
      candidates.push(release);
    }
  }
  if (candidates.length === 0) {
    candidates = releases;
  }

  // Find the earliest date. Dates are text like "1969-09-26", and comparing
  // text with < works for dates in this format: "1969-09-26" < "1987-01-01".
  // A release with no date counts as "9999", so it only wins if nothing else has a date.
  let earliest = null;
  for (const release of candidates) {
    const date = release.date || "9999";
    if (earliest === null || date < (earliest.date || "9999")) {
      earliest = release;
    }
  }
  return earliest; // null if the album has no releases at all
}


/* ---------- 4. Turn milliseconds into "4:21" ----------
   MusicBrainz gives track lengths in milliseconds (261000 = 261 seconds). */
function formatLength(milliseconds) {
  if (!milliseconds) {
    return ""; // some tracks have no length listed
  }
  const totalSeconds = Math.round(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60); // Math.floor rounds DOWN: 4.35 → 4
  const seconds = totalSeconds % 60;             // % is "remainder": 261 % 60 = 21
  // padStart adds a 0 in front if needed, so 5 seconds shows as "05", not "5".
  return minutes + ":" + String(seconds).padStart(2, "0");
}

// For the whole album: "47 min", or "2 hr 36 min" for long ones.
function formatTotalLength(milliseconds) {
  const totalMinutes = Math.round(milliseconds / 60000); // 60,000 ms in a minute
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) {
    return minutes + " min";
  }
  return hours + " hr " + minutes + " min";
}


/* ---------- 5. Build the page ---------- */

// The top part: cover on the left, title / artist / year on the right.
function createAlbumHeader(album, trackCount, totalLength) {
  const header = document.createElement("div");
  header.className = "album-page-header";

  const cover = createCoverImage(album, 500); // bigger 500px cover, from musicbrainz.js

  const info = document.createElement("div");

  const title = document.createElement("h1");
  title.className = "album-page-title";
  title.textContent = fixCapitalization(album.title); // fixes sentence-case titles (musicbrainz.js)

  const artist = document.createElement("p");
  artist.className = "album-page-artist";
  artist.textContent = getArtistName(album);

  // e.g. "1969 · 17 tracks · 47 min"
  const details = [getYear(album)];
  if (trackCount > 0) {
    details.push(trackCount + (trackCount === 1 ? " track" : " tracks"));
  }
  if (totalLength > 0) {
    details.push(formatTotalLength(totalLength));
  }
  const meta = document.createElement("p");
  meta.className = "album-page-meta";
  meta.textContent = details.join(" · ");

  info.append(title, artist, meta);
  header.append(cover, info);
  return header;
}

// The tracklist. "media" is the list of discs (most albums have just one).
function createTracklist(media) {
  const section = document.createElement("section");
  section.className = "tracklist-section";

  const heading = document.createElement("h2");
  heading.textContent = "Tracklist";
  section.append(heading);

  if (media.length === 0) {
    const empty = document.createElement("p");
    empty.className = "status-message";
    empty.textContent = "MusicBrainz doesn't have a tracklist for this album yet.";
    section.append(empty);
    return section;
  }

  for (const disc of media) {
    // Only label discs when there's more than one ("Disc 1", "Disc 2").
    if (media.length > 1) {
      const discHeading = document.createElement("h3");
      discHeading.className = "disc-heading";
      discHeading.textContent = "Disc " + disc.position + (disc.title ? ": " + fixCapitalization(disc.title) : "");
      section.append(discHeading);
    }

    // <ol> = "ordered list", a numbered list. Each <li> is one track.
    const list = document.createElement("ol");
    list.className = "tracklist";

    for (const track of disc.tracks || []) {
      const item = document.createElement("li");

      const number = document.createElement("span");
      number.className = "track-number";
      number.textContent = track.position; // 1, 2, 3... (restarts on each disc)

      const name = document.createElement("span");
      name.className = "track-title";
      name.textContent = fixCapitalization(track.title);

      const length = document.createElement("span");
      length.className = "track-length";
      length.textContent = formatLength(track.length);

      item.append(number, name, length);
      list.append(item);
    }

    section.append(list);
  }

  return section;
}


/* ---------- 6. Your review: stars, heart, text, Save and Delete ----------
   Works like Letterboxd:
     - Clicking a star or the heart saves IMMEDIATELY (no Save button needed).
     - The written review has its own "Save review" button, so a half-written
       review is never saved by accident.
     - Any one of rating, heart or text is enough to keep the album in My reviews.
       Clear all three and it's removed.
   This section keeps track of STATE: variables that describe what the review box
   should show right now (the rating, the heart, what's saved).
   The pattern every time you do something:
     1. an event listener notices (a click, a key press, typing),
     2. it changes a state variable (e.g. currentRating = 3.5),
     3. it calls updateReviewBox(), which redraws the box FROM the state.
   We never read the rating back out of the page. The variables are the single
   source of truth, and the page just displays them. */

// 6a. The parts of the review box (all in album.html)
const reviewBox = document.getElementById("review-box");
const starRating = document.getElementById("star-rating");
const stars = starRating.querySelectorAll(".star"); // all 5 star <span>s, as a list
const ratingLabel = document.getElementById("rating-label");
const likeButton = document.getElementById("like-button");
const likeLabel = document.getElementById("like-label");
const reviewText = document.getElementById("review-text");
const charCount = document.getElementById("char-count");
const saveButton = document.getElementById("save-button");
const deleteButton = document.getElementById("delete-button");
const reviewMessage = document.getElementById("review-message");
const quickMessage = document.getElementById("quick-message"); // "Saved ✓" next to the stars
const deleteConfirm = document.getElementById("delete-confirm");
const confirmDeleteButton = document.getElementById("confirm-delete-button");
const cancelDeleteButton = document.getElementById("cancel-delete-button");
const reviewedDate = document.getElementById("reviewed-date");

// 6b. The state
let currentRating = 0;        // what the stars show: 0 (no rating), 0.5, 1, 1.5 ... 5
let currentLiked = false;     // is the heart on?
let savedReview = null;       // this album's review as it is in storage (null = nothing saved)
let albumForReview = null;    // the album's MusicBrainz data, saved along with the review
let storageWorks = true;      // becomes false if localStorage can't be read
let savedMessageTimer = null; // lets us cancel the timer that hides "Saved ✓" by the Save button
let quickMessageTimer = null; // same, for the "Saved ✓" next to the stars

// 6c. Drawing the stars
// For a rating like 3.5: stars 1–3 are full, star 4 is half, star 5 is empty.
// paintStars, describeRating and formatReviewDate are in reviews.js, shared with
// the My reviews page so stars and dates look the same everywhere.
function drawStars(rating) {
  paintStars(stars, rating);
  ratingLabel.textContent = rating === 0 ? "Rate this album" : rating + " out of 5";
}

// Puts a message next to the Save button. kind is "success", "error", or "" (plain).
function showReviewMessage(text, kind) {
  reviewMessage.textContent = text;
  reviewMessage.className = "review-message " + (kind || "");
}

// Puts a short message next to the stars, and hides it after 2 seconds
// (errors stay until the next change).
function showQuickMessage(text, kind) {
  clearTimeout(quickMessageTimer);
  quickMessage.textContent = text;
  quickMessage.className = "quick-message " + (kind || "");
  if (kind !== "error") {
    quickMessageTimer = setTimeout(function () {
      quickMessage.textContent = "";
    }, 2000);
  }
}

// 6d. Saving
// Writes rating + heart + text to storage. If all three are empty, the album is
// removed from your reviews instead. Returns true if it worked.
function storeReview(rating, liked, text) {
  if (!storageWorks) {
    return false;
  }

  if (rating === 0 && !liked && text === "") {
    if (savedReview === null) {
      return true; // nothing saved and nothing to save
    }
    if (!deleteReview(albumForReview.id)) { // reviews.js
      return false;
    }
    savedReview = null;
    return true;
  }

  // saveReview (reviews.js) adds the date and returns the saved review, or null if it failed.
  const saved = saveReview({
    albumId: albumForReview.id,
    title: albumForReview.title,
    artist: getArtistName(albumForReview),
    // Just the year, or "" if MusicBrainz doesn't know it.
    year: (albumForReview["first-release-date"] || "").slice(0, 4),
    coverUrl: getCoverUrl(albumForReview.id, 250),
    rating: rating,
    liked: liked,
    text: text,
  });
  if (saved === null) {
    return false;
  }
  savedReview = saved;
  return true;
}

// The text that's currently saved ("" if none).
function getSavedText() {
  return savedReview ? savedReview.text : "";
}

// Called right after a star or heart change. Saves the rating and heart
// together with the ALREADY-saved text: a half-written review in the box stays
// unsaved until you click "Save review".
function saveRatingAndHeart() {
  if (storeReview(currentRating, currentLiked, getSavedText())) {
    showQuickMessage(savedReview ? "Saved ✓" : "Removed from your reviews", "success");
  } else {
    showQuickMessage("Not saved", "error");
  }
  updateReviewBox();
}

// 6e. Redraw the whole box from the state
// Is the text in the box different from the saved text? This decides whether
// "Save review" is clickable. (.trim(): extra spaces at the ends don't count.)
function hasUnsavedText() {
  return reviewText.value.trim() !== getSavedText();
}

function updateReviewBox() {
  drawStars(currentRating);
  // setAttribute changes an attribute in the HTML, like aria-valuetext="3.5 out of 5 stars".
  starRating.setAttribute("aria-valuenow", currentRating);
  starRating.setAttribute("aria-valuetext", describeRating(currentRating));

  likeButton.setAttribute("aria-pressed", currentLiked); // true becomes "true"
  likeLabel.textContent = currentLiked ? "Liked" : "Like";

  const length = reviewText.value.length;
  charCount.textContent = length + " / " + REVIEW_MAX_LENGTH;
  charCount.classList.toggle("near-limit", length > REVIEW_MAX_LENGTH - 100); // last 100 characters

  saveButton.disabled = !storageWorks || !hasUnsavedText();

  deleteButton.hidden = savedReview === null; // Delete only makes sense if something is saved
  reviewedDate.textContent = savedReview ? "Reviewed " + formatReviewDate(savedReview.savedAt) : "";
}

// 6f. The mouse and the stars
// Which rating is the mouse pointing at? The left half of star 3 means 2.5,
// the right half means 3.
function ratingFromMouse(star, event) {
  const starNumber = Number(star.dataset.star);
  // getBoundingClientRect() tells us where the star is on the screen (its left edge
  // and width). event.clientX is the mouse's position, measured the same way.
  const box = star.getBoundingClientRect();
  const onLeftHalf = event.clientX < box.left + box.width / 2;
  return onLeftHalf ? starNumber - 0.5 : starNumber;
}

for (const star of stars) {
  // "mousemove" fires again and again as the mouse moves over a star.
  // We PREVIEW that rating (draw it) without changing the state.
  star.addEventListener("mousemove", function (event) {
    drawStars(ratingFromMouse(star, event));
  });

  // "click" sets the rating and saves it. Clicking the rating you already have clears it.
  // On a phone, a tap counts as a click, so this handles taps too.
  star.addEventListener("click", function (event) {
    const clickedRating = ratingFromMouse(star, event);
    currentRating = clickedRating === currentRating ? 0 : clickedRating;
    saveRatingAndHeart();
  });
}

// "mouseleave" fires when the mouse leaves the stars: stop previewing, show the real rating.
starRating.addEventListener("mouseleave", function () {
  drawStars(currentRating);
});

// 6g. The keyboard and the stars
// After you Tab to the stars, "keydown" fires for every key you press.
// event.key is the name of the key, e.g. "ArrowRight".
starRating.addEventListener("keydown", function (event) {
  let newRating;
  if (event.key === "ArrowRight" || event.key === "ArrowUp") {
    newRating = Math.min(5, currentRating + 0.5); // Math.min keeps it from going above 5
  } else if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
    newRating = Math.max(0, currentRating - 0.5); // Math.max keeps it from going below 0
  } else if (event.key === "Home") {
    newRating = 0; // Home clears the rating
  } else if (event.key === "End") {
    newRating = 5;
  } else {
    return; // any other key (like Tab): ignore it and let the browser do its normal thing
  }
  event.preventDefault(); // stop the arrow keys from ALSO scrolling the page
  if (newRating === currentRating) {
    return; // e.g. ArrowRight at 5: nothing changed, nothing to save
  }
  currentRating = newRating;
  saveRatingAndHeart();
});

// 6h. The heart and the text box
likeButton.addEventListener("click", function () {
  currentLiked = !currentLiked; // "!" flips it: true becomes false, false becomes true
  saveRatingAndHeart();
});

// "input" fires every time the text changes: typing, pasting, deleting.
// Typing doesn't save; it just turns "Save review" on.
reviewText.addEventListener("input", function () {
  clearTimeout(savedMessageTimer);
  if (storageWorks) {
    showReviewMessage("");
  }
  updateReviewBox();
});

// 6i. Save the written review (along with the current rating and heart)
saveButton.addEventListener("click", function () {
  if (!storeReview(currentRating, currentLiked, reviewText.value.trim())) {
    showReviewMessage("Couldn't save your review. Your browser may be blocking storage (private browsing can do this).", "error");
    return;
  }

  reviewText.value = getSavedText(); // show exactly what was saved (without extra spaces)
  updateReviewBox();
  showReviewMessage(savedReview ? "Saved ✓" : "Removed from your reviews", "success");

  // Hide the message after 3 seconds. setTimeout runs a function later and returns an id;
  // we keep the id so typing again can cancel it.
  clearTimeout(savedMessageTimer);
  savedMessageTimer = setTimeout(function () {
    showReviewMessage("");
  }, 3000);
});

// 6j. Delete everything for this album, with a confirmation on the page
deleteButton.addEventListener("click", function () {
  deleteConfirm.hidden = false;
  cancelDeleteButton.focus(); // move keyboard focus to the safe choice
});

cancelDeleteButton.addEventListener("click", function () {
  deleteConfirm.hidden = true;
});

confirmDeleteButton.addEventListener("click", function () {
  deleteConfirm.hidden = true;
  if (!deleteReview(albumForReview.id)) {
    showReviewMessage("Couldn't delete your review. Your browser may be blocking storage.", "error");
    return;
  }

  // Back to an empty, never-reviewed box.
  savedReview = null;
  currentRating = 0;
  currentLiked = false;
  reviewText.value = "";
  updateReviewBox();
  showReviewMessage("Review deleted.");
});

// 6k. Set up the box once the album has loaded (called from loadAlbum below)
function setUpReviewBox(album) {
  albumForReview = album;
  reviewText.maxLength = REVIEW_MAX_LENGTH; // the browser stops typing at 1000 characters

  const allReviews = loadAllReviews(); // reviews.js: an object, or null if storage failed
  if (allReviews === null) {
    storageWorks = false;
    showReviewMessage("Your saved reviews couldn't be loaded, so saving is turned off to avoid overwriting them. Private browsing or strict browser settings can cause this.", "error");
  } else {
    // Look up this album by its id. If you never reviewed it, that's undefined,
    // and "|| null" turns it into null to match how we use savedReview.
    savedReview = allReviews[album.id] || null;
  }

  // Already reviewed? Fill the box in with what you saved.
  if (savedReview) {
    currentRating = savedReview.rating;
    currentLiked = savedReview.liked;
    reviewText.value = savedReview.text;
  }

  updateReviewBox();
  reviewBox.hidden = false; // show the box
}


/* ---------- 7. Load everything ----------
   Two requests, one after the other (the rate limiter spaces them 1 second apart):
     1. The album ("release group"), plus the list of its editions.
     2. The tracklist of the edition we picked. */
async function loadAlbum() {
  if (!albumId) {
    showMessage("No album was picked. Go back and search for one.");
    return; // stop here
  }

  try {
    // inc = "include": extra information to send along with the album.
    const album = await fetchFromMusicBrainz("release-group/" + albumId, {
      inc: "artist-credits releases",
    });

    // The browser tab shows the album name, e.g. "Abbey Road by The Beatles — Spin".
    document.title = `${fixCapitalization(album.title)} by ${getArtistName(album)} — Spin`;

    let media = [];
    const release = pickOriginalRelease(album.releases || []);
    if (release) {
      showMessage("Loading tracklist...");
      const releaseData = await fetchFromMusicBrainz("release/" + release.id, {
        inc: "recordings", // "recordings" = include the tracks
      });
      media = releaseData.media || [];
    }

    // Count the tracks and add up their lengths for the "17 tracks · 47 min" line.
    let trackCount = 0;
    let totalLength = 0;
    for (const disc of media) {
      for (const track of disc.tracks || []) {
        trackCount += 1;
        totalLength += track.length || 0;
      }
    }

    showMessage(""); // clear "Loading..."
    albumHeaderArea.append(createAlbumHeader(album, trackCount, totalLength));
    setUpReviewBox(album); // section 6: show the review box, filled in if you reviewed this before
    tracklistArea.append(createTracklist(media));
  } catch (error) {
    console.error(error);
    // 404 = no album with that id. 400 = the id isn't even in the right format.
    if (error.status === 404 || error.status === 400) {
      showMessage("We couldn't find that album. The link might be broken.");
    } else {
      showMessage("Sorry, the album didn't load. MusicBrainz may be busy. Wait a few seconds and refresh the page.");
    }
  }
}

loadAlbum();
