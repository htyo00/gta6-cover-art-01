// Neon Coast Cover Studio — entry program for gta6-cover-art-01.
//
// Copies the static app and the screenshots into the output directory
// and writes the dossier that the judge reads, using the kit library.

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDossier } from "./vendor/makefun-app.ts";

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR || "/output";

const caps = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
};

function copyTreeIntoOutput(name: string): void {
  const source = join(repoRoot, name);
  const target = join(outputDir, name);
  if (!existsSync(source)) {
    throw new Error("missing " + name + " in repository");
  }
  cpSync(source, target, { recursive: true });
}

mkdirSync(outputDir, { recursive: true });
for (const name of ["app", "screenshots"]) {
  const target = join(outputDir, name);
  if (existsSync(target)) {
    rmSync(target, { recursive: true, force: true });
  }
  copyTreeIntoOutput(name);
}

const dossier = buildDossier(outputDir, caps);
if (!dossier || dossier.length === 0) {
  throw new Error("buildDossier returned an empty dossier");
}
writeFileSync(join(outputDir, "dossier.json"), dossier, "utf8");
