// Verifies each configured credential actually authenticates against its
// live service. Every call here is read-only or a 1-token completion; none
// of them write data, create subscribers, or send email. Secret values are
// never printed, only pass/fail/skip per service.
import fs from "node:fs";
import path from "node:path";

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const values = {};
  for (const sourceLine of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = sourceLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

const fileValues = parseEnvFile(path.resolve(process.cwd(), ".env"));
const env = { ...fileValues, ...process.env };

function configured(value) {
  return typeof value === "string" && value.trim().length > 0;
}

const results = [];

function record(name, outcome, detail = "") {
  results.push({ name, outcome, detail });
}

async function withTimeout(promiseFactory, ms = 10_000) {
  return promiseFactory(AbortSignal.timeout(ms));
}

// Supabase — the exact read-only RPC the app itself calls.
async function checkSupabase() {
  const name = "Supabase (recommendation_catalogue_v4 RPC)";
  if (!configured(env.SUPABASE_URL) || !configured(env.SUPABASE_PUBLISHABLE_KEY)) {
    return record(name, "skip", "not configured");
  }
  try {
    const endpoint = new URL(
      "/rest/v1/rpc/recommendation_catalogue_v4",
      env.SUPABASE_URL,
    );
    const response = await withTimeout((signal) =>
      fetch(endpoint, {
        method: "POST",
        headers: {
          apikey: env.SUPABASE_PUBLISHABLE_KEY,
          "content-type": "application/json",
        },
        body: "{}",
        signal,
      }),
    );
    if (!response.ok) {
      return record(name, "fail", `HTTP ${response.status}`);
    }
    const body = await response.json();
    const count = Array.isArray(body?.referenceVariants)
      ? body.referenceVariants.length
      : Array.isArray(body)
        ? body.length
        : null;
    record(name, "pass", count !== null ? `${count} rows` : "responded 200");
  } catch (error) {
    record(name, "fail", String(error?.message ?? error));
  }
}

// Perplexity — 1-token completion, cheapest possible authenticated call.
async function checkPerplexity() {
  const name = "Perplexity (sonar chat completion)";
  if (!configured(env.PERPLEXITY_API_KEY)) return record(name, "skip", "not configured");
  try {
    const response = await withTimeout((signal) =>
      fetch("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: {
          authorization: `Bearer ${env.PERPLEXITY_API_KEY}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "sonar",
          messages: [{ role: "user", content: "ping" }],
          max_tokens: 16,
        }),
        signal,
      }),
    );
    if (!response.ok) {
      const text = await response.text();
      return record(name, "fail", `HTTP ${response.status} ${text.slice(0, 120)}`);
    }
    record(name, "pass", "authenticated, minimal completion returned");
  } catch (error) {
    record(name, "fail", String(error?.message ?? error));
  }
}

// Meta Muse Spark — 1-token completion via the OpenAI-compatible endpoint.
async function checkMuseSpark() {
  const name = "Muse Spark (Meta Model API)";
  if (!configured(env.MUSE_SPARK_API_KEY)) return record(name, "skip", "not configured");
  const baseUrl = env.MUSE_SPARK_BASE_URL || "https://api.meta.ai/v1";
  const model = env.MUSE_SPARK_MODEL || "muse-spark-1.3-contributor";
  try {
    const response = await withTimeout((signal) =>
      fetch(new URL("chat/completions", baseUrl.replace(/\/?$/, "/")), {
        method: "POST",
        headers: {
          authorization: `Bearer ${env.MUSE_SPARK_API_KEY}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: "ping" }],
          max_tokens: 1,
        }),
        signal,
      }),
    );
    const text = await response.text();
    if (!response.ok) {
      return record(name, "fail", `HTTP ${response.status} ${text.slice(0, 200)}`);
    }
    record(name, "pass", "authenticated, 1-token completion returned");
  } catch (error) {
    record(name, "fail", String(error?.message ?? error));
  }
}

// OpenAI — listing models costs nothing and confirms the key/org/project.
async function checkOpenAi() {
  const name = "OpenAI (models list)";
  if (!configured(env.OPENAI_API_KEY)) return record(name, "skip", "not configured");
  try {
    const headers = { authorization: `Bearer ${env.OPENAI_API_KEY}` };
    if (configured(env.OPENAI_ORG_ID)) headers["OpenAI-Organization"] = env.OPENAI_ORG_ID;
    if (configured(env.OPENAI_PROJECT_ID)) headers["OpenAI-Project"] = env.OPENAI_PROJECT_ID;
    const response = await withTimeout((signal) =>
      fetch("https://api.openai.com/v1/models", { headers, signal }),
    );
    if (!response.ok) {
      const text = await response.text();
      return record(name, "fail", `HTTP ${response.status} ${text.slice(0, 120)}`);
    }
    record(name, "pass", "authenticated");
  } catch (error) {
    record(name, "fail", String(error?.message ?? error));
  }
}

// Beehiiv — read-only publication lookup, creates no subscriber.
async function checkBeehiiv() {
  const name = "Beehiiv (publication lookup)";
  if (!configured(env.BEEHIIV_API_KEY) || !configured(env.BEEHIIV_PUBLICATION_ID)) {
    return record(name, "skip", "not configured");
  }
  try {
    const response = await withTimeout((signal) =>
      fetch(`https://api.beehiiv.com/v2/publications/${env.BEEHIIV_PUBLICATION_ID}`, {
        headers: { authorization: `Bearer ${env.BEEHIIV_API_KEY}` },
        signal,
      }),
    );
    if (!response.ok) {
      const text = await response.text();
      return record(name, "fail", `HTTP ${response.status} ${text.slice(0, 120)}`);
    }
    const body = await response.json();
    record(name, "pass", body?.data?.name ? `publication "${body.data.name}"` : "authenticated");
  } catch (error) {
    record(name, "fail", String(error?.message ?? error));
  }
}

// GitHub — repo-scoped read, matches the fine-grained PAT's actual scope.
async function checkGitHub() {
  const name = "GitHub (repo lookup)";
  if (!configured(env.GITHUB_PAT_TOKEN)) return record(name, "skip", "not configured");
  try {
    const response = await withTimeout((signal) =>
      fetch("https://api.github.com/repos/alexisinwork/the-reverse-watch", {
        headers: {
          authorization: `Bearer ${env.GITHUB_PAT_TOKEN}`,
          "user-agent": "the-reserve-connectivity-check",
        },
        signal,
      }),
    );
    if (!response.ok) {
      return record(name, "fail", `HTTP ${response.status}`);
    }
    record(name, "pass", "authenticated");
  } catch (error) {
    record(name, "fail", String(error?.message ?? error));
  }
}

// Resend — read-only domain list, sends no email.
async function checkResend() {
  const name = "Resend (domains list)";
  if (!configured(env.RESEND_API_KEY)) return record(name, "skip", "not configured");
  try {
    const response = await withTimeout((signal) =>
      fetch("https://api.resend.com/domains", {
        headers: { authorization: `Bearer ${env.RESEND_API_KEY}` },
        signal,
      }),
    );
    if (!response.ok) {
      return record(name, "fail", `HTTP ${response.status}`);
    }
    record(name, "pass", "authenticated");
  } catch (error) {
    record(name, "fail", String(error?.message ?? error));
  }
}

// Upstash — read-only PING.
async function checkUpstash() {
  const name = "Upstash Redis (PING)";
  if (!configured(env.UPSTASH_REDIS_REST_URL) || !configured(env.UPSTASH_REDIS_REST_TOKEN)) {
    return record(name, "skip", "not configured");
  }
  try {
    const response = await withTimeout((signal) =>
      fetch(`${env.UPSTASH_REDIS_REST_URL}/ping`, {
        headers: { authorization: `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}` },
        signal,
      }),
    );
    if (!response.ok) return record(name, "fail", `HTTP ${response.status}`);
    record(name, "pass", "authenticated");
  } catch (error) {
    record(name, "fail", String(error?.message ?? error));
  }
}

async function main() {
  await Promise.all([
    checkSupabase(),
    checkPerplexity(),
    checkMuseSpark(),
    checkOpenAi(),
    checkBeehiiv(),
    checkGitHub(),
    checkResend(),
    checkUpstash(),
  ]);

  const width = Math.max(...results.map((result) => result.name.length));
  for (const result of results) {
    const marker = result.outcome === "pass" ? "PASS" : result.outcome === "fail" ? "FAIL" : "SKIP";
    console.log(`${marker.padEnd(4)} ${result.name.padEnd(width)}  ${result.detail}`);
  }

  const failed = results.filter((result) => result.outcome === "fail").length;
  console.log(`\n${results.length} checked, ${failed} failed.`);
  if (failed > 0) process.exitCode = 1;
}

await main();
