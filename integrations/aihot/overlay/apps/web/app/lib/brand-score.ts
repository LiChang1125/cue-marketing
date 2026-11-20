// A small supervised text classifier for editorial fit. Each row is a labelled
// editorial example, not a news item. No score is used as an audience measurement.
const training = [
  ["品牌携手设计师推出联名系列", "品牌与动漫 IP 合作开出主题快闪店", "运动品牌发布限量新品并启动线下体验", "潮玩品牌联动游戏推出角色周边", "服饰品牌邀请新代言人出演广告片", "这家零售商在门店首发艺术家合作系列", "品牌发布全新视觉与广告战役", "饮料厂商赞助街舞赛事并推出限定包装", "球鞋品牌发布联乘配色", "文旅品牌联动动画举办主题展", "设计师发布春夏系列", "音乐节现场首发限定商品", "新合作帮助美妆品牌销售增长", "连锁餐饮品牌公开新品预售成绩", "品牌授权衍生品首批售罄", "两个厂牌共同发布胶囊系列", "品牌上线假日营销短片", "品牌旗舰店开业亮相", "消费者排队参与角色见面会", "潮流品牌推出节日企划"],
  ["这个词是什么意思", "百科知识与发展历史", "零基础入门教程", "网红明星私生活曝光", "今日股价大跌成交额换手率", "求职招聘最新报名通知", "会议强调深入贯彻学习", "选购指南低价优惠码", "品牌标志的定义与类型", "论文讨论文化现象的起源", "个人自拍写真合集", "同人作品绘制步骤", "盘点经典动漫角色", "课程培训广告报名", "无关标题内容为空", "品牌策划应该怎么写", "历届品牌联名汇总大全", "新品购买教程领券攻略", "数据采集基础知识解释", "粉丝搬运旧闻剪辑"],
] as const;
const concepts = [/品牌|厂牌|厂商|商家|零售|brand/i,/联名|联动|联乘|携手|合作|授权|collab/i,/新品|首发|推出|发布|上市|launch/i,/代言|营销|广告|赞助|传播|campaign/i,/线下|快闪|门店|开业|展览|主题店/i,/限定|限量|周边|系列|包装/i,/增长|销售|售罄|排队|预售/i,/指南|教程|攻略|怎么|百科|定义|历史/i,/股价|换手|成交额|招聘|会议|培训/i];
function features(text:string){
  const s=text.normalize("NFKC").toLowerCase().replace(/\s+/g,"").slice(0,240);
  const terms=new Set<string>();
  for(let i=0;i+1<s.length;i++)terms.add(s.slice(i,i+2));
  concepts.forEach((c,i)=>{if(c.test(s))terms.add("signal-"+i);});
  return terms;
}
const weights=new Map<string,number>();
const samples=training.flatMap((group,i)=>group.map(t=>({x:features(t),y:1-i})));
let bias=0;
for(let epoch=0;epoch<55;epoch++){
  const gradient=new Map<string,number>();let offset=0;
  for(const {x,y} of samples){
    const total=[...x].reduce((v,k)=>v+(weights.get(k)||0),bias);
    const diff=y-1/(1+Math.exp(-total));offset+=diff;
    for(const k of x)gradient.set(k,(gradient.get(k)||0)+diff);
  }
  bias+=offset/samples.length;
  for(const [k,v] of gradient)weights.set(k,(weights.get(k)||0)*0.985+v/samples.length);
}
export function brandScore(title:string,summary=""){
  const keys=[...features(title+" "+summary.slice(0,110))].filter(k=>weights.has(k));
  if(!keys.length)return null;
  return Math.round(100/(1+Math.exp(-keys.reduce((n,k)=>n+weights.get(k)!,bias))));
}
export function headlineParties(title:string){
  const ambassador=title.match(/^([\p{L}·]{2,10})成为\s*(.{2,26}?)(?:全新|首位|全球|中国区|品牌)?代言人/u);
  if(ambassador)return [ambassador[1]!,ambassador[2]!.trim()];
  const pair=title.match(/([\p{L}\d·＆&]{2,24})\s*(?:×|\s[xX]\s|携手)\s*(.+)/u);
  if(pair){
    const right=pair[2]!.split(/推出|发布|官宣|联名|打造|带来|亮相|共创|合作|开启|[，。,:：！｜「“《]|第[一二三四五六七八九十\d]+弹/)[0]?.trim()||"";
    return [pair[1]!,right].filter(n=>n.length>=2&&n.length<=28&&!/^(?:艺术家|设计师|品牌方|消费者|年轻人|多家品牌|媒体|品牌)$/.test(n));
  }
  return [];
}
