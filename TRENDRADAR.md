# TrendRadar integration

CUE downloads the complete upstream project at revision `86584f5544c66d4e22132f9b87c44a7ea3a32fea` (version 6.11.0), verifies the archive SHA-256, and runs its original `NewsAnalyzer` application. Upstream Python and generated HTML/CSS/JavaScript are not rewritten. The complete application runs on the collector. CUE exports its original SQLite news/RSS records and original ranking weights into the shared data payload, translates display text locally, and renders them with its own integrated cards, search and sidebar. The upstream HTML is kept as an internal diagnostic artifact; it is not embedded in the user interface. Project attribution and GPL-3.0 license are retained.

Upstream: https://github.com/sansan0/TrendRadar
Source revision: https://github.com/sansan0/TrendRadar/tree/86584f5544c66d4e22132f9b87c44a7ea3a32fea
License: https://github.com/sansan0/TrendRadar/blob/86584f5544c66d4e22132f9b87c44a7ea3a32fea/LICENSE

`scripts/run-trendradar-native.py` prepares deployment configuration, runs the original application and exports native storage records. Platform and enabled feed defaults are preserved and additional public feeds are added. AI models, translation APIs and notifications are disabled. The complete upstream tree, including optional AI/MCP modules, is installed; this website runs its free collection/report application, not an externally exposed MCP service.

GitHub Actions preserves upstream SQLite history with an Actions cache; the cloud container uses its persistent data volume. Native rank trajectories therefore reflect observed records and do not invent history before the first successful run.
