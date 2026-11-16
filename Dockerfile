FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
COPY package*.json ./
RUN npm ci --include=dev
ARG DEBIAN_MIRROR=deb.debian.org
RUN sed -i "s|http://deb.debian.org|http://${DEBIAN_MIRROR}|g" /etc/apt/sources.list.d/debian.sources \
    && printf 'Acquire::Retries "3";\nAcquire::http::Timeout "30";\nAcquire::https::Timeout "30";\n' > /etc/apt/apt.conf.d/80-cue-network \
    && apt-get update && apt-get install -y --no-install-recommends ca-certificates \
    && sed -i 's|http://|https://|g' /etc/apt/sources.list.d/debian.sources \
    && apt-get update && apt-get install -y --no-install-recommends chromium fonts-wqy-zenhei fonts-noto-color-emoji xvfb x11vnc novnc websockify openbox tini \
    && rm -rf /var/lib/apt/lists/*
COPY . .
RUN npm run build && npm run sources:install && mkdir -p /var/data/cue && chown -R node:node /app /var/data/cue && cp -a /root/.opencli /home/node/.opencli && chown -R node:node /home/node/.opencli
USER node
ENV HOST=0.0.0.0 PORT=4173 DATA_DIR=/var/data/cue PLATFORM_PROVIDER=selfhosted CLOUD_BROWSER_HEADLESS=false CLOUD_BROWSER_EXECUTABLE=/usr/bin/chromium DISPLAY=:99
EXPOSE 4173
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["bash", "deploy/start.sh"]
