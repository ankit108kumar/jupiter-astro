# Jupiter Astrology DOCX Preview and Converter

> Public documentation. This guide contains setup instructions only; never add service credentials, private keys, tokens or licensed font binaries to this folder.

The Library supports two Word preview routes:

- **DOCX → HTML** renders in the visitor's browser with `docx-preview`.
- **DOCX → PDF** calls the private Gotenberg 9 service through the server-side Vercel route in `api/drive.js`. Gotenberg uses LibreOffice to convert Word files to PDF.

## 1. Deploy the private converter

The Docker deployment files remain in the repository at `ops/docx-converter/`. Deploy that folder to a host that supports Docker containers and provides a stable HTTPS URL.

Set these environment variables on the conversion host:

- `GOTENBERG_USERNAME`: a long, unique username.
- `GOTENBERG_PASSWORD`: a long, randomly generated password.

The Compose file enables Gotenberg Basic Authentication. Do not disable it when the service is reachable over the public internet.

From the repository root, run the following on the private converter host:

```bash
cd ops/docx-converter
cp .env.example .env
# Replace both placeholders in .env with strong unique values.
docker compose up -d
```

Keep the real `.env` file on the converter host only. Do not commit it.

The Gotenberg API listens on port `3000`. Your host or reverse proxy should expose it over HTTPS. Do not expose an unauthenticated port.

## 2. Included font coverage for DOCX → PDF

The custom image installs a broad set of redistributable families on top of Gotenberg's built-in fonts (Carlito, Caladea, Liberation, DejaVu, Noto Core/CJK/Emoji and URW Base35).

The added collection includes:

- **Office-style and general sans:** Croscore, Open Sans, Roboto, Lato, Inter, Cantarell and Montserrat.
- **Serif and publishing:** EB Garamond, Linux Libertine, Gentium, Charis, Junicode and TeX Gyre.
- **Monospace:** Inconsolata, Fira Code and Noto Mono.
- **Unicode and symbols:** Noto Extra, Noto UI Core/Extra and DejaVu Extra.
- **Indian scripts:** Devanagari, Bengali/Assamese, Gujarati, Punjabi, Kannada, Malayalam, Odia, Tamil and Telugu families.
- **Other writing systems:** Arabic, Thai, Sinhala, Khmer and Myanmar, with Japanese/CJK coverage from Gotenberg's included Noto CJK fonts and IPA additions.

This is broad fallback coverage, not a guarantee that every Word font is identical. The image deliberately does not redistribute proprietary Microsoft/Adobe/commercial fonts. Where an original DOCX uses a licensed font that is not included, place its licensed `.ttf`, `.otf` or `.ttc` file in `ops/docx-converter/fonts/` on the private converter build machine. Follow the separate [licensed-font guide](./DOCX-CONVERTER-LICENSED-FONTS.md). The Dockerfile installs those files and refreshes Fontconfig.

To rebuild after changing the image or adding fonts, run on the private converter host:

```bash
cd ops/docx-converter
docker compose build --no-cache gotenberg
docker compose up -d
```

The image writes its detected font-family list to `/usr/share/gotenberg/font-families.txt` for diagnostics.

## 3. Configure Vercel

In the Jupiter Astrology Vercel project, add these three **Secret** environment variables for Production (and Preview if you use preview deployments):

| Key | Value |
|---|---|
| `DOCX_PDF_CONVERTER_URL` | Base HTTPS URL of your deployed Gotenberg service, without a trailing slash |
| `DOCX_PDF_CONVERTER_USERNAME` | Same value as `GOTENBERG_USERNAME` |
| `DOCX_PDF_CONVERTER_PASSWORD` | Same value as `GOTENBERG_PASSWORD` |

Redeploy Jupiter Astrology after adding the variables.

## 4. Windows fonts for DOCX → HTML

DOCX → HTML is a separate browser-rendering path. On desktop Chrome/Edge, the **Use Windows fonts** control can request permission to read matching installed font faces, load their font bytes into temporary browser-only Blob URLs, and verify that the faces actually load.

Font bytes are not uploaded to Vercel or the converter. The feature requires a secure context, browser support and the user's explicit local-font permission; other browsers continue with their normal font fallback. This improves font fidelity when the exact family is installed, but does not make HTML rendering identical to Microsoft Word.

## 5. Test both routes

Open a DOCX in Library and switch between **DOCX → HTML** and **DOCX → PDF**.

- DOCX → HTML runs in the browser with `docx-preview`.
- DOCX → PDF asks the Vercel backend to fetch the original file from the configured Library folder, convert it through Gotenberg/LibreOffice, and return a PDF to PDF.js.
- Converted PDFs are cached in the browser's IndexedDB cache for seven days, keyed by Drive file ID and modification time.

The conversion route accepts DOCX files and native Google Docs. It rejects file IDs outside the configured Library folder.

## Operational and security notes

- Use HTTPS for the Gotenberg endpoint.
- Keep Basic Authentication enabled.
- Keep conversion service credentials only in the converter host and Vercel environment variables. Never put credentials in `public/`, `Firebase.js` or Git.
- Gotenberg/LibreOffice runs as a separate service. It is not installed in the Vercel function.
- Large or complex files may take longer to convert. The current server route has a 50 MB source DOCX limit and a 240-second outbound conversion timeout.
- The PDF rendering path uses PDF.js already included in the Library preview engine.
- This documentation is served from the Next.js `public/` directory and is therefore web-accessible. Do not add private operational values or credentials.
