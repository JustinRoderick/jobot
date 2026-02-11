import { html, nothing } from "lit";

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

export type NotificationSettings = {
  channel?: string;
  dailySummary: boolean;
  newJobAlerts: boolean;
  emailResponseAlerts: boolean;
};

export type JobPreferencesProps = {
  loading: boolean;
  saving: boolean;
  preferences: JobPreferences;
  notifications: NotificationSettings;
  availableChannels: string[];
  error: string | null;
  success: string | null;
  onPreferencesChange: (prefs: Partial<JobPreferences>) => void;
  onNotificationsChange: (notifs: Partial<NotificationSettings>) => void;
  onSave: () => void;
  onReset: () => void;
};

export function renderJobPreferences(props: JobPreferencesProps) {
  return html`
    <section class="preferences-view">
      <div class="grid grid-cols-2">
        ${renderSearchPreferences(props)} ${renderNotificationSettings(props)}
      </div>

      <div class="card" style="margin-top: 16px;">
        <div
          class="row"
          style="justify-content: space-between; align-items: center;"
        >
          ${props.error
            ? html`<div class="callout danger">${props.error}</div>`
            : props.success
              ? html`<div class="callout success">${props.success}</div>`
              : html`<div></div>`}

          <div class="row" style="gap: 8px;">
            <button
              class="btn"
              ?disabled=${props.loading || props.saving}
              @click=${props.onReset}
            >
              Reset
            </button>
            <button
              class="btn primary"
              ?disabled=${props.loading || props.saving}
              @click=${props.onSave}
            >
              ${props.saving ? "Saving…" : "Save Preferences"}
            </button>
          </div>
        </div>
      </div>
    </section>
  `;
}

function renderSearchPreferences(props: JobPreferencesProps) {
  const { preferences } = props;

  return html`
    <div class="card">
      <div class="card-title">Search Preferences</div>
      <div class="card-sub">Configure what types of jobs to search for</div>

      <div class="form-grid" style="margin-top: 16px;">
        <label class="field">
          <span>Job Titles</span>
          <textarea
            placeholder="Software Engineer&#10;Full Stack Developer&#10;Backend Developer"
            .value=${preferences.titles.join("\n")}
            @input=${(e: Event) => {
              const value = (e.target as HTMLTextAreaElement).value;
              props.onPreferencesChange({
                titles: value.split("\n").filter((t) => t.trim()),
              });
            }}
            rows="3"
          ></textarea>
          <span class="hint">One title per line</span>
        </label>

        <label class="field">
          <span>Locations</span>
          <textarea
            placeholder="Remote&#10;San Francisco, CA&#10;New York, NY"
            .value=${preferences.locations.join("\n")}
            @input=${(e: Event) => {
              const value = (e.target as HTMLTextAreaElement).value;
              props.onPreferencesChange({
                locations: value.split("\n").filter((l) => l.trim()),
              });
            }}
            rows="3"
          ></textarea>
          <span class="hint">One location per line</span>
        </label>

        <label class="field">
          <span>Minimum Salary</span>
          <input
            type="number"
            placeholder="100000"
            .value=${preferences.salaryMin?.toString() ?? ""}
            @input=${(e: Event) => {
              const value = (e.target as HTMLInputElement).value;
              props.onPreferencesChange({
                salaryMin: value ? parseInt(value) : undefined,
              });
            }}
          />
        </label>

        <label class="field">
          <span>Maximum Salary</span>
          <input
            type="number"
            placeholder="200000"
            .value=${preferences.salaryMax?.toString() ?? ""}
            @input=${(e: Event) => {
              const value = (e.target as HTMLInputElement).value;
              props.onPreferencesChange({
                salaryMax: value ? parseInt(value) : undefined,
              });
            }}
          />
        </label>

        <label class="field checkbox">
          <span>Remote Only</span>
          <input
            type="checkbox"
            .checked=${preferences.remoteOnly}
            @change=${(e: Event) => {
              props.onPreferencesChange({
                remoteOnly: (e.target as HTMLInputElement).checked,
              });
            }}
          />
        </label>
      </div>

      <div class="form-grid" style="margin-top: 16px;">
        <label class="field">
          <span>Keywords to Include</span>
          <textarea
            placeholder="TypeScript&#10;React&#10;Node.js"
            .value=${preferences.keywords.join("\n")}
            @input=${(e: Event) => {
              const value = (e.target as HTMLTextAreaElement).value;
              props.onPreferencesChange({
                keywords: value.split("\n").filter((k) => k.trim()),
              });
            }}
            rows="3"
          ></textarea>
          <span class="hint">Jobs must contain at least one keyword</span>
        </label>

        <label class="field">
          <span>Keywords to Exclude</span>
          <textarea
            placeholder="Senior&#10;Manager&#10;Lead"
            .value=${preferences.excludeKeywords.join("\n")}
            @input=${(e: Event) => {
              const value = (e.target as HTMLTextAreaElement).value;
              props.onPreferencesChange({
                excludeKeywords: value.split("\n").filter((k) => k.trim()),
              });
            }}
            rows="3"
          ></textarea>
          <span class="hint">Jobs with these keywords will be hidden</span>
        </label>

        <label class="field" style="grid-column: span 2;">
          <span>Excluded Companies</span>
          <textarea
            placeholder="Company A&#10;Company B"
            .value=${preferences.excludeCompanies.join("\n")}
            @input=${(e: Event) => {
              const value = (e.target as HTMLTextAreaElement).value;
              props.onPreferencesChange({
                excludeCompanies: value.split("\n").filter((c) => c.trim()),
              });
            }}
            rows="2"
          ></textarea>
          <span class="hint">Jobs from these companies will be hidden</span>
        </label>
      </div>
    </div>
  `;
}

function renderNotificationSettings(props: JobPreferencesProps) {
  const { notifications, availableChannels } = props;

  return html`
    <div class="card">
      <div class="card-title">Notifications</div>
      <div class="card-sub">Configure how you receive job updates</div>

      <div class="form-grid" style="margin-top: 16px;">
        <label class="field">
          <span>Notification Channel</span>
          <select
            .value=${notifications.channel ?? ""}
            @change=${(e: Event) => {
              const value = (e.target as HTMLSelectElement).value;
              props.onNotificationsChange({
                channel: value || undefined,
              });
            }}
          >
            <option value="">Select a channel</option>
            ${availableChannels.map(
              (ch) => html`<option value=${ch}>${ch}</option>`,
            )}
          </select>
          <span class="hint">Where to send job alerts</span>
        </label>

        <div class="field-group">
          <label class="field checkbox">
            <input
              type="checkbox"
              .checked=${notifications.dailySummary}
              @change=${(e: Event) => {
                props.onNotificationsChange({
                  dailySummary: (e.target as HTMLInputElement).checked,
                });
              }}
            />
            <span>Daily Summary</span>
          </label>
          <span class="hint"
            >Receive a daily summary of job search activity</span
          >
        </div>

        <div class="field-group">
          <label class="field checkbox">
            <input
              type="checkbox"
              .checked=${notifications.newJobAlerts}
              @change=${(e: Event) => {
                props.onNotificationsChange({
                  newJobAlerts: (e.target as HTMLInputElement).checked,
                });
              }}
            />
            <span>New Job Alerts</span>
          </label>
          <span class="hint"
            >Get notified when new matching jobs are found</span
          >
        </div>

        <div class="field-group">
          <label class="field checkbox">
            <input
              type="checkbox"
              .checked=${notifications.emailResponseAlerts}
              @change=${(e: Event) => {
                props.onNotificationsChange({
                  emailResponseAlerts: (e.target as HTMLInputElement).checked,
                });
              }}
            />
            <span>Email Response Alerts</span>
          </label>
          <span class="hint"
            >Get notified when you receive responses from employers</span
          >
        </div>
      </div>

      <div class="callout info" style="margin-top: 16px;">
        <strong>Tip:</strong> Connect a messaging channel like iMessage or
        Telegram to receive real-time job alerts on your phone.
      </div>
    </div>
  `;
}
