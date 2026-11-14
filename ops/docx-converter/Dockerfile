FROM gotenberg/gotenberg:9

# Gotenberg already ships with metric-compatible Office substitutes
# (Carlito, Caladea, Liberation), DejaVu, Noto Core/CJK/Emoji and URW Base35.
# Add broader, redistributable families and specialist script coverage.
USER root

RUN set -eux; \
    apt-get update -qq; \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
      fonts-croscore \
      fonts-open-sans \
      fonts-roboto \
      fonts-roboto-slab \
      fonts-lato \
      fonts-inter \
      fonts-cantarell \
      fonts-montserrat \
      fonts-freefont-ttf \
      fonts-linuxlibertine \
      fonts-ebgaramond \
      fonts-ebgaramond-extra \
      fonts-sil-gentiumplus \
      fonts-inconsolata \
      fonts-firacode \
      fonts-noto-mono \
      fonts-deva \
      fonts-lohit-beng-assamese \
      fonts-lohit-beng-bengali \
      fonts-lohit-gujr \
      fonts-lohit-guru \
      fonts-lohit-knda \
      fonts-lohit-mlym \
      fonts-lohit-orya \
      fonts-lohit-taml \
      fonts-lohit-telu \
      fonts-hosny-amiri \
      fonts-thai-tlwg \
      fonts-lklug-sinhala \
      fonts-khmeros \
      fonts-sil-padauk; \
    rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

# Optional customer-supplied fonts are added at build time from ./fonts.
# Keep commercial fonts out of Git; copy only fonts you are licensed to use
# into ops/docx-converter/fonts on the private converter host.
COPY fonts/ /tmp/jupiter-custom-fonts/
RUN set -eux; \
    mkdir -p /usr/local/share/fonts/jupiter-custom; \
    find /tmp/jupiter-custom-fonts -type f \( -iname '*.ttf' -o -iname '*.otf' -o -iname '*.ttc' \) \
      -exec cp -t /usr/local/share/fonts/jupiter-custom/ {} +; \
    rm -rf /tmp/jupiter-custom-fonts; \
    fc-cache -f -v; \
    mkdir -p /usr/share/gotenberg; \
    fc-list : family | sort -u > /usr/share/gotenberg/font-families.txt

USER gotenberg
