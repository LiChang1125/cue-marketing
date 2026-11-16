# CUE 只读平台适配器

在项目根目录运行 `npm run sources:install`。命令将本目录注册到当前用户的 OpenCLI 插件目录，不包含或复制平台登录信息。保持 Chrome 打开、OpenCLI 扩展连接并登录对应平台。

| 命令 | 用途 |
| --- | --- |
| `npx opencli zhichao xiaohongshu-search 香水 --limit 30` | 保留笔记搜索结果中的原封面 |
| `npx opencli zhichao weibo-search 品牌联名 --limit 30` | 保留微博正文中的配图，不取头像 |
| `npx opencli zhichao weibo-hot --limit 20` | 读取微博热搜公开页面 |
| `npx opencli zhichao bilibili-search 香水 --limit 30 --page 1 --order pubdate` | 按发布时间检索 B站，保留原始日期、封面、播放指标 |
| `npx opencli zhichao zhihu-search 香水 --limit 30` | 分页检索知乎，保留原始创建时间与可用封面 |

本目录依赖根目录 node_modules 中的 OpenCLI 2.0.3。不要单独复制适配器而遗漏依赖。`npm ci` 使用根目录锁定版本。

bilibili-search.js、zhihu-search.js、xiaohongshu-search.js、weibo-search.js 改编自 jackwener/OpenCLI 2.0.3 的对应适配器（Apache-2.0），保留上游请求与校验逻辑；本项目修改站点注册名、导入路径，分别加入按发布时间排序和原始日期/图片字段。小红书、微博只扩展原有 DOM 返回字段以保留正文封面，沿用上游登录、验证和失败处理。许可证保存在 LICENSE.opencli。微博适配器为本项目实现。
