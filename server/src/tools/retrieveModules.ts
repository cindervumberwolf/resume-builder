import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { listModules, getJd, findMatchingSignals } from "../db/client.js";
import type { BulletModule, ExperienceModule } from "../types/index.js";

interface ScoredModule {
  module: ExperienceModule & { bullets: BulletModule[] };
  score: number;
  matched_signals: string[];
  selected_bullets: (BulletModule & { relevance_score: number })[];
}

function scoreBulletForJd(
  bullet: BulletModule,
  jdTags: Set<string>,
  evidenceSignals: Set<string>,
): number {
  let score = 0;
  const allBulletTags = [
    ...bullet.evidence_tags,
    ...bullet.skill_tags,
    ...bullet.role_fit_tags,
  ].map(t => t.toLowerCase());

  for (const tag of allBulletTags) {
    if (jdTags.has(tag)) score += 1;
    if (evidenceSignals.has(tag)) score += 1.5;
  }

  const ss = bullet.strength_score;
  score += (ss.clarity + ss.quantification + ss.brand_signal + ss.transferability) * 0.5;

  return score;
}

export function registerRetrieveModules(server: McpServer): void {
  server.tool(
    "retrieve_modules",
    "Given a JD ID (or JD requirements), retrieve and rank the most relevant " +
    "resume modules and bullets from the database. Returns modules sorted by " +
    "relevance with their best-matching bullets selected and scored.",
    {
      job_id: z.string().optional().describe("ID of a stored JD to match against"),
      domain_tags: z.array(z.string()).optional().describe("Fallback: domain tags if no JD stored"),
      required_signals: z.array(z.string()).optional().describe("Fallback: specific signals to match"),
      max_modules: z.number().int().min(1).max(10).default(5).describe("Max modules to return"),
      max_bullets_per_module: z.number().int().min(1).max(6).default(3).describe("Max bullets per module"),
    },
    async ({ job_id, domain_tags, required_signals, max_modules, max_bullets_per_module }) => {
      let jdTags = new Set<string>();
      let evidenceSignals = new Set<string>();
      let jdInfo = "";

      if (job_id) {
        const jd = getJd(job_id);
        if (jd) {
          const allTags = [
            ...jd.hard_requirements,
            ...jd.soft_requirements,
            ...jd.preferred_signals,
            ...jd.domain_tags,
          ].map(t => t.toLowerCase());
          jdTags = new Set(allTags);

          for (const et of jd.evidence_targets) {
            evidenceSignals.add(et.signal.toLowerCase());
            et.examples.forEach(e => evidenceSignals.add(e.toLowerCase()));
          }
          jdInfo = `${jd.meta.role_title} at ${jd.meta.company}`;
        }
      }

      if (domain_tags) {
        domain_tags.forEach(t => jdTags.add(t.toLowerCase()));
      }
      if (required_signals) {
        required_signals.forEach(s => {
          jdTags.add(s.toLowerCase());
          evidenceSignals.add(s.toLowerCase());
          const expanded = findMatchingSignals([s]);
          expanded.forEach(e => evidenceSignals.add(e.toLowerCase()));
        });
      }

      const allModules = listModules();

      const scored: ScoredModule[] = allModules.map(mod => {
        const bulletScores = mod.bullets.map(b => ({
          ...b,
          relevance_score: scoreBulletForJd(b, jdTags, evidenceSignals),
        }));

        bulletScores.sort((a, b) => b.relevance_score - a.relevance_score);
        const selectedBullets = bulletScores.slice(0, max_bullets_per_module);

        const moduleTagOverlap = mod.context_tags
          .filter(t => jdTags.has(t.toLowerCase())).length;

        const avgBulletScore = selectedBullets.length > 0
          ? selectedBullets.reduce((sum, b) => sum + b.relevance_score, 0) / selectedBullets.length
          : 0;

        const score = (mod.base_priority * 2) + (moduleTagOverlap * 1.5) + avgBulletScore;

        const matched = mod.context_tags.filter(t => jdTags.has(t.toLowerCase()));

        return { module: mod, score, matched_signals: matched, selected_bullets: selectedBullets };
      });

      scored.sort((a, b) => b.score - a.score);
      const topModules = scored.slice(0, max_modules);

      const summary = topModules.map((s, i) =>
        `${i + 1}. ${s.module.title} at ${s.module.organization} ` +
        `(score: ${s.score.toFixed(2)}, matched: [${s.matched_signals.join(", ")}])\n` +
        s.selected_bullets.map(b =>
          `   • ${b.raw_fact} (relevance: ${b.relevance_score.toFixed(2)})`
        ).join("\n")
      ).join("\n\n");

      return {
        content: [{
          type: "text" as const,
          text: jdInfo
            ? `Top ${topModules.length} modules for "${jdInfo}":\n\n${summary}`
            : `Top ${topModules.length} modules:\n\n${summary}`,
        }],
        structuredContent: {
          ranked_modules: topModules.map(s => ({
            module_id: s.module.module_id,
            organization: s.module.organization,
            title: s.module.title,
            section: s.module.section,
            date_range: s.module.date_range,
            score: s.score,
            matched_signals: s.matched_signals,
            bullets: s.selected_bullets.map(b => ({
              bullet_id: b.bullet_id,
              raw_fact: b.raw_fact,
              relevance_score: b.relevance_score,
              evidence_tags: b.evidence_tags,
            })),
          })),
        },
      };
    },
  );
}
