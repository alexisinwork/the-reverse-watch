import { z } from "zod";

export const VOCABULARY_KINDS = [
  "wearing_scenario",
  "complication",
  "positioning_group",
] as const;

export type VocabularyKind = (typeof VOCABULARY_KINDS)[number];

const slugSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:_[a-z0-9]+)*$/, "Use a lowercase snake_case slug.");

export const vocabularyRowSchema = z
  .object({
    kind: z.enum(VOCABULARY_KINDS),
    slug: slugSchema,
    labelEn: z.string().trim().min(1).max(80),
    sourceAliases: z.array(z.string().trim().min(1)).max(24),
    sortOrder: z.number().int().nonnegative(),
    active: z.boolean(),
  })
  .strict();

export type VocabularyRow = z.infer<typeof vocabularyRowSchema>;

export function normalizeSourceToken(value: string) {
  return value
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("ru-RU");
}

function scenario(
  slug: string,
  labelEn: string,
  sourceAliases: string[],
  sortOrder: number,
): VocabularyRow {
  return {
    kind: "wearing_scenario",
    slug,
    labelEn,
    sourceAliases,
    sortOrder,
    active: true,
  };
}

function complication(
  slug: string,
  labelEn: string,
  sourceAliases: string[],
  sortOrder: number,
): VocabularyRow {
  return {
    kind: "complication",
    slug,
    labelEn,
    sourceAliases,
    sortOrder,
    active: true,
  };
}

function positioning(
  slug: string,
  labelEn: string,
  sortOrder: number,
): VocabularyRow {
  return {
    kind: "positioning_group",
    slug,
    labelEn,
    sourceAliases: [],
    sortOrder,
    active: true,
  };
}

export const BUNDLED_VOCABULARY: readonly VocabularyRow[] = [
  scenario("everyday", "Everyday", ["повседневно", "везде", "casual"], 10),
  scenario("office", "Office", ["офис"], 20),
  scenario("business", "Business", ["бизнес", "международный бизнес"], 30),
  scenario("boardroom", "Boardroom", ["совет директоров"], 40),
  scenario("negotiation", "Negotiation", ["переговоры", "переговорные"], 50),
  scenario("executive", "Executive", ["представительский"], 60),
  scenario("smart_casual", "Smart casual", ["smart casual"], 70),
  scenario("sport_chic", "Sport chic", ["спорт-шик"], 80),
  scenario("suit", "Suit", ["костюм", "строгий костюм"], 90),
  scenario("black_tie", "Black tie", ["дресс-код", "смокинг"], 100),
  scenario(
    "evening",
    "Evening",
    ["вечер", "вечерний прием", "вечерний выход", "вечерний раут"],
    110,
  ),
  scenario("gala", "Gala", ["гала"], 120),
  scenario(
    "reception",
    "Reception",
    ["раут", "приемы", "официальные приемы", "официальные встречи"],
    130,
  ),
  scenario("high_society", "High society", ["высший свет"], 140),
  scenario("club", "Club", ["клуб"], 150),
  scenario("private_club", "Private club", ["закрытый клуб"], 160),
  scenario("cocktail", "Cocktail", ["коктейль"], 170),
  scenario("theatre", "Theatre", ["театр"], 180),
  scenario("status", "Status", ["статус", "топ-статус"], 190),
  scenario(
    "collection",
    "Collection",
    ["коллекция", "музейная коллекция"],
    200,
  ),
  scenario("auction", "Auction", ["аукцион", "аукционы"], 210),
  scenario("art", "Art", ["арт"], 220),
  scenario("weekend", "Weekend", ["уикенд"], 230),
  scenario("leisure", "Leisure", ["отдых"], 240),
  scenario("sport", "Sport", ["спорт", "повседневный спорт"], 250),
  scenario("motorsport", "Motorsport", ["автоспорт", "гоночный"], 260),
  scenario("field", "Field", ["полевые"], 270),
  scenario("expedition", "Expedition", ["экспедиции"], 280),
  scenario("caving", "Caving", ["спелеология"], 290),
  scenario("extreme", "Extreme", ["экстрим"], 300),
  scenario("diving", "Diving", ["дайвинг"], 310),
  scenario(
    "professional_diving",
    "Professional diving",
    ["профессиональный дайвинг"],
    320,
  ),
  scenario(
    "deep_sea_diving",
    "Deep-sea diving",
    ["глубоководный дайвинг", "экстремальный дайвинг"],
    330,
  ),
  scenario("marine_sport", "Marine sport", ["морской спорт"], 340),
  scenario("sailing", "Sailing", ["парусный спорт", "парусные гонки"], 350),
  scenario("regatta", "Regatta", ["регата"], 360),
  scenario("yachting", "Yachting", ["яхтинг", "яхта"], 370),
  scenario("beach", "Beach", ["пляж"], 380),
  scenario("resort", "Resort", ["курорт"], 390),
  scenario("travel", "Travel", ["путешествия"], 400),
  scenario(
    "business_travel",
    "Business travel",
    ["бизнес-тревел", "бизнес-авиация"],
    410,
  ),
  scenario("flights", "Flights", ["перелеты"], 420),
  scenario("aviation", "Aviation", ["авиация"], 430),
  scenario("laboratory", "Laboratory", ["наука", "лаборатории"], 440),

  complication("time_only", "Time only", ["нет (time-only)"], 10),
  complication("date", "Date", ["дата", "мгновенная дата"], 20),
  complication(
    "pointer_date",
    "Pointer date",
    ["стрелочная дата", "стрелочный указатель даты", "стрелочный календарь"],
    30,
  ),
  complication("day_of_week", "Day of week", ["день недели"], 40),
  complication("annual_calendar", "Annual calendar", ["годовой календарь"], 50),
  complication("moonphase", "Moon phase", ["фазы луны"], 60),
  complication(
    "small_seconds",
    "Small seconds",
    ["малая секундная стрелка"],
    70,
  ),
  complication(
    "gmt",
    "GMT / second time zone",
    ["второй пояс gmt", "второй пояс", "dual time 24h"],
    80,
  ),
  complication("day_night_indicator", "Day/night indicator", ["день/ночь"], 90),
  complication("bezel_24h", "24-hour bezel", ["безель 24ч"], 100),
  complication(
    "dive_bezel",
    "Dive bezel",
    ["дайверский безель", "дайверский безель 60 мин"],
    110,
  ),
  complication("sixty_minute_bezel", "60-minute bezel", ["безель 60 мин"], 120),
  complication("chronograph", "Chronograph", ["хронограф"], 130),
  complication("tachymeter", "Tachymeter", ["тахиметр"], 140),
  complication("flyback", "Flyback", ["flyback"], 150),
  complication(
    "regatta_timer",
    "Regatta timer",
    ["программируемый таймер регаты"],
    160,
  ),
  complication("helium_valve", "Helium escape valve", ["гелиевый клапан"], 170),
  complication(
    "antimagnetic_shield",
    "Antimagnetic shield",
    ["антимагнитный экран 1000g"],
    180,
  ),
  complication("ring_command", "Ring Command bezel", ["ring command"], 190),
  complication("ringlock", "Ringlock case system", ["ringlock"], 200),

  positioning("instrument", "Instrument", 10),
  positioning("quiet_classic", "Quiet classic", 20),
  positioning("recognised_benchmark", "Recognised benchmark", 30),
  positioning("bicolour", "Two-tone", 40),
  positioning("precious_metal", "Solid precious metal", 50),
  positioning("platinum_ice", "Platinum / Ice Blue", 60),
  positioning("high_jewellery", "High jewellery", 70),
  positioning("avant_garde", "Avant-garde", 80),
  positioning("sport_luxe", "Sport-luxe", 90),
  positioning("expressive_dial", "Expressive dial", 100),
  positioning("mechanical_showcase", "Mechanical showcase", 110),
];

export function resolveVocabularySlug(
  kind: VocabularyKind,
  token: string,
  rows: readonly VocabularyRow[] = BUNDLED_VOCABULARY,
) {
  const normalized = normalizeSourceToken(token);
  for (const row of rows) {
    if (row.kind !== kind) continue;
    if (
      row.sourceAliases.some(
        (alias) => normalizeSourceToken(alias) === normalized,
      )
    ) {
      return row.slug;
    }
  }
  return null;
}

function splitOn(cell: string, separator: RegExp) {
  return cell
    .split(separator)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}

export function splitScenarioTokens(cell: string) {
  return splitOn(cell, /\s*\/\s*/);
}

export function splitComplicationTokens(cell: string) {
  return splitOn(cell, /\s*,\s*/);
}
