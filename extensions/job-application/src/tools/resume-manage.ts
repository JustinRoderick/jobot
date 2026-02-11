/**
 * Resume Management Tool
 *
 * Handles resume upload, parsing, and management.
 * Stores resumes for use in job applications.
 */

import { Type } from "@sinclair/typebox";
import { copyFileSync, existsSync, unlinkSync } from "node:fs";
import { basename, join, extname } from "node:path";
import { randomUUID } from "node:crypto";

import type { MoltbotPluginApi } from "../../../../src/plugins/types.js";
import type { AnyAgentTool } from "../../../../src/agents/tools/common.js";
import type { JobStore } from "../db/store.js";
import type {
  JobApplicationConfig,
  ParsedResumeData,
  Resume,
} from "../types.js";

// Tool parameter types
type ResumeManageParams = {
  action: "upload" | "list" | "set_default" | "delete" | "view" | "parse";
  file_path?: string;
  resume_id?: string;
  name?: string;
};

export function createResumeManageTool(
  api: MoltbotPluginApi,
  store: JobStore,
  config: JobApplicationConfig,
): AnyAgentTool {
  return {
    name: "resume_manage",
    label: "Resume Manager",
    description: `Manage resumes for job applications.
Actions:
- upload: Add a new resume from a file path
- list: Show all saved resumes
- set_default: Set a resume as the default for applications
- delete: Remove a resume
- view: View resume details and parsed data
- parse: Re-parse a resume to extract information`,
    parameters: Type.Object({
      action: Type.String({
        description:
          "Action to perform: upload, list, set_default, delete, view, or parse",
      }),
      file_path: Type.Optional(
        Type.String({
          description:
            "Path to resume file for upload action (PDF, DOCX, or TXT)",
        }),
      ),
      resume_id: Type.Optional(
        Type.String({
          description:
            "Resume ID for set_default, delete, view, or parse actions",
        }),
      ),
      name: Type.Optional(
        Type.String({
          description: "Custom name for the resume (optional for upload)",
        }),
      ),
    }),
    async execute(_toolCallId, params) {
      const { action, file_path, resume_id, name } =
        params as ResumeManageParams;

      try {
        switch (action) {
          case "upload":
            return handleUpload(api, store, config, file_path, name);

          case "list":
            return handleList(store);

          case "set_default":
            return handleSetDefault(store, resume_id);

          case "delete":
            return handleDelete(store, resume_id);

          case "view":
            return handleView(store, resume_id);

          case "parse":
            return handleParse(api, store, resume_id);

          default:
            return {
              content: [
                {
                  type: "text",
                  text: `Unknown action: ${action}. Use: upload, list, set_default, delete, view, or parse`,
                },
              ],
              details: { error: "unknown_action" },
            };
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.error(`resume_manage error: ${message}`);
        return {
          content: [{ type: "text", text: `Error: ${message}` }],
          details: { error: message },
        };
      }
    },
  };
}

function handleUpload(
  api: MoltbotPluginApi,
  store: JobStore,
  config: JobApplicationConfig,
  filePath: string | undefined,
  customName: string | undefined,
) {
  if (!filePath) {
    return {
      content: [
        {
          type: "text",
          text: "Please provide a file_path to the resume file (PDF, DOCX, or TXT)",
        },
      ],
      details: { error: "missing_file_path" },
    };
  }

  // Validate file exists
  if (!existsSync(filePath)) {
    return {
      content: [{ type: "text", text: `File not found: ${filePath}` }],
      details: { error: "file_not_found" },
    };
  }

  // Validate file type
  const ext = extname(filePath).toLowerCase();
  const validTypes: Record<string, "pdf" | "docx" | "txt"> = {
    ".pdf": "pdf",
    ".docx": "docx",
    ".txt": "txt",
  };

  const fileType = validTypes[ext];
  if (!fileType) {
    return {
      content: [
        {
          type: "text",
          text: `Invalid file type: ${ext}. Supported types: PDF, DOCX, TXT`,
        },
      ],
      details: { error: "invalid_file_type" },
    };
  }

  // Copy file to resumes directory
  const resumeId = randomUUID();
  const fileName = `${resumeId}${ext}`;
  const destPath = join(api.resolvePath(config.resumesDir), fileName);

  try {
    copyFileSync(filePath, destPath);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [
        { type: "text", text: `Failed to copy resume file: ${message}` },
      ],
      details: { error: "copy_failed", message },
    };
  }

  // Parse resume (basic parsing - in production would use ML/NLP)
  const parsedData = parseResume(filePath, fileType);

  // Determine if this should be the default
  const existingResumes = store.listResumes();
  const isDefault = existingResumes.length === 0;

  // Create resume record
  const resumeName = customName ?? basename(filePath, ext) ?? "My Resume";
  const resume = store.createResume({
    name: resumeName,
    filePath: destPath,
    fileType,
    parsedData,
    isDefault,
  });

  api.logger.info(
    `resume_manage: Uploaded resume "${resumeName}" (${resume.id})`,
  );

  return {
    content: [
      {
        type: "text",
        text: formatResumeUploaded(resume, isDefault),
      },
    ],
    details: { resume, parsedData },
  };
}

function handleList(store: JobStore) {
  const resumes = store.listResumes();

  if (resumes.length === 0) {
    return {
      content: [
        {
          type: "text",
          text: 'No resumes uploaded yet. Use `resume_manage` with action "upload" and a file_path to add one.',
        },
      ],
      details: { count: 0 },
    };
  }

  return {
    content: [{ type: "text", text: formatResumeList(resumes) }],
    details: { count: resumes.length, resumes },
  };
}

function handleSetDefault(store: JobStore, resumeId: string | undefined) {
  if (!resumeId) {
    return {
      content: [{ type: "text", text: "Please provide a resume_id" }],
      details: { error: "missing_resume_id" },
    };
  }

  const resume = store.getResume(resumeId);
  if (!resume) {
    return {
      content: [{ type: "text", text: `Resume not found: ${resumeId}` }],
      details: { error: "not_found" },
    };
  }

  store.setDefaultResume(resumeId);

  return {
    content: [
      {
        type: "text",
        text: `Set **${resume.name}** as the default resume for applications.`,
      },
    ],
    details: { resumeId, name: resume.name },
  };
}

function handleDelete(store: JobStore, resumeId: string | undefined) {
  if (!resumeId) {
    return {
      content: [{ type: "text", text: "Please provide a resume_id" }],
      details: { error: "missing_resume_id" },
    };
  }

  const resume = store.getResume(resumeId);
  if (!resume) {
    return {
      content: [{ type: "text", text: `Resume not found: ${resumeId}` }],
      details: { error: "not_found" },
    };
  }

  // Delete the file
  if (existsSync(resume.filePath)) {
    try {
      unlinkSync(resume.filePath);
    } catch {
      // File deletion failed, continue anyway
    }
  }

  // Delete from database
  store.deleteResume(resumeId);

  return {
    content: [{ type: "text", text: `Deleted resume: **${resume.name}**` }],
    details: { resumeId, name: resume.name },
  };
}

function handleView(store: JobStore, resumeId: string | undefined) {
  if (!resumeId) {
    // Show default resume if no ID provided
    const defaultResume = store.getDefaultResume();
    if (!defaultResume) {
      return {
        content: [
          {
            type: "text",
            text: "No default resume set. Please provide a resume_id or upload a resume.",
          },
        ],
        details: { error: "no_default" },
      };
    }
    return {
      content: [{ type: "text", text: formatResumeDetails(defaultResume) }],
      details: { resume: defaultResume },
    };
  }

  const resume = store.getResume(resumeId);
  if (!resume) {
    return {
      content: [{ type: "text", text: `Resume not found: ${resumeId}` }],
      details: { error: "not_found" },
    };
  }

  return {
    content: [{ type: "text", text: formatResumeDetails(resume) }],
    details: { resume },
  };
}

function handleParse(
  api: MoltbotPluginApi,
  store: JobStore,
  resumeId: string | undefined,
) {
  if (!resumeId) {
    return {
      content: [{ type: "text", text: "Please provide a resume_id to parse" }],
      details: { error: "missing_resume_id" },
    };
  }

  const resume = store.getResume(resumeId);
  if (!resume) {
    return {
      content: [{ type: "text", text: `Resume not found: ${resumeId}` }],
      details: { error: "not_found" },
    };
  }

  // Re-parse the resume
  const parsedData = parseResume(resume.filePath, resume.fileType);

  // Update in database (would need to add update method)
  // For now, just return the parsed data
  return {
    content: [
      {
        type: "text",
        text: formatParsedResume(resume.name, parsedData),
      },
    ],
    details: { resumeId, parsedData },
  };
}

/**
 * Parse a resume file to extract structured data.
 * This is a simplified implementation - production would use ML/NLP.
 */
function parseResume(
  filePath: string,
  fileType: "pdf" | "docx" | "txt",
): ParsedResumeData {
  // In production, this would:
  // 1. Extract text from PDF/DOCX using appropriate libraries
  // 2. Use NLP to identify entities (name, email, phone, etc.)
  // 3. Classify sections (experience, education, skills)
  // 4. Extract structured data

  // For now, return placeholder data
  return {
    fullName: "John Doe",
    email: "john.doe@example.com",
    phone: "(555) 123-4567",
    location: "San Francisco, CA",
    summary:
      "Experienced software engineer with expertise in full-stack development and cloud technologies.",
    skills: [
      "TypeScript",
      "React",
      "Node.js",
      "Python",
      "AWS",
      "Docker",
      "PostgreSQL",
      "GraphQL",
    ],
    experience: [
      {
        company: "Tech Company Inc",
        title: "Senior Software Engineer",
        startDate: "2020-01",
        endDate: "Present",
        description:
          "Led development of cloud-native applications serving millions of users.",
      },
      {
        company: "Startup Co",
        title: "Software Engineer",
        startDate: "2017-06",
        endDate: "2019-12",
        description: "Built and maintained core platform services.",
      },
    ],
    education: [
      {
        institution: "University of California",
        degree: "Bachelor of Science",
        field: "Computer Science",
        graduationDate: "2017",
      },
    ],
  };
}

// Formatting helpers
function formatResumeUploaded(resume: Resume, isDefault: boolean): string {
  const lines: string[] = [];
  lines.push("## Resume Uploaded Successfully\n");
  lines.push(`**Name:** ${resume.name}`);
  lines.push(`**Type:** ${resume.fileType.toUpperCase()}`);
  lines.push(`**ID:** \`${resume.id}\``);

  if (isDefault) {
    lines.push(
      "\nThis resume has been set as your default for job applications.",
    );
  }

  if (resume.parsedData) {
    lines.push("\n### Extracted Information");
    if (resume.parsedData.fullName) {
      lines.push(`**Name:** ${resume.parsedData.fullName}`);
    }
    if (resume.parsedData.email) {
      lines.push(`**Email:** ${resume.parsedData.email}`);
    }
    if (resume.parsedData.skills && resume.parsedData.skills.length > 0) {
      lines.push(
        `**Skills:** ${resume.parsedData.skills.slice(0, 8).join(", ")}`,
      );
    }
  }

  return lines.join("\n");
}

function formatResumeList(resumes: Resume[]): string {
  const lines: string[] = [];
  lines.push("## Your Resumes\n");

  for (const resume of resumes) {
    const defaultBadge = resume.isDefault ? " ⭐ (default)" : "";
    lines.push(`### ${resume.name}${defaultBadge}`);
    lines.push(`- **Type:** ${resume.fileType.toUpperCase()}`);
    lines.push(`- **ID:** \`${resume.id}\``);
    lines.push(
      `- **Added:** ${new Date(resume.createdAt).toLocaleDateString()}`,
    );
    lines.push("");
  }

  return lines.join("\n");
}

function formatResumeDetails(resume: Resume): string {
  const lines: string[] = [];
  const defaultBadge = resume.isDefault ? " (Default)" : "";
  lines.push(`## ${resume.name}${defaultBadge}\n`);
  lines.push(`**Type:** ${resume.fileType.toUpperCase()}`);
  lines.push(`**ID:** \`${resume.id}\``);
  lines.push(`**File:** ${resume.filePath}`);
  lines.push(`**Added:** ${new Date(resume.createdAt).toLocaleDateString()}`);

  if (resume.parsedData) {
    lines.push("\n### Extracted Information");

    if (resume.parsedData.fullName) {
      lines.push(`**Name:** ${resume.parsedData.fullName}`);
    }
    if (resume.parsedData.email) {
      lines.push(`**Email:** ${resume.parsedData.email}`);
    }
    if (resume.parsedData.phone) {
      lines.push(`**Phone:** ${resume.parsedData.phone}`);
    }
    if (resume.parsedData.location) {
      lines.push(`**Location:** ${resume.parsedData.location}`);
    }

    if (resume.parsedData.summary) {
      lines.push("\n**Summary:**");
      lines.push(resume.parsedData.summary);
    }

    if (resume.parsedData.skills && resume.parsedData.skills.length > 0) {
      lines.push("\n**Skills:**");
      lines.push(resume.parsedData.skills.join(", "));
    }

    if (
      resume.parsedData.experience &&
      resume.parsedData.experience.length > 0
    ) {
      lines.push("\n**Experience:**");
      for (const exp of resume.parsedData.experience) {
        lines.push(
          `- ${exp.title} at ${exp.company} (${exp.startDate} - ${exp.endDate ?? "Present"})`,
        );
      }
    }

    if (resume.parsedData.education && resume.parsedData.education.length > 0) {
      lines.push("\n**Education:**");
      for (const edu of resume.parsedData.education) {
        lines.push(
          `- ${edu.degree}${edu.field ? ` in ${edu.field}` : ""} from ${edu.institution}`,
        );
      }
    }
  }

  return lines.join("\n");
}

function formatParsedResume(
  name: string,
  parsedData: ParsedResumeData,
): string {
  const lines: string[] = [];
  lines.push(`## Parsed Resume: ${name}\n`);

  if (parsedData.fullName) lines.push(`**Name:** ${parsedData.fullName}`);
  if (parsedData.email) lines.push(`**Email:** ${parsedData.email}`);
  if (parsedData.phone) lines.push(`**Phone:** ${parsedData.phone}`);
  if (parsedData.location) lines.push(`**Location:** ${parsedData.location}`);

  if (parsedData.summary) {
    lines.push("\n**Summary:**");
    lines.push(parsedData.summary);
  }

  if (parsedData.skills && parsedData.skills.length > 0) {
    lines.push("\n**Skills:**");
    lines.push(parsedData.skills.join(", "));
  }

  if (parsedData.experience && parsedData.experience.length > 0) {
    lines.push("\n**Experience:**");
    for (const exp of parsedData.experience) {
      lines.push(`- ${exp.title} at ${exp.company}`);
      if (exp.description) {
        lines.push(`  ${exp.description.slice(0, 100)}...`);
      }
    }
  }

  if (parsedData.education && parsedData.education.length > 0) {
    lines.push("\n**Education:**");
    for (const edu of parsedData.education) {
      lines.push(`- ${edu.degree} from ${edu.institution}`);
    }
  }

  return lines.join("\n");
}
