/**
 * Greenhouse Job Site Adapter
 *
 * Handles parsing and automation for Greenhouse-powered job boards.
 * Greenhouse is an ATS used by many tech companies.
 */

import type {
  JobSiteAdapter,
  JobSearchParams,
  RawJobListing,
  ApplicationForm,
  ApplicationFormField,
} from "./types.js";

export const greenhouseAdapter: JobSiteAdapter = {
  name: "greenhouse",
  label: "Greenhouse",
  baseUrl: "https://boards.greenhouse.io",

  buildSearchUrl(params: JobSearchParams): string {
    // Greenhouse URLs are company-specific
    // Format: https://boards.greenhouse.io/{company}
    // We can't build a generic search URL, but we can format for known companies

    // For API access (if available):
    // https://boards-api.greenhouse.io/v1/boards/{company}/jobs

    // Return a template that would need company name
    return `https://boards.greenhouse.io/search?q=${encodeURIComponent(params.query)}`;
  },

  parseJobList(snapshot: string): RawJobListing[] {
    const jobs: RawJobListing[] = [];

    // Greenhouse job listing patterns
    // Jobs are typically in div.opening with data-id
    // Title in a.opening-title
    // Location in span.location

    const jobPattern =
      /opening[^>]*data-id="(\d+)"[\s\S]*?opening-title[^>]*>([^<]+)[\s\S]*?location[^>]*>([^<]+)/g;

    let match;
    while ((match = jobPattern.exec(snapshot)) !== null) {
      const [, externalId, title, location] = match;

      // Extract company from URL or page title
      const companyMatch = snapshot.match(/<title[^>]*>([^<|]+)/i);
      const company = companyMatch
        ? companyMatch[1].replace(/jobs|careers|-/gi, "").trim()
        : "Unknown Company";

      jobs.push({
        externalId,
        title: title.trim(),
        company,
        location: location.trim(),
        url: `https://boards.greenhouse.io/embed/job_app?token=${externalId}`,
      });
    }

    return jobs;
  },

  parseJobDetail(snapshot: string): Partial<RawJobListing> {
    const details: Partial<RawJobListing> = {};

    // Greenhouse job detail patterns
    // Description in #content or div.content
    const descMatch = snapshot.match(
      /<div[^>]*(?:id="content"|class="[^"]*content[^"]*")[^>]*>([\s\S]*?)<\/div>/i,
    );
    if (descMatch) {
      details.description = cleanHtml(descMatch[1]);
    }

    // Department/Team
    const deptMatch = snapshot.match(/department[^>]*>([^<]+)/i);
    if (deptMatch) {
      details.requirements = [`Department: ${deptMatch[1].trim()}`];
    }

    // Extract tech stack from description
    if (details.description) {
      details.techStack = extractTechStack(details.description);
    }

    return details;
  },

  canHandle(url: string): boolean {
    return (
      url.includes("greenhouse.io") || url.includes("boards.greenhouse.io")
    );
  },

  parseApplicationForm(snapshot: string): ApplicationForm | null {
    const fields: ApplicationFormField[] = [];

    // Greenhouse has standardized application forms
    // Form fields are typically in div.field with input elements

    // Required fields
    const requiredPatterns = [
      {
        pattern: /first_name[^>]*ref="([^"]+)"/i,
        label: "First Name",
        type: "text" as const,
      },
      {
        pattern: /last_name[^>]*ref="([^"]+)"/i,
        label: "Last Name",
        type: "text" as const,
      },
      {
        pattern: /email[^>]*ref="([^"]+)"/i,
        label: "Email",
        type: "email" as const,
      },
    ];

    for (const { pattern, label, type } of requiredPatterns) {
      const match = snapshot.match(pattern);
      if (match) {
        fields.push({
          id: match[1],
          type,
          label,
          required: true,
        });
      }
    }

    // Optional fields
    const optionalPatterns = [
      {
        pattern: /phone[^>]*ref="([^"]+)"/i,
        label: "Phone",
        type: "phone" as const,
      },
      {
        pattern: /linkedin[^>]*ref="([^"]+)"/i,
        label: "LinkedIn Profile",
        type: "text" as const,
      },
      {
        pattern: /website[^>]*ref="([^"]+)"/i,
        label: "Website",
        type: "text" as const,
      },
    ];

    for (const { pattern, label, type } of optionalPatterns) {
      const match = snapshot.match(pattern);
      if (match) {
        fields.push({
          id: match[1],
          type,
          label,
          required: false,
        });
      }
    }

    // Resume upload
    const resumeMatch = snapshot.match(/resume[^>]*ref="([^"]+)"/i);
    if (resumeMatch) {
      fields.push({
        id: resumeMatch[1],
        type: "file",
        label: "Resume",
        required: true,
      });
    }

    // Cover letter
    const coverMatch = snapshot.match(/cover.?letter[^>]*ref="([^"]+)"/i);
    if (coverMatch) {
      fields.push({
        id: coverMatch[1],
        type: "textarea",
        label: "Cover Letter",
        required: false,
      });
    }

    // Custom questions (Greenhouse allows custom fields)
    const customPattern =
      /custom_field[^>]*label="([^"]+)"[^>]*ref="([^"]+)"[^>]*type="([^"]+)"/gi;
    let customMatch;
    while ((customMatch = customPattern.exec(snapshot)) !== null) {
      const [, label, id, inputType] = customMatch;
      fields.push({
        id,
        type: mapInputType(inputType),
        label: label.trim(),
        required: false, // Custom fields are usually optional
      });
    }

    // EEOC questions (common in US)
    const eeocFields = [
      {
        pattern: /gender[^>]*ref="([^"]+)"/i,
        label: "Gender",
        options: ["Male", "Female", "Non-binary", "Prefer not to say"],
      },
      {
        pattern: /ethnicity[^>]*ref="([^"]+)"/i,
        label: "Ethnicity",
        options: [
          "Asian",
          "Black",
          "Hispanic",
          "White",
          "Other",
          "Prefer not to say",
        ],
      },
      {
        pattern: /veteran[^>]*ref="([^"]+)"/i,
        label: "Veteran Status",
        options: ["Yes", "No", "Prefer not to say"],
      },
      {
        pattern: /disability[^>]*ref="([^"]+)"/i,
        label: "Disability Status",
        options: ["Yes", "No", "Prefer not to say"],
      },
    ];

    for (const { pattern, label, options } of eeocFields) {
      const match = snapshot.match(pattern);
      if (match) {
        fields.push({
          id: match[1],
          type: "select",
          label,
          required: false,
          options,
        });
      }
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

      // Handle name fields
      if (labelLower.includes("first name") && data.contactInfo?.name) {
        filled.value = data.contactInfo.name.split(" ")[0];
      } else if (labelLower.includes("last name") && data.contactInfo?.name) {
        const parts = data.contactInfo.name.split(" ");
        filled.value = parts.slice(1).join(" ");
      }
      // Handle contact fields
      else if (labelLower.includes("email")) {
        filled.value = data.contactInfo?.email ?? "";
      } else if (labelLower.includes("phone")) {
        filled.value = data.contactInfo?.phone ?? "";
      }
      // Handle files
      else if (labelLower.includes("resume")) {
        filled.value = data.resume?.path ?? "";
      } else if (labelLower.includes("cover letter")) {
        filled.value = data.coverLetter ?? "";
      }
      // Handle custom answers
      else if (data.answers && data.answers[field.id]) {
        filled.value = data.answers[field.id];
      }
      // Default EEOC answers to "Prefer not to say"
      else if (
        labelLower.includes("gender") ||
        labelLower.includes("ethnicity") ||
        labelLower.includes("veteran") ||
        labelLower.includes("disability")
      ) {
        if (field.options?.includes("Prefer not to say")) {
          filled.value = "Prefer not to say";
        }
      }

      return filled;
    });
  },
};

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
    "Terraform",
    "Jenkins",
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
