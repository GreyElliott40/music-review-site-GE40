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
- [ ] Album search with the MusicBrainz API that shows titles, artists and covers
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
- Layout done: `index.html` (header, search bar, results grid, footer) and `style.css` (dark theme, responsive grid). Placeholder album cards are in the results grid; delete them when real search results arrive.
- The search form has no JavaScript yet. Submitting it just reloads the page.
- Working site name is "Spin" (a placeholder; Grey can rename it).
- Next step: Milestone 1, item 2 (album search with MusicBrainz). It will need a new `script.js`.

## Decisions log
- Plain HTML/CSS/JS first so Grey learns the fundamentals before using a framework.
- MusicBrainz instead of Spotify: it's free and needs no API key or developer approval.
