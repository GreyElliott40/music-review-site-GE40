# Music Review Site — Project Guide

Claude: read this whole file at the start of every session. It's the project's memory.

## What this is
A Letterboxd-style website for music. Users search for an album, rate it 1–5 stars, can write a short review, and see their reviews on a profile page.

## Who's building it
Grey, a beginner who is learning to code through this project. That changes how Claude should work:
- Keep code simple and readable. Don't add frameworks or build tools until this file says to.
- After each change, explain in plain language what each new or changed file does and why.
- Add short comments to the code, especially when a concept is new (fetch, async/await, DOM manipulation, etc.).
- When there's a choice to make, give Grey the tradeoff in two or three sentences and let him decide.
- Make one feature per session. At the end, update the "Status" section below.

## Tech stack
- **Frontend:** plain HTML, CSS and JavaScript (no framework yet)
- **Album data:** MusicBrainz API (free, no key; about 1 request per second max) and the Cover Art Archive for album covers
- **Accounts and saved reviews:** Supabase, starting in Milestone 2
- **Hosting:** GitHub Pages for now, possibly Vercel later

## Roadmap
### Milestone 1: Static prototype (no accounts)
- [x] Basic page layout and styling (header, search bar, results area)
- [x] Album search with the MusicBrainz API that shows titles, artists and covers
- [ ] Album detail page (cover, artist, year, tracklist)
- [ ] Star rating and review box (saved in the browser for now with localStorage)
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
- Album search done: `script.js` searches MusicBrainz release groups (studio albums only: no singles, live albums or compilations), shows cover / title / artist / year cards, a "No cover" box when art is missing, and Searching / No results / error messages. Waits at least 1 second between requests and retries once on a 503 ("too busy").
- Search quality is decent but imperfect: searching an artist name can also return albums *titled* with that name (e.g. "radiohead"). Ranking lives in `buildQuery()` in `script.js`.
- Album cards are not clickable yet.
- Working site name is "Spin" (a placeholder; Grey can rename it).
- Next step: Milestone 1, item 3 (album detail page). Clicking a card should open it, using the album's MusicBrainz id.

## Decisions log
- Plain HTML/CSS/JS first so Grey learns the fundamentals before using a framework.
- MusicBrainz instead of Spotify: it's free and needs no API key or developer approval.
- Search MusicBrainz *release groups*, not releases, so each album shows up once instead of once per edition.
- Cover images come straight from the Cover Art Archive with an <img> tag; the 1-request-per-second limit is only for the MusicBrainz API.
