A Letterboxd-style website for music. Search for any album, rate it from one to five stars, write a review, and keep a profile of everything you've listened to.

## Why this exists

Letterboxd turned logging films into a habit and a community, but music doesn't have a real equivalent. The places that do exist for reviewing albums tend to be cluttered, outdated, or built for critics rather than everyday listeners. This project tries to build the simple version that's missing: a clean place to rate what you hear, write a few honest sentences about it, and look back on your listening over time.

## What it does

The first version focuses on the core loop:

- **Search** for any album using the MusicBrainz database, with cover art from the Cover Art Archive
- **View** an album's details: artist, release year, and tracklist
- **Rate** it from one to five stars, with an optional written review
- **See** all of your ratings on a personal "My Reviews" page

Later versions will add user accounts, public profiles, ratings for individual songs, custom lists like "Top 10 Albums of the Year," and the ability to follow friends and see what they're listening to.

## How it's built

The site starts with plain HTML, CSS, and JavaScript, without frameworks, so every part of it stays understandable. Album data comes from the free, open MusicBrainz API, which needs no key or developer approval. In the second milestone, Supabase will handle sign-ups and log-ins and store reviews in a real database. The site is hosted on GitHub Pages.

## About this repo

This is also a learning project. I'm building it to learn web development from the ground up, with AI as both a coding partner and a teacher. Each work session tackles one feature, and every new concept gets explained and commented in the code as it's added. The full roadmap, current status, and a log of technical decisions live in `CLAUDE.md`, which gets updated at the end of every session. The commit history shows the project growing one feature at a time.

## Status

🚧 In progress: Milestone 1 (static prototype)
