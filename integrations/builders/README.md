# Five-tool advisor on website builders

Replace the public-key placeholder, paste the **complete snippet**, and publish:

```html
<div
  data-reserve="all"
  data-key="pk_live_YOUR_PUBLIC_KEY"
  data-scheme="light"
></div>
<script src="https://thereserve.watch/embed.js" async></script>
```

`all` gives five tabs with independent, preserved answers/results. Use `quiz`,
`archetype`, `find`, `alternatives` or `stories` for a single tool. All features
are available to every partner. Source/review labels stay visible. Quiz and
archetype results contain only the Powered by link, with no cross-tool funnel.

Before embedding, the owner registers every exact public/staging origin in
Reserve admin. Use public keys only. A builder's editor preview is not proof of
published operation. Allow the Reserve origin for scripts, styles (`embed.css`)
and frames when your site sets a Content Security Policy.

| Platform    | Partner's steps                                                                                                                                                                                                                                        |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| WordPress   | Upload the plugin ZIP, activate, Settings → The Reserve → save public key; add `[the_reserve feature="all"]` in a Shortcode block. Elementor: Shortcode widget. The Reserve editor block also offers All five tools.                                   |
| Shopify     | Themes → Customize → Custom Liquid → paste snippet → Save. Or install the supplied theme section in a duplicate theme and select it in Add section; set public key and look. No Shopify app required.                                                  |
| Squarespace | Add block → Code → HTML; turn Display Source off, paste snippet, save and publish. JavaScript/iframe support requires a suitable plan.                                                                                                                 |
| Webflow     | Add → Code Embed; paste snippet, save, publish. An eligible site/workspace plan is required.                                                                                                                                                           |
| Wix         | Add → Embed Code → Embed HTML; paste snippet, set a generous height and publish. Its wrapping iframe cannot automatically fit long results; keep scrolling accessible. Register its exact intermediate frame origin as well as the public site origin. |
| Framer      | Insert → Embed → HTML; paste snippet and publish. Set a suitable height if Framer creates a wrapping frame.                                                                                                                                            |
| Ghost       | Add an HTML card on a page/post, paste snippet, publish.                                                                                                                                                                                               |
| Carrd       | Embed → Code on a custom-code-capable plan; paste snippet and publish.                                                                                                                                                                                 |

If a builder uses nested frames, **every** ancestor must match a registered
exact origin. Inspect the published frame tree; never add `*`, a guessed shared
host, or an unrelated builder domain. On pages replaced by client-side navigation,
call `window.TheReserve.scan()` after mounting the placeholder. Shopify section
editor reloads are handled by the loader.

Partner handoff/checklist: [owner onboarding](../../docs/partner-onboarding.md).
Public, current installation guide: `/partners#builders`. Shopify's section is
in `integrations/shopify/sections/` and downloadable at
`/downloads/the-reserve-shopify-section.liquid`. WordPress's ZIP is at
`/downloads/the-reserve-wordpress.zip`.

Reference checks, retrieved 2026-10-25:

- [Shopify section schema](https://shopify.dev/docs/storefronts/themes/architecture/sections/section-schema)
- [Squarespace Code blocks](https://support.squarespace.com/hc/en-us/articles/206543167-Add-custom-code-to-a-page-with-code-blocks)
- [Webflow Code Embed](https://help.webflow.com/hc/en-us/articles/33961332238611-Custom-code-embed)
- [Framer Embed](https://www.framer.com/help/articles/how-to-add-an-iframe-or-embed-script/)

The shared HTML loader is tested; that does not establish a live installation
or marketplace listing on every hosted builder. Obtain each partner's published
URL and verify it separately.
