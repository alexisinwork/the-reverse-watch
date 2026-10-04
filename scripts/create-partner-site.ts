// Creates a partner site from the command line (the same as "Add a partner
// site" on /admin/sites) and prints its public key. Usage:
//   node --env-file=.env --import tsx scripts/create-partner-site.ts \
//     "Shop name" https://shop.example.com [https://www.shop.example.com]
import { parseOriginList } from "../app/domain/partner-sites";
import { savePartnerSite } from "../app/domain/partner-sites.server";
import { catalogueClient } from "../app/domain/watch-catalogue.server";

const [name, ...originArgs] = process.argv.slice(2);
if (!name) {
  console.error(
    'Usage: scripts/create-partner-site.ts "Shop name" https://shop.example.com',
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
  monthlyQuota: null,
  theme: {},
  notes: null,
});
if (!site) {
  console.error("The site was not saved.");
  process.exit(1);
}
console.log(
  `${site.name}: ${site.publicKey} (${site.allowedOrigins.join(", ")})`,
);
