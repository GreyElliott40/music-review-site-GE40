/* ============================================================
   album.js — the album page (album.html).
   Reads the album id from the address, asks MusicBrainz for the album
   and its tracklist, and builds the page.
   Shared helpers (fetchFromMusicBrainz, getArtistName, getYear,
   createCoverImage) live in musicbrainz.js, which loads first.
   ============================================================ */


/* ---------- 1. Find the parts of the page we need ---------- */
const albumDetail = document.getElementById("album-detail");
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
  title.textContent = album.title;

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
      discHeading.textContent = "Disc " + disc.position + (disc.title ? ": " + disc.title : "");
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
      name.textContent = track.title;

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


/* ---------- 6. Load everything ----------
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
    document.title = `${album.title} by ${getArtistName(album)} — Spin`;

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
    albumDetail.append(createAlbumHeader(album, trackCount, totalLength), createTracklist(media));
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
