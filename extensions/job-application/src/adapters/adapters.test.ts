/**
 * Tests for Job Site Adapters
 */

import { describe, it, expect } from "vitest";

import { indeedAdapter } from "./indeed.js";
import { linkedinAdapter } from "./linkedin.js";
import { greenhouseAdapter } from "./greenhouse.js";
import {
  getAdapter,
  findAdapterForUrl,
  getAvailableAdapters,
} from "./index.js";

describe("Indeed Adapter", () => {
  it("should build search URL with query", () => {
    const url = indeedAdapter.buildSearchUrl({ query: "Software Engineer" });

    expect(url).toContain("indeed.com/jobs");
    expect(url).toContain("q=Software+Engineer");
  });

  it("should build search URL with location", () => {
    const url = indeedAdapter.buildSearchUrl({
      query: "Developer",
      location: "San Francisco, CA",
    });

    expect(url).toContain("q=Developer");
    expect(url).toContain("l=San+Francisco");
  });

  it("should build search URL with remote filter", () => {
    const url = indeedAdapter.buildSearchUrl({
      query: "Engineer",
      remote: true,
    });

    expect(url).toContain("remotejob=");
  });

  it("should build search URL with salary filter", () => {
    const url = indeedAdapter.buildSearchUrl({
      query: "Engineer",
      salaryMin: 100000,
    });

    expect(url).toContain("salary=");
  });

  it("should detect Indeed URLs", () => {
    expect(
      indeedAdapter.canHandle("https://www.indeed.com/viewjob?jk=123"),
    ).toBe(true);
    expect(indeedAdapter.canHandle("https://indeed.com/jobs?q=test")).toBe(
      true,
    );
    expect(indeedAdapter.canHandle("https://linkedin.com/jobs")).toBe(false);
  });
});

describe("LinkedIn Adapter", () => {
  it("should build search URL with query", () => {
    const url = linkedinAdapter.buildSearchUrl({ query: "Software Engineer" });

    expect(url).toContain("linkedin.com/jobs/search");
    expect(url).toContain("keywords=Software+Engineer");
  });

  it("should build search URL with remote filter", () => {
    const url = linkedinAdapter.buildSearchUrl({
      query: "Developer",
      remote: true,
    });

    expect(url).toContain("f_WT=2");
  });

  it("should build search URL with time filter", () => {
    const urlDay = linkedinAdapter.buildSearchUrl({
      query: "Engineer",
      postedWithin: 1,
    });
    expect(urlDay).toContain("f_TPR=r86400");

    const urlWeek = linkedinAdapter.buildSearchUrl({
      query: "Engineer",
      postedWithin: 7,
    });
    expect(urlWeek).toContain("f_TPR=r604800");
  });

  it("should detect LinkedIn URLs", () => {
    expect(
      linkedinAdapter.canHandle("https://www.linkedin.com/jobs/view/123"),
    ).toBe(true);
    expect(linkedinAdapter.canHandle("https://linkedin.com/jobs/search")).toBe(
      true,
    );
    expect(linkedinAdapter.canHandle("https://indeed.com/jobs")).toBe(false);
  });
});

describe("Greenhouse Adapter", () => {
  it("should build search URL", () => {
    const url = greenhouseAdapter.buildSearchUrl({ query: "Engineer" });

    expect(url).toContain("greenhouse.io");
    expect(url).toContain("q=Engineer");
  });

  it("should detect Greenhouse URLs", () => {
    expect(
      greenhouseAdapter.canHandle("https://boards.greenhouse.io/company"),
    ).toBe(true);
    expect(greenhouseAdapter.canHandle("https://greenhouse.io/jobs")).toBe(
      true,
    );
    expect(greenhouseAdapter.canHandle("https://indeed.com/jobs")).toBe(false);
  });
});

describe("Adapter Registry", () => {
  it("should get adapter by source", () => {
    const indeed = getAdapter("indeed");
    expect(indeed.name).toBe("indeed");

    const linkedin = getAdapter("linkedin");
    expect(linkedin.name).toBe("linkedin");

    const greenhouse = getAdapter("greenhouse");
    expect(greenhouse.name).toBe("greenhouse");
  });

  it("should find adapter for URL", () => {
    const indeedAdapter = findAdapterForUrl(
      "https://www.indeed.com/viewjob?jk=123",
    );
    expect(indeedAdapter?.name).toBe("indeed");

    const linkedinAdapter = findAdapterForUrl(
      "https://linkedin.com/jobs/view/456",
    );
    expect(linkedinAdapter?.name).toBe("linkedin");

    const greenhouseAdapter = findAdapterForUrl(
      "https://boards.greenhouse.io/acme",
    );
    expect(greenhouseAdapter?.name).toBe("greenhouse");

    const unknown = findAdapterForUrl("https://random-site.com/jobs");
    expect(unknown).toBeNull();
  });

  it("should list available adapters", () => {
    const adapters = getAvailableAdapters();

    expect(adapters).toContain("indeed");
    expect(adapters).toContain("linkedin");
    expect(adapters).toContain("greenhouse");
  });
});

describe("Job Parsing", () => {
  it("should extract tech stack from description", () => {
    // Test via parseJobDetail which uses extractTechStack internally
    const mockSnapshot = `
      <div id="jobDescriptionText">
        We are looking for a developer with experience in:
        - TypeScript
        - React
        - Node.js
        - PostgreSQL
        - AWS
        - Docker
      </div>
    `;

    const details = indeedAdapter.parseJobDetail(mockSnapshot);

    expect(details.techStack).toBeDefined();
    expect(details.techStack).toContain("TypeScript");
    expect(details.techStack).toContain("React");
    expect(details.techStack).toContain("Node.js");
  });
});

describe("Application Form Handling", () => {
  it("should fill application form with contact info", () => {
    if (!indeedAdapter.fillApplicationForm) {
      return;
    }

    const form = {
      url: "https://indeed.com/apply",
      fields: [
        {
          id: "name",
          type: "text" as const,
          label: "Full Name",
          required: true,
        },
        { id: "email", type: "email" as const, label: "Email", required: true },
        {
          id: "phone",
          type: "phone" as const,
          label: "Phone",
          required: false,
        },
      ],
    };

    const filled = indeedAdapter.fillApplicationForm(form, {
      contactInfo: {
        name: "John Doe",
        email: "john@example.com",
        phone: "555-1234",
      },
    });

    expect(filled.find((f) => f.id === "name")?.value).toBe("John Doe");
    expect(filled.find((f) => f.id === "email")?.value).toBe(
      "john@example.com",
    );
    expect(filled.find((f) => f.id === "phone")?.value).toBe("555-1234");
  });
});
