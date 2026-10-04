// Builds public/downloads/the-reserve-wordpress.zip from
// integrations/wordpress/the-reserve/, the file partners upload in
// WordPress (Plugins → Add New → Upload Plugin). Rerun after changing the
// plugin, and commit the zip:
//   npx tsx scripts/package-wordpress-plugin.ts
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { crc32, deflateRawSync } from "node:zlib";

const SOURCE = path.resolve("integrations/wordpress/the-reserve");
const TARGET = path.resolve("public/downloads/the-reserve-wordpress.zip");
// WordPress expects the plugin inside a folder of its own name.
const FOLDER = "the-reserve";

// A fixed timestamp, so an unchanged plugin gives a byte-identical zip.
const DOS_TIME = 0;
const DOS_DATE = ((2026 - 1980) << 9) | (10 << 5) | 1;

type Entry = { name: string; data: Buffer };

function entries(): Entry[] {
  return readdirSync(SOURCE, { withFileTypes: true })
    .filter((item) => item.isFile())
    .map((item) => item.name)
    .sort()
    .map((name) => ({
      name: `${FOLDER}/${name}`,
      data: readFileSync(path.join(SOURCE, name)),
    }));
}

export function zip(files: Entry[]) {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const file of files) {
    const name = Buffer.from(file.name, "utf8");
    const compressed = deflateRawSync(file.data, { level: 9 });
    const checksum = crc32(file.data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0x0800, 6); // UTF-8 names
    local.writeUInt16LE(8, 8); // deflate
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(file.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, name, compressed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4); // made by
    central.writeUInt16LE(20, 6); // version needed
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(DOS_TIME, 12);
    central.writeUInt16LE(DOS_DATE, 14);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(file.data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, name);

    offset += local.length + name.length + compressed.length;
  }
  const centralSize = centrals.reduce((sum, part) => sum + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, ...centrals, end]);
}

const files = entries();
mkdirSync(path.dirname(TARGET), { recursive: true });
writeFileSync(TARGET, zip(files));
console.log(
  `Wrote ${path.relative(process.cwd(), TARGET)} (${files.map((file) => file.name).join(", ")})`,
);
