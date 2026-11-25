// Skills live in one Git-tracked folder, .agents/skills, which Google Antigravity
// reads directly. Claude Code only reads .claude/skills, so this script links that
// path to the same folder. Runs automatically after `pnpm install`; safe to repeat.
//
// Why a link is created here instead of being committed to Git: on Windows without
// Developer Mode, Git checks a committed symlink out as a plain text file.
import {
  lstatSync,
  mkdirSync,
  readdirSync,
  realpathSync,
  rmdirSync,
  symlinkSync,
} from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const sharedSkillsPath = fileURLToPath(
  new URL("../.agents/skills", import.meta.url),
);
const claudeSkillsPath = fileURLToPath(
  new URL("../.claude/skills", import.meta.url),
);

function readEntry(path) {
  try {
    return lstatSync(path);
  } catch (error) {
    if (error.code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
}

const existingEntry = readEntry(claudeSkillsPath);

if (existingEntry?.isSymbolicLink()) {
  // Node reports both Windows junctions and Unix symlinks as symbolic links.
  if (realpathSync(claudeSkillsPath) !== realpathSync(sharedSkillsPath)) {
    throw new Error(".claude/skills is a link to a different folder; fix it.");
  }
  console.log(".claude/skills already links to .agents/skills");
} else {
  if (existingEntry) {
    // Never delete files here: a non-empty folder may hold someone's unmerged skill.
    if (readdirSync(claudeSkillsPath).length > 0) {
      throw new Error(
        ".claude/skills contains files. Move them to .agents/skills, delete the folder, then run pnpm skills:link.",
      );
    }
    rmdirSync(claudeSkillsPath);
  }
  mkdirSync(dirname(claudeSkillsPath), { recursive: true });
  // "junction" needs no administrator rights on Windows; other systems ignore it
  // and create a normal relative symlink.
  symlinkSync("../.agents/skills", claudeSkillsPath, "junction");
  console.log("Linked .claude/skills to .agents/skills");
}
