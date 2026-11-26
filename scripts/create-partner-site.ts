// Creates a partner site from the command line (the same as "Add a partner
// site" on /admin/sites) and prints its public key. No secret key is made;
// issue one on /admin/sites if the partner's server needs the API. Usage:
//   node --env-file=.env --import tsx scripts/create-partner-site.ts \
//     "Shop name" https://shop.example.com [https://www.shop.example.com] \
//     [--quota 1000] [--notes "Why this site exists"]
import { parseOriginList } from "../app/domain/partner-sites";
import { savePartnerSite } from "../app/domain/partner-sites.server";
import { catalogueClient } from "../app/domain/watch-catalogue.server";

const args = process.argv.slice(2);
const option = (flag: string) => {
  const index = args.indexOf(flag);
  if (index < 0) return undefined;
  const [, value] = args.splice(index, 2);
  return value;
};
const quotaText = option("--quota");
const notes = option("--notes") ?? null;
const monthlyQuota = quotaText === undefined ? null : Number(quotaText);
if (
  monthlyQuota !== null &&
  (!Number.isInteger(monthlyQuota) || monthlyQuota < 1)
) {
  console.error(
    "--quota takes a whole number of uses per month, such as 1000.",
  );
  process.exit(2);
}
const [name, ...originArgs] = args;
if (!name) {
  console.error(
    'Usage: scripts/create-partner-site.ts "Shop name" https://shop.example.com [--quota 1000] [--notes "..."]',
  );
  process.exit(2);
}
const { origins, invalid } = parseOriginList(originArgs.join(" "));
if (invalid.length > 0) {
  console.error(`Not website addresses: ${invalid.join(", ")}`);
  process.exit(2);
}
const client = catalogueClient();
if (!client) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are needed.");
  process.exit(2);
}
const site = await savePartnerSite(client, {
  name,
  allowedOrigins: origins,
  active: true,
  monthlyQuota,
  theme: {},
  notes,
});
if (!site) {
  console.error("The site was not saved.");
  process.exit(1);
}
console.log(
  `${site.name}: ${site.publicKey} (${site.allowedOrigins.join(", ")}; ${
    site.monthlyQuota === null
      ? "no monthly limit"
      : `${site.monthlyQuota} uses a month`
  })`,
);
