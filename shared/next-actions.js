const directions=[
 {name:'圈层身份与日常消费结合',pattern:/谷子|痛包|二次元|同人|cosplay|动漫周边|subculture|fandom/i,action:'先选一个圈层，测试可日常使用的小件周边；观察真实购买与复购意愿。'},
 {name:'IP 联名走向可参与的体验',pattern:/联名|跨界|collaborat|co.brand|crossover/i,action:'把合作做成一次可参与的体验，先用小范围活动验证受众重合度。'},
 {name:'香氛从产品转向情绪场景',pattern:/(香水|香氛|perfume|fragrance|scent).*(情绪|场景|记忆|疗愈|emotion|mood|memory)|(情绪|场景|记忆|疗愈|emotion|mood|memory).*(香水|香氛|perfume|fragrance|scent)/i,action:'围绕一个具体生活场景做试香测试，比较用户描述和实际选择。'},
 {name:'线下体验成为传播内容',pattern:/快闪|展览|体验店|主题店|pop.up|immersive|exhibition/i,action:'设计一个易拍、可参与的现场触点，用真实到场与自发分享检验效果。'},
 {name:'收藏欲带动小体量新品',pattern:/盲盒|潮玩|手办|收藏|限定|限量|collectible|limited.edition/i,action:'先验证收藏动机，再做小批量限定；关注售罄之外的复购和转售反馈。'},
 {name:'品牌叙事进入短剧与连续内容',pattern:/短剧|微短剧|microdrama|mini.drama|episodic/i,action:'先测试一条人物故事，比较完播、主动讨论与品牌记忆，再决定是否系列化。'},
 {name:'创作者与社群共同定义产品',pattern:/共创|创作者|社群|creator|co.creat|community/i,action:'邀请小规模核心用户共同试用，记录他们主动提出的改进和使用场景。'},
 {name:'文化元素进入当代生活方式',pattern:/国潮|新中式|非遗|东方美学|传统文化|heritage|chinoiserie/i,action:'选择一个有具体文化出处的元素，用设计与使用体验验证表达是否成立。'},
];
const ipNames=[['LABUBU',/labubu|拉布布/i],['星星人',/星星人|twinkle twinkle/i],['Chiikawa',/chiikawa|吉伊卡哇|吉伊川/i],['Loopy',/loopy|露比/i],['迪士尼',/迪士尼|disney/i],['三丽鸥',/三丽鸥|sanrio|hello kitty|库洛米|玉桂狗/i],['宝可梦',/宝可梦|pokemon|pokémon|皮卡丘/i],['哈利·波特',/哈利.?波特|harry potter/i],['哪吒',/哪吒|ne zha/i],['原神',/原神|genshin/i],['黑神话',/黑神话|black myth/i],['恋与深空',/恋与深空|love and deepspace/i],['高达',/高达|gundam/i],['名侦探柯南',/名侦探柯南|detective conan/i],['海贼王',/海贼王|航海王|one piece/i],['初音未来',/初音未来|hatsune miku/i],['线条小狗',/线条小狗/i],['小马宝莉',/小马宝莉|my little pony/i],['黄油小熊',/黄油小熊|butterbear/i]];
export function nextActions(query,rows=[]){
 query=query.trim();if(!query)return {query,count:0,directions:[],ips:[]};
 const unique=new Map();for(const row of rows){if(!row.title?.toLowerCase().includes(query.toLowerCase())||!/^https?:\/\//.test(row.url||''))continue;const key=row.title.replace(/[\s\p{P}]/gu,'').toLowerCase();if(!unique.has(key))unique.set(key,row);}
 const matches=[...unique.values()];
 const assess=pattern=>{const evidence=matches.filter(i=>pattern.test(i.title)),sources=new Set(evidence.map(i=>i.source).filter(Boolean));return {count:evidence.length,sources:sources.size,risk:evidence.some(i=>/抵制|召回|争议|侵权|滞销|下架|boycott|recall|backlash|lawsuit/i.test(i.title)),evidence:evidence.slice(0,2)};};
 return {query,count:matches.length,directions:directions.map(d=>({...d,pattern:undefined,...assess(d.pattern)})).filter(d=>d.count>=2).sort((a,b)=>b.sources-a.sources||b.count-a.count).slice(0,2),ips:ipNames.map(([name,pattern])=>({name,...assess(pattern)})).filter(i=>i.count>0).sort((a,b)=>b.sources-a.sources||b.count-a.count).slice(0,3)};
}
