# Partner onboarding: how to add a paying partner

Your checklist for putting The Reserve on a partner's website, plus the
email to send them. Partners' own instructions are on
https://thereserve.watch/partners (send them that link too).
Publishing to npm, a Shopify app, the WordPress.org directory and other
channels: [`partner-distribution-playbook.md`](partner-distribution-playbook.md).

## Before you start

Agree the price with the partner (every feature is included) and ask for:

- **Every address their site is reached at**, exactly as it appears in the
  browser, for example `https://myshop.com` and `https://www.myshop.com`.
  Shopify shops usually need both their own domain and
  `https://their-shop.myshopify.com`. Add `http://localhost:3000` only if
  their developer wants to test locally.
- Their **brand colours** (optional): accent (buttons and links), background,
  card and text colour, and whether their site is light or dark.
- Whether they want the **API** (only if a developer will build their own
  design). Most partners just need the widget.

## 1. Create the site (2 minutes)

1. Open https://thereserve.watch/admin/sites and sign in with the admin
   password (the same one as the catalogue review).
2. Open **Add a partner site** and fill in:
   - **Name**: the partner or shop name.
   - **Monthly limit**: leave empty for unlimited, or a number of uses per
     month if their plan has a cap.
   - **Website addresses**: one per line, as collected above.
   - **Theme** (optional): Look = Light for most shops; accent, background,
     card and text colours as `#hex`; font; corner rounding. Partners can
     also override these themselves on the code.
   - **Notes**: plan, price, contact person (only you see this).
3. Click **Create site and public key**. The site appears in the list with
   its public key (`pk_live_…`).

## 2. If they want the API: create a secret key

Click **Create secret key (for the partner's server)** on their site. The key
(`sk_live_…`) is shown **once**: copy it straight into your email to the
partner's developer. It is not stored and can't be shown again; if it's lost
or leaked, click **Replace secret key** (the old one stops working at once).

Never send the secret key to anyone who will put it in a web page.

## 3. Send them the code

Open **Code to send the partner** on their site and copy the two lines, or
use the email below.

## 4. Check it works

When they say it's live, open their page. The widget should load within a
second or two with "Powered by The Reserve" at the bottom. If it shows a
blank box or "refused to connect", the address in their browser isn't in
the site's list: **Edit** the site, add the exact address, **Save**. Changes
take effect within a minute.

## Every month: invoicing

Each site on `/admin/sites` shows this month's and last month's uses, in
total and per feature. What counts as one use:

| Feature | One use is |
| --- | --- |
| Watch diagnostic (quiz) | one submitted shortlist |
| Watch archetype | one archetype result |
| Watches from film/TV | one search |
| Cheaper alternatives | one search |
| Stories | one story page or list viewed |

Opening a widget without searching doesn't count.

## Changing or ending a partnership

- **Change addresses, limit or colours**: **Edit** → change → **Save**.
- **Pause or end**: **Edit** → untick **Active** → **Save**. The widgets
  disappear from their site within a minute. Tick it again to restore; the
  same code keeps working. Sites are never deleted, so the usage history
  stays for your records.
- **Raise the limit**: when a site reaches its monthly limit, visitors see
  "This website has used all of its searches for this month". Edit the limit
  to lift it immediately.

## Email to send the partner

> Subject: Your The Reserve widget is ready
>
> Hi [name],
>
> Your The Reserve account is set up for [their addresses].
>
> **Your public key:** `pk_live_…`
>
> **To add the watch finder**, paste these two lines where it should appear
> on your page:
>
> ```html
> <div data-reserve="quiz"></div>
> <script src="https://thereserve.watch/embed.js" data-key="pk_live_…" async></script>
> ```
>
> Change `quiz` to show a different tool: `archetype` (watch personality
> quiz), `find` (watches from films, TV and celebrities), `alternatives`
> (cheaper alternatives to a named watch) or `stories` (watches from
> movies). You can use several on one page; the script line is needed only
> once.
>
> **WordPress:** install the plugin from
> https://thereserve.watch/downloads/the-reserve-wordpress.zip, paste your
> key under Settings → The Reserve, then add `[the_reserve feature="quiz"]`
> to any page.
>
> **Shopify:** Online Store → Themes → Customize → Add section → Custom
> Liquid, and paste the two lines above.
>
> Colours, other website builders, the API and troubleshooting:
> https://thereserve.watch/partners
>
> [Only if they asked for the API:] Your secret key for your server is
> `sk_live_…`. Keep it on your server only and never put it in a web page.
>
> Your visitors don't need an account or email address, and the widget sets
> no cookies. Reply to this email with any questions.

## For reference

- Keys: public `pk_live_` + 24 characters (safe in page source, works only on
  the registered addresses); secret `sk_live_` + 40 characters (server only).
- Command-line alternative to step 1:
  `node --env-file=.env --import tsx scripts/create-partner-site.ts "Shop name" https://myshop.com https://www.myshop.com`
- After changing the WordPress plugin: `npx tsx scripts/package-wordpress-plugin.ts`
  and commit the zip.
- How it works in code: "Partner widgets" in `CODE-GUIDE.md`.
