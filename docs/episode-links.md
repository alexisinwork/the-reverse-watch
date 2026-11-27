# Episode short links

## Links per platform (owner, 2026-11-27)

"Нужно нам чётко создать ссылки под youtube/tiktok/insta, чтобы мы знали,
откуда кто пришёл." Every link below is a short address on the site that
redirects with its platform's campaign tags; `/admin/analytics` shows
sessions by source and by campaign and source.

Vercel Web Analytics receives the same three tags since 2026-11-27 (before,
the whole query was cut off; `analyticsAddress` in
`app/domain/campaign-tags.ts` keeps only these tags with plain values).
Splitting visits by them in Vercel needs the Web Analytics Plus add-on or
the Enterprise plan: on Pro the API answers "UTM dimensions require an
Enterprise plan or the Web Analytics Plus add-on" (402). Pro shows pages,
countries, devices and referring sites, such as `l.instagram.com` and
`facebook.com`. A YouTube Short and the long video of the same episode
differ only in `utm_medium`; `/admin/analytics` shows the medium in its own
column since 2026-11-27 (below).

### Visits, quiz and sign-ups per platform (2026-11-27)

`/admin/analytics` → "Where visitors and subscribers come from" counts each
browser-tab session once, under how its visit began (its first touch), with
the sessions that started a quiz (diagnostic or archetype), finished it,
finished any tool, and subscribed to the newsletter, and the share of
sessions that subscribed. The first touch is the link's `utm_*` tags;
without tags, the referring site (`instagram.com` and `l.instagram.com` are
instagram, `tiktok.com` tiktok, `youtube.com`, `m.youtube.com` and
`youtu.be` youtube, any other site its host name); without a referrer,
`direct`. Direct has its own line: an address typed by hand after the ad
read in an episode lands there. The browser keeps the first touch in the
tab's sessionStorage (`app/domain/first-touch.ts`), so it survives a reload
and the plain link from `/start` to the archetype quiz. A new newsletter
subscription sends the same first touch to Beehiiv (`utm_source`,
`utm_medium`, `utm_campaign`, and the entry page as `referring_site`), so
Beehiiv's own acquisition report splits subscribers the same way.

| Where the link goes | Link | Tags |
| --- | --- | --- |
| A YouTube video's description and pinned comment | `https://thereserve.watch/e/<episode>` | youtube · video · ep<episode> |
| A YouTube Short | `https://thereserve.watch/ys/<episode>` | youtube · shorts · ep<episode> |
| A TikTok clip | `https://thereserve.watch/tt/<episode>` | tiktok · short_video · ep<episode> |
| An Instagram reel or post | `https://thereserve.watch/ig/<episode>` | instagram · short_video · ep<episode> |
| The YouTube channel's links | `https://thereserve.watch/yt` | youtube · social · bio |
| The TikTok profile's bio link | `https://thereserve.watch/tt` | tiktok · social · bio |
| The Instagram profile's bio link | `https://thereserve.watch/ig` | instagram · social · bio |

A clip of episode N opens the same tool as `/e/N` (the table below). The
bio links open the pages set under `profiles` in
`app/data/episode-links.json`: `/tt` and `/ig` open `/start`, the profile
page that leads with the latest episode (`docs/social-landing.md`); `/yt`
opens the home page. The tags for bio links follow the channel's
decision of 2026-11-27 (`analysis/SITE_SOCIAL_LANDING.md` in the channel
folder).

Owner decision, 2026-11-25: every video description and pinned comment links
to the site through its episode's short link, so visits from each episode can
be counted. The link redirects with `utm_source=youtube`, `utm_medium=video`
and `utm_campaign=ep<number>`; the existing anonymous analytics reads those
tags, and `/admin/analytics` shows sessions per campaign. Nothing about the
visitor is stored by the link itself.

## Where each link leads (owner decision, 2026-11-26)

Each episode ends with one line about the site, and its link opens the tool
that line describes, so viewers land where the video told them to go:

| Text | Closing line in the video | Opens |
| --- | --- | --- |
| A | “Four questions at thereserve.watch tell you what kind of collector you are, with ten watches at your price. Free, no sign-up.” | Archetype quiz, `/watches/archetype` (four questions, no email) |
| B | “Name a watch you love at thereserve.watch, and we'll find cheaper alternatives that look and work like it. Free with our newsletter.” | Cheaper alternatives, `/watches/alternatives` (newsletter) |
| C | “At thereserve.watch, six answers about your budget, your wrist and how you wear a watch build a shortlist checked against the maker's own pages. Free with the newsletter.” | Diagnostic quiz, `/quiz` (six answers, newsletter) |

Episodes 11–80 use the texts in turn, A for episode 1 + 3k, B for 2 + 3k and
C for 3 + 3k (the owner's rule of 2026-11-23); all 70 recording scripts
(`RECORDING_SCRIPTS_EP11-EP80.md` in the channel folder) contain exactly
their episode's text. Episodes 1–10 were recorded before the fixed texts, so
each link follows the episode's own spoken line, checked against its
transcript or aligned script in `edit/EPxx/`. Episodes 5, 9 and 10 say only
"find a style" or "explore recommendations": 5 opens the free archetype quiz
(a style that fits you), 9 and 10 the diagnostic quiz (recommendations and
references that fit your life).

Checked against the site on 2026-11-26: the archetype quiz has four
questions and asks for no email; the diagnostic quiz has six answers and
lists watches confirmed on their makers' pages; the alternatives finder and
the diagnostic quiz need the newsletter subscription. Not yet proven: that
every archetype and budget reaches ten watches. Some combinations have fewer
than ten catalogue candidates and depend on paid discovery; measuring that is
part of the evaluation budget in `docs/evaluation-budget.md`.

To send an episode's viewers elsewhere, edit its `target` in
`app/data/episode-links.json` (a path on this site, such as
`/watches/find`), then commit. Links to other websites are refused, and a
test fails if a target is not an existing visitor page.

| Episode | Title | Closing line | Opens | Link |
| ---: | --- | --- | --- | --- |
| 1 | Switzerland Built the Future. Then Couldn't Afford to Sell It. | “…questions at thereserve.watch tell you what kind of collector you are…” | Archetype quiz (`/watches/archetype`) | https://thereserve.watch/e/1 |
| 2 | Rolex Has No Shareholders to Answer To | “…name a watch you love at thereserve.watch…” | Cheaper alternatives (`/watches/alternatives`) | https://thereserve.watch/e/2 |
| 3 | America Protected Its Watch Industry. It Moved Abroad Anyway | “…six answers about your budget, your wrist, and how you wear a watch…” | Diagnostic quiz (`/quiz`) | https://thereserve.watch/e/3 |
| 4 | A Government Bought an Entire American Factory | “…four questions at thereserve.watch will tell you.” | Archetype quiz (`/watches/archetype`) | https://thereserve.watch/e/4 |
| 5 | Seiko Didn't Invent Quartz. It Did the Harder Part | “…explore thereserve.watch to find a style that fits you.” | Archetype quiz (`/watches/archetype`) | https://thereserve.watch/e/5 |
| 6 | The Man Who Built It Thought He Was Being Fired | “…six answers can help you find watches matched to…” | Diagnostic quiz (`/quiz`) | https://thereserve.watch/e/6 |
| 7 | A. Lange & Söhne: The Watch Company That Disappeared for 40 Years | “…six answers can help you find watches matched to specific references…” | Diagnostic quiz (`/quiz`) | https://thereserve.watch/e/7 |
| 8 | Casio Broke 200 Prototypes. Then a Rubber Ball Changed Everything. | “…watch suggestions matched to your budget and how you wear one…” | Diagnostic quiz (`/quiz`) | https://thereserve.watch/e/8 |
| 9 | This Watch Factory Is 300 Years Old. It Didn't Make Watches for 225. | “You can explore watch recommendations at thereserve.watch.” | Diagnostic quiz (`/quiz`) | https://thereserve.watch/e/9 |
| 10 | Patek Philippe's Most Famous Line Was Written by an Ad Agency | “Explore the references and how they fit your life…” | Diagnostic quiz (`/quiz`) | https://thereserve.watch/e/10 |
| 11 | Vostok Outlived the USSR. Its Company Didn't | Text B | Cheaper alternatives (`/watches/alternatives`) | https://thereserve.watch/e/11 |
| 12 | Omega's Owners Sold Blancpain's Name for 20,000 Francs | Text C | Diagnostic quiz (`/quiz`) | https://thereserve.watch/e/12 |
| 13 | Bulova Built the Future, Then Licensed It to Its Rivals | Text A | Archetype quiz (`/watches/archetype`) | https://thereserve.watch/e/13 |
| 14 | Why Did the Royal Oak Cost More Than Gold? | Text B | Cheaper alternatives (`/watches/alternatives`) | https://thereserve.watch/e/14 |
| 15 | Hamilton Is Swiss Now. So Who Stayed Behind? | Text C | Diagnostic quiz (`/quiz`) | https://thereserve.watch/e/15 |
| 16 | The Heuer Family Never Sold Heuer. They Lost It Anyway. | Text A | Archetype quiz (`/watches/archetype`) | https://thereserve.watch/e/16 |
| 17 | Swatch Group Tried to Quit. Switzerland Made It Stay. | Text B | Cheaper alternatives (`/watches/alternatives`) | https://thereserve.watch/e/17 |
| 18 | Who Can Say No at Rolex, Omega and Patek Philippe? | Text C | Diagnostic quiz (`/quiz`) | https://thereserve.watch/e/18 |
| 19 | What Does "Since 1845" on a Watch Actually Mean? | Text A | Archetype quiz (`/watches/archetype`) | https://thereserve.watch/e/19 |
| 20 | You Can Afford a Rolex. So Why Can't You Buy One? | Text B | Cheaper alternatives (`/watches/alternatives`) | https://thereserve.watch/e/20 |
| 21 | Paul Newman's Rolex Sold for More Than Anyone Bid | Text C | Diagnostic quiz (`/quiz`) | https://thereserve.watch/e/21 |
| 22 | NASA Gave the Moonwatch Job to a Camera Engineer | Text A | Archetype quiz (`/watches/archetype`) | https://thereserve.watch/e/22 |
| 23 | A Rolex Dealer Contract. Not Leaked. Filed. | Text B | Cheaper alternatives (`/watches/alternatives`) | https://thereserve.watch/e/23 |
| 24 | Swatch Asked a Court to Say It Owed Nothing | Text C | Diagnostic quiz (`/quiz`) | https://thereserve.watch/e/24 |
| 25 | Rolex's Own Website Describes One Service Two Ways | Text A | Archetype quiz (`/watches/archetype`) | https://thereserve.watch/e/25 |
| 26 | George Daniels Invented It. Omega Patented a Factory Fix. | Text B | Cheaper alternatives (`/watches/alternatives`) | https://thereserve.watch/e/26 |
| 27 | Apple Said Its Watch Is No. 1. Where Are the Numbers? | Text C | Diagnostic quiz (`/quiz`) | https://thereserve.watch/e/27 |
| 28 | The Word “Chronometer” Is Real. Who Is It Written For? | Text A | Archetype quiz (`/watches/archetype`) | https://thereserve.watch/e/28 |
| 29 | When Does a Real Rolex Become a Counterfeit? | Text B | Cheaper alternatives (`/watches/alternatives`) | https://thereserve.watch/e/29 |
| 30 | Did a Car Crash Really Inspire the Cartier Crash? | Text C | Diagnostic quiz (`/quiz`) | https://thereserve.watch/e/30 |
| 31 | A Dealer Thought an Omega Was Worth More as Gold | Text A | Archetype quiz (`/watches/archetype`) | https://thereserve.watch/e/31 |
| 32 | He Lost a £190,000 Rolex. The Insurer Paid Nothing. | Text B | Cheaper alternatives (`/watches/alternatives`) | https://thereserve.watch/e/32 |
| 33 | The Omega That Sold for Nearly 26 Times Its High Estimate | Text C | Diagnostic quiz (`/quiz`) | https://thereserve.watch/e/33 |
| 34 | The Soviet Dive Watch Built Around One Clever Part | Text A | Archetype quiz (`/watches/archetype`) | https://thereserve.watch/e/34 |
| 35 | The Watch Was in Their Drawer. They Didn’t Own It. | Text B | Cheaper alternatives (`/watches/alternatives`) | https://thereserve.watch/e/35 |
| 36 | What Does an Empty Rolex Window Actually Prove? | Text C | Diagnostic quiz (`/quiz`) | https://thereserve.watch/e/36 |
| 37 | Jean-Claude Biver Made Cheese Nobody Could Buy | Text A | Archetype quiz (`/watches/archetype`) | https://thereserve.watch/e/37 |
| 38 | What Did 66,000 Pebble Backers Actually Buy? | Text B | Cheaper alternatives (`/watches/alternatives`) | https://thereserve.watch/e/38 |
| 39 | The 65% Watch Loan Number Nobody Can Reproduce | Text C | Diagnostic quiz (`/quiz`) | https://thereserve.watch/e/39 |
| 40 | What Is a Watch Actually Worth, and to Whom? | Text A | Archetype quiz (`/watches/archetype`) | https://thereserve.watch/e/40 |
| 41 | The Dial That Poisoned Its Painters | Text B | Cheaper alternatives (`/watches/alternatives`) | https://thereserve.watch/e/41 |
| 42 | The Watch Workers Who Paid Themselves | Text C | Diagnostic quiz (`/quiz`) | https://thereserve.watch/e/42 |
| 43 | The Watch Factory Paid People to Leave | Text A | Archetype quiz (`/watches/archetype`) | https://thereserve.watch/e/43 |
| 44 | A New Trade Needed More Than a Free Classroom | Text B | Cheaper alternatives (`/watches/alternatives`) | https://thereserve.watch/e/44 |
| 45 | The Machines Still Needed a Watchmaker | Text C | Diagnostic quiz (`/quiz`) | https://thereserve.watch/e/45 |
| 46 | The Watch Passed. The Prize Did Not Follow. | Text A | Archetype quiz (`/watches/archetype`) | https://thereserve.watch/e/46 |
| 47 | Did One Watch Cause the Train Crash? | Text B | Cheaper alternatives (`/watches/alternatives`) | https://thereserve.watch/e/47 |
| 48 | The Olympic Race That Time Could Not Settle | Text C | Diagnostic quiz (`/quiz`) | https://thereserve.watch/e/48 |
| 49 | The Pilot's Watch Still Needed a Navigator | Text A | Archetype quiz (`/watches/archetype`) | https://thereserve.watch/e/49 |
| 50 | The Summit Was Shared. The Credit Became a Contest. | Text B | Cheaper alternatives (`/watches/alternatives`) | https://thereserve.watch/e/50 |
| 51 | The Swiss Watchmaker Who Removed Swiss Made | Text C | Diagnostic quiz (`/quiz`) | https://thereserve.watch/e/51 |
| 52 | The FTC Put Shinola's Detroit Claim to the Test | Text A | Archetype quiz (`/watches/archetype`) | https://thereserve.watch/e/52 |
| 53 | Who Won the 1969 Watch Race? | Text B | Cheaper alternatives (`/watches/alternatives`) | https://thereserve.watch/e/53 |
| 54 | The 21-Jewel Claim the FTC Rejected | Text C | Diagnostic quiz (`/quiz`) | https://thereserve.watch/e/54 |
| 55 | The Watch That Didn't Fit Its Own Brand's Chart | Text A | Archetype quiz (`/watches/archetype`) | https://thereserve.watch/e/55 |
| 56 | The Worker's Watch Most Workers Couldn't Buy | Text B | Cheaper alternatives (`/watches/alternatives`) | https://thereserve.watch/e/56 |
| 57 | The Dollar Watch Business That Could Not Pay | Text C | Diagnostic quiz (`/quiz`) | https://thereserve.watch/e/57 |
| 58 | The Watch Disappeared. The Sales Pitch Kept Going. | Text A | Archetype quiz (`/watches/archetype`) | https://thereserve.watch/e/58 |
| 59 | When the Ruby Stopped Being Rare | Text B | Cheaper alternatives (`/watches/alternatives`) | https://thereserve.watch/e/59 |
| 60 | The Watch That Worked for Four Hours | Text C | Diagnostic quiz (`/quiz`) | https://thereserve.watch/e/60 |
| 61 | The Atomic Watch Has No Atomic Clock | Text A | Archetype quiz (`/watches/archetype`) | https://thereserve.watch/e/61 |
| 62 | The Watch That Needed Your Other Hand | Text B | Cheaper alternatives (`/watches/alternatives`) | https://thereserve.watch/e/62 |
| 63 | The Calculator Watch Needed Another Tool | Text C | Diagnostic quiz (`/quiz`) | https://thereserve.watch/e/63 |
| 64 | Your Watch Works. The Service Doesn't. | Text A | Archetype quiz (`/watches/archetype`) | https://thereserve.watch/e/64 |
| 65 | Why Did a Watch Feature Move to the Phone? | Text B | Cheaper alternatives (`/watches/alternatives`) | https://thereserve.watch/e/65 |
| 66 | The Watchmaker Had to Renew the Name | Text C | Diagnostic quiz (`/quiz`) | https://thereserve.watch/e/66 |
| 67 | The Sale Price That Depended on the Future | Text A | Archetype quiz (`/watches/archetype`) | https://thereserve.watch/e/67 |
| 68 | The €278 Million Watch Sale Reversal | Text B | Cheaper alternatives (`/watches/alternatives`) | https://thereserve.watch/e/68 |
| 69 | The Military Watch Sold as a Memory | Text C | Diagnostic quiz (`/quiz`) | https://thereserve.watch/e/69 |
| 70 | The Watch Partnership That Ended in Arbitration | Text A | Archetype quiz (`/watches/archetype`) | https://thereserve.watch/e/70 |
| 71 | The $40,000 Rolex in Madoff’s Auction | Text B | Cheaper alternatives (`/watches/alternatives`) | https://thereserve.watch/e/71 |
| 72 | The Watch That Vanished but Left a Record | Text C | Diagnostic quiz (`/quiz`) | https://thereserve.watch/e/72 |
| 73 | A Watch on Credit Behind Barbed Wire | Text A | Archetype quiz (`/watches/archetype`) | https://thereserve.watch/e/73 |
| 74 | A Sky Built for One Customer | Text B | Cheaper alternatives (`/watches/alternatives`) | https://thereserve.watch/e/74 |
| 75 | The Watch That Knew Easter Until 2017 | Text C | Diagnostic quiz (`/quiz`) | https://thereserve.watch/e/75 |
| 76 | A Watch for Everyone Still Has to Fit Someone | Text A | Archetype quiz (`/watches/archetype`) | https://thereserve.watch/e/76 |
| 77 | A Watch on the Wrist Was Only the Beginning | Text B | Cheaper alternatives (`/watches/alternatives`) | https://thereserve.watch/e/77 |
| 78 | The Mayor Who Vetoed Standard Time | Text C | Diagnostic quiz (`/quiz`) | https://thereserve.watch/e/78 |
| 79 | The Stopwatch That Cost a Worker His Job | Text A | Archetype quiz (`/watches/archetype`) | https://thereserve.watch/e/79 |
| 80 | The World Does Not Run on One Clock | Text B | Cheaper alternatives (`/watches/alternatives`) | https://thereserve.watch/e/80 |
