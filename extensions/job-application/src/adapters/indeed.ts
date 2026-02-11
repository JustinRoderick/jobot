/**
 * Indeed Job Site Adapter
 *
 * Handles parsing and automation for Indeed job listings.
 */

import type {
  JobSiteAdapter,
  JobSearchParams,
  RawJobListing,
  ApplicationForm,
  ApplicationFormField,
} from "./types.js";

export const indeedAdapter: JobSiteAdapter = {
  name: "indeed",
  label: "Indeed",
  baseUrl: "https://www.indeed.com",

  buildSearchUrl(params: JobSearchParams): string {
    const url = new URL("https://www.indeed.com/jobs");
    url.searchParams.set("q", params.query);

    if (params.location) {
      url.searchParams.set("l", params.location);
    }

    if (params.remote) {
      url.searchParams.set("remotejob", "032b3046-06a3-4876-8dfd-474eb5e7ed11");
    }

    if (params.salaryMin) {
      // Indeed uses salary format like "$100,000"
      url.searchParams.set("salary", `$${params.salaryMin.toLocaleString()}`);
    }

    if (params.postedWithin) {
      // Indeed uses fromage parameter (days)
      url.searchParams.set("fromage", params.postedWithin.toString());
    }

    if (params.limit) {
      url.searchParams.set("limit", params.limit.toString());
    }

    return url.toString();
  },

  parseJobList(snapshot: string): RawJobListing[] {
    const jobs: RawJobListing[] = [];

    // This is a simplified parser for demonstration
    // In production, this would parse the actual Indeed page structure
    // The snapshot would be the browser's accessibility tree or DOM content

    // Example parsing logic based on Indeed's typical structure:
    // - Job cards have data-jk attribute with job ID
    // - Title is in h2.jobTitle
    // - Company in span.companyName
    // - Location in div.companyLocation
    // - Salary in div.salary-snippet (if present)

    // For now, return empty array - actual implementation would parse snapshot
    // This would use regex or DOM parsing on the snapshot content

    const jobCardPattern =
      /data-jk="([^"]+)"[\s\S]*?jobTitle[^>]*>([^<]+)[\s\S]*?companyName[^>]*>([^<]+)[\s\S]*?companyLocation[^>]*>([^<]+)/g;

    let match;
    while ((match = jobCardPattern.exec(snapshot)) !== null) {
      const [, externalId, title, company, location] = match;
      jobs.push({
        externalId,
        title: title.trim(),
        company: company.trim(),
        location: location.trim(),
        url: `https://www.indeed.com/viewjob?jk=${externalId}`,
      });
    }

    return jobs;
  },

  parseJobDetail(snapshot: string): Partial<RawJobListing> {
    const details: Partial<RawJobListing> = {};

    // Parse job description
    const descMatch = snapshot.match(
      /jobDescriptionText[^>]*>([\s\S]*?)<\/div>/i,
    );
    if (descMatch) {
      details.description = cleanHtml(descMatch[1]);
    }

    // Parse salary if present
    const salaryMatch = snapshot.match(
      /salary[^>]*>\s*\$?([\d,]+)\s*-?\s*\$?([\d,]+)?/i,
    );
    if (salaryMatch) {
      details.salaryMin = parseInt(salaryMatch[1].replace(/,/g, ""));
      if (salaryMatch[2]) {
        details.salaryMax = parseInt(salaryMatch[2].replace(/,/g, ""));
      }
    }

    // Parse requirements (often in bullet points)
    const requirementsMatch = snapshot.match(/<ul[^>]*>([\s\S]*?)<\/ul>/gi);
    if (requirementsMatch) {
      const requirements: string[] = [];
      for (const ul of requirementsMatch) {
        const items = ul.match(/<li[^>]*>([\s\S]*?)<\/li>/gi);
        if (items) {
          for (const item of items) {
            const text = cleanHtml(item);
            if (text.length > 10 && text.length < 200) {
              requirements.push(text);
            }
          }
        }
      }
      if (requirements.length > 0) {
        details.requirements = requirements.slice(0, 10);
      }
    }

    // Extract tech stack from description
    if (details.description) {
      details.techStack = extractTechStack(details.description);
    }

    return details;
  },

  canHandle(url: string): boolean {
    return url.includes("indeed.com");
  },

  parseApplicationForm(snapshot: string): ApplicationForm | null {
    const fields: ApplicationFormField[] = [];

    // Parse form fields
    // Indeed's "Apply Now" typically opens a modal with standard fields

    // Name field
    const nameMatch = snapshot.match(/name[^>]*type="text"[^>]*ref="([^"]+)"/i);
    if (nameMatch) {
      fields.push({
        id: nameMatch[1],
        type: "text",
        label: "Full Name",
        required: true,
      });
    }

    // Email field
    const emailMatch = snapshot.match(
      /email[^>]*type="email"[^>]*ref="([^"]+)"/i,
    );
    if (emailMatch) {
      fields.push({
        id: emailMatch[1],
        type: "email",
        label: "Email",
        required: true,
      });
    }

    // Phone field
    const phoneMatch = snapshot.match(
      /phone[^>]*type="tel"[^>]*ref="([^"]+)"/i,
    );
    if (phoneMatch) {
      fields.push({
        id: phoneMatch[1],
        type: "phone",
        label: "Phone",
        required: false,
      });
    }

    // Resume upload
    const resumeMatch = snapshot.match(
      /resume[^>]*type="file"[^>]*ref="([^"]+)"/i,
    );
    if (resumeMatch) {
      fields.push({
        id: resumeMatch[1],
        type: "file",
        label: "Resume",
        required: true,
      });
    }

    // Cover letter (usually textarea)
    const coverMatch = snapshot.match(/cover[^>]*textarea[^>]*ref="([^"]+)"/i);
    if (coverMatch) {
      fields.push({
        id: coverMatch[1],
        type: "textarea",
        label: "Cover Letter",
        required: false,
      });
    }

    // Submit button
    const submitMatch = snapshot.match(/submit[^>]*button[^>]*ref="([^"]+)"/i);

    if (fields.length === 0) {
      return null;
    }

    return {
      url: "", // Would be extracted from current page
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

      switch (field.label.toLowerCase()) {
        case "full name":
        case "name":
          filled.value = data.contactInfo?.name ?? "";
          break;
        case "email":
          filled.value = data.contactInfo?.email ?? "";
          break;
        case "phone":
          filled.value = data.contactInfo?.phone ?? "";
          break;
        case "cover letter":
          filled.value = data.coverLetter ?? "";
          break;
        case "resume":
          filled.value = data.resume?.path ?? "";
          break;
        default:
          // Check custom answers
          if (data.answers && data.answers[field.id]) {
            filled.value = data.answers[field.id];
          }
      }

      return filled;
    });
  },
};

/**
 * Clean HTML content to plain text.
 */
function cleanHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extract tech stack keywords from job description.
 */
function extractTechStack(description: string): string[] {
  const techKeywords = [
    // Languages
    "JavaScript",
    "TypeScript",
    "Python",
    "Java",
    "C++",
    "C#",
    "Go",
    "Rust",
    "Ruby",
    "PHP",
    "Swift",
    "Kotlin",
    "Scala",
    // Frontend
    "React",
    "Vue",
    "Angular",
    "Next.js",
    "Svelte",
    "HTML",
    "CSS",
    "Tailwind",
    // Backend
    "Node.js",
    "Express",
    "Django",
    "Flask",
    "Spring",
    "Rails",
    "FastAPI",
    ".NET",
    // Databases
    "PostgreSQL",
    "MySQL",
    "MongoDB",
    "Redis",
    "Elasticsearch",
    "DynamoDB",
    "SQLite",
    // Cloud/DevOps
    "AWS",
    "Azure",
    "GCP",
    "Docker",
    "Kubernetes",
    "Terraform",
    "CI/CD",
    "Jenkins",
    // Other
    "GraphQL",
    "REST",
    "gRPC",
    "Kafka",
    "RabbitMQ",
    "Git",
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
