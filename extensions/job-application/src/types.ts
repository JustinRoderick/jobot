/**
 * Core types for the Job Application plugin
 */

// =============================================================================
// Job Types
// =============================================================================

export type JobSource =
  | "indeed"
  | "linkedin"
  | "greenhouse"
  | "lever"
  | "custom";

export type JobStatus =
  | "new" // Just discovered
  | "reviewing" // User is reviewing
  | "approved" // User approved for application
  | "rejected" // User rejected
  | "applied" // Application submitted
  | "archived"; // No longer relevant

export type Job = {
  id: string;
  externalId?: string; // ID from job board
  source: JobSource;
  company: string;
  title: string;
  location?: string;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  description?: string;
  requirements?: string[];
  techStack?: string[];
  url: string;
  postedAt?: number;
  discoveredAt: number;
  status: JobStatus;
  metadata?: Record<string, unknown>;
};

// =============================================================================
// Application Types
// =============================================================================

export type ApplicationStatus =
  | "pending" // Ready to apply but not submitted
  | "submitted" // Application sent
  | "viewed" // Company viewed application
  | "rejected" // Received rejection
  | "interview" // Interview requested
  | "offer" // Received offer
  | "withdrawn" // User withdrew
  | "closed"; // Position closed

export type Application = {
  id: string;
  jobId: string;
  status: ApplicationStatus;
  appliedAt?: number;
  resumeId?: string;
  coverLetter?: string;
  answers?: ApplicationAnswer[]; // Q&A from application form
  notes?: string;
  lastActivityAt: number;
  createdAt: number;
  updatedAt: number;
};

export type ApplicationAnswer = {
  question: string;
  answer: string;
  type?: "text" | "select" | "checkbox" | "textarea";
};

// =============================================================================
// Email Thread Types
// =============================================================================

export type EmailThreadStatus =
  | "active" // Ongoing conversation
  | "awaiting_response" // Waiting for reply
  | "responded" // User responded
  | "closed"; // Thread concluded

export type EmailThread = {
  id: string;
  applicationId: string;
  gmailThreadId?: string;
  subject: string;
  fromEmail: string;
  lastMessageAt: number;
  status: EmailThreadStatus;
  messageCount: number;
  metadata?: Record<string, unknown>;
};

// =============================================================================
// Resume Types
// =============================================================================

export type Resume = {
  id: string;
  name: string;
  filePath: string;
  fileType: "pdf" | "docx" | "txt";
  parsedData?: ParsedResumeData;
  isDefault: boolean;
  createdAt: number;
  updatedAt: number;
};

export type ParsedResumeData = {
  fullName?: string;
  email?: string;
  phone?: string;
  location?: string;
  summary?: string;
  skills?: string[];
  experience?: ResumeExperience[];
  education?: ResumeEducation[];
};

export type ResumeExperience = {
  company: string;
  title: string;
  startDate?: string;
  endDate?: string;
  description?: string;
};

export type ResumeEducation = {
  institution: string;
  degree: string;
  field?: string;
  graduationDate?: string;
};

// =============================================================================
// Preferences Types
// =============================================================================

export type JobPreferences = {
  titles: string[];
  locations: string[];
  salaryMin?: number;
  salaryMax?: number;
  remoteOnly: boolean;
  excludeCompanies: string[];
  keywords: string[];
  excludeKeywords: string[];
};

// =============================================================================
// Plugin Config Types
// =============================================================================

export type JobApplicationConfig = {
  dbPath: string;
  resumesDir: string;
  scanInterval: string;
  defaultJobBoards: JobSource[];
  preferences: JobPreferences;
  notifications: {
    channel?: string;
    dailySummary: boolean;
    newJobAlerts: boolean;
    emailResponseAlerts: boolean;
  };
};

// =============================================================================
// Statistics Types
// =============================================================================

export type JobStats = {
  totalJobs: number;
  newJobs: number;
  appliedJobs: number;
  pendingApplications: number;
  interviewsScheduled: number;
  offersReceived: number;
  rejections: number;
  bySource: Record<JobSource, number>;
  byStatus: Record<JobStatus, number>;
  applicationsByStatus: Record<ApplicationStatus, number>;
  averageResponseTime?: number; // Days
};

export type TimelineEntry = {
  date: string; // ISO date string
  jobsDiscovered: number;
  applicationsSubmitted: number;
  responsesReceived: number;
};
