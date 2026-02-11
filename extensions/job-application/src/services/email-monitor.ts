/**
 * Email Monitor Service
 *
 * Integrates with Gmail Pub/Sub to track job application responses.
 * Classifies email responses and updates application status.
 */

import type { MoltbotPluginApi } from "../../../../src/plugins/types.js";
import type { JobStore } from "../db/store.js";
import type { JobApplicationConfig, ApplicationStatus } from "../types.js";

// Keywords for classifying email responses
const REJECTION_KEYWORDS = [
  "unfortunately",
  "regret to inform",
  "not moving forward",
  "decided not to proceed",
  "other candidates",
  "position has been filled",
  "not selected",
  "not a fit",
  "pursued other",
  "decided to move forward with",
];

const INTERVIEW_KEYWORDS = [
  "schedule an interview",
  "interview invitation",
  "would like to speak",
  "set up a call",
  "phone screen",
  "technical interview",
  "on-site interview",
  "video interview",
  "meet with",
  "next steps",
  "availability",
];

const OFFER_KEYWORDS = [
  "pleased to offer",
  "offer letter",
  "job offer",
  "employment offer",
  "compensation package",
  "start date",
  "we would like to extend",
];

type EmailResponseType = "rejection" | "interview" | "offer" | "generic";

type EmailData = {
  from: string;
  subject: string;
  body: string;
  gmailThreadId?: string;
  gmailMessageId?: string;
};

/**
 * Email monitor service that hooks into the gateway's email processing.
 */
export function createEmailMonitorService(
  api: MoltbotPluginApi,
  store: JobStore,
  config: JobApplicationConfig,
) {
  return {
    id: "jobbot-email-monitor",

    async start() {
      api.logger.info("jobbot-email-monitor: Service started");

      // Register hook to intercept Gmail notifications
      api.registerHook(
        "message_received",
        async (event) => {
          // Check if this is a Gmail notification
          if (!isGmailNotification(event)) return;

          try {
            await processEmailNotification(api, store, config, event);
          } catch (error) {
            const message =
              error instanceof Error ? error.message : String(error);
            api.logger.error(
              `jobbot-email-monitor: Error processing email: ${message}`,
            );
          }
        },
        { name: "jobbot-email-processor" },
      );
    },

    stop() {
      api.logger.info("jobbot-email-monitor: Service stopped");
    },
  };
}

/**
 * Check if an event is a Gmail notification.
 */
function isGmailNotification(event: unknown): event is EmailData {
  if (!event || typeof event !== "object") return false;
  const e = event as Record<string, unknown>;
  return typeof e.from === "string" && typeof e.subject === "string";
}

/**
 * Process an incoming email notification.
 */
async function processEmailNotification(
  api: MoltbotPluginApi,
  store: JobStore,
  config: JobApplicationConfig,
  email: EmailData,
): Promise<void> {
  // Try to match email to an existing application
  const application = matchEmailToApplication(store, email);

  if (!application) {
    api.logger.info(
      `jobbot-email-monitor: Email from ${email.from} did not match any applications`,
    );
    return;
  }

  // Classify the email response
  const responseType = classifyEmailResponse(email);
  api.logger.info(
    `jobbot-email-monitor: Classified email as ${responseType} for application ${application.applicationId}`,
  );

  // Update application status based on response type
  const newStatus = responseTypeToStatus(
    responseType,
    application.currentStatus,
  );

  if (newStatus && newStatus !== application.currentStatus) {
    store.updateApplicationStatus(
      application.applicationId,
      newStatus,
      `Email response classified as: ${responseType}`,
    );
  }

  // Create or update email thread
  const existingThread = email.gmailThreadId
    ? store.getEmailThreadByGmailId(email.gmailThreadId)
    : null;

  if (existingThread) {
    store.updateEmailThread(existingThread.id, {
      lastMessageAt: Date.now(),
      messageCount: existingThread.messageCount + 1,
      status: responseType === "interview" ? "awaiting_response" : "active",
    });
  } else {
    store.createEmailThread({
      applicationId: application.applicationId,
      gmailThreadId: email.gmailThreadId,
      subject: email.subject,
      fromEmail: email.from,
    });
  }

  // Send notification to user if configured
  if (
    config.notifications.emailResponseAlerts &&
    config.notifications.channel
  ) {
    const job = store.getJob(application.jobId);
    const notificationMessage = formatNotification(responseType, job, email);

    api.logger.info(
      `jobbot-email-monitor: Would send notification to ${config.notifications.channel}: ${notificationMessage.slice(0, 100)}...`,
    );
    // In production, this would use the message tool to send to the configured channel
  }
}

/**
 * Try to match an email to an existing application.
 */
function matchEmailToApplication(
  store: JobStore,
  email: EmailData,
): {
  applicationId: string;
  jobId: string;
  currentStatus: ApplicationStatus;
} | null {
  // Get all submitted applications
  const applications = store.listApplications({ status: "submitted" });

  // Also check applications in interview/offer status
  const interviewApps = store.listApplications({ status: "interview" });
  const allApps = [...applications, ...interviewApps];

  for (const app of allApps) {
    const job = store.getJob(app.jobId);
    if (!job) continue;

    // Match by company name in sender email or subject
    const companyLower = job.company.toLowerCase();
    const fromLower = email.from.toLowerCase();
    const subjectLower = email.subject.toLowerCase();

    // Extract domain from sender
    const senderDomain = fromLower.split("@")[1]?.split(".")[0];

    // Check if company name appears in sender domain or subject
    const companyWords = companyLower.split(/\s+/);
    const matchesSender = companyWords.some(
      (word) =>
        word.length > 3 &&
        (fromLower.includes(word) || senderDomain?.includes(word)),
    );
    const matchesSubject = companyWords.some(
      (word) => word.length > 3 && subjectLower.includes(word),
    );

    if (matchesSender || matchesSubject) {
      return {
        applicationId: app.id,
        jobId: app.jobId,
        currentStatus: app.status as ApplicationStatus,
      };
    }
  }

  return null;
}

/**
 * Classify an email response based on content analysis.
 */
function classifyEmailResponse(email: EmailData): EmailResponseType {
  const content = `${email.subject} ${email.body}`.toLowerCase();

  // Check for offer keywords first (highest priority)
  if (OFFER_KEYWORDS.some((kw) => content.includes(kw))) {
    return "offer";
  }

  // Check for interview keywords
  if (INTERVIEW_KEYWORDS.some((kw) => content.includes(kw))) {
    return "interview";
  }

  // Check for rejection keywords
  if (REJECTION_KEYWORDS.some((kw) => content.includes(kw))) {
    return "rejection";
  }

  return "generic";
}

/**
 * Map response type to application status.
 */
function responseTypeToStatus(
  responseType: EmailResponseType,
  currentStatus: ApplicationStatus,
): ApplicationStatus | null {
  switch (responseType) {
    case "offer":
      return "offer";
    case "interview":
      // Only update to interview if not already in interview or offer
      if (currentStatus !== "interview" && currentStatus !== "offer") {
        return "interview";
      }
      return null;
    case "rejection":
      return "rejected";
    case "generic":
      // Mark as viewed if currently just submitted
      if (currentStatus === "submitted") {
        return "viewed";
      }
      return null;
    default:
      return null;
  }
}

/**
 * Format a notification message for the user.
 */
function formatNotification(
  responseType: EmailResponseType,
  job: { company: string; title: string } | null,
  email: EmailData,
): string {
  const company = job?.company ?? "Unknown Company";
  const title = job?.title ?? "Unknown Position";

  switch (responseType) {
    case "offer":
      return `🎉 Great news! You received a job offer from ${company} for ${title}!\n\nSubject: ${email.subject}`;
    case "interview":
      return `📅 Interview request from ${company} for ${title}!\n\nSubject: ${email.subject}\n\nCheck your email for scheduling details.`;
    case "rejection":
      return `📧 Response from ${company} regarding ${title}.\n\nSubject: ${email.subject}\n\nThis appears to be a rejection. Keep going!`;
    default:
      return `📬 New email from ${company} regarding your ${title} application.\n\nSubject: ${email.subject}`;
  }
}

/**
 * Export for use in plugin registration.
 */
export type EmailMonitorService = ReturnType<typeof createEmailMonitorService>;
