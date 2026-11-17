import {radarMatches} from './radar.js';
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
 query=query.trim()||'品牌营销';
 const unique=new Map();for(const row of rows){if(!radarMatches(row,query)||!/^https?:\/\//.test(row.url||''))continue;const key=row.title.replace(/[\s\p{P}]/gu,'').toLowerCase();if(!unique.has(key))unique.set(key,row);}
 const matches=[...unique.values()];
 const assess=pattern=>{const evidence=matches.filter(i=>pattern.test(i.title)),sources=new Set(evidence.map(i=>i.source).filter(Boolean));return {count:evidence.length,sources:sources.size,risk:evidence.some(i=>/抵制|召回|争议|侵权|滞销|下架|boycott|recall|backlash|lawsuit/i.test(i.title)),evidence:evidence.slice(0,2)};};
 const observedDirections=directions.map(d=>({...d,pattern:undefined,...assess(d.pattern)})).filter(d=>d.count>=2).sort((a,b)=>b.sources-a.sources||b.count-a.count).slice(0,1);
 const observedIps=ipNames.map(([name,pattern])=>({name,...assess(pattern)})).filter(i=>i.count>0).sort((a,b)=>b.sources-a.sources||b.count-a.count).slice(0,1);
 const forecast=explore(query);
 return {query,count:matches.length,directions:observedDirections.length?observedDirections:[{name:forecast.direction,action:forecast.action,reason:forecast.reason,hypothesis:true,evidence:[]}],ips:observedIps.length?observedIps:[{name:forecast.ip,reason:forecast.ipReason,hypothesis:true,evidence:[]}]};
}
function explore(query){
 const choices=[
  [/亚文化|二次元|圈层|谷子|动漫|cosplay/i,{direction:'小圈层共创，可能接替泛化的二次元符号',reason:'可参与、可再创作的表达，可能比单纯贴标更容易留下持续内容。',action:'先找一个具体社群，共创一款可日常携带的小物；用投稿、实际购买和复购来检验。',ip:'初音未来的二创合作方向',ipReason:'可以从音乐、角色造型与用户再创作切入。这是待调研的合作方向，不代表近期热度已经上涨。'}],
  [/香水|香氛|香薰|气味|美妆/i,{direction:'气味人格与情绪场景，可能成为下一步表达',reason:'把难描述的香气变成可识别的人格或生活瞬间，或许更适合分享和送礼。',action:'测试“通勤、独处、见面”三个场景的小样组合，对比实际试香选择。',ip:'线条小狗的情绪表达联名',ipReason:'可探索陪伴感角色与随身香气的组合，先用概念图和试香反馈验证适配。'}],
  [/潮玩|盲盒|手办|收藏|labubu|泡泡玛特/i,{direction:'小体量、可随身的情绪角色值得押注测试',reason:'角色如果进入通勤与穿搭，可能获得比单纯陈列更频繁的展示机会。',action:'先试挂件或可替换配件，比较用户真实携带率和二次分享。',ip:'星星人的细分场景系列',ipReason:'可测试睡前、通勤等日常场景的角色表达；系列能否扩散仍需用户反馈验证。'}],
  [/快闪|空间|门店|文旅|城市|展览/i,{direction:'可带走的体验纪念物，可能延长线下传播',reason:'体验结束后仍能使用的物件，可能让一次到访继续出现在日常生活里。',action:'用一个参与任务连接限定纪念物，观察实际领取、使用与自发分享。',ip:'城市日常角色 · 原创 IP 方向',ipReason:'从当地人的生活习惯设计角色，先验证本地认同，再考虑跨城传播。'}],
  [/联名|IP|合作|品牌营销/i,{direction:'从符号贴标走向共同使用场景',reason:'双方能共同解决一个小需求的联名，可能比单次视觉拼接更有持续性。',action:'先设计一个低成本联名原型，比较受众重合度、使用频率与购买意愿。',ip:'三丽鸥细分角色的生活方式合作',ipReason:'可从具体角色与细分生活场景建立匹配，先做小范围概念测试，不预设它一定成为爆款。'}],
  [/科技|AI|软件|智能|数字/i,{direction:'抽象能力的人格化，可能降低理解与传播门槛',reason:'可持续互动的角色有机会把功能说明变成用户愿意重复参与的内容。',action:'选择一个具体任务做角色化演示，观察任务完成率和用户主动分享。',ip:'任务型助手 · 原创角色 IP',ipReason:'围绕真实用户任务设定性格与叙事，先验证记忆点，再扩展形象和周边。'}],
 ];
 return choices.find(([pattern])=>pattern.test(query))?.[1]||{direction:`「${query}」的细分使用场景，可能比宽泛主题更有机会`,reason:'先让受众在一个具体时刻感到相关，再观察能否扩展成共同表达。',action:'选一个高频场景制作两版内容原型，比较主动讨论、试用与真实转化。',ip:`围绕「${query}」的原创角色方向`,ipReason:'从用户的共同情绪或小问题提炼角色，先测试角色认同，再判断是否值得持续开发。'};
}
