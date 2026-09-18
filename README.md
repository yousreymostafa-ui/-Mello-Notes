# Mello Notes

A friendly, installable personal notes app for iPhone. Capture rough thoughts with iOS dictation, tidy them into clear notes, extract to-dos, and prepare reminders for Apple Calendar.

## What works

- Quick note capture with an iPhone-dictation shortcut
- Offline smart organization of rough notes
- Editable organized-note preview that always preserves the original wording
- Automatic to-do extraction
- Reminder date and time detection
- Apple Calendar `.ics` export
- Compact colour-coded note cards
- Notes, To-dos, and Later views
- Daily (default), Ocean, Grape, and Matcha themes
- Local-only storage plus JSON backup and restore
- Offline PWA installation

## Important privacy note

The current smart organizer runs inside the browser and sends no notes to an external AI service. A true generative-AI model requires a private server endpoint so an API key is never exposed in the public GitHub Pages code.

## Run locally

```bash
python3 -m http.server 8080
```

Open `http://localhost:8080`.

## Deploy

The included GitHub Actions workflow deploys the repository to GitHub Pages after each push to `main`. In the repository, open **Settings → Pages** and select **GitHub Actions** as the source.

## Install on iPhone

1. Open the GitHub Pages URL in Safari.
2. Tap **Share**.
3. Choose **Add to Home Screen**.
4. Open Mello from the new Home Screen icon.
