# Partner distribution playbook: every way to ship the widgets

What is live today, and step-by-step for every channel that is prepared but
not launched yet. Day-to-day onboarding of a partner is in
[`partner-onboarding.md`](partner-onboarding.md).

| Channel | State | Needs from you |
| --- | --- | --- |
| Script tag (any website) | **Live** | Nothing |
| WordPress plugin (zip download) | **Live**, not yet tested on a real WordPress | 10-minute test (section 1) |
| Shopify Custom Liquid | **Live** | Nothing |
| Wix, Squarespace, Webflow, Google Tag Manager | **Live** (paste the script) | Nothing |
| JSON API | **Live** | Nothing |
| npm packages (`@thereserve/client`, `@thereserve/react`) | Code ready, **not published** | npm account (section 2) |
| Shopify app block (theme editor) | Code ready, **not published** | Shopify Partner account (section 3) |
| WordPress.org plugin directory | **Not submitted** | WordPress.org account (section 4) |

Rule for every channel: when it goes live, add its instructions to
`/partners` (`app/routes/partners.tsx`) and update this table.

---

## 1. Test the WordPress plugin (do this first)

The plugin's PHP has not been run yet. Test it without installing anything:

1. Open https://playground.wordpress.net (a full WordPress in your browser).
2. In its admin: **Plugins → Add New → Upload Plugin**, choose
   `public/downloads/the-reserve-wordpress.zip` (or download it from
   https://thereserve.watch/downloads/the-reserve-wordpress.zip), **Install**,
   **Activate**. Any PHP error appears here.
3. **Settings → The Reserve**: paste a public key, pick Light, **Save**.
   Check a wrong key (e.g. `abc`) shows an error and isn't saved.
4. Create a page with `[the_reserve feature="quiz"]` and another with the
   **The Reserve** block. View them.
   - Playground's address isn't registered for any key, so the widget box
     shows "refused to connect". That is correct and proves the plugin
     wrote the right code. To see the widget itself, add the Playground
     address (shown in its address bar, e.g. `https://playground.wordpress.net`)
     to a test site on `/admin/sites`, wait a minute, reload.
5. If something fails, tell Claude the error text; after any fix run
   `npx tsx scripts/package-wordpress-plugin.ts` and commit the new zip.

## 2. Publish the npm packages

Lets developers write `npm install @thereserve/react` instead of copying code.

**One-time setup**

1. Create an account at https://www.npmjs.com/signup and turn on two-factor
   authentication (Account → Two-Factor Authentication).
2. Claim the name `@thereserve`: **Add Organization** (the + menu), name
   `thereserve`, choose the free plan (public packages only). Both names are
   free as of 2026-10-04; claim the organisation early so nobody else does.
3. On your computer: `npm login` (opens the browser to sign in).

**Publish** (first time and every update)

```sh
cd packages/client
npm version patch        # 1.0.0 → 1.0.1; skip on the very first publish
npm install --no-save typescript
npm run build            # writes dist/
npm publish --access public
cd ../react
npm install --no-save typescript @types/react
npm run build
npm publish --access public
```

Check: https://www.npmjs.com/package/@thereserve/client and
https://www.npmjs.com/package/@thereserve/react show the README.

**Afterwards**

- In `/partners`, replace the copy-paste React component with
  `npm install @thereserve/react` and
  `<ReserveWidget feature="quiz" publicKey="pk_live_…" />`, and add
  `npm install @thereserve/client` to the API section (the package READMEs
  have the exact examples).
- Use `npm version minor` for new features and `npm version major` for
  changes that break existing code. Never unpublish a version people use;
  publish a fixed one instead (`npm deprecate` marks a bad version).
- Optional: let a GitHub Action publish on each release (npm "trusted
  publishing"), so no npm token is kept anywhere.

## 3. Shopify app block (merchants add it in the theme editor)

Today, shops paste the code into a Custom Liquid section, which works. An
app adds "The Reserve" under **Add block → Apps** with settings instead of
code, and opens the Shopify App Store as a sales channel.

**One-time setup**

1. Create a Shopify Partner account: https://www.shopify.com/partners (free).
2. In the Partner Dashboard create a **development store** to test on.
3. Install the Shopify CLI: `npm install -g @shopify/cli`.

**Build the app**

```sh
shopify app init                # name it "The Reserve"; choose "Build an extension-only app" if offered
cd the-reserve
# copy this repo's integrations/shopify/extensions/the-reserve-widget
# into the new app's extensions/ folder
shopify app dev                 # installs it on the development store
```

In the development store: **Online Store → Themes → Customize → Add block →
Apps → The Reserve**, paste a public key whose site lists the store's
addresses (`https://<store>.myshopify.com`), check the widget appears.

`shopify app deploy` releases a version.

**Distribution, pick one**

- **Custom distribution** (no review): in the Partner Dashboard choose
  *Custom distribution*, enter one merchant's store, and send them the install
  link. Good for a handful of paying partners.
- **Shopify App Store** (public listing): needs a listing (description,
  screenshots, privacy policy link https://thereserve.watch/privacy, support
  email), and passing Shopify's app review, which can take a few weeks.
  Charging through Shopify (their Billing API) would need extra work in the
  app; invoicing partners directly, as now, avoids that.

## 4. WordPress.org plugin directory

Listing makes the plugin installable by searching inside WordPress
(**Plugins → Add New**) and gives automatic updates.

1. Finish section 1 first.
2. Create an account at https://login.wordpress.org/register.
3. Submit the zip at https://wordpress.org/plugins/developers/add/. The
   `readme.txt` in the plugin already follows their format, including the
   required "External services" section explaining that it loads
   thereserve.watch.
4. A volunteer reviews it (often days to a few weeks) and may ask for
   changes by email. Claude can make them; rebuild the zip after each change.
5. Once approved you get an SVN repository. Upload the plugin files to
   `trunk/`, tag the version (`tags/1.0.0/`), and add a banner and icon to
   `assets/`. For each update: raise `Version:` in `the-reserve.php` and
   `Stable tag:` in `readme.txt`, then commit to SVN.
6. Keep offering the zip download on `/partners` for partners who want it
   straight away.

Note: plugins in the directory may not lock features behind a payment made
elsewhere in a hidden way. Ours is fine: the readme says a partner key from
The Reserve is required.

## 5. Other website builders

All of these work today by pasting the two-line code (instructions on
`/partners`). Things to know:

- **Wix:** *Add → Embed code → Embed HTML*. Wix puts the code in its own
  frame, so the widget can't resize the box: tell partners to make it tall
  (about 900 px). Register the partner's Wix address (e.g.
  `https://user.wixsite.com` or their domain) **and**
  `https://<something>.filesusr.com` if the widget shows "refused to
  connect" (Wix serves embedded HTML from that domain; check the exact
  address in the browser's developer tools). A Wix App Market app would
  remove this, but is a separate project.
- **Squarespace:** *Code* block. Custom code needs a Squarespace plan that
  allows it (Core or above at the time of writing).
- **Webflow:** *Embed* element. Custom code needs a paid site plan.
- **Google Tag Manager:** Custom HTML tag with the script line, triggered on
  the pages that have a `<div data-reserve="…">`.
- **Framer, Ghost, Carrd, HubSpot and similar:** any "custom HTML / embed"
  block works the same way.
- **Single-page apps (React, Vue, Next.js):** the React snippet on
  `/partners` (or the npm package once published); other frameworks call
  `window.TheReserve.scan()` after adding the element.

## 6. If a partner's developer uses the API

1. Create a secret key on `/admin/sites` (shown once) and send it privately.
2. Point them to https://thereserve.watch/api/v1/openapi.json (any OpenAPI
   tool, e.g. https://editor.swagger.io, displays it) and the API section of
   `/partners`.
3. Remind them: secret key on their server only; send search answers only,
   never names or emails; keep the "Not yet reviewed" and "Manufacturer
   reference not confirmed" labels.
4. A leaked key: **Replace secret key** on `/admin/sites` and send the new
   one.

## 7. Before calling any channel finished: real-browser check

The automated tests check the code, not a real browser on a real partner
site. For the first partner on each channel:

1. Open their page in Chrome and in Safari (or an iPhone).
2. Check: the widget appears, grows with its content (no inner scrollbar),
   colours match, a full quiz or search works, links to other The Reserve
   pages open in a new tab, and nothing asks for an email.
3. Open the widget address directly (right-click the widget → open frame in
   new tab, or copy its `src`): you should land on The Reserve's own page.
4. On `/admin/sites`, the partner's uses went up.

## 8. Taking payment

Billing is outside the site: use the monthly use counts on `/admin/sites`
for invoices (e.g. from your accounting tool or Stripe Invoicing). If you
later want partners to sign up and pay by card themselves, that is a new
piece of work (payment provider, automatic key creation); ask Claude to
plan it.
