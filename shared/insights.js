import {meaningfulContent} from './quality.js';
export const sectors = [
  {id:'brand',name:'品牌营销',eyebrow:'BRAND & CAMPAIGN'},
  {id:'ip',name:'IP 联名',eyebrow:'IP & COLLABORATION'},
  {id:'culture',name:'潮玩消费',eyebrow:'CULTURE & CONSUMPTION'}
];
export const directions = [
  {id:'scent',name:'香水与香氛',pattern:/香水|香氛|香薰|香调|perfume|fragrance/i},
  {id:'subculture',name:'亚文化与圈层',pattern:/亚文化|哥特|朋克|洛丽塔|lolita|二次元|痛包|谷子|谷店|漫展|同人|街头文化/i},
  {id:'collab',name:'联名与授权',pattern:/联名|跨界|授权|IP合作|IP联动/i},
  {id:'toys',name:'潮玩与收藏',pattern:/潮玩|盲盒|手办|公仔|泡泡玛特|泡泡马特|labubu|molly|收藏玩具/i},
  {id:'offline',name:'线下体验',pattern:/快闪|门店|开业|开店|展览|展会|体验店|酒店|体验馆/i},
  {id:'launch',name:'新品与限定',pattern:/新品|新系列|限定|首发|上市|推出|发售/i},
  {id:'ambassador',name:'代言与人物',pattern:/代言|品牌大使|主理人|明星|运动员/i},
  {id:'story',name:'内容与叙事',pattern:/短片|广告|叙事|纪录片|品牌故事|创意|企划|怀旧|复古/i},
  {id:'commerce',name:'电商与转化',pattern:/电商|带货|直播|种草|双11|双十一|小红书|抖音营销/i}
];
const aliases=[['香水','香氛','香薰','perfume','fragrance'],['亚文化','哥特','朋克','洛丽塔','lolita','二次元','街头文化'],['潮玩','盲盒','手办','公仔','labubu','泡泡玛特','泡泡马特'],['IP联名','品牌联名','跨界联名','联名','IP授权']];
export const contentText=item=>[item.title,item.excerpt].filter(Boolean).join(' ');
export function isMarketingCase(item){
  if(!meaningfulContent(item))return false;
  if(/现货补货|私信下单|代购接单|求购|出闲置|有路人|偶遇|代拍/.test(item.title))return false;
  return ['socialbeta','brandstar'].includes(item.source)||/品牌|营销|联名|广告|代言|新品|发售|快闪|发布|推出|市场|研究报告|消费趋势|消费经济|展览|展会|开业|IP授权|商业化/.test(item.title);
}
export function topicMatches(item,query){
  const word=String(query||'').trim().toLowerCase();if(!word)return false;
  const text=contentText(item).toLowerCase();
  const terms=aliases.find(group=>group.some(t=>t.toLowerCase()===word))||[word];
  return terms.some(term=>text.includes(term.toLowerCase()));
}
export const directionIds=item=>directions.filter(d=>d.pattern.test(contentText(item))).map(d=>d.id);
export function sectorId(item){
  if(item.categories?.includes('ip')||/联名|跨界|IP授权/i.test(item.title))return 'ip';
  if(item.categories?.includes('culture')||/潮玩|盲盒|手办|亚文化|谷子|二次元|朋克|哥特/i.test(item.title))return 'culture';
  return 'brand';
}
export function marketingLogic(item){
  const text=contentText(item);
  const rules=[
    [/联名|跨界|授权|IP联动/i,'联名共创','借用双方已有的识别符号，建立产品与圈层的连接。','可借鉴：把合作符号落到产品、包装和线下体验，形成同一套表达。'],
    [/香水|香氛|香薰/i,'感官场景','将气味、情绪和使用场景放在同一个故事里。','可借鉴：用生活场景描述香气，再结合试香体验承接兴趣。'],
    [/盲盒|潮玩|手办|公仔/i,'收藏与认同','围绕角色、系列和收藏兴趣组织内容。','可借鉴：关注角色设定、系列叙事与用户展示，避免只强调稀缺。'],
    [/亚文化|朋克|哥特|二次元|谷子|洛丽塔/i,'圈层共鸣','用圈层熟悉的审美与文化符号建立识别。','可借鉴：从具体社群的语言和场景出发，邀请创作者共同表达。'],
    [/快闪|展览|体验|门店|开业|酒店|列车|山海之窗/i,'空间体验','通过实体空间把品牌主张转成可参与的体验。','可借鉴：把主题、互动和产品体验串成完整的现场动线。'],
    [/听劝|爆改|二创|共创/i,'用户共创','将用户的创意或反馈转为品牌回应的素材。','可借鉴：围绕用户已有的表达开展互动，并展示品牌如何回应。'],
    [/代言|品牌大使|明星|运动员/i,'人物关联','将人物的表达或专业背景与品牌信息连接。','可借鉴：围绕人物与产品的具体关联展开内容。'],
    [/限定|新品|发售|上市|发布|推出/i,'产品话题','以产品变化或发售节点形成清晰的传播主题。','可借鉴：围绕一个明确卖点组织视觉、故事与体验。'],
    [/广告|短片|复古|故事|创意/i,'内容叙事','通过可识别的情节与视觉表达品牌信息。','可借鉴：提炼一个容易复述的情节，并与产品关联。']
  ];
  const rule=rules.find(([pattern])=>pattern.test(text));
  if(!rule)return {label:'待补充',reason:null,idea:null,evidence:null};
  const hit=text.match(rule[0])?.[0];
  return {label:rule[1],reason:rule[2],idea:rule[3],evidence:hit};
}
export function recentPublication(item,now=Date.now(),days=7){const at=Date.parse(item.publishedAt);return Number.isFinite(at)&&at<=now&&at>=now-days*86400000;}
export function uniqueCases(items){
  const seen=new Set();return items.filter(item=>{const key=String(item.title).replace(/[\s\p{P}]/gu,'').toLowerCase();const url=item.url?.split('?')[0];if(seen.has(key)||(url&&seen.has(url)))return false;seen.add(key);if(url)seen.add(url);return true;});
}
