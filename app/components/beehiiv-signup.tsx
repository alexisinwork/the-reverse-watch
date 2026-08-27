import { useEffect, useRef } from "react";

export const BEEHIIV_FORM_ID = "e0fc5991-3244-47f3-a4fd-1214039d9da7";

export function BeehiivSignup() {
  const embedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const embed = embedRef.current;
    if (!embed) return;

    const script = document.createElement("script");
    script.async = true;
    script.src = "https://subscribe-forms.beehiiv.com/v3/loader.js";
    script.dataset.beehiivForm = BEEHIIV_FORM_ID;
    embed.append(script);

    return () => {
      script.remove();
      embed
        .querySelector('iframe[src*="subscribe-forms.beehiiv.com"]')
        ?.remove();
    };
  }, []);

  return (
    <section className="signup" aria-labelledby="signup-heading">
      <h2 className="sr-only" id="signup-heading">
        Subscribe to The Reserve
      </h2>
      <div
        className="signup-embed"
        data-testid="beehiiv-signup"
        ref={embedRef}
      />
      <noscript>
        <p className="noscript-note">
          Enable JavaScript to open the secure Beehiiv subscription form.
        </p>
      </noscript>
    </section>
  );
}
