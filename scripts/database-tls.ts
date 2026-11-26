// Every database script encrypts its connection and verifies the server.
// Supabase signs its database certificates with its own authority, which
// Node does not trust by default, so the scripts trust exactly that one
// authority: certs/prod-ca-2021.crt ("Supabase Root 2021 CA", valid until
// 2031-04-26), downloaded by the owner from the dashboard on 2026-11-26.
// Node also checks that the certificate names the host connected to.
import { readFileSync } from "node:fs";

const SUPABASE_CA = new URL("../certs/prod-ca-2021.crt", import.meta.url);

export function databaseTls() {
  return { ca: readFileSync(SUPABASE_CA, "utf8"), rejectUnauthorized: true };
}
