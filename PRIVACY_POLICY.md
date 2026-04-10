# Mira — Privacy Policy

**Last updated:** April 10, 2026

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

- Salary range, work authorization, sponsorship needs, relocation willingness, work arrangement, notice period

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

Your profile data is used for one purpose: **filling job application forms when you click the Fill button.**

Specifically:

- When you click Fill, your profile is converted to a flat map of field categories and values.
- The content script scans the current page for form fields and matches them to your profile.
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

## 4. ML Model

Mira includes a machine learning model (~38 MB, DeBERTa-v3-xsmall) for classifying form fields and scoring option matches. This model:

- Runs entirely in your browser via an offscreen document
- Uses WebAssembly (WASM) for inference via ONNX Runtime
- Is loaded from the extension's bundled files, not downloaded from the internet
- Does not transmit any data externally
- Is unloaded from memory when you close the side panel

---

## 5. Permissions

Mira requests the following browser permissions:

| Permission                     | Why                                                                                                                                                  |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `activeTab` / `tabs`           | To identify the current tab and send fill commands                                                                                                   |
| `sidePanel`                    | To display the profile editor in the browser side panel                                                                                              |
| `storage` / `unlimitedStorage` | To store your profile, presets, and uploaded files locally                                                                                           |
| `offscreen`                    | To run the ML model in an isolated background document                                                                                               |
| `scripting`                    | To inject the content script that detects and fills form fields                                                                                      |
| `webNavigation`                | To fill forms inside iframes (e.g., embedded ATS forms)                                                                                              |
| `<all_urls>` (host)            | To run on any job application site. The content script only activates when you click Fill — it does not run automatically or collect data passively. |

---

## 6. Data Retention

- Your data is stored indefinitely until you delete it.
- Uninstalling Mira removes all locally stored data.
- You can manually delete all data using the "Clear feedback" option in the Fill Bar settings, or by removing individual presets, files, and answer bank entries through the side panel.

---

## 7. Your Rights

You have full control over your data:

- **Access:** All your data is visible in the Mira side panel at any time.
- **Edit:** You can modify any field in your profile at any time.
- **Delete:** You can delete individual entries, presets, files, or feedback. Uninstalling the extension removes all data.
- **Export:** You can export fill feedback as JSON from the Fill Bar settings menu.
- **Portability:** Your data is stored as JSON in browser storage and can be exported via browser developer tools if needed.

---

## 8. Children's Privacy

Mira is not directed at children under 13. We do not knowingly collect data from children.

---

## 9. Changes to This Policy

If this policy changes, the updated version will be included with the extension update and the "Last updated" date will be revised.

---

## 10. Contact

For questions about this privacy policy or Mira's data practices, open an issue on the project's GitHub repository.
