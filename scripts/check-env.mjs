import fs from 'node:fs';
import path from 'node:path';

const groups = {
  foundation: {
    required: ['APP_URL'],
    optional: [
      'SESSION_SECRET',
      'BEEHIIV_API_KEY',
      'BEEHIIV_PUBLICATION_ID',
    ],
  },
  questionnaire: {
    required: [],
    optional: ['SESSION_SECRET'],
  },
  research: {
    required: ['PERPLEXITY_API_KEY'],
    optional: ['OPENAI_API_KEY', 'OPENAI_PROJECT_ID'],
  },
  recommendation: {
    required: ['DATABASE_URL'],
    optional: ['DIRECT_DATABASE_URL'],
  },
  semantic: {
    required: [],
    optional: [
      'OPENAI_API_KEY',
      'OPENAI_PROJECT_ID',
      'OLLAMA_BASE_URL',
      'RUNPOD_ENDPOINT_ID',
    ],
  },
  deployment: {
    required: [],
    optional: ['VERCEL_TOKEN', 'VERCEL_ORG_ID', 'VERCEL_PROJECT_ID'],
  },
  mcp: {
    required: [],
    optional: ['PERPLEXITY_API_KEY', 'GITHUB_PAT_TOKEN', 'CONTEXT7_API_KEY'],
  },
  production: {
    required: ['CRON_SECRET'],
    optional: [
      'QUIZ_RATE_LIMIT_MAX_REQUESTS',
      'QUIZ_RATE_LIMIT_WINDOW_SECONDS',
      'UPSTASH_REDIS_REST_URL',
      'UPSTASH_REDIS_REST_TOKEN',
      'RESEND_API_KEY',
      'EMAIL_FROM',
      'SENTRY_DSN',
    ],
  },
};

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};

  const values = {};
  for (const sourceLine of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const line = sourceLine.trim();
    if (!line || line.startsWith('#')) continue;

    const separator = line.indexOf('=');
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

function isConfigured(value) {
  if (!value) return false;
  return !/^(replace|change|paste|your)[-_ ]/i.test(value);
}

const args = process.argv.slice(2);
const phaseIndex = args.indexOf('--phase');
const selectedName = phaseIndex >= 0 ? args[phaseIndex + 1] : null;
const strict = args.includes('--strict');

if (selectedName && !groups[selectedName]) {
  console.error(`Unknown phase group: ${selectedName}`);
  console.error(`Available groups: ${Object.keys(groups).join(', ')}`);
  process.exit(2);
}

const fileValues = parseEnvFile(path.resolve(process.cwd(), '.env'));
const values = { ...fileValues, ...process.env };
const selectedGroups = selectedName
  ? [[selectedName, groups[selectedName]]]
  : Object.entries(groups);

let missingRequired = 0;

for (const [name, config] of selectedGroups) {
  const missing = config.required.filter((key) => !isConfigured(values[key]));
  const optionalConfigured = config.optional.filter((key) =>
    isConfigured(values[key]),
  );

  missingRequired += missing.length;
  console.log(`\n${name}`);
  console.log(
    missing.length === 0
      ? '  required: ready'
      : `  required missing: ${missing.join(', ')}`,
  );
  console.log(
    optionalConfigured.length === 0
      ? '  optional configured: none'
      : `  optional configured: ${optionalConfigured.join(', ')}`,
  );
}

console.log('\nSecret values were not printed.');

if (strict && missingRequired > 0) process.exit(1);
