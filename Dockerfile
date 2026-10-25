FROM node:22-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS browser
ARG CHROME_VERSION=156.0.8078.47
ARG TARGETARCH
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl unzip \
    && case "$TARGETARCH" in amd64) chrome_platform=linux64 ;; arm64) chrome_platform=linux-arm64 ;; *) exit 1 ;; esac \
    && curl -fSL "https://storage.googleapis.com/chrome-for-testing-public/${CHROME_VERSION}/${chrome_platform}/chrome-headless-shell-${chrome_platform}.zip" -o /tmp/chrome.zip \
    && unzip -q /tmp/chrome.zip -d /opt \
    && mv "/opt/chrome-headless-shell-${chrome_platform}" /opt/chrome \
    && rm /tmp/chrome.zip

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 HOSTNAME=0.0.0.0 SITE_STORE=postgres \
    SITECRAFT_DATA_ROOT=/app/data CHROME_PATH=/opt/chrome/chrome-headless-shell
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates fonts-liberation fonts-noto-cjk libasound2 libatk-bridge2.0-0 libatk1.0-0 \
    libcairo2 libcups2 libdbus-1-3 libdrm2 libexpat1 libgbm1 libglib2.0-0 libgtk-3-0 \
    libnspr4 libnss3 libpango-1.0-0 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 \
    libxdamage1 libxext6 libxfixes3 libxkbcommon0 libxrandr2 \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /app/data && chown node:node /app/data
COPY --from=browser /opt/chrome /opt/chrome
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/skills ./skills
COPY lib/code-site-browser.ts lib/code-check-diagnostics.ts ./lib/
COPY deploy/docker/check-chrome.mjs deploy/docker/entrypoint.sh ./deploy/docker/
USER node
EXPOSE 3000
ENTRYPOINT ["sh", "deploy/docker/entrypoint.sh"]
CMD ["node", "server.js"]
