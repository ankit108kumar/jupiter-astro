# Additional Licensed Fonts for the DOCX Converter

> Public documentation only. Never commit font binaries or other files unless you have the rights to redistribute them.

The private LibreOffice/Gotenberg converter can load additional font files at image-build time.

## Add fonts on the private converter build machine

1. Confirm that you have the right to install the font on this private conversion server.
2. Copy only licensed `.ttf`, `.otf` or `.ttc` files into `ops/docx-converter/fonts/` on the private build machine.
3. Do **not** commit commercial or Microsoft Office font files to GitHub.
4. Rebuild and restart the converter from `ops/docx-converter/`:

   ```bash
   docker compose build --no-cache gotenberg
   docker compose up -d
   ```

The Dockerfile copies these files into `/usr/local/share/fonts/jupiter-custom/` and refreshes Fontconfig.

For Microsoft fonts such as Arial, Times New Roman, Calibri, Cambria, Aptos, Segoe UI or other proprietary families, use only files covered by your applicable licence.

The converter image already includes common metric-compatible substitutes. Custom fonts are added so LibreOffice can use the actual family where your licence permits.

The build-input directory is excluded from Git by `ops/docx-converter/fonts/.gitignore`. Keep licensed binaries on the private build machine; this documentation does not distribute them.
