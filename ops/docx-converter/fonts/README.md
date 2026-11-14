# Additional licensed fonts (private build input)

Place only `.ttf`, `.otf` or `.ttc` files here when you have the right to install them on this private conversion server.

- Do **not** commit commercial or Microsoft Office font files to GitHub.
- This directory is excluded from Git by `.gitignore`.
- Copy licensed font files into this directory on the machine that builds the converter image, then run `docker compose build --no-cache gotenberg` and `docker compose up -d`.
- The Dockerfile copies these files into `/usr/local/share/fonts/jupiter-custom/` and refreshes Fontconfig.
- For Microsoft fonts such as Arial, Times New Roman, Calibri, Cambria, Aptos, Segoe UI or other proprietary families, use only files covered by your applicable licence.

The converter image already includes common metric-compatible substitutes. Custom fonts are added so LibreOffice can use the actual family where your licence permits.
