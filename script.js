/* ============================================================
   script.js — makes the search bar actually search.
   HTML = what's on the page. CSS = how it looks.
   JavaScript = what the page DOES when you interact with it.
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

// The web address of the MusicBrainz search API for "release groups" (= albums).
// A release group bundles every version of an album (CD, vinyl, deluxe, etc.)
// so we get each album once instead of ten copies.
const MUSICBRAINZ_URL = "https://musicbrainz.org/ws/2/release-group/";


/* ---------- 2. Rate limiting ----------
   MusicBrainz asks apps to send at most about 1 request per second.
   We remember when we last asked, and if it was less than a second ago, we wait.
   "let" (instead of const) means the value is allowed to change later. */
let lastRequestTime = 0;
let isSearching = false; // true while a search is running, so we don't start two at once

async function waitForRateLimit() {
  const oneSecond = 1000; // JavaScript measures time in milliseconds
  const timeSinceLast = Date.now() - lastRequestTime;

  if (timeSinceLast < oneSecond) {
    const waitTime = oneSecond - timeSinceLast;
    // A Promise is "a value that will be ready later". This one is ready after
    // waitTime milliseconds. "await" pauses this function until it's ready.
    await new Promise(function (resolve) {
      setTimeout(resolve, waitTime);
    });
  }

  lastRequestTime = Date.now();
}


/* ---------- 3. Build the search query ----------
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


/* ---------- 4. Ask MusicBrainz for albums ----------
   "async" marks a function that does slow work (like talking to another website)
   and is allowed to use "await" inside it. */
async function searchAlbums(text, matchEveryWord) {
  await waitForRateLimit();

  // URLSearchParams builds the "?query=...&fmt=json" part of a web address and
  // safely encodes spaces and symbols (a space becomes %20, etc.).
  const params = new URLSearchParams({
    query: buildQuery(text, matchEveryWord),
    fmt: "json",  // ask for JSON instead of the default XML
    limit: "24",  // at most 24 results
  });

  // fetch() sends a request to a web address and gets a response back.
  // It takes time, so we "await" it: the code waits here until the answer arrives,
  // but the rest of the page keeps working (you can still scroll, etc.).
  const url = MUSICBRAINZ_URL + "?" + params.toString();
  let response = await fetch(url);

  // Status 503 means "too busy, try later". MusicBrainz sends it fairly often,
  // so we wait our 1 second and try one more time before giving up.
  if (response.status === 503) {
    await waitForRateLimit();
    response = await fetch(url);
  }

  // response.ok is false when the server answers with an error code
  // (like 503 = "too busy" or 400 = "bad request").
  if (!response.ok) {
    // "throw" stops this function and jumps to the "catch" block in section 6.
    throw new Error("MusicBrainz error " + response.status);
  }

  // The response body is JSON: text formatted like JavaScript objects, e.g.
  //   { "release-groups": [ { "title": "OK Computer", ... }, ... ] }
  // response.json() turns that text into real JavaScript objects we can use.
  const data = await response.json();
  return data["release-groups"]; // the list (array) of albums
}


/* ---------- 5. Show things on the page ---------- */

// Puts a message (like "Searching...") above the results.
function showMessage(text) {
  statusMessage.textContent = text;
}

// Joins the artist names. Most albums have one artist, but some have several,
// e.g. [{name: "Jay-Z", joinphrase: " & "}, {name: "Kanye West", joinphrase: ""}]
function getArtistName(album) {
  let name = "";
  for (const credit of album["artist-credit"] || []) {
    name += credit.name + (credit.joinphrase || "");
  }
  return name || "Unknown artist";
}

// Dates look like "1997-05-21", "1997-05" or "1997". The year is the first 4 characters.
function getYear(album) {
  const date = album["first-release-date"];
  return date ? date.slice(0, 4) : "Unknown year";
}

// Builds the "No cover" box used when an album has no art.
function createNoCoverBox() {
  const box = document.createElement("div");
  box.className = "album-cover no-cover";
  box.textContent = "No cover";
  return box;
}

// Builds ONE album card. This is "DOM manipulation": creating HTML elements
// with JavaScript instead of typing them into index.html.
// The result looks like the placeholder cards from last session:
//   <article class="album-card">
//     <img class="album-cover"> <h3 class="album-title"> <p class="album-artist"> <p class="album-year">
//   </article>
function createAlbumCard(album) {
  // document.createElement makes a new element. It isn't on the page yet.
  const card = document.createElement("article");
  card.className = "album-card";

  // The Cover Art Archive gives a 250px cover for any album id.
  // If there's no cover, the image fails to load and the "error" event fires.
  const cover = document.createElement("img");
  cover.className = "album-cover";
  cover.src = `https://coverartarchive.org/release-group/${album.id}/front-250`;
  cover.alt = "Cover of " + album.title;
  cover.loading = "lazy"; // only download the image when it's about to scroll into view

  // addEventListener means "when this happens, run this function".
  // Here: when the image fails to load, swap it for the "No cover" box.
  cover.addEventListener("error", function () {
    cover.replaceWith(createNoCoverBox());
  });

  const title = document.createElement("h3");
  title.className = "album-title";
  // textContent (not innerHTML) puts the text in as plain text. That way an album
  // named something like "<b>hi</b>" shows up as those characters instead of
  // being treated as HTML code. It's a safety habit worth keeping.
  title.textContent = album.title;

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
function showResults(albums) {
  resultsGrid.innerHTML = ""; // remove whatever was there before

  for (const album of albums) {
    resultsGrid.append(createAlbumCard(album)); // this is the moment it appears on the page
  }
}


/* ---------- 6. Run a search when the form is submitted ----------
   The form's "submit" event fires when you click Search OR press Enter
   in the search box, so this one listener handles both. */
searchForm.addEventListener("submit", async function (event) {
  // By default, submitting a form reloads the page. This line stops that,
  // so JavaScript handles the search instead.
  event.preventDefault();

  const text = searchInput.value.trim(); // .trim() removes spaces at the start and end
  if (text === "" || isSearching) {
    return; // nothing typed, or a search is already running: do nothing
  }

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
    // waitForRateLimit() inside searchAlbums keeps this 1 second after the first request.
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
      showResults(albums);
    }
  } catch (error) {
    console.error(error); // prints the real error in the browser's developer console (F12)
    showMessage("Sorry, the search didn't work. MusicBrainz may be busy. Wait a few seconds and try again.");
  } finally {
    // "finally" runs at the end no matter what: success or error.
    isSearching = false;
    searchButton.disabled = false;
  }
});
