FROM node:24-bookworm-slim
WORKDIR /app
COPY integrations/aihot integrations/aihot
COPY integrations/hot-monitor/setup-last30.mjs integrations/hot-monitor/setup-last30.mjs
COPY config/pulse-feeds.json config/pulse-feeds.json
COPY public/favicon.svg public/cue-logo.svg public/
RUN node integrations/aihot/prepare.mjs && npm --prefix .tools/aihot-upstream ci --no-audit --no-fund && node integrations/aihot/icons.mjs && npm --prefix .tools/aihot-upstream run build -w @aihot/web && mkdir -p /var/data/pulse && chown node:node /var/data/pulse
ENV AIHOT_DATA_DIR=/var/data/pulse DATA_DIR=/var/data/cue
USER node
CMD ["node","integrations/aihot/start.mjs"]
