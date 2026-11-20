const publications=[
 ["SocialBeta","中文 · 品牌营销","查联名双方、上线日期和活动形式，适合跟进刚发生的品牌动作。","https://socialbeta.com/find"],
 ["数英 DIGITALING","中文 · 广告案例","看品牌与代理商提交的完整项目，了解一支广告从创意到执行的过程。","https://www.digitaling.com/"],
 ["TOPYS 顶尖文案","中文 · 创意与文化","看展览、装置和品牌空间，寻找线下体验的创意参照。","https://www.topys.cn/"],
 ["Foodaily 每日食品","中文 · 食品饮料","追踪饮料、零食和餐饮新品，关注口味、包装和上架渠道。","https://www.foodaily.com/"],
 ["Marketing Dive","英文 · 营销策略","看国际消费品牌如何设计广告活动、安排媒体投放和选择合作方。","https://www.marketingdive.com/"],
 ["Retail Dive","英文 · 零售渠道","跟进门店开闭、零售商合作和会员策略，观察品牌怎样触达消费者。","https://www.retaildive.com/"],
 ["Dieline","英文 · 包装设计","用实物图对照包装改版，追溯设计方和品牌想传达的变化。","https://thedieline.com/"],
 ["Sprudge","英文 · 咖啡文化","从咖啡馆、烘焙商和产地故事入手，观察精品咖啡里的新产品与新场景。","https://sprudge.com/category/news"],
 ["Modern Retail","英文 · 消费与零售","跟踪新消费品牌的增长、渠道选择和与大型商超的合作。","https://www.modernretail.co/"],
 ["Licensing Magazine","英文 · IP 授权","核对娱乐、动漫和游戏 IP 的授权方、合作品牌和商品品类。","https://www.licensingmagazine.com/"]
];
export default function ReadingSites(){
 return <section><header className="mb-5"><h1 className="text-3xl font-bold">值得阅读</h1><p className="mt-2 text-sm text-ink-3">10 家关注消费品牌与市场营销的新闻网站</p></header>
 <div className="grid gap-x-6 sm:grid-cols-2">{publications.map(([name,beat,note,url])=><article key={url} className="border-t border-line-soft py-4"><small className="text-ink-3">{beat}</small><h2 className="my-1 text-lg font-bold"><a href={url} target="_blank" rel="noreferrer">{name} ↗</a></h2><p className="text-sm text-ink-3">{note}</p></article>)}</div></section>;
}
