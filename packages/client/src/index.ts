/**
 * @thereserve/client — a small typed client for The Reserve's partner API
 * (https://thereserve.watch/api/v1/openapi.json). Works in browsers (public
 * key, from your registered websites) and on servers (secret key).
 */

export type WatchDetails = {
  price?: { amount: number; currency: string } | null;
  waterResistanceM?: number | null;
  caseDiameterMm?: number | null;
  movement?: string | null;
  materials?: {
    case: string | null;
    caseback: string | null;
    strap: string | null;
  };
  sourceKind?: "manufacturer" | "retailer";
  referenceVerified?: boolean;
  person?: string | null;
  work?: string | null;
  year?: number | null;
  context?: string | null;
  evidenceUrl?: string | null;
  /** "pending": show it as "Not yet reviewed". */
  reviewStatus?: "pending" | "approved" | "rejected";
  priceConfirmed?: boolean;
  misses?: string[];
  priceCondition?: "new" | "pre-owned";
};

export type Watch = {
  brand: string;
  model: string;
  referenceCode: string | null;
  sourceUrl: string;
  imageUrl: string | null;
  priceNote: string | null;
  rationale: string;
  details: WatchDetails;
};

export type SearchResult =
  | {
      status: "found";
      summary: string;
      watches: Watch[];
      fromCache?: boolean;
      origin?: "catalogue" | "live" | "mixed";
      /** Show with "Manufacturer reference not confirmed". */
      alsoWorth?: Watch[];
    }
  | { status: "no_match"; summary: string }
  | { status: "unavailable" };

export type ProgressStep = { text: string; watch?: Watch };

export type QuizAnswers = {
  version: 4;
  budgetCurrency: "USD" | "EUR" | "GBP" | "CHF";
  /** An id from quizOptions().priceRanges, e.g. "2000_3000". */
  priceRange: string;
  wristCm: number;
  caseDiameterMinMm?: number;
  caseDiameterMaxMm?: number;
  wearingScenarios: string[];
  minimumWaterResistanceM: number;
  movementTypes: (
    "automatic" | "manual" | "quartz" | "solar" | "spring_drive" | "hybrid"
  )[];
  requiredComplications: string[];
  allergyConstraint: "none" | "nickel_contact";
  maxCaseThicknessMm?: number;
  caseShape?: string;
  movementConstruction?: "mass_produced" | "manufacture";
  displayCaseback?: boolean;
  crystal?: "sapphire" | "mineral" | "acrylic" | "other";
  microAdjustmentRequired?: boolean;
};

export type FilmSubject =
  "movie" | "series" | "actor" | "character" | "celebrity";

export type AlternativesQuery = {
  name?: string;
  ref?: string;
  currency?: "USD" | "EUR" | "GBP" | "CHF";
  quartz: "yes" | "no";
} & ({ mode: "exact"; amount: number } | { mode: "range"; range: string });

export type AlternativesResult =
  | { target: { card: Watch; preowned: unknown } | null; result: SearchResult }
  | {
      result: {
        status: "ambiguous";
        options: { label: string; name: string; reference: string }[];
      };
    };

export class ReserveApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ReserveApiError";
  }
}

export type ReserveClientOptions = {
  /** pk_live_…: for web pages on your registered websites. */
  publicKey?: string;
  /** sk_live_…: for your server only. Never ship it to a browser. */
  secretKey?: string;
  baseUrl?: string;
  fetch?: typeof fetch;
};

type CallOptions = {
  /** Called for each live search step; the request then streams. */
  onProgress?: (step: ProgressStep) => void;
  signal?: AbortSignal;
};

export class ReserveClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: ReserveClientOptions) {
    if (!options.publicKey && !options.secretKey) {
      throw new Error("Pass publicKey (web pages) or secretKey (servers).");
    }
    this.baseUrl = (options.baseUrl ?? "https://thereserve.watch").replace(
      /\/$/,
      "",
    );
    this.fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis);
  }

  /** The diagnostic's choices: price ranges, scenarios, complications… */
  quizOptions(signal?: AbortSignal) {
    return this.request<Record<string, unknown>>("GET", "/api/v1/quiz", {
      signal,
    });
  }

  quiz(answers: QuizAnswers, call: CallOptions = {}) {
    return this.request<{ result: SearchResult }>("POST", "/api/v1/quiz", {
      ...call,
      body: answers,
    });
  }

  find(query: { q: string; type: FilmSubject }, call: CallOptions = {}) {
    return this.request<{ result: SearchResult }>("GET", "/api/v1/find", {
      ...call,
      query,
    });
  }

  alternatives(query: AlternativesQuery, call: CallOptions = {}) {
    return this.request<AlternativesResult>("GET", "/api/v1/alternatives", {
      ...call,
      query: Object.fromEntries(
        Object.entries(query).map(([key, value]) => [key, String(value)]),
      ),
    });
  }

  /** Without answers: the questions. With all four: the archetype. */
  archetype(answers?: Record<string, string>, signal?: AbortSignal) {
    return this.request<Record<string, unknown>>("GET", "/api/v1/archetype", {
      query: answers,
      signal,
    });
  }

  stories(signal?: AbortSignal) {
    return this.request<{ stories: unknown[] }>("GET", "/api/v1/stories", {
      signal,
    });
  }

  story(slug: string, signal?: AbortSignal) {
    return this.request<{ story: unknown }>(
      "GET",
      `/api/v1/stories/${encodeURIComponent(slug)}`,
      { signal },
    );
  }

  private async request<T>(
    method: "GET" | "POST",
    path: string,
    {
      query,
      body,
      onProgress,
      signal,
    }: CallOptions & { query?: Record<string, string>; body?: unknown } = {},
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    for (const [key, value] of Object.entries(query ?? {})) {
      url.searchParams.set(key, value);
    }
    const headers: Record<string, string> = {};
    if (this.options.secretKey) {
      headers.Authorization = `Bearer ${this.options.secretKey}`;
    } else {
      // In the query string: no custom header, so no browser preflight.
      url.searchParams.set("key", this.options.publicKey!);
    }
    if (onProgress) headers.Accept = "text/event-stream";
    // text/plain keeps a browser POST "simple" (no preflight); the API
    // reads the body as JSON either way.
    if (body !== undefined) headers["Content-Type"] = "text/plain";

    const response = await this.fetchImpl(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
    if (!response.ok) {
      const error = (await response.json().catch(() => null)) as {
        error?: { code?: string; message?: string };
      } | null;
      throw new ReserveApiError(
        response.status,
        error?.error?.code ?? "http_error",
        error?.error?.message ?? `The Reserve answered ${response.status}.`,
      );
    }
    if (
      onProgress &&
      response.body &&
      (response.headers.get("Content-Type") ?? "").includes("text/event-stream")
    ) {
      return readStream<T>(response.body, onProgress);
    }
    return (await response.json()) as T;
  }
}

/** Reads server-sent events until the `result` event. */
async function readStream<T>(
  body: ReadableStream<Uint8Array>,
  onProgress: (step: ProgressStep) => void,
): Promise<T> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: T | undefined;
  for (;;) {
    const { value, done } = await reader.read();
    if (value) buffer += decoder.decode(value, { stream: true });
    let boundary = buffer.indexOf("\n\n");
    while (boundary !== -1) {
      const block = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const event = /^event: (.*)$/m.exec(block)?.[1];
      const data = /^data: (.*)$/m.exec(block)?.[1];
      if (data !== undefined) {
        const parsed: unknown = JSON.parse(data);
        if (event === "progress") onProgress(parsed as ProgressStep);
        if (event === "result") result = parsed as T;
      }
      boundary = buffer.indexOf("\n\n");
    }
    if (done) break;
  }
  if (result === undefined) {
    throw new ReserveApiError(
      502,
      "stream_ended",
      "The search stream ended early.",
    );
  }
  return result;
}
