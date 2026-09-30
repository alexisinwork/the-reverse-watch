/**
 * Fallback price search: Muse Spark looks up one specific watch's retail
 * price itself, with two tools this server executes: web_search (the
 * Perplexity Search API) and read_page (a plain fetch of one page, cut to
 * the text around prices). Only the watch's brand, model and reference are
 * ever sent; nothing about any visitor exists here.
 */
import {
  safeHttpUrl,
  searchWeb,
  parseModelJson,
  type Deps,
} from "./ai-watch-finder.server";

const TOOLS = [
  {
    type: "function",
    function: {
      name: "web_search",
      description:
        "Search the live web. Returns ranked results with URL, title and a snippet.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "The search query." },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_page",
      description:
        "Load one web page and return its title and the text around any prices and the reference number.",
      parameters: {
        type: "object",
        properties: { url: { type: "string", description: "The page URL." } },
        required: ["url"],
        additionalProperties: false,
      },
    },
  },
] as const;

const SYSTEM = [
  "You find the current official new retail price of one specific wristwatch reference.",
  "Use web_search to find the manufacturer's product page and authorised retailers' product pages, then read_page to read the price actually shown on each page.",
  "Only report a price you saw on a page with read_page, on a page about this exact reference. Never report second-hand, grey-market, sale, marketplace or auction prices, and never estimate.",
  "Prefer US dollar prices from the manufacturer's US site and US authorised retailers.",
  'When done, answer only with JSON: {"prices":[{"amount":number,"currency":"ISO code","sourceUrl":"page URL"}]} listing up to 3 different pages, or {"prices":[]} if you found none.',
].join(" ");

const MAX_ROUNDS = 8;
const PAGE_CHARS = 3_500;

/** The page title plus short windows of text around prices and the reference. */
export function pageExcerpt(html: string, reference: string | null) {
  const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() ?? "";
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");
  const marks = [
    /(?:\$|US\$|USD|€|EUR|£|GBP|CHF|¥|JPY)\s?\d[\d,.'’\s]*\d/g,
    /\d[\d,.'’\s]*\d\s?(?:\$|USD|€|EUR|£|GBP|CHF)/g,
  ];
  const windows: string[] = [];
  for (const mark of marks) {
    for (const match of text.matchAll(mark)) {
      const start = Math.max(0, match.index - 120);
      windows.push(text.slice(start, match.index + match[0].length + 60));
      if (windows.join(" … ").length > PAGE_CHARS) break;
    }
  }
  const referenceAt = reference
    ? text.toLowerCase().indexOf(reference.toLowerCase())
    : -1;
  const referenceWindow =
    referenceAt >= 0
      ? text.slice(Math.max(0, referenceAt - 150), referenceAt + 150)
      : "";
  return [
    `Title: ${title}`,
    referenceWindow
      ? `Around the reference: ${referenceWindow}`
      : "The reference number does not appear on this page.",
    windows.length > 0
      ? `Around prices: ${windows.join(" … ")}`
      : "No prices appear on this page.",
  ]
    .join("\n")
    .slice(0, PAGE_CHARS);
}

async function readPage(
  url: string,
  reference: string | null,
  fetchImpl: typeof fetch,
) {
  const safe = safeHttpUrl(url);
  if (!safe) return "That is not a valid http(s) URL.";
  try {
    const response = await fetchImpl(safe, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (compatible; TheReserveBot/1.0; +https://thereserve.watch)",
        accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) {
      await response.body?.cancel();
      return `The page returned HTTP ${response.status}.`;
    }
    return pageExcerpt((await response.text()).slice(0, 1_500_000), reference);
  } catch {
    return "The page could not be loaded.";
  }
}

type Message = Record<string, unknown>;
type ToolCall = { id: string; function: { name: string; arguments: string } };

export type MusePrice = { amount: number; currency: string; sourceUrl: string };

/**
 * Lets Muse Spark search for the price; returns what it reports. The caller
 * still verifies every page itself before any price counts.
 */
export async function musePriceSearch(
  watch: { brand: string; model: string; referenceCode: string | null },
  deps: Deps,
  options: {
    avoidUrls: string[];
    currency: string | null;
    hintUrl: string | null;
  },
): Promise<MusePrice[]> {
  const config = deps.config.museSpark;
  if (!config || !deps.config.perplexity) return [];
  const name = `${watch.brand} ${watch.model}${watch.referenceCode ? ` reference ${watch.referenceCode}` : ""}`;
  const messages: Message[] = [
    { role: "system", content: SYSTEM },
    {
      role: "user",
      content: [
        `Watch: ${name}.`,
        options.hintUrl
          ? `The manufacturer's page is probably ${options.hintUrl}.`
          : "",
        options.currency ? `Report prices in ${options.currency} only.` : "",
        options.avoidUrls.length > 0
          ? `Use pages other than: ${options.avoidUrls.slice(0, 6).join(", ")}.`
          : "",
      ]
        .filter(Boolean)
        .join("\n"),
    },
  ];

  for (let round = 0; round < MAX_ROUNDS; round += 1) {
    const last = round === MAX_ROUNDS - 1;
    // The last round has no tools, so the model must answer with what it read.
    if (last) {
      messages.push({
        role: "user",
        content:
          "Stop searching. Answer now with the JSON, listing only prices you saw with read_page.",
      });
    }
    const response = await deps.fetchImpl(
      new URL("chat/completions", config.baseUrl),
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${config.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: config.fastModel,
          reasoning_effort: "minimal",
          prompt_cache_key: "reserve-price-search-v1",
          // Meta's API accepts only tool_choice "auto".
          ...(last ? {} : { tools: TOOLS, tool_choice: "auto" }),
          max_tokens: 4_000,
          messages,
        }),
        signal: AbortSignal.timeout(60_000),
      },
    );
    if (!response.ok) {
      throw new Error(
        `Muse Spark returned ${response.status}: ${(await response.text()).slice(0, 200)}`,
      );
    }
    const body = (await response.json()) as {
      choices?: { message?: { content?: unknown; tool_calls?: unknown } }[];
    };
    const message = body.choices?.[0]?.message;
    if (!message) throw new Error("Muse Spark returned no message.");
    const calls = Array.isArray(message.tool_calls)
      ? (message.tool_calls as ToolCall[])
      : [];
    if (calls.length > 0 && !last) {
      messages.push(message);
      const results = await Promise.all(
        calls.slice(0, 4).map(async (call) => {
          let args: Record<string, unknown> = {};
          try {
            args = JSON.parse(call.function.arguments) as Record<
              string,
              unknown
            >;
          } catch {
            args = {};
          }
          if (
            call.function.name === "web_search" &&
            typeof args.query === "string"
          ) {
            const hits = await searchWeb(
              [args.query.slice(0, 200)],
              deps,
            ).catch(() => []);
            return JSON.stringify(hits.slice(0, 8));
          }
          if (
            call.function.name === "read_page" &&
            typeof args.url === "string"
          ) {
            return readPage(args.url, watch.referenceCode, deps.fetchImpl);
          }
          return "Unknown tool or missing argument.";
        }),
      );
      calls.slice(0, 4).forEach((call, index) =>
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: results[index],
        }),
      );
      // Tool calls past the fourth are answered so the conversation stays valid.
      for (const call of calls.slice(4)) {
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: "Skipped: too many calls at once.",
        });
      }
      continue;
    }
    if (typeof message.content !== "string" || !message.content.trim())
      return [];
    let parsed: { prices?: unknown };
    try {
      parsed = parseModelJson(message.content) as { prices?: unknown };
    } catch {
      return [];
    }
    return (
      Array.isArray(parsed.prices) ? (parsed.prices as unknown[]) : []
    ).flatMap((raw) => {
      const item = (raw ?? {}) as Record<string, unknown>;
      const sourceUrl = safeHttpUrl(
        typeof item.sourceUrl === "string" ? item.sourceUrl : null,
      );
      const currency =
        typeof item.currency === "string" &&
        /^[A-Za-z]{3}$/.test(item.currency.trim())
          ? item.currency.trim().toUpperCase()
          : null;
      const amount =
        typeof item.amount === "number" && Number.isFinite(item.amount)
          ? item.amount
          : null;
      return sourceUrl && currency && amount !== null && amount >= 20
        ? [{ amount, currency, sourceUrl }]
        : [];
    });
  }
  return [];
}
