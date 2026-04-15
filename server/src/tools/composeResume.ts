import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getJd, getModuleWithBullets } from "../db/client.js";

export function registerComposeResume(server: McpServer): void {
  server.tool(
    "compose_resume",
    "Compose a complete one-page resume draft from selected modules and bullets. " +
    "The model should provide the final assembled content. This tool validates " +
    "the structure and returns a formatted markdown resume. " +
    "Use retrieve_modules first to determine which modules and bullets to include.",
    {
      job_id: z.string().optional().describe("JD ID for context/header"),
      candidate_name: z.string().describe("Candidate's full name"),
      contact_info: z.object({
        email: z.string().optional(),
        phone: z.string().optional(),
        linkedin: z.string().optional(),
        location: z.string().optional(),
      }).describe("Contact information for the resume header"),
      sections: z.array(z.object({
        section_type: z.enum(["education", "experience", "projects", "leadership", "skills", "awards"]),
        entries: z.array(z.object({
          module_id: z.string().optional().describe("Reference to stored module, if available"),
          organization: z.string(),
          title: z.string(),
          date_range: z.string(),
          location: z.string().optional(),
          bullets: z.array(z.string()).describe("Final bullet text for this entry"),
          gpa: z.string().optional().describe("GPA, only for education entries"),
          coursework: z.string().optional().describe("Relevant coursework, only for education"),
        })),
      })).describe("Resume sections in display order"),
      skills_section: z.object({
        technical: z.array(z.string()).optional(),
        languages: z.array(z.string()).optional(),
        interests: z.array(z.string()).optional(),
      }).optional().describe("Optional skills/interests section"),
    },
    async ({ job_id, candidate_name, contact_info, sections, skills_section }) => {
      let jdContext = "";
      if (job_id) {
        const jd = getJd(job_id);
        if (jd) {
          jdContext = ` (tailored for ${jd.meta.role_title} at ${jd.meta.company})`;
        }
      }

      const lines: string[] = [];

      lines.push(`# ${candidate_name}`);
      const contactParts: string[] = [];
      if (contact_info.email) contactParts.push(contact_info.email);
      if (contact_info.phone) contactParts.push(contact_info.phone);
      if (contact_info.linkedin) contactParts.push(contact_info.linkedin);
      if (contact_info.location) contactParts.push(contact_info.location);
      if (contactParts.length) lines.push(contactParts.join(" | "));
      lines.push("");

      const sectionTitles: Record<string, string> = {
        education: "EDUCATION",
        experience: "EXPERIENCE",
        projects: "PROJECTS",
        leadership: "LEADERSHIP & ACTIVITIES",
        skills: "SKILLS & INTERESTS",
        awards: "HONORS & AWARDS",
      };

      for (const section of sections) {
        lines.push(`## ${sectionTitles[section.section_type] ?? section.section_type.toUpperCase()}`);
        lines.push("");

        for (const entry of section.entries) {
          const titleLine = entry.location
            ? `**${entry.organization}** — ${entry.title} | ${entry.location} | ${entry.date_range}`
            : `**${entry.organization}** — ${entry.title} | ${entry.date_range}`;
          lines.push(titleLine);

          if (entry.gpa) lines.push(`GPA: ${entry.gpa}`);
          if (entry.coursework) lines.push(`Relevant Coursework: ${entry.coursework}`);

          for (const bullet of entry.bullets) {
            lines.push(`- ${bullet}`);
          }
          lines.push("");
        }
      }

      if (skills_section) {
        lines.push(`## SKILLS & INTERESTS`);
        lines.push("");
        if (skills_section.technical?.length) {
          lines.push(`**Technical:** ${skills_section.technical.join(", ")}`);
        }
        if (skills_section.languages?.length) {
          lines.push(`**Languages:** ${skills_section.languages.join(", ")}`);
        }
        if (skills_section.interests?.length) {
          lines.push(`**Interests:** ${skills_section.interests.join(", ")}`);
        }
        lines.push("");
      }

      const markdown = lines.join("\n");

      let totalBullets = 0;
      for (const s of sections) {
        for (const e of s.entries) {
          totalBullets += e.bullets.length;
        }
      }

      return {
        content: [{
          type: "text" as const,
          text: `Resume draft composed${jdContext}: ${sections.length} sections, ${totalBullets} bullets.\n\n${markdown}`,
        }],
        structuredContent: {
          markdown,
          stats: {
            sections: sections.length,
            total_bullets: totalBullets,
            target_jd: job_id ?? null,
          },
        },
      };
    },
  );
}
