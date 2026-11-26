// The free evaluation's read-only database path (owner, 2026-11-26: "да").
// With EVAL_DATABASE_URL set, scripts/run-evals.ts runs the read-only
// catalogue and cache functions (READ_ONLY_RPC) over PostgreSQL as the role
// reserve_eval_reader (migration 0123) instead of through the Supabase API
// with the service key, so the CI job (.github/workflows/eval.yml) holds a
// sign-in that can only read.
//
// The role may run only those functions and its sessions are read-only;
// every call here also runs in a read-only transaction. Each answer is
// shaped like the Supabase API's answer, so the search code is unchanged.
import { createHash, createHmac, pbkdf2Sync, randomBytes } from "node:crypto";

import postgres from "postgres";

import { databaseTls } from "./database-tls";

export const EVAL_ROLE = "reserve_eval_reader";

// PostgreSQL's stored form of a SCRAM-SHA-256 password (RFC 5802 and RFC
// 7677). scripts/set-eval-reader-password.ts sends only this, so the
// database and its logs never hold the password itself.
export function scramVerifier(
  password: string,
  salt: Buffer = randomBytes(16),
  iterations = 4096,
) {
  const salted = pbkdf2Sync(password, salt, iterations, 32, "sha256");
  const clientKey = createHmac("sha256", salted).update("Client Key").digest();
  const storedKey = createHash("sha256").update(clientKey).digest();
  const serverKey = createHmac("sha256", salted).update("Server Key").digest();
  return `SCRAM-SHA-256$${iterations}:${salt.toString("base64")}$${storedKey.toString("base64")}:${serverKey.toString("base64")}`;
}

// The evaluation sign-in's address: the owner's database address with the
// user and password swapped. Through Supabase's pooler the user name also
// carries the project reference ("role.project").
export function evalReaderUrl(adminUrl: string, password: string) {
  const url = new URL(adminUrl);
  const dot = url.username.indexOf(".");
  url.username =
    dot > 0 ? `${EVAL_ROLE}.${url.username.slice(dot + 1)}` : EVAL_ROLE;
  url.password = password;
  return url.toString();
}

export type Signature = { names: string[]; types: string[] };

const NAME = /^[a-z_][a-z0-9_]*$/;
const TYPE = /^[a-z][a-z ]*(\[\])?$/;

// One argument. Every value is sent as JSON text and converted in SQL, so
// it reaches the function as the Supabase API would pass it: JSON as JSON,
// a JSON list as an array, anything else as its text.
export function argumentSql(type: string, position: number) {
  if (!TYPE.test(type)) throw new Error(`Unexpected argument type ${type}.`);
  const value = `$${position}::text::jsonb`;
  if (type === "jsonb") return value;
  if (type === "json") return `${value}::json`;
  if (type.endsWith("[]")) {
    return `(case jsonb_typeof(${value}) when 'array' then array(select jsonb_array_elements_text(${value}))::${type} end)`;
  }
  return `(${value} #>> '{}')::${type}`;
}

export class UnknownArgument extends Error {}

// The call, by argument name like the Supabase API, so arguments left out
// take the function's defaults.
export function callSql(name: string, signature: Signature, keys: string[]) {
  if (!NAME.test(name)) throw new Error(`Unexpected function name ${name}.`);
  const parts = keys.map((key, index) => {
    const at = signature.names.indexOf(key);
    if (at < 0 || !NAME.test(key)) {
      throw new UnknownArgument(`${name} has no argument ${key}.`);
    }
    return `${key} => ${argumentSql(signature.types[at]!, index + 1)}`;
  });
  return `select public.${name}(${parts.join(", ")}) as result`;
}

function reply(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function argumentsOf(body: unknown): Record<string, unknown> {
  if (typeof body !== "string" || !body.trim()) return {};
  const parsed = JSON.parse(body) as unknown;
  return parsed && typeof parsed === "object" && !Array.isArray(parsed)
    ? (parsed as Record<string, unknown>)
    : {};
}

export async function openEvalDatabase(
  url: string,
  allowed: ReadonlySet<string>,
) {
  const sql = postgres(url, {
    max: 2,
    ssl: databaseTls(),
    connect_timeout: 15,
    idle_timeout: 20,
    prepare: false,
    onnotice: () => undefined,
  });
  const rows = await sql<{ name: string; names: string[]; types: string[] }[]>`
    select p.proname as name,
           coalesce(p.proargnames, '{}') as names,
           array(select pg_catalog.format_type(arg.type, null)
                 from unnest(p.proargtypes::oid[]) with ordinality as arg(type, position)
                 order by arg.position) as types
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (select jsonb_array_elements_text(${JSON.stringify([...allowed])}::text::jsonb))`;
  const signatures = new Map<string, Signature>();
  for (const row of rows) {
    if (signatures.has(row.name)) {
      await sql.end();
      throw new Error(`${row.name} has more than one version; name one.`);
    }
    signatures.set(row.name, { names: row.names, types: row.types });
  }
  const missing = [...allowed].filter((name) => !signatures.has(name));
  if (missing.length > 0) {
    await sql.end();
    throw new Error(`Missing evaluation functions: ${missing.join(", ")}.`);
  }

  return {
    async call(name: string, body: unknown): Promise<Response> {
      const signature = signatures.get(name);
      if (!signature) {
        return reply(404, {
          message: `${name} is not an evaluation function.`,
        });
      }
      const args = argumentsOf(body);
      const keys = Object.keys(args).filter((key) => args[key] !== undefined);
      let text: string;
      try {
        text = callSql(name, signature, keys);
      } catch (error) {
        return reply(404, { message: (error as Error).message });
      }
      try {
        const [row] = await sql.begin("read only", (transaction) =>
          transaction.unsafe(
            text,
            keys.map((key) => JSON.stringify(args[key])),
          ),
        );
        return reply(
          200,
          (row as { result?: unknown } | undefined)?.result ?? null,
        );
      } catch (error) {
        return reply(400, { message: (error as Error).message });
      }
    },
    end: () => sql.end({ timeout: 5 }),
  };
}
