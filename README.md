# Mira

Chrome extension that auto-fills job applications. Supports Ashby, Greenhouse, Lever, and Workday.

Uses a fine-tuned DeBERTa-v3-xsmall model to classify form fields and match answers. Heuristic patterns handle the obvious stuff (name, email, phone), ML handles the rest (sponsorship, consent, EEO questions). Everything runs locally in your browser — no data leaves your machine.

## Install

### From Chrome Web Store

[Install Mira from the Chrome Web Store](https://chromewebstore.google.com/detail/nmanfejonnmcnldcpbjhcglbbhdglbpa)

### From GitHub Releases

1. Download the latest `mira-chrome.zip` from [Releases](https://github.com/hyunwoo312/mira/releases/latest)
2. Unzip the file
3. Go to `chrome://extensions` → enable Developer Mode
4. Click "Load unpacked" → select the unzipped folder
5. Open any job application and click the Mira icon in the sidebar

### From Source

```bash
pnpm install
pnpm build
```

Then load `.output/chrome-mv3/` as an unpacked extension in Chrome.

## How to Use

### Setting Up Your Profile

Open the Mira sidebar on any page. Fill in your information across the profile sections:

- **Personal** — name, email, phone, address, date of birth
- **Links** — LinkedIn, GitHub, portfolio, and additional URLs
- **Work Experience** — roles auto-sort by date; first entry defaults to "currently working"
- **Education** — schools and degrees, also sorted by date
- **Skills & Languages** — skills list and language proficiencies
- **Preferences** — salary range, work authorization, start date, work arrangement
- **EEO** — optional demographic info (gender, race, veteran status, etc.)
- **Documents** — upload resume and cover letter (per-preset)
- **Custom Questions** — save answers to common open-ended questions for reuse

Your profile auto-saves as you type.

### Filling Applications

1. Navigate to a job application page (Ashby, Greenhouse, Lever, or Workday)
2. Fill using any of these methods:
   - Click **Fill Application** in the Mira side panel
   - Right-click the page and select **Mira: Auto-fill**
   - Press **Ctrl+Shift+F** (Windows) or **Cmd+Shift+F** (Mac)
3. Mira scans the form, classifies each field, and fills them automatically
4. A floating overlay shows fill progress — expand the log for details

### Multiple Profiles

Use presets to maintain separate profiles (e.g., "SWE" and "PM"). Each preset has its own profile data and documents. Switch between them from the top bar.

### ML Model

The field classifier runs entirely in your browser via WebAssembly (ONNX Runtime). No data leaves your machine. The model loads on your first fill and unloads after 5 minutes of inactivity to save memory.

## Development

```bash
pnpm dev          # hot-reload dev server
pnpm build        # production build
pnpm test         # run tests
pnpm typecheck    # type check
pnpm lint         # lint
```

### ML Training

The training pipeline lives in `ml/`. See `ml/train_multitask.py` for the multi-task training script and `ml/export_multitask.py` for ONNX export with vocab trimming.

## License

MIT
