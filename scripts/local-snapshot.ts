import { z } from "zod";

export const snapshotSchema = z.object({
  formatVersion: z.literal(2),
  snapshotId: z.string(),
  createdAt: z.string(),
  migrations: z.array(z.string()),
  files: z.array(
    z.object({
      schema: z.enum(["public", "private"]),
      table: z.string().regex(/^[a-z_][a-z0-9_]*$/),
      file: z.string().regex(/^(public|private)\.[a-z_][a-z0-9_]*\.jsonl$/),
      insertColumns: z.array(z.string()),
      rows: z.number().int().nonnegative(),
      sha256: z.string().regex(/^[a-f0-9]{64}$/),
    }),
  ),
});
export type SnapshotFile = z.infer<typeof snapshotSchema>["files"][number];
