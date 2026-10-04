# @thereserve/client

Typed client for The Reserve's partner API. Full description:
https://thereserve.watch/api/v1/openapi.json · Guide:
https://thereserve.watch/partners

```ts
import { ReserveClient } from "@thereserve/client";

// On your server (never ship the secret key to a browser):
const reserve = new ReserveClient({
  secretKey: process.env.RESERVE_SECRET_KEY,
});
// In a web page on a registered website:
// const reserve = new ReserveClient({ publicKey: "pk_live_…" });

const { result } = await reserve.find(
  { type: "actor", q: "Daniel Craig" },
  { onProgress: (step) => console.log(step.text) }, // live steps (optional)
);
if (result.status === "found") console.log(result.watches);
```

Methods: `quizOptions()`, `quiz(answers)`, `find({ q, type })`,
`alternatives({ name, mode, amount | range, currency, quartz })`,
`archetype(answers?)`, `stories()`, `story(slug)`. Errors throw
`ReserveApiError` with `status` and `code` (`monthly_limit`, `rate_limited`,
`origin_not_allowed`, …).

Send search answers only, never names, emails or other personal data.

## Publishing (owner)

Not on npm yet. From this folder, logged in to the npm account that should
own the `@thereserve` scope: `npm run build && npm publish --access public`.
Then add the `npm install` instructions to `/partners`.
