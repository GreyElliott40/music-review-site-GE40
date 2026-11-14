/* ============================================================
   script.js — the search page (index.html).
   HTML = what's on the page. CSS = how it looks.
   JavaScript = what the page DOES when you interact with it.
   Shared helpers (waitForRateLimit, fetchFromMusicBrainz, getArtistName,
   getYear, createCoverImage) live in musicbrainz.js, which loads first.
   ============================================================ */


/* ---------- 1. Find the parts of the page we need ----------
   document.getElementById finds an element in index.html by its id="...".
   We store each one in a variable so we can use it later.
   "const" means this variable will always point to the same thing. */
const searchForm = document.getElementById("search-form");
const searchInput = document.getElementById("search-input");
const searchButton = searchForm.querySelector("button"); // the first <button> inside the form
const statusMessage = document.getElementById("status-message");
const resultsGrid = document.getElementById("results");

let isSearching = false; // true while a search is running, so we don't start two at once


/* ---------- 2. Build the search query ----------
   MusicBrainz uses a special search language. By default it only searches
   album TITLES, so typing "radiohead" would find albums named "Radiohead".
   These functions build a query that matches the title OR the artist,
   forgives small typos, and keeps only studio albums
   (no singles, live albums or compilations).
   Capital letters and accents don't matter: MusicBrainz already
   treats "DeBÍ" and "debi" as the same word. */

// Characters like  ( ) : " ~ / *  are commands in the search language.
// To search for them as plain text, each one needs a backslash in front.
// "$&" in the replacement means "the character that was matched".
function escapeWord(word) {
  return word.replace(/[+\-&|!(){}\[\]^"~*?:\\\/]/g, "\\$&");
}

// Builds the query for ONE word: it can be in the title or the artist name.
function buildWordPart(word) {
  const safeWord = escapeWord(word);

  // ^2 is a "boost": the exactly spelled word counts double when ranking results.
  let part = `releasegroup:${safeWord}^2 OR artist:${safeWord}^2`;

  // TYPO TOLERANCE: "word~" means "this word, or one up to 2 letters different".
  // So "kendrik~" finds "kendrick" and "buterfly~" finds "butterfly".
  // We skip it for short words: for "ok" or "mas", 2 letters off matches almost anything.
  if (word.length >= 4) {
    part += ` OR releasegroup:${safeWord}~ OR artist:${safeWord}~`;
  }

  return "(" + part + ")";
}

// Builds the full query. There are two modes:
//   matchEveryWord = true  → STRICT: every word must match (allowing small typos).
//   matchEveryWord = false → LOOSE: albums matching SOME of the words count too.
//                            We only use this if the strict search finds nothing.
function buildQuery(text, matchEveryWord) {
  // Lowercase everything. Otherwise typing "AND", "OR" or "NOT" in capitals
  // would be read as a command instead of a word.
  const lowerText = text.toLowerCase();

  // One query part per word, glued together with AND (strict) or OR (loose).
  // "ok computer" in strict mode becomes roughly:
  //   (releasegroup:ok OR artist:ok) AND (releasegroup:computer~ OR artist:computer~ ...)
  const words = lowerText.split(/\s+/); // split on spaces
  const wordParts = [];
  for (const word of words) {
    wordParts.push(buildWordPart(word));
  }
  const glue = matchEveryWord ? " AND " : " OR ";
  // ↑ This is a "ternary": condition ? valueIfTrue : valueIfFalse. A one-line if/else.
  const wordsQuery = wordParts.join(glue);

  // Only studio albums: no singles, EPs, live albums, compilations, etc.
  const albumsOnly = " AND primarytype:album AND NOT secondarytype:*";

  if (!matchEveryWord) {
    return "(" + wordsQuery + ")" + albumsOnly;
  }

  // Strict mode also checks the whole phrase in quotes, with a big boost (^3, ^2).
  // That puts Radiohead's albums near the top when you search "radiohead",
  // and keeps "AC/DC" from being split into "AC" and "DC".
  // Inside quotes, only backslashes and quote marks need a backslash in front.
  const safePhrase = lowerText.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `(artist:"${safePhrase}"^3 OR releasegroup:"${safePhrase}"^2 OR (${wordsQuery}))` + albumsOnly;
}


/* ---------- 3. Ask MusicBrainz for albums ---------- */
async function searchAlbums(text, matchEveryWord) {
  // "release-group/" is the search for release groups (= albums). A release group
  // bundles every version of an album (CD, vinyl, deluxe...) so each album shows up once.
  const data = await fetchFromMusicBrainz("release-group/", {
    query: buildQuery(text, matchEveryWord),
    limit: "24", // at most 24 results
  });
  return data["release-groups"]; // the list (array) of albums
}


/* ---------- 4. Show things on the page ---------- */

// Puts a message (like "Searching...") above the results.
function showMessage(text) {
  statusMessage.textContent = text;
}

// Builds ONE album card. This is "DOM manipulation": creating HTML elements
// with JavaScript instead of typing them into index.html.
// The whole card is a link to the album page:
//   <a class="album-card" href="album.html?id=...&q=...">
//     <img class="album-cover"> <h3 class="album-title"> <p class="album-artist"> <p class="album-year">
//   </a>
function createAlbumCard(album, searchText) {
  const card = document.createElement("a");
  card.className = "album-card";

  // The part after "?" is the "query string": extra information for the next page.
  // id = which album to show. q = what you searched, so the album page's
  // "Back to search" link can bring your results back.
  card.href = "album.html?" + new URLSearchParams({ id: album.id, q: searchText });

  const cover = createCoverImage(album, 250); // from musicbrainz.js
  cover.loading = "lazy"; // only download the image when it's about to scroll into view

  const title = document.createElement("h3");
  title.className = "album-title";
  // textContent (not innerHTML) puts the text in as plain text. That way an album
  // named something like "<b>hi</b>" shows up as those characters instead of
  // being treated as HTML code. It's a safety habit worth keeping.
  title.textContent = fixCapitalization(album.title); // "Un verano sin ti" → "Un Verano Sin Ti" (musicbrainz.js)

  const artist = document.createElement("p");
  artist.className = "album-artist";
  artist.textContent = getArtistName(album);

  const year = document.createElement("p");
  year.className = "album-year";
  year.textContent = getYear(album);

  // append puts elements INSIDE the card, in this order.
  card.append(cover, title, artist, year);
  return card;
}

// Clears the grid and fills it with a card for each album.
function showResults(albums, searchText) {
  resultsGrid.innerHTML = ""; // remove whatever was there before

  for (const album of albums) {
    resultsGrid.append(createAlbumCard(album, searchText)); // this is the moment it appears on the page
  }
}


/* ---------- 5. Run a search ---------- */
async function runSearch(text) {
  isSearching = true;
  searchButton.disabled = true;
  resultsGrid.innerHTML = "";
  showMessage("Searching...");

  // try/catch: run the code in "try". If anything inside it fails
  // (no internet, MusicBrainz is down...), jump to "catch" instead of crashing.
  try {
    // First try: every word has to match (small typos allowed).
    let albums = await searchAlbums(text, true);
    let showingCloseMatches = false;

    // Nothing? One word might be too misspelled ("tiara" for "tirar").
    // Try again, accepting albums that match only some of the words.
    // The rate limiter in musicbrainz.js keeps this 1 second after the first request.
    if (albums.length === 0) {
      showMessage("No exact matches. Looking for close matches...");
      albums = await searchAlbums(text, false);
      showingCloseMatches = true;
    }

    if (albums.length === 0) {
      showMessage(`No albums found for "${text}". Try different words.`);
    } else {
      if (showingCloseMatches) {
        showMessage(`No exact matches for "${text}". Here are the closest matches:`);
      } else {
        showMessage(""); // clear the "Searching..." message
      }
      showResults(albums, text);
    }
  } catch (error) {
    console.error(error); // prints the real error in the browser's developer console (F12)
    showMessage("Sorry, the search didn't work. MusicBrainz may be busy. Wait a few seconds and try again.");
  } finally {
    // "finally" runs at the end no matter what: success or error.
    isSearching = false;
    searchButton.disabled = false;
  }
}


/* ---------- 6. When the form is submitted ----------
   The form's "submit" event fires when you click Search OR press Enter
   in the search box, so this one listener handles both. */
searchForm.addEventListener("submit", function (event) {
  // By default, submitting a form reloads the page. This line stops that,
  // so JavaScript handles the search instead.
  event.preventDefault();

  const text = searchInput.value.trim(); // .trim() removes spaces at the start and end
  if (text === "" || isSearching) {
    return; // nothing typed, or a search is already running: do nothing
  }

  // Put the search in the address bar (index.html?q=radiohead) WITHOUT reloading.
  // Then, if you click an album and press the browser's Back button,
  // you land on index.html?q=radiohead and section 7 runs the search again.
  history.replaceState(null, "", "?" + new URLSearchParams({ q: text }));

  runSearch(text);
});


/* ---------- 7. When the page first loads ----------
   window.location.search is the "?q=..." part of the current address.
   If there's a search in it, fill in the box and run it. */
const startingSearch = new URLSearchParams(window.location.search).get("q");
if (startingSearch) {
  searchInput.value = startingSearch;
  runSearch(startingSearch);
}
