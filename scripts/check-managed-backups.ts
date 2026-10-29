/** Read-only Supabase Management API evidence. No token/raw response is logged.
 * Exit 2 means no available restore point was observed; it is never a green
 * backup check merely because the API accepted the token or WAL-G is enabled. */
import { writeFile } from "node:fs/promises";
import { z } from "zod";

const backupList = z.object({
  region: z.string(),
  walg_enabled: z.boolean(),
  pitr_enabled: z.boolean(),
  backups: z.array(
    z.object({
      status: z.enum([
        "COMPLETED",
        "FAILED",
        "PENDING",
        "REMOVED",
        "ARCHIVED",
        "CANCELLED",
      ]),
      inserted_at: z.string(),
      is_physical_backup: z.boolean(),
    }),
  ),
  physical_backup_data: z.object({
    earliest_physical_backup_date_unix: z.number().int().optional(),
    latest_physical_backup_date_unix: z.number().int().optional(),
  }),
});
const scheduleSchema = z.object({
  schedule_for: z.string().regex(/^\d{2}:\d{2}:\d{2}$/),
  updated_at: z.string(),
});

async function main() {
  const token = process.env.SUPABASE_ACCESS_TOKEN?.trim();
  if (!token) throw new Error("Missing Management API configuration");
  const hostname = new URL(process.env.SUPABASE_URL ?? "").hostname;
  const match = /^([a-z]{20})\.supabase\.co$/.exec(hostname);
  if (!match) throw new Error("Expected hosted Supabase project URL");
  const endpoint = `https://api.supabase.com/v1/projects/${match[1]}/database/backups`;
  const read = (url: string) =>
    fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15000),
      redirect: "error",
    });
  const results = await Promise.allSettled([
    read(endpoint),
    read(`${endpoint}/schedule`),
  ]);
  const listResult = results[0];
  if (listResult.status !== "fulfilled" || !listResult.value.ok)
    throw new Error("Backup list unavailable");
  const response = listResult.value;
  const list = backupList.parse(await response.json());
  const completed = list.backups.filter((item) => item.status === "COMPLETED");
  const completedDates = completed
    .map((item) => {
      // Do not guess a timezone if an upstream timestamp omitted it.
      const parsed = z.iso
        .datetime({ offset: true })
        .safeParse(item.inserted_at);
      return parsed.success ? Date.parse(parsed.data) : null;
    })
    .filter(
      (value): value is number => value !== null && Number.isFinite(value),
    );
  const physical = list.physical_backup_data;
  const dateFromUnix = (seconds: number | undefined) => {
    if (seconds === undefined || seconds < 0) return null;
    const millis = seconds * 1000;
    return Number.isFinite(new Date(millis).getTime()) ? millis : null;
  };
  const physicalEarliest = dateFromUnix(
    physical.earliest_physical_backup_date_unix,
  );
  const physicalLatest = dateFromUnix(
    physical.latest_physical_backup_date_unix,
  );
  const physicalWindow =
    physicalEarliest !== null &&
    physicalLatest !== null &&
    physicalEarliest <= physicalLatest;
  const observedTimes = [
    ...completedDates,
    ...(physicalWindow ? [physicalLatest] : []),
  ];
  const newest = observedTimes.length ? Math.max(...observedTimes) : null;
  const now = Date.now();
  const available = newest !== null && newest <= now + 5 * 60_000;
  const scheduleResult = results[1];
  const scheduleResponse =
    scheduleResult.status === "fulfilled" ? scheduleResult.value : null;
  const schedule = scheduleResponse?.ok
    ? scheduleSchema.parse(await scheduleResponse.json())
    : null;
  const report = {
    at: new Date(now).toISOString(),
    status: available
      ? "restore_point_observed"
      : "no_available_restore_point_observed",
    backupListStatus: response.status,
    region: list.region,
    walgEnabled: list.walg_enabled,
    pitrEnabled: list.pitr_enabled,
    listedBackups: list.backups.length,
    completedBackups: completed.length,
    invalidCompletedTimestamps: completed.length - completedDates.length,
    latestObservedBackupAt:
      newest === null ? null : new Date(newest).toISOString(),
    latestObservedAgeHours: available
      ? Math.max(0, (now - newest) / 3_600_000)
      : null,
    physicalRecoveryWindow: physicalWindow
      ? {
          earliest: new Date(physicalEarliest).toISOString(),
          latest: new Date(physicalLatest).toISOString(),
        }
      : null,
    configuredRetentionDays: null,
    scheduleApiStatus: scheduleResponse?.status ?? null,
    configuredScheduleUtc: schedule?.schedule_for ?? null,
    scheduleUpdatedAt: schedule?.updated_at ?? null,
    scheduleNote:
      "Custom schedule reads are Enterprise-only; 402 alone does not identify the plan or disable default daily backups.",
    retentionNote:
      "The backup-list response does not establish configured retention. No plan or retention is inferred from WAL-G or the observed window.",
    scope:
      "Read-only metadata; not a managed restore rehearsal, off-site export or Storage-object backup proof.",
  };
  await writeFile(
    "docs/reports/managed-backups-production.json",
    `${JSON.stringify(report, null, 2)}\n`,
  );
  console.log(JSON.stringify(report));
  if (!available) process.exitCode = 2;
}

try {
  await main();
} catch {
  // Upstream bodies, headers and configuration values are deliberately omitted.
  console.error("Managed backup verification could not read valid metadata.");
  process.exitCode = 1;
}
