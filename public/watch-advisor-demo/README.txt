THE RESERVE — VANILLA JAVASCRIPT DEMO

Five files. No React, package installation or build required.

1. Create an active partner in The Reserve /admin/sites.
   Register https://oleksandr-kukhtin.dev as an exact origin.
   Add www or a localhost origin separately only if you use it.
2. Paste the PUBLIC pk_live_... key in config.js. Never use sk_live_....
3. Copy this entire folder to your host's static/public directory as
   watch-advisor-demo. Keep the relative file paths intact.
4. Publish and open https://oleksandr-kukhtin.dev/watch-advisor-demo/index.html.
   A directory URL /watch-advisor-demo/ also works if your host serves index.html.
   On an SPA host, ensure this path serves the static HTML rather than its app shell.

The placeholder intentionally makes no external widget requests until configured.
The tools mount on first selection and preserve their frames when switching.
This uses the real /embed.js and the shared Reserve catalogue, not store inventory.
No visitor answers or widget event payloads are logged by this demo.

For local testing serve these files with an HTTP static server and register its
exact origin, including port. Do not double-click index.html using file://.

CONTENT SECURITY POLICY
Your host must permit these local scripts/styles, script-src for
https://thereserve.watch and frame-src for https://thereserve.watch.
Merge those origins into your existing policy; do not replace the whole policy.
Use the same origin as config.js if testing a different Reserve deployment.

VERIFICATION AFTER PUBLICATION (not yet performed)
- Record install time; target 5–10 minutes, not a proven claim.
- Submit each of the five tools; test keyboard, narrow/mobile viewport and resizing.
- Switch tools and confirm previous answers remain.
- Check provenance labels and Powered by The Reserve; no newsletter/email gate.
- Confirm per-feature use counts in /admin/sites against submitted operations.
- On a separate unregistered origin, confirm framing is refused.
- With a dedicated test partner, check disabled key and reached monthly limit.
- Restore that test partner after testing; never delete it.
- Block embed.js to check the script error; block the frame to check ready timeout.

Ready means the frame emitted reserve:ready, not that a recommendation succeeded.
The parent page cannot read cross-origin HTTP errors or prove why framing failed.
An HTML iframe load event alone is not used as evidence of a working widget.

MINIMUM INSTALL ON ANY HTML SITE
<div data-reserve="quiz"></div>
<script src="https://thereserve.watch/embed.js" data-key="pk_live_YOUR_PUBLIC_KEY" async></script>

The full demo adds layout, tool selection and loading/error messages.
Changing this folder requires regenerating the downloadable ZIP (see the business plan).
