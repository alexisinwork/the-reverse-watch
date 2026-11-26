import { createHash, createHmac } from "node:crypto";
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  argumentSql,
  callSql,
  evalReaderUrl,
  scramVerifier,
  UnknownArgument,
} from "./eval-database";
import { READ_ONLY_RPC } from "./eval-sets";

describe("the evaluation sign-in", () => {
  it("is granted exactly the functions the evaluation's guard allows", () => {
    const migration = readFileSync(
      "db/migrations/0123_eval_reader_role.sql",
      "utf8",
    );
    const granted = [
      ...migration.matchAll(
        /^grant execute on function public\.([a-z0-9_]+)\(/gm,
      ),
    ].map((match) => match[1]);
    expect(granted).toHaveLength(READ_ONLY_RPC.size);
    expect(new Set(granted)).toEqual(READ_ONLY_RPC);
    expect(migration).not.toMatch(/grant (all|insert|update|delete|select)/i);
  });

  // RFC 7677, section 3: user "user", password "pencil". The server's
  // signature (v=) and the client's proof (p=) come from the RFC, so they
  // check the verifier independently of this code.
  it("stores the password as a SCRAM-SHA-256 verifier", () => {
    const salt = Buffer.from("W22ZaJ0SNY7soEsUEjb6gQ==", "base64");
    const verifier = scramVerifier("pencil", salt, 4096);
    const match = verifier.match(
      /^SCRAM-SHA-256\$4096:W22ZaJ0SNY7soEsUEjb6gQ==\$([^:]+):(.+)$/,
    );
    expect(match).not.toBeNull();
    const storedKey = Buffer.from(match![1]!, "base64");
    const serverKey = Buffer.from(match![2]!, "base64");
    const nonce = "rOprNGfwEbeRWgbNEkqO%hvYDpWUa2RaTCAfuxFIlj)hNlF$k0";
    const authMessage = [
      "n=user,r=rOprNGfwEbeRWgbNEkqO",
      `r=${nonce},s=W22ZaJ0SNY7soEsUEjb6gQ==,i=4096`,
      `c=biws,r=${nonce}`,
    ].join(",");
    const serverSignature = createHmac("sha256", serverKey)
      .update(authMessage)
      .digest("base64");
    expect(serverSignature).toBe(
      "6rriTRBi23WpRR/wtup+mMhUZUn/dB5nLTJRsjl95G4=",
    );
    const proof = Buffer.from(
      "dHzbZapWIk4jUhN+Ute9ytag9zjfMHgsqmmiz7AndVQ=",
      "base64",
    );
    const clientSignature = createHmac("sha256", storedKey)
      .update(authMessage)
      .digest();
    const clientKey = Buffer.from(
      proof.map((byte, index) => byte ^ clientSignature[index]!),
    );
    expect(createHash("sha256").update(clientKey).digest()).toEqual(storedKey);
  });

  it("swaps the user and password of the owner's address", () => {
    const pooled = new URL(
      evalReaderUrl(
        "postgresql://postgres.abcdefghij:old@aws-0-eu-central-1.pooler.supabase.com:5432/postgres",
        "new-Password_1",
      ),
    );
    expect(pooled.username).toBe("reserve_eval_reader.abcdefghij");
    expect(pooled.password).toBe("new-Password_1");
    expect(pooled.host).toBe("aws-0-eu-central-1.pooler.supabase.com:5432");
    expect(pooled.pathname).toBe("/postgres");
    const direct = new URL(
      evalReaderUrl(
        "postgresql://postgres:old@db.example.co:5432/postgres",
        "x",
      ),
    );
    expect(direct.username).toBe("reserve_eval_reader");
  });
});

describe("calling a function like the Supabase API", () => {
  const signature = {
    names: [
      "p_price_bounds",
      "p_styles",
      "p_min_diameter",
      "p_mechanical_only",
    ],
    types: ["jsonb", "text[]", "numeric", "boolean"],
  };

  it("passes each argument by name, converted from JSON", () => {
    expect(
      callSql("watch_catalogue_alternatives_window_v1", signature, [
        "p_styles",
        "p_min_diameter",
      ]),
    ).toBe(
      "select public.watch_catalogue_alternatives_window_v1(" +
        "p_styles => (case jsonb_typeof($1::text::jsonb) when 'array' then array(select jsonb_array_elements_text($1::text::jsonb))::text[] end), " +
        "p_min_diameter => ($2::text::jsonb #>> '{}')::numeric) as result",
    );
    expect(argumentSql("jsonb", 3)).toBe("$3::text::jsonb");
  });

  it("refuses an unknown argument, name or type", () => {
    expect(() => callSql("f", signature, ["p_other"])).toThrow(UnknownArgument);
    expect(() => callSql("f; drop", signature, [])).toThrow();
    expect(() => argumentSql("text); select 1; --", 1)).toThrow();
  });
});
