# Episode short links

Owner decision, 2026-11-25: every video description and pinned comment links
to the site through its episode's short link, so visits from each episode can
be counted. The link redirects with `utm_source=youtube`, `utm_medium=video`
and `utm_campaign=ep<number>`; the existing anonymous analytics reads those
tags, and `/admin/analytics` shows sessions per campaign. Nothing about the
visitor is stored by the link itself.

To send an episode's viewers to a specific page, edit its `target` in
`app/data/episode-links.json` (a path on this site, such as
`/watches/archetype`), then commit. Links to other websites are refused.
Episodes 1–10 have no title in the local scripts yet.

| Episode | Title | Link |
| ---: | --- | --- |
| 1 |  | https://thereserve.watch/e/1 |
| 2 |  | https://thereserve.watch/e/2 |
| 3 |  | https://thereserve.watch/e/3 |
| 4 |  | https://thereserve.watch/e/4 |
| 5 |  | https://thereserve.watch/e/5 |
| 6 |  | https://thereserve.watch/e/6 |
| 7 |  | https://thereserve.watch/e/7 |
| 8 |  | https://thereserve.watch/e/8 |
| 9 |  | https://thereserve.watch/e/9 |
| 10 |  | https://thereserve.watch/e/10 |
| 11 | Vostok Outlived the USSR. Its Company Didn't | https://thereserve.watch/e/11 |
| 12 | Omega's Owners Sold Blancpain's Name for 20,000 Francs | https://thereserve.watch/e/12 |
| 13 | Bulova Built the Future, Then Licensed It to Its Rivals | https://thereserve.watch/e/13 |
| 14 | Why Did the Royal Oak Cost More Than Gold? | https://thereserve.watch/e/14 |
| 15 | Hamilton Is Swiss Now. So Who Stayed Behind? | https://thereserve.watch/e/15 |
| 16 | The Heuer Family Never Sold Heuer. They Lost It Anyway. | https://thereserve.watch/e/16 |
| 17 | Swatch Group Tried to Quit. Switzerland Made It Stay. | https://thereserve.watch/e/17 |
| 18 | Who Can Say No at Rolex, Omega and Patek Philippe? | https://thereserve.watch/e/18 |
| 19 | What Does "Since 1845" on a Watch Actually Mean? | https://thereserve.watch/e/19 |
| 20 | You Can Afford a Rolex. So Why Can't You Buy One? | https://thereserve.watch/e/20 |
| 21 | Paul Newman's Rolex Sold for More Than Anyone Bid | https://thereserve.watch/e/21 |
| 22 | NASA Gave the Moonwatch Job to a Camera Engineer | https://thereserve.watch/e/22 |
| 23 | A Rolex Dealer Contract. Not Leaked. Filed. | https://thereserve.watch/e/23 |
| 24 | Swatch Asked a Court to Say It Owed Nothing | https://thereserve.watch/e/24 |
| 25 | Rolex's Own Website Describes One Service Two Ways | https://thereserve.watch/e/25 |
| 26 | George Daniels Invented It. Omega Patented a Factory Fix. | https://thereserve.watch/e/26 |
| 27 | Apple Said Its Watch Is No. 1. Where Are the Numbers? | https://thereserve.watch/e/27 |
| 28 | The Word “Chronometer” Is Real. Who Is It Written For? | https://thereserve.watch/e/28 |
| 29 | When Does a Real Rolex Become a Counterfeit? | https://thereserve.watch/e/29 |
| 30 | Did a Car Crash Really Inspire the Cartier Crash? | https://thereserve.watch/e/30 |
| 31 | A Dealer Thought an Omega Was Worth More as Gold | https://thereserve.watch/e/31 |
| 32 | He Lost a £190,000 Rolex. The Insurer Paid Nothing. | https://thereserve.watch/e/32 |
| 33 | The Omega That Sold for Nearly 26 Times Its High Estimate | https://thereserve.watch/e/33 |
| 34 | The Soviet Dive Watch Built Around One Clever Part | https://thereserve.watch/e/34 |
| 35 | The Watch Was in Their Drawer. They Didn’t Own It. | https://thereserve.watch/e/35 |
| 36 | What Does an Empty Rolex Window Actually Prove? | https://thereserve.watch/e/36 |
| 37 | Jean-Claude Biver Made Cheese Nobody Could Buy | https://thereserve.watch/e/37 |
| 38 | What Did 66,000 Pebble Backers Actually Buy? | https://thereserve.watch/e/38 |
| 39 | The 65% Watch Loan Number Nobody Can Reproduce | https://thereserve.watch/e/39 |
| 40 | What Is a Watch Actually Worth, and to Whom? | https://thereserve.watch/e/40 |
| 41 | The Dial That Poisoned Its Painters | https://thereserve.watch/e/41 |
| 42 | The Watch Workers Who Paid Themselves | https://thereserve.watch/e/42 |
| 43 | The Watch Factory Paid People to Leave | https://thereserve.watch/e/43 |
| 44 | A New Trade Needed More Than a Free Classroom | https://thereserve.watch/e/44 |
| 45 | The Machines Still Needed a Watchmaker | https://thereserve.watch/e/45 |
| 46 | The Watch Passed. The Prize Did Not Follow. | https://thereserve.watch/e/46 |
| 47 | Did One Watch Cause the Train Crash? | https://thereserve.watch/e/47 |
| 48 | The Olympic Race That Time Could Not Settle | https://thereserve.watch/e/48 |
| 49 | The Pilot's Watch Still Needed a Navigator | https://thereserve.watch/e/49 |
| 50 | The Summit Was Shared. The Credit Became a Contest. | https://thereserve.watch/e/50 |
| 51 | The Swiss Watchmaker Who Removed Swiss Made | https://thereserve.watch/e/51 |
| 52 | The FTC Put Shinola's Detroit Claim to the Test | https://thereserve.watch/e/52 |
| 53 | Who Won the 1969 Watch Race? | https://thereserve.watch/e/53 |
| 54 | The 21-Jewel Claim the FTC Rejected | https://thereserve.watch/e/54 |
| 55 | The Watch That Didn't Fit Its Own Brand's Chart | https://thereserve.watch/e/55 |
| 56 | The Worker's Watch Most Workers Couldn't Buy | https://thereserve.watch/e/56 |
| 57 | The Dollar Watch Business That Could Not Pay | https://thereserve.watch/e/57 |
| 58 | The Watch Disappeared. The Sales Pitch Kept Going. | https://thereserve.watch/e/58 |
| 59 | When the Ruby Stopped Being Rare | https://thereserve.watch/e/59 |
| 60 | The Watch That Worked for Four Hours | https://thereserve.watch/e/60 |
| 61 | The Atomic Watch Has No Atomic Clock | https://thereserve.watch/e/61 |
| 62 | The Watch That Needed Your Other Hand | https://thereserve.watch/e/62 |
| 63 | The Calculator Watch Needed Another Tool | https://thereserve.watch/e/63 |
| 64 | Your Watch Works. The Service Doesn't. | https://thereserve.watch/e/64 |
| 65 | Why Did a Watch Feature Move to the Phone? | https://thereserve.watch/e/65 |
| 66 | The Watchmaker Had to Renew the Name | https://thereserve.watch/e/66 |
| 67 | The Sale Price That Depended on the Future | https://thereserve.watch/e/67 |
| 68 | The €278 Million Watch Sale Reversal | https://thereserve.watch/e/68 |
| 69 | The Military Watch Sold as a Memory | https://thereserve.watch/e/69 |
| 70 | The Watch Partnership That Ended in Arbitration | https://thereserve.watch/e/70 |
| 71 | The $40,000 Rolex in Madoff’s Auction | https://thereserve.watch/e/71 |
| 72 | The Watch That Vanished but Left a Record | https://thereserve.watch/e/72 |
| 73 | A Watch on Credit Behind Barbed Wire | https://thereserve.watch/e/73 |
| 74 | A Sky Built for One Customer | https://thereserve.watch/e/74 |
| 75 | The Watch That Knew Easter Until 2017 | https://thereserve.watch/e/75 |
| 76 | A Watch for Everyone Still Has to Fit Someone | https://thereserve.watch/e/76 |
| 77 | A Watch on the Wrist Was Only the Beginning | https://thereserve.watch/e/77 |
| 78 | The Mayor Who Vetoed Standard Time | https://thereserve.watch/e/78 |
| 79 | The Stopwatch That Cost a Worker His Job | https://thereserve.watch/e/79 |
| 80 | The World Does Not Run on One Clock | https://thereserve.watch/e/80 |
