# Jupiter Astrology DOCX-to-PDF converter

This is an optional, private conversion service for the Library's **DOCX → PDF** preview mode.

It runs Gotenberg 9, which uses LibreOffice to convert Word files to PDF. The browser never calls this service directly. Vercel calls it from the server-side `api/drive.js` route.

## Deploy

Deploy this folder to a host that supports Docker containers and provides a stable HTTPS URL.

Set these environment variables on the conversion host:

- `GOTENBERG_USERNAME`: a long, unique username.
- `GOTENBERG_PASSWORD`: a long, randomly generated password.

The Compose file enables Gotenberg Basic Authentication. Do not disable it when the service is reachable over the public internet.

## Included font coverage

The custom image installs a broad set of redistributable families on top of Gotenberg's built-in fonts (Carlito, Caladea, Liberation, DejaVu, Noto Core/CJK/Emoji and URW Base35).

The added collection includes:

- **Office-style and general sans:** Croscore, Open Sans, Roboto, Lato, Inter, Cantarell and Montserrat.
- **Serif and publishing:** EB Garamond, Linux Libertine, Gentium, Charis, Junicode and TeX Gyre.
- **Monospace:** Inconsolata, Fira Code and Noto Mono.
- **Unicode and symbols:** Noto Extra, Noto UI Core/Extra and DejaVu Extra.
- **Indian scripts:** Devanagari, Bengali/Assamese, Gujarati, Punjabi, Kannada, Malayalam, Odia, Tamil and Telugu families.
- **Other writing systems:** Arabic, Thai, Sinhala, Khmer and Myanmar, with Japanese/CJK coverage from Gotenberg's included Noto CJK fonts and IPA additions.

This is broad fallback coverage, not a guarantee that every Word font is identical. The image deliberately does not redistribute proprietary Microsoft/Adobe/commercial fonts. Where an original DOCX uses a licensed font that is not included, put its licensed `.ttf`, `.otf` or `.ttc` file into the private `fonts/` directory on the converter build machine. The Dockerfile installs those files and refreshes Fontconfig.

**This font pack affects DOCX → PDF conversion through LibreOffice.** The browser-only DOCX → HTML option uses fonts available to the visitor's browser; installing a font in this Docker image does not install it in every visitor's browser.

For the PDF route to use the new fonts, rebuild and redeploy the converter image after updating the repository:

    docker compose build --no-cache gotenberg
    docker compose up -d

The image writes its detected font-family list to `/usr/share/gotenberg/font-families.txt` for diagnostics.

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
