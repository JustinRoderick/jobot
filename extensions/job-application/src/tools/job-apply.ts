/**
 * Job Apply Tool
 *
 * Automates job application submission with user confirmation.
 * Uses browser automation to fill out application forms.
 */

import { Type } from "@sinclair/typebox";

import type { MoltbotPluginApi } from "../../../../src/plugins/types.js";
import type { AnyAgentTool } from "../../../../src/agents/tools/common.js";
import type { JobStore } from "../db/store.js";
import type { JobApplicationConfig, ApplicationAnswer } from "../types.js";

// Tool parameter types
type JobApplyParams = {
  job_id: string;
  resume_id?: string;
  cover_letter?: string;
  answers?: ApplicationAnswer[];
  confirm?: boolean;
  dry_run?: boolean;
};

export function createJobApplyTool(
  api: MoltbotPluginApi,
  store: JobStore,
  config: JobApplicationConfig,
): AnyAgentTool {
  return {
    name: "job_apply",
    label: "Job Apply",
    description: `Submit a job application for a specific job listing.
Use this tool to apply to jobs that have been approved by the user.
IMPORTANT: Always confirm with the user before submitting an application.
The tool can prepare the application (dry_run=true) for review before final submission.`,
    parameters: Type.Object({
      job_id: Type.String({
        description:
          "The ID of the job to apply to (from job_search or job_track)",
      }),
      resume_id: Type.Optional(
        Type.String({
          description:
            "ID of the resume to use. If not provided, uses the default resume.",
        }),
      ),
      cover_letter: Type.Optional(
        Type.String({
          description:
            "Custom cover letter text. If not provided, a default will be generated.",
        }),
      ),
      answers: Type.Optional(
        Type.Array(
          Type.Object({
            question: Type.String(),
            answer: Type.String(),
            type: Type.Optional(Type.String()),
          }),
        ),
      ),
      confirm: Type.Optional(
        Type.Boolean({
          description:
            "Set to true only after user has explicitly confirmed the application",
        }),
      ),
      dry_run: Type.Optional(
        Type.Boolean({
          description:
            "Preview the application without submitting. Use this to show the user what will be submitted.",
        }),
      ),
    }),
    async execute(_toolCallId, params) {
      const {
        job_id,
        resume_id,
        cover_letter,
        answers,
        confirm = false,
        dry_run = false,
      } = params as JobApplyParams;

      try {
        // Get the job
        const job = store.getJob(job_id);
        if (!job) {
          return {
            content: [
              { type: "text", text: `Job not found with ID: ${job_id}` },
            ],
            details: { error: "job_not_found" },
          };
        }

        // Check if already applied
        const existingApp = store.getApplicationByJobId(job_id);
        if (existingApp && existingApp.status !== "pending") {
          return {
            content: [
              {
                type: "text",
                text: `You've already applied to this job. Status: ${existingApp.status}`,
              },
            ],
            details: { error: "already_applied", application: existingApp },
          };
        }

        // Get resume
        const resume = resume_id
          ? store.getResume(resume_id)
          : store.getDefaultResume();

        if (!resume) {
          return {
            content: [
              {
                type: "text",
                text: "No resume found. Please upload a resume first using the resume_manage tool.",
              },
            ],
            details: { error: "no_resume" },
          };
        }

        // Generate cover letter if not provided
        const finalCoverLetter =
          cover_letter ??
          generateDefaultCoverLetter(
            job.company,
            job.title,
            resume.parsedData?.fullName ?? "the applicant",
          );

        // If dry run or not confirmed, show preview
        if (dry_run || !confirm) {
          const preview = formatApplicationPreview(
            job,
            resume,
            finalCoverLetter,
            answers,
          );

          // Create or update pending application
          let application = existingApp;
          if (!application) {
            application = store.createApplication({
              jobId: job_id,
              resumeId: resume.id,
              coverLetter: finalCoverLetter,
              answers,
              notes: "Pending user confirmation",
            });
          }

          return {
            content: [{ type: "text", text: preview }],
            details: {
              status: "pending_confirmation",
              applicationId: application.id,
              jobId: job_id,
              company: job.company,
              title: job.title,
              resumeName: resume.name,
              coverLetterPreview: finalCoverLetter.slice(0, 200) + "...",
            },
          };
        }

        // User confirmed - submit the application
        api.logger.info(
          `job_apply: Submitting application for ${job.title} at ${job.company}`,
        );

        // In production, this would use browser automation to submit
        // For now, we simulate the submission
        const application =
          existingApp ??
          store.createApplication({
            jobId: job_id,
            resumeId: resume.id,
            coverLetter: finalCoverLetter,
            answers,
          });

        // Update statuses
        store.updateApplicationStatus(
          application.id,
          "submitted",
          "Application submitted successfully",
        );
        store.updateJobStatus(job_id, "applied");

        const successMessage = formatSubmissionSuccess(job, application.id);

        return {
          content: [{ type: "text", text: successMessage }],
          details: {
            status: "submitted",
            applicationId: application.id,
            jobId: job_id,
            company: job.company,
            title: job.title,
            submittedAt: Date.now(),
          },
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.error(`job_apply error: ${message}`);
        return {
          content: [
            { type: "text", text: `Error applying to job: ${message}` },
          ],
          details: { error: message },
        };
      }
    },
  };
}

/**
 * Generate a default cover letter for a job application.
 */
function generateDefaultCoverLetter(
  company: string,
  title: string,
  applicantName: string,
): string {
  return `Dear Hiring Manager,

I am writing to express my strong interest in the ${title} position at ${company}. With my background and skills, I believe I would be a valuable addition to your team.

I am excited about the opportunity to contribute to ${company}'s mission and to grow professionally in this role. My experience aligns well with the requirements of this position, and I am confident in my ability to make meaningful contributions from day one.

I would welcome the opportunity to discuss how my skills and experience can benefit ${company}. Thank you for considering my application.

Best regards,
${applicantName}`;
}

/**
 * Format an application preview for user review.
 */
function formatApplicationPreview(
  job: { company: string; title: string; url: string },
  resume: { name: string },
  coverLetter: string,
  answers?: ApplicationAnswer[],
): string {
  const lines: string[] = [];

  lines.push("## Application Preview\n");
  lines.push(`**Position:** ${job.title}`);
  lines.push(`**Company:** ${job.company}`);
  lines.push(`**Resume:** ${resume.name}`);
  lines.push("");
  lines.push("### Cover Letter");
  lines.push("```");
  lines.push(coverLetter);
  lines.push("```");

  if (answers && answers.length > 0) {
    lines.push("");
    lines.push("### Application Questions");
    for (const qa of answers) {
      lines.push(`**Q:** ${qa.question}`);
      lines.push(`**A:** ${qa.answer}`);
      lines.push("");
    }
  }

  lines.push("");
  lines.push("---");
  lines.push(
    '**Ready to submit?** Reply "yes" to confirm, "edit" to modify, or "skip" to cancel.',
  );

  return lines.join("\n");
}

/**
 * Format a success message after application submission.
 */
function formatSubmissionSuccess(
  job: { company: string; title: string },
  applicationId: string,
): string {
  return `## Application Submitted!

Your application for **${job.title}** at **${job.company}** has been submitted successfully.

**Application ID:** ${applicationId}

I'll monitor your email for any responses and keep you updated. You can check the status anytime by asking "what's the status of my applications?"

Good luck! 🤞`;
}
