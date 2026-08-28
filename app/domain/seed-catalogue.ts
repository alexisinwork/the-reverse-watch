import rawSeedCatalogue from "../../data/catalogue/seed-catalogue.json";

import { seedCatalogueSchema } from "./catalogue";

export const seedCatalogue = seedCatalogueSchema.parse(rawSeedCatalogue);
