/**
 * LinkedIn Job Site Adapter
 *
 * Handles parsing and automation for LinkedIn job listings.
 * Note: LinkedIn requires authentication for most operations.
 */

import type {
  JobSiteAdapter,
  JobSearchParams,
  RawJobListing,
  ApplicationForm,
  ApplicationFormField,
} from "./types.js";

export const linkedinAdapter: JobSiteAdapter = {
  name: "linkedin",
  label: "LinkedIn",
  baseUrl: "https://www.linkedin.com",

  buildSearchUrl(params: JobSearchParams): string {
    const url = new URL("https://www.linkedin.com/jobs/search/");

    url.searchParams.set("keywords", params.query);

    if (params.location) {
      url.searchParams.set("location", params.location);
    }

    if (params.remote) {
      // LinkedIn remote filter: f_WT=2
      url.searchParams.set("f_WT", "2");
    }

    if (params.postedWithin) {
      // LinkedIn uses time filter:
      // r86400 = past 24 hours
      // r604800 = past week
      // r2592000 = past month
      if (params.postedWithin <= 1) {
        url.searchParams.set("f_TPR", "r86400");
      } else if (params.postedWithin <= 7) {
        url.searchParams.set("f_TPR", "r604800");
      } else {
        url.searchParams.set("f_TPR", "r2592000");
      }
    }

    if (params.salaryMin) {
      // LinkedIn salary filters vary by region
      // This is a simplified version
      const salaryBucket = getSalaryBucket(params.salaryMin);
      if (salaryBucket) {
        url.searchParams.set("f_SB2", salaryBucket);
      }
    }

    return url.toString();
  },

  parseJobList(snapshot: string): RawJobListing[] {
    const jobs: RawJobListing[] = [];

    // LinkedIn job cards pattern
    // Jobs are in li elements with data-occludable-job-id
    // Title in .job-card-list__title
    // Company in .job-card-container__company-name
    // Location in .job-card-container__metadata-item

    const jobPattern =
      /data-occludable-job-id="(\d+)"[\s\S]*?job-card-list__title[^>]*>([^<]+)[\s\S]*?company-name[^>]*>([^<]+)[\s\S]*?metadata-item[^>]*>([^<]+)/g;

    let match;
    while ((match = jobPattern.exec(snapshot)) !== null) {
      const [, externalId, title, company, location] = match;
      jobs.push({
        externalId,
        title: title.trim(),
        company: company.trim(),
        location: location.trim(),
        url: `https://www.linkedin.com/jobs/view/${externalId}`,
      });
    }

    return jobs;
  },

  parseJobDetail(snapshot: string): Partial<RawJobListing> {
    const details: Partial<RawJobListing> = {};

    // Parse job description
    const descMatch = snapshot.match(
      /jobs-description[^>]*>([\s\S]*?)<\/div>/i,
    );
    if (descMatch) {
      details.description = cleanHtml(descMatch[1]);
    }

    // Parse salary (LinkedIn shows ranges)
    const salaryMatch = snapshot.match(
      /\$?([\d,]+)\s*\/?\s*(?:yr|year|annually)?\s*-\s*\$?([\d,]+)/i,
    );
    if (salaryMatch) {
      details.salaryMin = parseInt(salaryMatch[1].replace(/,/g, ""));
      details.salaryMax = parseInt(salaryMatch[2].replace(/,/g, ""));
    }

    // LinkedIn often shows skills in a separate section
    const skillsMatch = snapshot.match(/skills[^>]*>([\s\S]*?)<\/section>/i);
    if (skillsMatch) {
      const skills = extractSkillsFromSection(skillsMatch[1]);
      if (skills.length > 0) {
        details.techStack = skills;
      }
    }

    // Fallback: extract from description
    if (!details.techStack && details.description) {
      details.techStack = extractTechStack(details.description);
    }

    // Posted date
    const postedMatch = snapshot.match(
      /posted\s+(\d+)\s+(day|week|month)s?\s+ago/i,
    );
    if (postedMatch) {
      const value = parseInt(postedMatch[1]);
      const unit = postedMatch[2].toLowerCase();
      let daysAgo = value;
      if (unit === "week") daysAgo *= 7;
      if (unit === "month") daysAgo *= 30;
      details.postedAt = Date.now() - daysAgo * 24 * 60 * 60 * 1000;
    }

    return details;
  },

  canHandle(url: string): boolean {
    return url.includes("linkedin.com");
  },

  parseApplicationForm(snapshot: string): ApplicationForm | null {
    const fields: ApplicationFormField[] = [];

    // LinkedIn Easy Apply has standardized fields
    // Check if it's Easy Apply vs external application

    const isEasyApply =
      snapshot.includes("Easy Apply") || snapshot.includes("easy-apply");

    if (!isEasyApply) {
      // External application - might redirect
      return null;
    }

    // Contact info fields (usually pre-filled from profile)
    const contactFields = [
      {
        pattern: /first.?name[^>]*ref="([^"]+)"/i,
        label: "First Name",
        type: "text" as const,
      },
      {
        pattern: /last.?name[^>]*ref="([^"]+)"/i,
        label: "Last Name",
        type: "text" as const,
      },
      {
        pattern: /email[^>]*ref="([^"]+)"/i,
        label: "Email",
        type: "email" as const,
      },
      {
        pattern: /phone[^>]*ref="([^"]+)"/i,
        label: "Phone",
        type: "phone" as const,
      },
    ];

    for (const { pattern, label, type } of contactFields) {
      const match = snapshot.match(pattern);
      if (match) {
        fields.push({
          id: match[1],
          type,
          label,
          required: label === "Email",
        });
      }
    }

    // Resume upload
    const resumeMatch = snapshot.match(/upload.?resume[^>]*ref="([^"]+)"/i);
    if (resumeMatch) {
      fields.push({
        id: resumeMatch[1],
        type: "file",
        label: "Resume",
        required: true,
      });
    }

    // Additional questions (varies by job)
    const questionPattern =
      /question[^>]*label="([^"]+)"[^>]*ref="([^"]+)"[^>]*type="([^"]+)"/gi;
    let questionMatch;
    while ((questionMatch = questionPattern.exec(snapshot)) !== null) {
      const [, label, id, inputType] = questionMatch;
      fields.push({
        id,
        type: mapInputType(inputType),
        label: label.trim(),
        required: false,
      });
    }

    // Submit button
    const submitMatch = snapshot.match(/submit[^>]*ref="([^"]+)"/i);

    if (fields.length === 0) {
      return null;
    }

    return {
      url: "",
      fields,
      submitButtonRef: submitMatch?.[1],
    };
  },

  fillApplicationForm(
    form: ApplicationForm,
    data: {
      resume?: { name: string; path: string };
      coverLetter?: string;
      contactInfo?: { name?: string; email?: string; phone?: string };
      answers?: Record<string, string>;
    },
  ): ApplicationFormField[] {
    return form.fields.map((field) => {
      const filled = { ...field };
      const labelLower = field.label.toLowerCase();

      if (labelLower.includes("first name") && data.contactInfo?.name) {
        filled.value = data.contactInfo.name.split(" ")[0];
      } else if (labelLower.includes("last name") && data.contactInfo?.name) {
        const parts = data.contactInfo.name.split(" ");
        filled.value = parts.slice(1).join(" ");
      } else if (labelLower.includes("email")) {
        filled.value = data.contactInfo?.email ?? "";
      } else if (labelLower.includes("phone")) {
        filled.value = data.contactInfo?.phone ?? "";
      } else if (labelLower.includes("resume")) {
        filled.value = data.resume?.path ?? "";
      } else if (data.answers && data.answers[field.id]) {
        filled.value = data.answers[field.id];
      }

      return filled;
    });
  },
};

/**
 * Get LinkedIn salary bucket from minimum salary.
 */
function getSalaryBucket(salaryMin: number): string | null {
  // LinkedIn salary filters (US)
  // These are approximate ranges
  if (salaryMin >= 200000) return "8";
  if (salaryMin >= 160000) return "7";
  if (salaryMin >= 120000) return "6";
  if (salaryMin >= 100000) return "5";
  if (salaryMin >= 80000) return "4";
  if (salaryMin >= 60000) return "3";
  if (salaryMin >= 40000) return "2";
  return "1";
}

/**
 * Clean HTML to plain text.
 */
function cleanHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extract skills from LinkedIn skills section.
 */
function extractSkillsFromSection(html: string): string[] {
  const skills: string[] = [];
  const skillPattern = /<span[^>]*>([^<]+)<\/span>/gi;
  let match;
  while ((match = skillPattern.exec(html)) !== null) {
    const skill = match[1].trim();
    if (skill.length > 1 && skill.length < 30 && !skill.includes("\n")) {
      skills.push(skill);
    }
  }
  return skills.slice(0, 15);
}

/**
 * Extract tech stack from description.
 */
function extractTechStack(description: string): string[] {
  const techKeywords = [
    "JavaScript",
    "TypeScript",
    "Python",
    "Java",
    "C++",
    "C#",
    "Go",
    "Rust",
    "React",
    "Vue",
    "Angular",
    "Node.js",
    "Django",
    "Flask",
    "Spring",
    "AWS",
    "Azure",
    "GCP",
    "Docker",
    "Kubernetes",
    "PostgreSQL",
    "MongoDB",
    "Redis",
    "GraphQL",
    "REST",
    "Git",
    "CI/CD",
  ];

  const found: string[] = [];
  const descLower = description.toLowerCase();

  for (const tech of techKeywords) {
    if (descLower.includes(tech.toLowerCase())) {
      found.push(tech);
    }
  }

  return found;
}

/**
 * Map HTML input type to our field type.
 */
function mapInputType(
  inputType: string,
): "text" | "textarea" | "select" | "checkbox" | "file" | "email" | "phone" {
  switch (inputType.toLowerCase()) {
    case "textarea":
      return "textarea";
    case "select":
    case "dropdown":
      return "select";
    case "checkbox":
      return "checkbox";
    case "file":
      return "file";
    case "email":
      return "email";
    case "tel":
    case "phone":
      return "phone";
    default:
      return "text";
  }
}
