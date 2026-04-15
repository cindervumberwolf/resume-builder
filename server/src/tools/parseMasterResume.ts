// @ts-nocheck
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { upsertModule, upsertBullet, listModules } from "../db/client.js";
import { ExperienceModuleSchema, BulletModuleSchema } from "../types/index.js";

export function registerParseMasterResume(server: McpServer): void {
  server.tool(
    "parse_master_resume",
    "Parse a master resume or experience description into modular resume components. " +
    "The model should break down the input into experience-level modules and bullet-level modules. " +
    "Each experience module represents a distinct role/project/education entry. " +
    "Each bullet module represents a single achievement or responsibility within that experience. " +
    "This tool stores all parsed modules and bullets in the database.",
    {
      modules: z.array(z.object({
        module_id: z.string().describe("Unique ID, e.g. exp_company_role_01"),
        type: z.enum(["experience", "project", "education", "leadership", "award", "certification"]),
        section: z.enum(["experience", "education", "projects", "leadership", "skills", "awards"]),
        organization: z.string(),
        title: z.string(),
        date_range: z.string(),
        context_tags: z.array(z.string()),
        base_priority: z.number().min(0).max(1).describe("How important/impressive this experience is, 0-1"),
        source_type: z.enum(["master_resume", "manual_input", "parsed"]).default("parsed"),
      })).describe("Experience-level modules parsed from the resume"),
      bullets: z.array(z.object({
        bullet_id: z.string().describe("Unique ID, e.g. bullet_company_01"),
        parent_module_id: z.string().describe("The module_id this bullet belongs to"),
        raw_fact: z.string().describe("The original bullet text"),
        normalized_fact: z.object({
          action: z.string(),
          object: z.string(),
          method: z.array(z.string()).optional(),
          output: z.string().optional(),
          metric: z.string().nullable().optional(),
        }),
        evidence_tags: z.array(z.string()).describe("What this bullet proves, mapped to taxonomy signals"),
        skill_tags: z.array(z.string()),
        role_fit_tags: z.array(z.string()).describe("Which role types this bullet fits: consulting, ib, strategy, product, etc."),
        strength_score: z.object({
          clarity: z.number().min(0).max(1),
          quantification: z.number().min(0).max(1),
          brand_signal: z.number().min(0).max(1),
          transferability: z.number().min(0).max(1),
        }),
        rewrite_candidates: z.array(z.string()).default([]),
      })).describe("Bullet-level modules parsed from the resume"),
    },
    async ({ modules, bullets }) => {
      try {
        let moduleCount = 0;
        let bulletCount = 0;

        for (const mod of modules) {
          const validated = ExperienceModuleSchema.parse(mod);
          upsertModule(validated);
          moduleCount++;
        }

        for (const bullet of bullets) {
          const validated = BulletModuleSchema.parse(bullet);
          upsertBullet(validated);
          bulletCount++;
        }

        return {
          content: [{
            type: "text" as const,
            text: `Successfully parsed and stored ${moduleCount} experience modules and ${bulletCount} bullets.`,
          }],
          structuredContent: { modules, bullets },
        };
      } catch (error: any) {
        return {
          content: [{ type: "text" as const, text: `Failed to parse resume: ${error.message}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    "list_modules",
    "List all stored resume modules with their bullets from the database.",
    {},
    async () => {
      const modules = listModules();
      const summary = modules.map(m =>
        `- ${m.module_id}: ${m.title} at ${m.organization} (${m.bullets.length} bullets, priority: ${m.base_priority})`
      ).join("\n");

      return {
        content: [{
          type: "text" as const,
          text: modules.length > 0
            ? `Found ${modules.length} modules:\n${summary}`
            : "No resume modules stored yet. Use parse_master_resume to add some.",
        }],
        structuredContent: { modules },
      };
    },
  );
}
