# CUE 脉动

第三栏直接加载 AIHOT 原生精选首页，沿用桌面侧栏、移动底栏、按日时间线、热点榜、主题、品牌榜、营销日历及文章页。原生搜索框进入全部动态的搜索结果页，同时读取最近 30 天的品牌动作与公开讨论，附可核实的来源和原帖指标。PostgreSQL、发布 API 与 worker 在本机私有服务运行。静态 GitHub Pages 继续提供既有快照。

## 运行

使用 Node.js 24.22.1 或更新版本，准备独立 PostgreSQL 数据库及允许创建 pg_trgm 的数据库账号。项目根目录运行以下命令。

```sh
npm run pulse:prepare
npm --prefix .tools/aihot-upstream ci
node integrations/aihot/icons.mjs
npm --prefix .tools/aihot-upstream run build -w @aihot/web
npm run build
```

在服务端环境或私有环境文件设置 DATABASE_URL、ADMIN_PASSWORD、SESSION_SECRET、IMG_PROXY_SIGN_SECRET 和 DATA_DIR。DATA_DIR 指向 CUE 正在写入的目录。启动 `node --env-file=.env.pulse integrations/aihot/start.mjs` 和原有 CUE 主服务。默认 API 4389、行业网页 4390 均绑定回环地址。CUE 的 CUE_PULSE_WEB 可指定同机行业网页地址。公开代理仅提供读者路径，管理后台从内部进入。

启动器执行迁移和信源导入，每五分钟检查 CUE 的发布快照，导入有日期的品牌报道与营销摘要。CUE 已确认的精选沿用既有编辑决定，日期和标题相同的报道可确定性归到同一事件；同源转载只计一次。48 小时内至少两个独立来源后才进入原生热榜。平台互动属于具体帖子。每日编刊沿用原生日报排程。品牌资料的第一次导入可补当天的日报。模型预筛、两轮评分、基于语义的归组、周月报总结使用框架原生模型流程。免费预览在第三栏使用本地监督式文本分类器评估品牌营销选题契合度。有原生模型评分的文章沿用已有分值。分类器的训练样例及算法位于 overlay/apps/web/app/lib/brand-score.ts。

原版来自 [AIHOT](https://github.com/KKKKhazix/AIHOT/tree/88b114d7efbcdee17c3fc4d2e29c27672178e10a)。版本校验、营销行业配置、中文编辑规则和页面定制在本目录。检查从 .tools/aihot-upstream 运行 npm run typecheck、npm test、npm run build -w @aihot/web、npm run test:web 和 node scripts/smoke.ts --base http://127.0.0.1:4390。npm test 使用独立的 _test 或 _ci 数据库及测试内的本地模型替身。正式开放前审核条款和隐私文本；校准精选门槛需要团队标记的 100–200 条选稿样本。

Windows 回归测试需要 PostgreSQL 的 pg_dump、pg_restore 和 OpenSSL 可执行文件位于 PATH 中；将系统的 System32 放在 Git 的 usr/bin 前，以便 tar 正确读取含盘符的路径。测试数据库需使用独立的 _test 或 _ci 库，避免与正在运行的其他测试共用。

容器部署在原有 compose.free.yaml 上叠加 compose.pulse.yaml。使用同一 Compose 项目与原 CUE 数据卷。在私有环境指定 CUE_PG_PASSWORD、CUE_PULSE_DATABASE_URL（使用该密码，主机 pulse-db，用户和库名 cuepulse）、CUE_PULSE_ADMIN_PASSWORD、CUE_PULSE_SESSION_SECRET、CUE_PULSE_IMAGE_SECRET，随后运行 `docker compose -f compose.free.yaml -f compose.pulse.yaml up -d --build`。外部只走 CUE 登录入口。


## 选稿与统计

脉动跟踪消费品牌、授权 IP 和面向消费者的营销活动。重点覆盖餐饮茶咖、美妆香氛、服饰运动、零售、玩具、文化消费与生活方式。科技、互联网、AI 企业自身的产品、活动和经营动态排除。综合财经媒体、社交平台与创作者可以是报道渠道。判断依据是新闻主角和具体动作。

主服务每 15 分钟轮询公开订阅和出版方栏目，保留近 30 天原文。按域名统计本轮确实读到有日期且入选内容的来源。支持分页的订阅会补读历史页。每轮还从已出现的消费品牌出发，向新闻索引和营销媒体追查更多报道，分批轮换品牌并保存查得的文章。付费接口和平台账号均非依赖。

品牌榜按近七日事件统计，默认按报道域名数排序，至少四个域名；同一出版域名内多篇只算一个来源，已识别的同集团新闻分站合并计数，原文分别保留。事件归组比较时间、标题、品牌、动作、产品型号或活动名称。相似标题会有漏并或误并，展开事件可核看各来源原文。热点榜使用近 48 小时报道人次的衰减指数，同一身份按最近一次计分，24 小时减半。曲线按原文发布时间回算。平台公开的播放、评论、点赞保留各自单位。
