# Music Review Site — Project Guide

Claude: read this whole file at the start of every session. It's the project's memory.

## What this is
A Letterboxd-style website for music. Users search for an album, rate it 0.5–5 stars (half stars allowed), can "like" it with a heart, can write a short review, and see their reviews on a profile page.

## Who's building it
Grey, a beginner who is learning to code through this project. That changes how Claude should work:
- Keep code simple and readable. Don't add frameworks or build tools until this file says to.
- After each change, explain in plain language what each new or changed file does and why.
- Add short comments to the code, especially when a concept is new (fetch, async/await, DOM manipulation, etc.).
- When there's a choice to make, give Grey the tradeoff in two or three sentences and let him decide.
- Build up to 3 roadmap items per session. After each item, update the "Status" section below.
- Don't tell Grey to start a new session, or end one, without asking him first.
- Always ask Grey for permission before merging a pull request, every time. Approval for one PR doesn't carry over to the next.

## Tech stack
- **Frontend:** plain HTML, CSS and JavaScript (no framework yet)
- **Album data:** MusicBrainz API (free, no key; about 1 request per second max) and the Cover Art Archive for album covers
- **Accounts and saved reviews:** Supabase, starting in Milestone 2
- **Hosting:** GitHub Pages for now, possibly Vercel later

## Roadmap
### Milestone 1: Static prototype (no accounts)
- [x] Basic page layout and styling (header, search bar, results area)
- [x] Album search with the MusicBrainz API that shows titles, artists and covers
- [x] Album detail page (cover, artist, year, tracklist)
- [x] Rating and review box, working like Letterboxd's: a 5-star rating that allows half stars (0.5–5), a separate heart to mark that you liked the album, and a short review (saved in the browser for now with localStorage)
- [ ] "My reviews" page that lists saved ratings
- [ ] Deploy to GitHub Pages

### Milestone 2: Real accounts and a database
- [ ] Set up a Supabase project
- [ ] Sign up and log in
- [ ] Save reviews to the database instead of localStorage
- [ ] Public profile pages

### Later (don't build yet)
- Rating individual songs
- Following other users and an activity feed
- Lists ("Top 10 albums of 2025")
- Average ratings per album

## Status
- Layout done: `index.html` (header, search bar, results grid, footer) and `style.css` (dark theme, responsive grid).
- Album search done: `script.js` searches MusicBrainz release groups (studio albums only: no singles, live albums or compilations), shows cover / title / artist / year cards, a "No cover" box when art is missing, and Searching / No results / error messages. The search is saved in the address (`index.html?q=...`) so Back brings results back.
- Search forgives typos: capitals and accents never mattered; words of 4+ letters match up to 2 letters off (`word~`). If the strict search (every word must match) finds nothing, a second "loose" search matches albums with only SOME of the words and says "Here are the closest matches". Query building lives in `buildQuery()` in `script.js`.
- Search limits: MusicBrainz counts swapped letters as 2 changes, so some typos are too far for `~`; the loose search catches most of those, but the right album isn't always #1. MusicBrainz has no popularity data, so for common titles ("What's Going On") the famous album may not rank first. Searching an artist name can also return albums *titled* with that name (e.g. "radiohead").
- Shared code lives in `musicbrainz.js` (loaded before each page's own script): `fetchFromMusicBrainz()` (waits at least 1 second between requests, tracked in `sessionStorage` so it holds across page changes, falling back to a normal variable if the browser blocks storage; retries once on a 503 "too busy"), `getArtistName()`, `getYear()`, `createCoverImage()`, `getCoverUrl()`, `fixCapitalization()`.
- Album page done: cards link to `album.html?id=<release-group id>&q=<search>`. `album.js` loads the album (1 request), picks the earliest official edition, loads its tracklist (2nd request), and shows cover, title, artist, year, track count, total length, and tracks (with disc headings for multi-disc albums). Handles missing/broken ids. "Back to search" returns to the same results.
- Title capitalization: MusicBrainz writes Spanish (and some other languages') titles in sentence case ("Un verano sin ti") and doesn't store the artist's styling. `fixCapitalization()` changes titles that are in plain sentence case (capital first letter, everything else lowercase) to "Un Verano Sin Ti", keeping small Spanish words (de, la, y...) lowercase. Titles styled on purpose (IGOR, GNX's lowercase tracks, DeBÍ TiRAR MáS FOToS) are untouched. Known misses: a sentence-case title with any other capital ("Voy a llevarte pa PR") or starting with a symbol ("¿Quién es?") isn't fixed; an artist who really uses sentence case gets wrongly capitalized. Artist names are never changed.
- Review box done (album page, between the header and the tracklist): half-star rating 0.5–5 (hover previews, click sets, clicking the current rating clears it; keyboard: Tab to the stars, arrows ±0.5, Home clears, End = 5; screen readers hear "3.5 out of 5 stars" via role="slider"), a like heart, an optional review (1,000-character limit with a live count), Save (off when nothing changed or there's no rating; shows "Saved ✓"), "Reviewed Nov 14, 2026", and Delete with an on-page confirmation. A rating is required to save; the heart and text are optional. The UI code is section 6 of `album.js`; the box's HTML is in `album.html`.
- Reviews are stored by `reviews.js` (loaded after `musicbrainz.js`, before the page script): one localStorage key, `spin-reviews`, holding an object keyed by release-group id. Each review: `albumId, title, artist, year, coverUrl, rating, liked, text, savedAt` (ISO date text). `title` is MusicBrainz's raw title, so run `fixCapitalization()` when showing it. `year` is "" if unknown. Functions: `loadAllReviews()` (object, `{}` if none, `null` if storage is blocked or the data is damaged), `saveReview(review)` (adds `savedAt`, returns the saved review or `null`), `deleteReview(albumId)` (true/false), constant `REVIEW_MAX_LENGTH`. If loading fails, saving is refused so damaged data is never overwritten.
- localStorage is per browser and per site address: reviews saved while opening the files locally won't appear on the GitHub Pages site, or in another browser.
- The header and footer are copied into both `index.html` and `album.html`; change both if you change one.
- Working site name is "Spin" (a placeholder; Grey can rename it).
- Next step: Milestone 1, item 5 ("My reviews" page). It should read everything from `loadAllReviews()` in `reviews.js`; no MusicBrainz requests needed.

## Decisions log
- Plain HTML/CSS/JS first so Grey learns the fundamentals before using a framework.
- MusicBrainz instead of Spotify: it's free and needs no API key or developer approval.
- Search MusicBrainz *release groups*, not releases, so each album shows up once instead of once per edition.
- Cover images come straight from the Cover Art Archive with an <img> tag; the 1-request-per-second limit is only for the MusicBrainz API.
- Typo handling uses MusicBrainz's own fuzzy search plus a looser fallback search, instead of fixing spelling ourselves, to keep `script.js` simple.
- Album page is a separate page (`album.html?id=...`), not a view swapped in on the search page, so every album has its own link and the Back button works. (Grey's choice.)
- The album page shows the tracklist of the earliest official edition, since one album can have many editions with different tracklists.
- Title capitalization is fixed with a rule (`fixCapitalization()`), not a second data source like Apple Music. It's a best guess, not the artist's real styling. A second data source would be accurate but much bigger; revisit after Milestone 1 if it matters. (Grey's choice.)
- Ratings work like Letterboxd's: 0.5–5 stars in half steps, plus a separate "like" heart, instead of whole 1–5 stars. (Grey's choice.)
- For saving, a rating is required; the heart and written review are optional. The review is limited to 1,000 characters. (Grey's choices.)
- Each saved review carries its album's title, artist, year and cover URL, so the "My reviews" page never has to call MusicBrainz (which would take 1 second per album).
