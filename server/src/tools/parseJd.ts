// @ts-nocheck
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { upsertJd, getJd, listJds } from "../db/client.js";
import { JdSchema } from "../types/index.js";

export function registerParseJd(server: McpServer): void {
  server.tool(
    "parse_jd",
    "Parse a raw job description into a structured JD schema. " +
    "The model should analyze the JD text and return a structured JSON " +
    "matching the JD schema format with fields: job_id, meta, " +
    "hard_requirements, soft_requirements, preferred_signals, domain_tags, " +
    "evidence_targets, and style_constraints. " +
    "This tool stores the parsed result in the database for later retrieval.",
    {
      jd_schema: z.object({
        job_id: z.string().describe("Unique identifier for this JD, e.g. jd_2026_bain_pta"),
        raw_text: z.string().describe("The original JD text"),
        meta: z.object({
          company: z.string(),
          team: z.string().optional(),
          location: z.string().optional(),
          role_title: z.string(),
          language: z.enum(["en", "zh"]).default("en"),
          seniority: z.enum(["student_intern", "entry_level", "experienced"]).default("student_intern"),
        }),
        hard_requirements: z.array(z.string()),
        soft_requirements: z.array(z.string()),
        preferred_signals: z.array(z.string()),
        domain_tags: z.array(z.string()),
        evidence_targets: z.array(z.object({
          signal: z.string(),
          examples: z.array(z.string()),
          priority: z.number().min(0).max(1),
        })),
        style_constraints: z.object({
          resume_language: z.enum(["en", "zh"]).default("en"),
          bullet_style: z.enum(["result_first", "action_first"]).default("action_first"),
          quant_preference: z.enum(["high", "medium", "low"]).default("high"),
          tone: z.enum(["professional_student", "professional_experienced", "academic"]).default("professional_student"),
        }),
      }).describe("The structured JD schema parsed from the raw text"),
    },
    async ({ jd_schema }) => {
      try {
        const validated = JdSchema.parse(jd_schema);
        upsertJd(validated);

        return {
          content: [
            {
              type: "text" as const,
              text: `JD "${validated.meta.role_title}" at ${validated.meta.company} has been parsed and stored (ID: ${validated.job_id}). ` +
                `Found ${validated.hard_requirements.length} hard requirements, ` +
                `${validated.evidence_targets.length} evidence targets, ` +
                `and ${validated.domain_tags.length} domain tags.`,
            },
          ],
          structuredContent: { jd: validated },
        };
      } catch (error: any) {
        return {
          content: [{ type: "text" as const, text: `Failed to parse JD: ${error.message}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    "list_jds",
    "List all stored JD schemas from the database.",
    {},
    async () => {
      const jds = listJds();
      const summary = jds.map(j =>
        `- ${j.job_id}: ${j.meta.role_title} at ${j.meta.company}`
      ).join("\n");

      return {
        content: [{
          type: "text" as const,
          text: jds.length > 0
            ? `Found ${jds.length} stored JDs:\n${summary}`
            : "No JDs stored yet.",
        }],
        structuredContent: { jds },
      };
    },
  );
}
