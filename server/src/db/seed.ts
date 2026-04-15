import { readFileSync } from "node:fs";
import path from "node:path";
import { db, upsertJd, upsertModule, upsertBullet, upsertExemplar, upsertTaxonomySignal } from "./client.js";
import type { Jd, ExperienceModule, BulletModule, Exemplar, Taxonomy } from "../types/index.js";

const dataDir = path.resolve(process.cwd(), "data");

function loadJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf-8"));
}

console.log("Seeding database...");

db();

const taxonomy = loadJson<Taxonomy>(path.join(dataDir, "taxonomy.json"));
for (const [signal, aliases] of Object.entries(taxonomy.signal_taxonomy)) {
  upsertTaxonomySignal(signal, aliases);
}
console.log(`  Taxonomy: ${Object.keys(taxonomy.signal_taxonomy).length} signals`);

const jd = loadJson<Jd>(path.join(dataDir, "seed/sample_jd.json"));
upsertJd(jd);
console.log(`  JD: ${jd.job_id}`);

const moduleData = loadJson<{ modules: ExperienceModule[]; bullets: BulletModule[] }>(
  path.join(dataDir, "seed/sample_modules.json")
);
for (const mod of moduleData.modules) upsertModule(mod);
for (const bullet of moduleData.bullets) upsertBullet(bullet);
console.log(`  Modules: ${moduleData.modules.length}, Bullets: ${moduleData.bullets.length}`);

const exemplars = loadJson<Exemplar[]>(path.join(dataDir, "seed/sample_exemplars.json"));
for (const ex of exemplars) upsertExemplar(ex);
console.log(`  Exemplars: ${exemplars.length}`);

console.log("Seeding complete.");
