# Mira — Privacy Policy

**Last updated:** May 2, 2026

Mira is a browser extension that auto-fills job application forms. This policy explains what data Mira collects, how it is stored, and your rights regarding that data.

---

## Summary

- All data stays on your device. Mira has **no servers, no accounts, no analytics, and no tracking**.
- Your profile data is stored locally in your browser's extension storage.
- Mira never transmits your personal information over the internet.
- You can delete all your data at any time.

---

## 1. Data We Collect

Mira stores only data you explicitly provide through the side panel interface:

**Personal Information**

- Name, email, phone number, mailing address, date of birth, pronouns

**Professional Information**

- Work experience (companies, titles, dates, descriptions)
- Education (schools, degrees, fields of study, GPA)
- Skills, certifications, languages
- LinkedIn, GitHub, portfolio URLs

**Work Preferences**

- Salary range, work authorization, sponsorship needs, relocation willingness, relocation-assistance needs, willingness to travel, work arrangement, earliest start date, notice period, visa type, security clearance, SMS-contact consent flag

**Equal Employment Opportunity (EEO) Data**

- Gender identity, transgender status, sexual orientation, race/ethnicity, veteran status, disability status

**Documents**

- Resume and cover letter files you upload (stored as base64-encoded data)

**Fill Feedback**

- If you flag a field as incorrectly filled, the field label, fill status, and page URL are stored locally for debugging purposes. A maximum of 200 feedback entries are retained.

**Answer Bank**

- Question and answer pairs you create for common application questions.

**Application History**

- A log of jobs you've filled (company, role, URL, ATS platform, fill statistics, timestamp). Capped at 1,000 entries. You can delete individual entries or clear all history at any time.

---

## 2. How Data Is Stored

All data is stored in `chrome.storage.local`, a sandboxed storage area provided by the browser. This means:

- **Data never leaves your device.** There are no network requests, no cloud sync, no remote servers.
- **Other extensions cannot read your data.** Chrome/Brave isolates each extension's storage.
- **Websites cannot access your data.** The stored profile is only accessible to Mira's own code.

**Storage disclosure:** Your data is stored locally without encryption. It is protected by the browser's built-in extension storage isolation. If your device is compromised by malware or unauthorized physical access, locally stored data could potentially be exposed — the same risk that applies to your browser's saved passwords, cookies, and autofill data.

---

## 3. How Data Is Used

Your profile data is used for one purpose: **filling job application forms when you trigger a fill** — via the Fill button in the side panel, the right-click context menu ("Mira: Auto-fill"), or the keyboard shortcut (Ctrl+Shift+F).

Specifically:

- When you trigger a fill, your profile is converted to a flat map of field categories and values.
- The content script is injected on demand (only when you fill) and scans the current page for form fields, matching them to your profile.
- Matched fields are filled with your stored values.
- An ML model (running locally in your browser) classifies unrecognized fields. This model runs entirely offline — no data is sent to any server.

Mira does **not**:

- Track which job applications you fill or submit
- Record which websites you visit
- Send any data to remote servers, APIs, or third parties
- Use analytics, telemetry, or crash reporting services
- Display advertisements
- Sell, share, or license your data to anyone

---

## 4. Onboarding & Demo Profile

When you first install Mira (or replay the walkthrough from Settings), an onboarding tab opens with a sample candidate ("Mira Lewandowski") so you can try autofill before building your real profile. This sample profile is hardcoded into the extension and lives only in the onboarding tab's memory — it is never written to storage and disappears when the tab closes. If you choose to upload a resume or cover letter during the onboarding walkthrough, those files are saved to your real profile's document storage so they remain available after onboarding ends. No other onboarding state persists.

## 5. ML Model

Mira includes a machine learning model (~38 MB, DeBERTa-v3-xsmall) for classifying form fields and scoring option matches. This model:

- Runs entirely in your browser via an offscreen document
- Uses WebAssembly (WASM) for inference via ONNX Runtime
- Is loaded from the extension's bundled files, not downloaded from the internet
- Does not transmit any data externally
- Is unloaded from memory after five minutes of inactivity (via `chrome.alarms`) to free WASM memory; reloaded automatically on the next fill

---

## 6. Permissions

Mira requests the following browser permissions:

| Permission                     | Why                                                                                                                                                  |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `activeTab` / `tabs`           | To identify the current tab and send fill commands                                                                                                   |
| `sidePanel`                    | To display the profile editor in the browser side panel                                                                                              |
| `storage` / `unlimitedStorage` | To store your profile, presets, and uploaded files locally                                                                                           |
| `offscreen`                    | To run the ML model in an isolated background document                                                                                               |
| `scripting`                    | To inject the content script that detects and fills form fields                                                                                      |
| `webNavigation`                | To fill forms inside iframes (e.g., embedded ATS forms)                                                                                              |
| `contextMenus`                 | To register the right-click "Mira: Auto-fill" item; sub-items appear when multiple presets exist                                                     |
| `alarms`                       | To unload the ML model from memory after 5 minutes of inactivity                                                                                     |
| `<all_urls>` (host)            | To run on any job application site. The content script only activates when you click Fill — it does not run automatically or collect data passively. |

---

## 7. Data Retention

- Your data is stored indefinitely until you delete it.
- Uninstalling Mira removes all locally stored data.
- You can clear specific data categories through the Settings panel (gear icon in the footer): "Clear application history", "Clear answer bank", or "Delete all data" (removes profiles, files, history, settings, and answer bank). Individual presets, profile fields, and uploaded files can also be removed from the side panel.

---

## 8. Your Rights

You have full control over your data:

- **Access:** All your data is visible in the Mira side panel at any time.
- **Edit:** You can modify any field in your profile at any time.
- **Delete:** You can delete individual entries, presets, files, answer bank entries, or application history. The Settings panel provides one-click options to clear each category or delete everything. Uninstalling the extension also removes all data.
- **Export:** You can export your active profile as JSON from the side panel header.
- **Portability:** Your data is stored as JSON in browser storage and can be exported via the profile export button or, if needed, through browser developer tools.

---

## 9. Children's Privacy

Mira is not directed at children under 13. We do not knowingly collect data from children.

---

## 10. Changes to This Policy

If this policy changes, the updated version will be included with the extension update and the "Last updated" date will be revised.

---

## 11. Contact

For questions about this privacy policy or Mira's data practices, open an issue on the project's GitHub repository.
