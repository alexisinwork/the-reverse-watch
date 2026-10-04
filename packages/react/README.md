# @thereserve/react

The Reserve's watch widgets as a React component. Guide:
https://thereserve.watch/partners

```tsx
import { ReserveWidget } from "@thereserve/react";

<ReserveWidget
  feature="quiz" // quiz | archetype | find | alternatives | stories
  publicKey="pk_live_…"
  scheme="light"
  accent="#0a7cff"
  onMessage={(message) => {
    if (message.type === "reserve:results") console.log(message.count);
  }}
/>;
```

Your website's address must be registered for the key. The widget runs in a
frame from thereserve.watch, sizes itself to its content, asks for no email
and sets no cookies.

## Publishing (owner)

Not on npm yet. From this folder, logged in to the npm account that should
own the `@thereserve` scope: `npm run build && npm publish --access public`.
Then add the `npm install` instructions to `/partners`.
