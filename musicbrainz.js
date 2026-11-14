/* ============================================================
   musicbrainz.js — code that BOTH pages use (search and album).
   Instead of copying the same functions into script.js and album.js,
   we write them once here. Each HTML page loads this file FIRST,
   so by the time script.js or album.js runs, these functions already exist.
   ============================================================ */


// The start of every MusicBrainz API address.
const MUSICBRAINZ_API = "https://musicbrainz.org/ws/2/";


/* ---------- 1. Rate limiting ----------
   MusicBrainz asks apps to send at most about 1 request per second.
   We remember when we last asked, and if it was less than a second ago, we wait.

   WHERE we remember it matters. A normal variable is wiped every time a new page
   loads, so going search → album → back could send requests too close together.
   sessionStorage is a small storage box the browser keeps for this tab, and it
   survives moving between pages. It only stores text, so we turn the time into
   text when saving it and back into a number with Number() when reading it.

   Some browsers block storage entirely (private modes, "block all cookies").
   Then even READING sessionStorage throws an error, which would break every
   search. try/catch catches that, and we fall back to a normal variable,
   which still works within one page. */
let lastRequestTimeBackup = 0;

function getLastRequestTime() {
  try {
    return Number(sessionStorage.getItem("lastMusicBrainzRequest")) || 0; // 0 if nothing saved yet
  } catch (error) {
    return lastRequestTimeBackup; // storage is blocked: use the variable instead
  }
}

function saveLastRequestTime() {
  lastRequestTimeBackup = Date.now();
  try {
    sessionStorage.setItem("lastMusicBrainzRequest", String(lastRequestTimeBackup));
  } catch (error) {
    // Storage is blocked. Nothing to do: lastRequestTimeBackup already has the time.
  }
}

async function waitForRateLimit() {
  const oneSecond = 1000; // JavaScript measures time in milliseconds
  const timeSinceLast = Date.now() - getLastRequestTime();

  if (timeSinceLast < oneSecond) {
    const waitTime = oneSecond - timeSinceLast;
    // A Promise is "a value that will be ready later". This one is ready after
    // waitTime milliseconds. "await" pauses this function until it's ready.
    await new Promise(function (resolve) {
      setTimeout(resolve, waitTime);
    });
  }

  saveLastRequestTime();
}


/* ---------- 2. Ask MusicBrainz for something ----------
   Every request (search, album lookup, tracklist) goes through this one function,
   so the rate limit and the retry always apply.
     path:   what to ask for, e.g. "release-group/" (search) or "release/<id>" (one release)
     params: extra settings as an object, e.g. { query: "ok computer", limit: "24" }
   "async" marks a function that does slow work (like talking to another website)
   and is allowed to use "await" inside it. */
async function fetchFromMusicBrainz(path, params) {
  await waitForRateLimit();

  // URLSearchParams builds the "?query=...&fmt=json" part of a web address and
  // safely encodes spaces and symbols (a space becomes %20, etc.).
  const searchParams = new URLSearchParams(params);
  searchParams.set("fmt", "json"); // ask for JSON instead of the default XML
  const url = MUSICBRAINZ_API + path + "?" + searchParams.toString();

  // fetch() sends a request to a web address and gets a response back.
  // It takes time, so we "await" it: the code waits here until the answer arrives,
  // but the rest of the page keeps working (you can still scroll, etc.).
  let response = await fetch(url);

  // Status 503 means "too busy, try later". MusicBrainz sends it fairly often,
  // so we wait our 1 second and try one more time before giving up.
  if (response.status === 503) {
    await waitForRateLimit();
    response = await fetch(url);
  }

  // response.ok is false when the server answers with an error code
  // (like 503 = "too busy", 404 = "not found", 400 = "bad request").
  if (!response.ok) {
    const error = new Error("MusicBrainz error " + response.status);
    error.status = response.status; // keep the code so the page can pick the right message
    // "throw" stops this function and jumps to the nearest "catch" block.
    throw error;
  }

  // The response body is JSON: text formatted like JavaScript objects, e.g.
  //   { "title": "OK Computer", "first-release-date": "1997-05-21", ... }
  // response.json() turns that text into real JavaScript objects we can use.
  return await response.json();
}


/* ---------- 3. Fix capitalization ----------
   MusicBrainz writes Spanish (and some other) titles in "sentence case":
   only the first word capitalized, e.g. "Un verano sin ti", "Me porto bonito".
   Artists and streaming apps usually write "Un Verano Sin Ti".
   MusicBrainz doesn't store the artist's version, so this is a RULE (a best guess):
     - Only titles in plain sentence case are changed: the first letter is a capital
       and EVERY other letter is lowercase.
     - Anything styled on purpose is left alone: "IGOR", "luther", "DeBÍ TiRAR MáS FOToS",
       "Exit Music (for a Film)" all have other capitals or start lowercase.
     - Small Spanish words like "de", "la", "y" stay lowercase ("Después de la Playa"). */

// A Set is a list made for one job: quickly checking "is this word in the list?"
const SMALL_WORDS = new Set(["a", "al", "de", "del", "e", "el", "en", "la", "las", "los", "o", "u", "y"]);

function fixCapitalization(title) {
  if (!title) {
    return title;
  }

  const firstLetter = title.charAt(0);
  const rest = title.slice(1);

  // Leave it alone unless the first letter is a capital AND everything after it
  // is already lowercase. (A letter is "a capital" if lowercasing it changes it.)
  const startsWithCapital = firstLetter !== firstLetter.toLowerCase();
  const restIsAllLowercase = rest === rest.toLowerCase();
  if (!startsWithCapital || !restIsAllLowercase) {
    return title;
  }

  // Split into words, capitalize each one (except small words), and join back up.
  const words = title.split(" ");
  for (let i = 1; i < words.length; i++) { // start at 1: the first word is already capitalized
    const word = words[i];
    if (!SMALL_WORDS.has(word)) {
      words[i] = word.charAt(0).toUpperCase() + word.slice(1);
    }
  }
  return words.join(" ");
}


/* ---------- 4. Small helpers for album data ---------- */

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

// The Cover Art Archive address of an album's front cover. size is 250 (small) or 500 (big).
// Used for the <img> below, and saved with each review so item 5 can show covers.
function getCoverUrl(albumId, size) {
  return `https://coverartarchive.org/release-group/${albumId}/front-${size}`;
}

// Builds the cover image for an album. size is 250 (small) or 500 (big).
// The Cover Art Archive has a cover address for every album id. If the album
// has no cover, the image fails to load and the "error" event fires.
function createCoverImage(album, size) {
  // document.createElement makes a new element. It isn't on the page yet.
  const cover = document.createElement("img");
  cover.className = "album-cover";
  cover.src = getCoverUrl(album.id, size);
  cover.alt = "Cover of " + fixCapitalization(album.title);

  // addEventListener means "when this happens, run this function".
  // Here: when the image fails to load, swap it for the "No cover" box.
  cover.addEventListener("error", function () {
    cover.replaceWith(createNoCoverBox());
  });

  return cover;
}
