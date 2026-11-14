/* ============================================================
   reviews.js — saving, loading and deleting your reviews.
   Shared code: the album page uses it now, and the "My reviews"
   page (item 5) will use it too. Load it after musicbrainz.js and
   before the page's own script, like this:
     <script src="musicbrainz.js"></script>
     <script src="reviews.js"></script>
     <script src="album.js"></script>
   ============================================================ */


/* ---------- 1. What localStorage is ----------
   localStorage is a small storage box inside your browser, one per website.
   Unlike a normal variable (wiped when the page reloads) or sessionStorage
   (wiped when you close the tab), localStorage KEEPS its contents until you clear it.
   It's like a notebook the website can write in:
     localStorage.setItem("name", "text")   → write "text" under "name"
     localStorage.getItem("name")           → read it back ("text", or null if nothing's there)
     localStorage.removeItem("name")        → erase it
   Two catches:
     1. It can only store TEXT. To store an object we turn it into text first
        with JSON.stringify, and turn it back into an object with JSON.parse.
     2. It lives in THIS browser only. Reviews saved in Chrome won't show in Safari,
        on your phone, or for anyone else. That's why Milestone 2 moves them to Supabase.

   We keep ALL reviews under one name ("spin-reviews"), as one object
   where each key is an album's MusicBrainz release-group id:
     {
       "9162580e-...": { albumId: "9162580e-...", title: "Abbey Road", rating: 4.5, ... },
       "b1392450-...": { albumId: "b1392450-...", title: "OK Computer", rating: 5, ... }
     }
   Looking up one album's review is then just  allReviews[albumId].

   Each review looks like this:
     {
       albumId:  "9162580e-...",   // MusicBrainz release-group id
       title:    "Abbey Road",     // the title as MusicBrainz has it (run fixCapitalization() when showing it)
       artist:   "The Beatles",
       year:     "1969",
       coverUrl: "https://coverartarchive.org/release-group/9162580e-.../front-250",
       rating:   4.5,              // 0.5 to 5, in steps of 0.5
       liked:    true,             // the heart
       text:     "Side two...",    // the written review ("" if none)
       savedAt:  "2026-11-14T18:22:05.123Z"   // when it was last saved (see saveReview)
     }
   The album info (title, artist, year, cover) is saved WITH the review so the
   "My reviews" page can list everything without asking MusicBrainz again,
   which would take 1 second per album because of the rate limit. */

const REVIEWS_KEY = "spin-reviews";   // the name everything is saved under
const REVIEW_MAX_LENGTH = 1000;       // character limit for the written review


/* ---------- 2. Load every review ----------
   Returns the object of all reviews ({} if you haven't saved any yet),
   or null if something went wrong. Two things can go wrong:
     - The browser blocks localStorage (some private-browsing modes, strict settings).
       Then even READING it throws an error.
     - The saved text is damaged, so JSON.parse can't turn it back into an object.
   try/catch catches either one, so the page shows a message instead of breaking. */
function loadAllReviews() {
  try {
    const savedText = localStorage.getItem(REVIEWS_KEY);
    if (savedText === null) {
      return {}; // nothing saved yet: an empty object, not an error
    }

    // JSON.parse turns text back into a JavaScript object:
    //   '{"rating":4.5}'  →  { rating: 4.5 }
    // If the text isn't valid JSON, it throws an error and we jump to "catch".
    const reviews = JSON.parse(savedText);

    // Valid JSON could still be the wrong shape (a number, a list...).
    // typeof tells us what kind of value it is; we need a plain object.
    if (typeof reviews !== "object" || reviews === null || Array.isArray(reviews)) {
      throw new Error("Saved reviews aren't in the expected format");
    }
    return reviews;
  } catch (error) {
    console.error("Couldn't read saved reviews:", error);
    return null; // null means "something went wrong"; the page decides what to tell you
  }
}


/* ---------- 3. Write every review back ----------
   Returns true if it worked, false if not. Writing can fail if storage is
   blocked or full. */
function saveAllReviews(reviews) {
  try {
    // JSON.stringify turns an object into text:  { rating: 4.5 }  →  '{"rating":4.5}'
    localStorage.setItem(REVIEWS_KEY, JSON.stringify(reviews));
    return true;
  } catch (error) {
    console.error("Couldn't save reviews:", error);
    return false;
  }
}


/* ---------- 4. Save (or update) one review ----------
   Adds the date, then stores it under its album id. If that album already had
   a review, the new one replaces it. Returns the saved review, or null if it failed. */
function saveReview(review) {
  const reviews = loadAllReviews();

  // If we couldn't READ the existing reviews, don't write either: writing now
  // would replace all your other reviews with just this one.
  if (reviews === null) {
    return null;
  }

  // Dates can't go into JSON as Date objects, so we store them as text in a
  // standard format (ISO 8601): "2026-11-14T18:22:05.123Z".
  // new Date(thatText) turns it back into a date when we need to show it.
  //
  // { ...review, savedAt: ... } is "spread" syntax: it copies every property
  // of review into a NEW object, then adds (or replaces) savedAt.
  const reviewToSave = { ...review, savedAt: new Date().toISOString() };

  reviews[review.albumId] = reviewToSave; // add or replace this album's entry
  if (!saveAllReviews(reviews)) {
    return null;
  }
  return reviewToSave;
}


/* ---------- 5. Delete one review ----------
   Returns true if it worked, false if not. */
function deleteReview(albumId) {
  const reviews = loadAllReviews();
  if (reviews === null) {
    return false;
  }

  delete reviews[albumId]; // "delete" removes a property from an object
  return saveAllReviews(reviews);
}
