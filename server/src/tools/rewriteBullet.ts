// @ts-nocheck
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { searchExemplars } from "../db/client.js";

export function registerRewriteBullet(server: McpServer): void {
  server.tool(
    "rewrite_bullet",
    "Rewrite a resume bullet point using exemplar style references. " +
    "The model should generate three versions (conservative, balanced, aggressive) " +
    "based on the original fact, exemplar style patterns, and rewrite constraints. " +
    "This tool retrieves relevant exemplars automatically and returns them alongside " +
    "the constraints so the model can produce high-quality rewrites.",
    {
      original_bullet: z.string().describe("The original bullet text to rewrite"),
      track: z.string().default("general").describe("Target role track for exemplar matching"),
      tags: z.array(z.string()).default([]).describe("Skill tags for exemplar retrieval"),
      constraints: z.object({
        must_keep_facts: z.boolean().default(true).describe("Must preserve the core factual claims"),
        no_fabrication: z.boolean().default(true).describe("Do not invent metrics or achievements not in original"),
        max_words: z.number().int().optional().describe("Maximum word count per bullet"),
        tone: z.string().default("professional_student").describe("Target tone"),
        quantify_when_supported: z.boolean().default(true).describe("Add quantification if facts support it"),
        open_with_action_verb: z.boolean().default(true).describe("Start with a strong action verb"),
      }).default({
        must_keep_facts: true,
        no_fabrication: true,
        tone: "professional_student",
        quantify_when_supported: true,
        open_with_action_verb: true,
      }),
      num_exemplars: z.number().int().min(1).max(10).default(3).describe("Number of style reference exemplars to retrieve"),
    },
    async ({ original_bullet, track, tags, constraints, num_exemplars }) => {
      const exemplars = searchExemplars(track, tags).slice(0, num_exemplars);

      const exemplarText = exemplars.length > 0
        ? exemplars.map((ex, i) => {
            const features: string[] = [];
            if (ex.style_features.opens_with_action_verb) features.push("action-verb opening");
            if (ex.style_features.quantified) features.push("quantified");
            return `  ${i + 1}. "${ex.bullet_text}" [${features.join(", ")}]`;
          }).join("\n")
        : "  (No exemplars found â€?use general best practices)";

      const constraintLines = [
        constraints.must_keep_facts ? "- Must preserve core facts from original" : "",
        constraints.no_fabrication ? "- Do NOT fabricate metrics or achievements" : "",
        constraints.max_words ? `- Maximum ${constraints.max_words} words` : "",
        `- Target tone: ${constraints.tone}`,
        constraints.quantify_when_supported ? "- Add quantification where the original facts support it" : "",
        constraints.open_with_action_verb ? "- Open with a strong action verb" : "",
      ].filter(Boolean).join("\n");

      const prompt = `Original bullet to rewrite:\n"${original_bullet}"\n\n` +
        `Style reference exemplars from top university career centers:\n${exemplarText}\n\n` +
        `Rewrite constraints:\n${constraintLines}\n\n` +
        `Please generate three versions:\n` +
        `1. CONSERVATIVE â€?minimal changes, fix obvious issues only\n` +
        `2. BALANCED â€?improve structure, add action verb, tighten language\n` +
        `3. AGGRESSIVE â€?fully rewrite in exemplar style, maximize impact while keeping facts true\n\n` +
        `For each version, briefly explain what was changed and why.`;

      return {
        content: [{
          type: "text" as const,
          text: prompt,
        }],
        structuredContent: {
          original_bullet,
          exemplars_used: exemplars.map(e => ({
            exemplar_id: e.exemplar_id,
            bullet_text: e.bullet_text,
            source: e.source,
          })),
          constraints,
        },
      };
    },
  );
}
