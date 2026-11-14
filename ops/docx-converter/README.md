# Jupiter Astrology DOCX-to-PDF converter

This is an optional, private conversion service for the Library's **DOCX → PDF** preview mode.

It runs Gotenberg 9, which uses LibreOffice to convert Word files to PDF. The browser never calls this service directly. Vercel calls it from the server-side `api/drive.js` route.

## Deploy

Deploy this folder to a host that supports Docker containers and provides a stable HTTPS URL.

Set these environment variables on the conversion host:

- `GOTENBERG_USERNAME`: a long, unique username.
- `GOTENBERG_PASSWORD`: a long, randomly generated password.

The Compose file enables Gotenberg Basic Authentication. Do not disable it when the service is reachable over the public internet.

Copy the sample environment file, replace both placeholders with strong unique values, and keep the real `.env` file on the converter host only:

    cp .env.example .env

Start the service with:

    docker compose up -d

The Gotenberg API listens on port `3000`. Your host or reverse proxy should expose it over HTTPS. Do not expose an unauthenticated port.

## Configure Vercel

In the Jupiter Astrology Vercel project, add these three **Secret** environment variables for Production (and Preview if you use preview deployments):

| Key | Value |
|---|---|
| `DOCX_PDF_CONVERTER_URL` | Base HTTPS URL of your deployed Gotenberg service, without a trailing slash |
| `DOCX_PDF_CONVERTER_USERNAME` | Same value as `GOTENBERG_USERNAME` |
| `DOCX_PDF_CONVERTER_PASSWORD` | Same value as `GOTENBERG_PASSWORD` |

Redeploy Jupiter Astrology after adding the variables.

## Test

Open a DOCX in Library and switch between **DOCX → HTML** and **DOCX → PDF**.

- DOCX → HTML runs in the browser with `docx-preview`.
- DOCX → PDF asks the Vercel backend to fetch the original file from the configured Library folder, convert it through Gotenberg/LibreOffice, and return a PDF to PDF.js.
- Converted PDFs are cached in the browser's IndexedDB cache for seven days, keyed by Drive file ID and modification time.

The conversion route accepts DOCX files and native Google Docs. It rejects file IDs outside the configured Library folder.

## Operational notes

- Use HTTPS for the Gotenberg endpoint.
- Keep Basic Authentication enabled.
- Keep conversion service credentials only in the converter host and Vercel environment variables. Never put them in `public/`, `Firebase.js`, or Git.
- Gotenberg/LibreOffice runs as a separate service. It is not installed in the Vercel function.
- Large or complex files may take longer to convert. The current server route has a 50 MB source DOCX limit and a 240-second outbound conversion timeout.
- The PDF rendering path uses PDF.js already included in the Library preview engine.
