# The profile page (/start) and its episode data

Owner decision, 2026-11-27: the first link in the Instagram and TikTok
profiles (@thereserve.watch) is the site, YouTube is the second. Every reel
caption ends with "Full episode: link in bio.", so the page the link opens
shows the latest episode on the first screen of a phone. The channel
folder's task is `analysis/SITE_SOCIAL_LANDING.md`.

| Address | What |
| --- | --- |
| https://thereserve.watch/start | The page: latest episode, every episode out so far, the archetype quiz, the newsletter sign-up, the privacy policy |
| https://thereserve.watch/ig | Instagram profile link: 302 to `/start?utm_source=instagram&utm_medium=social&utm_campaign=bio` |
| https://thereserve.watch/tt | TikTok profile link: 302 to `/start?utm_source=tiktok&utm_medium=social&utm_campaign=bio` |

`/admin/analytics` groups campaigns by campaign and source, so Instagram and
TikTok visits show as separate rows of campaign `bio`. Clicks on the page are
named per episode in the controls table: `Watch on YouTube · EP01`,
`Episode cover · EP01`, `Episode list · EP03`, `YouTube channel`, and
`YouTube channel · before the first episode`.

## How episodes appear

- The data is `app/data/youtube-episodes.json`, a copy of the channel
  folder's `analysis/site_youtube_episodes.json`: per episode its number,
  title, YouTube ID and `publishAt` with the Warsaw offset
  (`2026-12-06T16:00:00+01:00`).
- The page's loader (`app/routes/start.tsx`, rules in
  `app/domain/youtube-episodes.server.ts`) keeps only the episodes whose
  `publishAt` has passed. Until then the video is private on YouTube, so the
  ID and title of an episode not yet out are in neither the page's HTML nor
  the data sent to the browser. The file ends in `.server.ts`, so the full
  list never reaches the browser's JavaScript either.
- Before the first release the page says "First episode: Sunday 6 December"
  (the day comes from the data) with a button to the channel, without the
  title.
- The CDN keeps the page for five minutes at most, and only until the next
  release time (`s-maxage` = the seconds left, capped at 300, with no
  stale copy served afterwards). On a release day the episode appears by
  itself at its time; nobody deploys or edits anything that day.

The repository is public: a title or ID committed here can be read on
GitHub before its release. A scheduled YouTube video stays private until its
release time, so its ID opens nothing early; episode titles were already
public in `docs/episode-links.md`.

## Updating the episodes

The channel session sends a new file each time an episode is scheduled or
re-uploaded with a new ID: `python tools/site_episodes_export.py` writes
`analysis/site_youtube_episodes.json` from `analysis/pre_release_links.json`
(`--check` confirms the two agree). Then, in this repository:

1. Copy it over the site's copy:

   ```sh
   cp "../The Reserve/analysis/site_youtube_episodes.json" app/data/youtube-episodes.json
   ```

2. Run the tests: the file must parse (an 11-character ID, a release time
   with its offset, one entry per episode and per video), and the release
   checks must still pass.

   ```sh
   npx vitest run app/domain/youtube-episodes.server.test.ts app/routes/start.test.tsx
   ```

   The tests name episodes 1, 2 and 11 by their current titles and IDs. If
   one of those three is re-uploaded, update the expected ID in both test
   files in the same commit.

3. Commit the JSON and push `main`; Vercel deploys it.

Do this well before the release, as the channel schedules it, never on the
day: an episode added early stays hidden until its time. If a release is
moved later, the new file must be deployed before the old time, or the page
would link to a video that is still private.

## Checking production

```sh
curl -sI https://thereserve.watch/ig
curl -sI https://thereserve.watch/tt
curl -s https://thereserve.watch/start | grep -c "youtube.com/watch"
```

The first two answer `302` with the tags above. The last counts the episode
links: before 6 December 16:00 (Warsaw) it is 0; afterwards the latest
episode has two links (cover and button) and each episode one more in the
list.
