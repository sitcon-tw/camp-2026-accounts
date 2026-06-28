# Agent Maintenance Guide

This project implements the SITCON Camp 2026 pre-camp account setup flow for `accounts.sitcon.party`.

## Files

- `index.html`: Static frontend deployed at `https://accounts.sitcon.party/`.
- `Code.gs`: Google Apps Script backend. It reads/writes the Google Sheet and exchanges GitHub OAuth codes.
- `README.md`: Human-facing Traditional Chinese maintenance guide for SITCON staff.
- `AGENTS.md`: This file. Agent-facing maintenance instructions.

## Language and audience

- User-facing text must use Traditional Chinese as used in Taiwan.
- Avoid Simplified Chinese and PRC-specific wording.
- `README.md` is for SITCON staff and should stay in Traditional Chinese.
- `AGENTS.md` is for coding agents and should stay in English.
- Prefer "行前帳號設定" over "帳號綁定" in participant-facing copy. The participant does not need to understand backend binding terminology.
- Error messages shown to participants must describe what they can do next. Do not expose raw backend terms such as `token`, `OAuth code`, or implementation stack unless the message is explicitly for maintainers.

## Architecture

The frontend and final rendering happen on `accounts.sitcon.party`.

Google Apps Script is only used as a JSONP backend:

- `action=profile`: Validate token existence and return only non-sensitive participant confirmation data.
- `action=complete`: Validate token, Google credential, and GitHub OAuth code; write back account fields; return completion data including Telegram links.

Do not render the completion UI in Apps Script. Apps Script HTML rendering had poor mobile behavior and should not be used for the final page.

## Data model

The Google Sheet tab name must be:

```text
學員帳號
```

Column order is part of the contract and must not be changed without updating `Code.gs`:

```text
A 小隊
B 學員姓名
C 行前信接收 email
D token
E google account mail
F GitHub username
G Telegram 群組連結
H 營隊大群組連結
```

`profile` must never return Telegram group URLs. Group links are intentionally returned only after `complete` succeeds.

The participant email in column C is existing registration data. It is for internal matching only and must not be returned by `profile` or displayed in the frontend.

Tokens are participant-specific lookup secrets. They must be random, unique, and treated as private. Do not put real tokens in public docs, examples, commits, issue comments, or screenshots.

## Configuration model

Public client IDs may live in source:

- `GOOGLE_CLIENT_ID` in `Code.gs`
- `GITHUB_CLIENT_ID` in both `Code.gs` and `index.html`
- Google Sign-In `data-client_id` in `index.html`
- `APPS_SCRIPT_WEB_APP_URL` in `index.html`

Environment-specific or sensitive values must live in Apps Script Script Properties:

```text
SPREADSHEET_ID
GITHUB_CLIENT_SECRET
```

Do not reintroduce `GITHUB_CLIENT_SECRET` or the production Google Sheet ID as hard-coded constants in committed source.

## OAuth configuration

Google OAuth:

- Client type: Web application.
- Authorized JavaScript origin: `https://accounts.sitcon.party`.
- Do not include a path, trailing slash, or query string in the origin.

GitHub OAuth:

- Use an OAuth App, not a GitHub App.
- Homepage URL: `https://accounts.sitcon.party`
- Authorization callback URL: `https://accounts.sitcon.party/`
- No repo scope is required. The flow only needs the authenticated user's `login`.

## Apps Script deployment

The Apps Script Web App must be deployed as:

```text
Execute as: Me
Who has access: Anyone
```

When updating Apps Script, edit the existing deployment and select `New version`. Do not create a new deployment unless the frontend `APPS_SCRIPT_WEB_APP_URL` is also updated.

## Security constraints

- Never put `GITHUB_CLIENT_SECRET` in `index.html`.
- Never put `GITHUB_CLIENT_SECRET` in committed `Code.gs`; read it from Script Properties.
- Keep the Google Sheet ID in Script Properties unless there is an explicit governance decision to make it source-controlled.
- Never return participant contact email from `profile`.
- Never return Telegram group URLs from `profile`.
- Keep OAuth state validation in the frontend before calling `complete`.
- Keep Google ID token validation in Apps Script by checking `aud`, `iss`, `exp`, and `email_verified`.
- Keep JSONP callback validation in Apps Script using `isSafeJsonpCallback_`.
- Keep the GitHub OAuth request scope-free unless the workflow genuinely needs additional GitHub permissions.

## In-app browser handling

Many users open links from Gmail, LINE, Instagram, Facebook, or other embedded browsers. OAuth can fail in these contexts.

The frontend intentionally detects likely in-app browsers and blocks OAuth startup. It should show instructions to copy the link and open it in Safari or Chrome instead. Keep this behavior unless the entire auth architecture changes.

## Editing guidelines

- Keep this project dependency-free. It should remain a single static `index.html` plus Apps Script backend.
- Do not introduce build tools unless the deployment process is explicitly changed.
- Do not use `fetch()` to call Apps Script cross-origin; use the existing JSONP helper unless CORS is explicitly configured and tested.
- Keep mobile-first RWD behavior. The completion page must render on `accounts.sitcon.party`, not in Apps Script.
- Preserve GitHub button branding: dark button, GitHub mark, and `Continue with GitHub` wording.
- When adding reusable setup instructions, update `README.md` first and keep this file as agent-specific policy rather than a duplicate manual.
- When changing participant-facing wording, check the full flow: token entry, profile loading, Google step, GitHub step, completion page, in-app browser gate, and error states.
- When changing the Sheet columns, update `COLUMNS`, README contract, AGENTS contract, and manual test checklist together.

## Manual test checklist

1. Open `https://accounts.sitcon.party/?t=<valid-token>` in Safari/Chrome.
2. Confirm the participant team and name render correctly.
3. Confirm no Telegram URLs appear in the `profile` JSONP response.
4. Complete Google Sign-In.
5. Click `Continue with GitHub`.
6. Confirm GitHub redirects back to `https://accounts.sitcon.party/`.
7. Confirm `complete` writes Google email and GitHub username to Sheet columns E and F.
8. Confirm Telegram links appear only on the completion page.
9. Test an invalid token.
10. Test likely in-app browser user agents if possible.
11. Test empty Telegram link cells and confirm the completion page shows staff-notification fallback text.
12. Confirm no participant-facing error displays raw backend wording such as `token` for common invalid-link cases.
