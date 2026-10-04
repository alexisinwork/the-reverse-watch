# The Reserve on Shopify

## Today: Custom Liquid (no app needed)

1. Online Store → Themes → Customize, open the page.
2. Add section → **Custom Liquid** (or a "Custom liquid" block).
3. Paste:

```html
<div data-reserve="quiz"></div>
<script
  src="https://thereserve.watch/embed.js"
  data-key="pk_live_YOUR_KEY"
  data-scheme="light"
  async
></script>
```

The shop's address (e.g. `https://your-shop.com` and
`https://your-shop.myshopify.com`) must be registered for the key on
`/admin/sites`.

## Later: theme app block

`extensions/the-reserve-widget/` is a Shopify theme app extension: merchants
get "The Reserve" under Add block → Apps, with the key, feature, look and
colour as block settings. Publishing it needs a Shopify Partner account and
an app (Shopify CLI: `shopify app init`, copy this extension folder into
the app's `extensions/`, then `shopify app deploy`). Nothing here needs
changing for that; the block uses the same `embed.js`.
