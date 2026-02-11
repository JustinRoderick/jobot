/**
 * Resumes Management View
 *
 * Upload, manage, and preview resumes for job applications.
 */

import { html, nothing } from "lit";

export type Resume = {
  id: string;
  name: string;
  filePath: string;
  fileType: string;
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
  experience?: Array<{
    company: string;
    title: string;
    startDate?: string;
    endDate?: string;
    description?: string;
  }>;
  education?: Array<{
    institution: string;
    degree: string;
    field?: string;
    graduationDate?: string;
  }>;
};

export type ResumesProps = {
  loading: boolean;
  resumes: Resume[];
  error: string | null;
  selectedResume: Resume | null;
  uploadProgress: number | null;
  onRefresh: () => void;
  onSelectResume: (resume: Resume | null) => void;
  onSetDefault: (resumeId: string) => void;
  onDelete: (resumeId: string) => void;
  onUpload: (file: File) => void;
};

export function renderResumes(props: ResumesProps) {
  return html`
    <section class="resumes-view">
      <div class="card">
        <div
          class="row"
          style="justify-content: space-between; align-items: center;"
        >
          <div>
            <div class="card-title">Resumes</div>
            <div class="card-sub">
              Manage your resume versions for job applications
            </div>
          </div>
          <button
            class="btn"
            ?disabled=${props.loading}
            @click=${props.onRefresh}
          >
            ${props.loading ? "Loading…" : "Refresh"}
          </button>
        </div>

        ${props.error
          ? html`<div class="callout danger" style="margin-top: 12px;">
              ${props.error}
            </div>`
          : nothing}

        <div class="resumes-content" style="margin-top: 16px;">
          <div class="resumes-grid">
            ${renderUploadCard(props)}
            ${props.resumes.map((resume) => renderResumeCard(resume, props))}
          </div>
        </div>
      </div>

      ${props.selectedResume ? renderResumeDetail(props) : nothing}
    </section>
  `;
}

function renderUploadCard(props: ResumesProps) {
  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer?.files[0];
    if (file) props.onUpload(file);
  };

  const handleFileInput = (e: Event) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) props.onUpload(file);
  };

  return html`
    <div
      class="resume-upload-card"
      @dragover=${(e: DragEvent) => e.preventDefault()}
      @drop=${handleDrop}
    >
      ${props.uploadProgress !== null
        ? html`
            <div class="upload-progress">
              <div
                class="progress-bar"
                style="width: ${props.uploadProgress}%"
              ></div>
              <span>Uploading... ${props.uploadProgress}%</span>
            </div>
          `
        : html`
            <div class="upload-content">
              <div class="upload-icon">+</div>
              <div class="upload-text">Upload Resume</div>
              <div class="upload-hint">PDF, DOCX, or TXT</div>
              <input
                type="file"
                accept=".pdf,.docx,.txt"
                class="file-input"
                @change=${handleFileInput}
              />
            </div>
          `}
    </div>
  `;
}

function renderResumeCard(resume: Resume, props: ResumesProps) {
  const isSelected = props.selectedResume?.id === resume.id;

  return html`
    <div
      class="resume-card ${isSelected ? "selected" : ""} ${resume.isDefault
        ? "default"
        : ""}"
      @click=${() => props.onSelectResume(isSelected ? null : resume)}
    >
      ${resume.isDefault
        ? html`<div class="default-badge">Default</div>`
        : nothing}

      <div class="resume-icon">${getFileIcon(resume.fileType)}</div>
      <div class="resume-name">${resume.name}</div>
      <div class="resume-type">${resume.fileType.toUpperCase()}</div>

      ${resume.parsedData?.skills
        ? html`
            <div class="resume-skills">
              ${resume.parsedData.skills
                .slice(0, 3)
                .map((skill) => html`<span class="skill-tag">${skill}</span>`)}
              ${resume.parsedData.skills.length > 3
                ? html`<span class="skill-tag more">
                    +${resume.parsedData.skills.length - 3}
                  </span>`
                : nothing}
            </div>
          `
        : nothing}

      <div class="resume-date">
        Added ${new Date(resume.createdAt).toLocaleDateString()}
      </div>
    </div>
  `;
}

function renderResumeDetail(props: ResumesProps) {
  const resume = props.selectedResume!;
  const parsed = resume.parsedData;

  return html`
    <div class="modal-overlay" @click=${() => props.onSelectResume(null)}>
      <div
        class="modal resume-modal"
        @click=${(e: Event) => e.stopPropagation()}
      >
        <div class="modal-header">
          <h2>${resume.name}</h2>
          <button class="btn-close" @click=${() => props.onSelectResume(null)}>
            ×
          </button>
        </div>

        <div class="modal-body">
          <div class="resume-info">
            <div class="info-row">
              <span class="label">File Type:</span>
              <span>${resume.fileType.toUpperCase()}</span>
            </div>
            <div class="info-row">
              <span class="label">Added:</span>
              <span>${new Date(resume.createdAt).toLocaleDateString()}</span>
            </div>
            <div class="info-row">
              <span class="label">Default:</span>
              <span>${resume.isDefault ? "Yes" : "No"}</span>
            </div>
          </div>

          ${parsed
            ? html`
                <div class="parsed-resume">
                  <h3>Extracted Information</h3>

                  ${parsed.fullName || parsed.email || parsed.phone
                    ? html`
                        <div class="section contact-info">
                          <h4>Contact</h4>
                          ${parsed.fullName
                            ? html`<div class="contact-name">
                                ${parsed.fullName}
                              </div>`
                            : nothing}
                          ${parsed.email
                            ? html`<div class="contact-item">
                                ${parsed.email}
                              </div>`
                            : nothing}
                          ${parsed.phone
                            ? html`<div class="contact-item">
                                ${parsed.phone}
                              </div>`
                            : nothing}
                          ${parsed.location
                            ? html`<div class="contact-item">
                                ${parsed.location}
                              </div>`
                            : nothing}
                        </div>
                      `
                    : nothing}
                  ${parsed.summary
                    ? html`
                        <div class="section">
                          <h4>Summary</h4>
                          <p>${parsed.summary}</p>
                        </div>
                      `
                    : nothing}
                  ${parsed.skills && parsed.skills.length > 0
                    ? html`
                        <div class="section">
                          <h4>Skills</h4>
                          <div class="skills-list">
                            ${parsed.skills.map(
                              (skill) =>
                                html`<span class="skill-tag">${skill}</span>`,
                            )}
                          </div>
                        </div>
                      `
                    : nothing}
                  ${parsed.experience && parsed.experience.length > 0
                    ? html`
                        <div class="section">
                          <h4>Experience</h4>
                          ${parsed.experience.map(
                            (exp) => html`
                              <div class="experience-item">
                                <div class="exp-title">${exp.title}</div>
                                <div class="exp-company">${exp.company}</div>
                                <div class="exp-dates">
                                  ${exp.startDate} - ${exp.endDate ?? "Present"}
                                </div>
                                ${exp.description
                                  ? html`<div class="exp-desc">
                                      ${exp.description}
                                    </div>`
                                  : nothing}
                              </div>
                            `,
                          )}
                        </div>
                      `
                    : nothing}
                  ${parsed.education && parsed.education.length > 0
                    ? html`
                        <div class="section">
                          <h4>Education</h4>
                          ${parsed.education.map(
                            (edu) => html`
                              <div class="education-item">
                                <div class="edu-degree">
                                  ${edu.degree}${edu.field
                                    ? ` in ${edu.field}`
                                    : ""}
                                </div>
                                <div class="edu-institution">
                                  ${edu.institution}
                                </div>
                                ${edu.graduationDate
                                  ? html`<div class="edu-date">
                                      ${edu.graduationDate}
                                    </div>`
                                  : nothing}
                              </div>
                            `,
                          )}
                        </div>
                      `
                    : nothing}
                </div>
              `
            : html`
                <div class="callout info">
                  Resume content has not been parsed yet. Use the CLI to parse
                  this resume.
                </div>
              `}
        </div>

        <div class="modal-footer">
          ${!resume.isDefault
            ? html`
                <button
                  class="btn primary"
                  @click=${() => props.onSetDefault(resume.id)}
                >
                  Set as Default
                </button>
              `
            : nothing}
          <button class="btn danger" @click=${() => props.onDelete(resume.id)}>
            Delete
          </button>
          <button class="btn" @click=${() => props.onSelectResume(null)}>
            Close
          </button>
        </div>
      </div>
    </div>
  `;
}

function getFileIcon(fileType: string): string {
  switch (fileType.toLowerCase()) {
    case "pdf":
      return "📄";
    case "docx":
      return "📝";
    case "txt":
      return "📃";
    default:
      return "📎";
  }
}
