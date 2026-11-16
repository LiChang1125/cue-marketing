FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
COPY package*.json ./
RUN npm ci --include=dev && npx playwright install --with-deps chromium
RUN apt-get update && apt-get install -y --no-install-recommends xvfb x11vnc novnc websockify openbox tini && rm -rf /var/lib/apt/lists/*
COPY . .
RUN npm run build && npm run sources:install && mkdir -p /var/data/cue && chown -R node:node /app /var/data/cue /ms-playwright && cp -a /root/.opencli /home/node/.opencli && chown -R node:node /home/node/.opencli
USER node
ENV HOST=0.0.0.0 PORT=4173 DATA_DIR=/var/data/cue PLATFORM_PROVIDER=selfhosted CLOUD_BROWSER_HEADLESS=false DISPLAY=:99
EXPOSE 4173
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["bash", "deploy/start.sh"]
