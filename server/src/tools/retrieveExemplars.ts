// @ts-nocheck
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { searchExemplars } from "../db/client.js";

export function registerRetrieveExemplars(server: McpServer): void {
  server.tool(
    "retrieve_exemplars",
    "Retrieve exemplar bullet points from top-school resume samples that are most " +
    "relevant to a given role type and skill tags. Returns ranked exemplars from " +
    "MIT, Oxford, and other top university career centers. Use these exemplars as " +
    "style references when rewriting user bullets with rewrite_bullet.",
    {
      track: z.string().describe(
        "Target role track: consulting, finance, technology, research, marketing, creative, or general"
      ),
      tags: z.array(z.string()).default([]).describe(
        "Skill/evidence tags to match against exemplar latent_tags, e.g. ['analysis', 'leadership', 'quantification']"
      ),
      max_results: z.number().int().min(1).max(50).default(5).describe(
        "Maximum number of exemplars to return"
      ),
      section_filter: z.string().optional().describe(
        "Optional: filter by resume section (experience, projects, leadership)"
      ),
      quantified_only: z.boolean().default(false).describe(
        "If true, only return exemplars that contain quantified results"
      ),
    },
    async ({ track, tags, max_results, section_filter, quantified_only }) => {
      let results = searchExemplars(track, tags);

      if (section_filter) {
        results = results.filter(e => e.section === section_filter);
      }

      if (quantified_only) {
        results = results.filter(e => e.style_features.quantified);
      }

      results = results.slice(0, max_results);

      if (results.length === 0) {
        return {
          content: [{
            type: "text" as const,
            text: `No exemplars found for track "${track}" with tags [${tags.join(", ")}]. ` +
              `Try broadening your search with track "general" or fewer tags.`,
          }],
        };
      }

      const formatted = results.map((ex, i) => {
        const features: string[] = [];
        if (ex.style_features.opens_with_action_verb) features.push("action-verb opening");
        if (ex.style_features.quantified) features.push("quantified");
        features.push(ex.style_features.length_band);
        features.push(ex.style_features.tone);

        return `${i + 1}. "${ex.bullet_text}"\n` +
          `   Source: ${ex.source} | Track: ${ex.track} | Section: ${ex.section}\n` +
          `   Style: [${features.join(", ")}]\n` +
          `   Tags: [${ex.latent_tags.join(", ")}]`;
      }).join("\n\n");

      return {
        content: [{
          type: "text" as const,
          text: `Found ${results.length} exemplar bullets for track "${track}":\n\n${formatted}`,
        }],
        structuredContent: {
          exemplars: results.map(ex => ({
            exemplar_id: ex.exemplar_id,
            bullet_text: ex.bullet_text,
            source: ex.source,
            track: ex.track,
            section: ex.section,
            style_features: ex.style_features,
            latent_tags: ex.latent_tags,
          })),
        },
      };
    },
  );
}
