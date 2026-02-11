/**
 * Configuration parsing and defaults for Job Application plugin
 */

import { homedir } from "node:os";
import { join } from "node:path";

import type { JobApplicationConfig, JobSource } from "./types.js";

const DEFAULT_DB_PATH = join(
  homedir(),
  ".clawdbot",
  "jobbot",
  "applications.sqlite",
);
const DEFAULT_RESUMES_DIR = join(homedir(), ".clawdbot", "jobbot", "resumes");
const DEFAULT_SCAN_INTERVAL = "6h";
const DEFAULT_JOB_BOARDS: JobSource[] = ["indeed", "linkedin"];

function assertAllowedKeys(
  value: Record<string, unknown>,
  allowed: string[],
  label: string,
): void {
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unknown.length === 0) return;
  throw new Error(`${label} has unknown keys: ${unknown.join(", ")}`);
}

function parsePreferences(value: unknown): JobApplicationConfig["preferences"] {
  const defaults: JobApplicationConfig["preferences"] = {
    titles: [],
    locations: [],
    salaryMin: undefined,
    salaryMax: undefined,
    remoteOnly: false,
    excludeCompanies: [],
    keywords: [],
    excludeKeywords: [],
  };

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return defaults;
  }

  const prefs = value as Record<string, unknown>;
  assertAllowedKeys(
    prefs,
    [
      "titles",
      "locations",
      "salaryMin",
      "salaryMax",
      "remoteOnly",
      "excludeCompanies",
      "keywords",
      "excludeKeywords",
    ],
    "preferences",
  );

  return {
    titles: Array.isArray(prefs.titles)
      ? (prefs.titles as string[])
      : defaults.titles,
    locations: Array.isArray(prefs.locations)
      ? (prefs.locations as string[])
      : defaults.locations,
    salaryMin:
      typeof prefs.salaryMin === "number"
        ? prefs.salaryMin
        : defaults.salaryMin,
    salaryMax:
      typeof prefs.salaryMax === "number"
        ? prefs.salaryMax
        : defaults.salaryMax,
    remoteOnly:
      typeof prefs.remoteOnly === "boolean"
        ? prefs.remoteOnly
        : defaults.remoteOnly,
    excludeCompanies: Array.isArray(prefs.excludeCompanies)
      ? (prefs.excludeCompanies as string[])
      : defaults.excludeCompanies,
    keywords: Array.isArray(prefs.keywords)
      ? (prefs.keywords as string[])
      : defaults.keywords,
    excludeKeywords: Array.isArray(prefs.excludeKeywords)
      ? (prefs.excludeKeywords as string[])
      : defaults.excludeKeywords,
  };
}

function parseNotifications(
  value: unknown,
): JobApplicationConfig["notifications"] {
  const defaults: JobApplicationConfig["notifications"] = {
    channel: undefined,
    dailySummary: true,
    newJobAlerts: true,
    emailResponseAlerts: true,
  };

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return defaults;
  }

  const notif = value as Record<string, unknown>;
  assertAllowedKeys(
    notif,
    ["channel", "dailySummary", "newJobAlerts", "emailResponseAlerts"],
    "notifications",
  );

  return {
    channel:
      typeof notif.channel === "string" ? notif.channel : defaults.channel,
    dailySummary:
      typeof notif.dailySummary === "boolean"
        ? notif.dailySummary
        : defaults.dailySummary,
    newJobAlerts:
      typeof notif.newJobAlerts === "boolean"
        ? notif.newJobAlerts
        : defaults.newJobAlerts,
    emailResponseAlerts:
      typeof notif.emailResponseAlerts === "boolean"
        ? notif.emailResponseAlerts
        : defaults.emailResponseAlerts,
  };
}

export const jobApplicationConfigSchema = {
  parse(value: unknown): JobApplicationConfig {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      // Return defaults if no config provided
      return {
        dbPath: DEFAULT_DB_PATH,
        resumesDir: DEFAULT_RESUMES_DIR,
        scanInterval: DEFAULT_SCAN_INTERVAL,
        defaultJobBoards: DEFAULT_JOB_BOARDS,
        preferences: parsePreferences(undefined),
        notifications: parseNotifications(undefined),
      };
    }

    const cfg = value as Record<string, unknown>;
    assertAllowedKeys(
      cfg,
      [
        "dbPath",
        "resumesDir",
        "scanInterval",
        "defaultJobBoards",
        "preferences",
        "notifications",
      ],
      "job-application config",
    );

    return {
      dbPath: typeof cfg.dbPath === "string" ? cfg.dbPath : DEFAULT_DB_PATH,
      resumesDir:
        typeof cfg.resumesDir === "string"
          ? cfg.resumesDir
          : DEFAULT_RESUMES_DIR,
      scanInterval:
        typeof cfg.scanInterval === "string"
          ? cfg.scanInterval
          : DEFAULT_SCAN_INTERVAL,
      defaultJobBoards: Array.isArray(cfg.defaultJobBoards)
        ? (cfg.defaultJobBoards as JobSource[])
        : DEFAULT_JOB_BOARDS,
      preferences: parsePreferences(cfg.preferences),
      notifications: parseNotifications(cfg.notifications),
    };
  },

  uiHints: {
    dbPath: {
      label: "Database Path",
      placeholder: "~/.clawdbot/jobbot/applications.sqlite",
      advanced: true,
      help: "Path to SQLite database for storing job data",
    },
    resumesDir: {
      label: "Resumes Directory",
      placeholder: "~/.clawdbot/jobbot/resumes",
      advanced: true,
      help: "Directory to store uploaded resume files",
    },
    scanInterval: {
      label: "Scan Interval",
      placeholder: "6h",
      help: "How often to scan for new jobs (e.g., '6h', '12h', '24h')",
    },
    defaultJobBoards: {
      label: "Default Job Boards",
      help: "Job boards to search by default",
    },
    "preferences.titles": {
      label: "Target Job Titles",
      help: "Job titles to search for",
    },
    "preferences.locations": {
      label: "Preferred Locations",
      help: "Locations to search (e.g., 'Remote', 'San Francisco, CA')",
    },
    "preferences.salaryMin": {
      label: "Minimum Salary",
      help: "Minimum acceptable salary",
    },
    "preferences.salaryMax": {
      label: "Maximum Salary",
      help: "Maximum salary to consider",
    },
    "preferences.remoteOnly": {
      label: "Remote Only",
      help: "Only show remote positions",
    },
    "preferences.excludeCompanies": {
      label: "Excluded Companies",
      help: "Companies to exclude from search results",
    },
    "notifications.channel": {
      label: "Notification Channel",
      help: "Channel to send notifications (e.g., 'imessage', 'telegram')",
    },
    "notifications.dailySummary": {
      label: "Daily Summary",
      help: "Send daily summary of job search activity",
    },
    "notifications.newJobAlerts": {
      label: "New Job Alerts",
      help: "Alert when new matching jobs are found",
    },
    "notifications.emailResponseAlerts": {
      label: "Email Response Alerts",
      help: "Alert when email responses are detected",
    },
  },
};
