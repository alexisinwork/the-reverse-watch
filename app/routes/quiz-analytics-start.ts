import { data } from "react-router";

import type { Route } from "./+types/quiz-analytics-start";
import { persistFunnelEvent } from "../domain/funnel-store.server";

export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return data({ ok: false }, { status: 405 });
  }

  try {
    await persistFunnelEvent({ name: "start" });
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "quiz_funnel_persistence_error",
        message: error instanceof Error ? error.message : "unknown error",
      }),
    );
    return data({ ok: false }, { status: 503 });
  }
}
