export const CATEGORIES = [
 {key:"collab",label:"IP 联名",section:"品牌合作",tagColor:"indigo",guide:"有明确双方和合作动作，包括授权、联乘和联动。"},
 {key:"campaign",label:"营销现场",section:"营销现场",tagColor:"orange",guide:"品牌传播、快闪、线下参与、渠道与内容营销。"},
 {key:"launch",label:"新品与零售",section:"新品与零售",tagColor:"green",guide:"有日期的上市、限定发售或渠道动作。"},
 {key:"culture",label:"消费文化",section:"消费文化",tagColor:"violet",guide:"有具体案例或研究支撑的近期圈层与消费变化。"},
 {key:"industry",label:"品牌动向",section:"品牌动向",tagColor:"turquoise",guide:"品牌经营、合作伙伴和市场变化。"},
 {key:"opinion",label:"市场观察",section:"市场观察",tagColor:"purple",guide:"有事实与来源的复盘和市场研究。",commentary:true}
] as const;
export const RELEASE:{category:string;tag:string;unit:string}|null={category:"collab",tag:"品牌联名",unit:"项联名"};
export const PLAIN_TERMS:readonly string[]=["ip","roi","cmo","gmv","ceo","ugc"];
export const ITEM_TYPES=["ip_collaboration","product_launch","campaign_case","market_research","industry_event","opinion_analysis","tutorial_explainer"] as const;
export const CATEGORY_TAGS=["品牌联名","营销活动","新品上市","渠道变化","行业动态","消费趋势","市场研究","其他"] as const;
export const TOPIC_TAGS=["亚文化","街头文化","二次元","潮玩","球鞋","香水","香氛","运动","美妆","时尚","餐饮","快闪","联名","零售"] as const;
export const ENTITY_TAGS=["耐克","迪士尼","泡泡玛特","宝可梦","任天堂","阿迪达斯","麦当劳","优衣库"] as const;
export const TAG_SYNONYMS:Readonly<Record<string,string>>={"次文化":"亚文化","联乘":"品牌联名","香氛":"香水"};
export const ENTITIES:Record<string,{name:string;displayTag:string|null;aliases:string[];orgNames?:string[];otherNames?:string[]}>={
 lego:{name:"乐高",displayTag:"乐高",aliases:["LEGO","乐高"]},nike:{name:"耐克",displayTag:"耐克",aliases:["Nike","耐克"],otherNames:["Air Jordan","Jordan"]},disney:{name:"迪士尼",displayTag:"迪士尼",aliases:["Disney","迪士尼"],orgNames:["The Walt Disney Company"],otherNames:["Disney Parks"]},popmart:{name:"泡泡玛特",displayTag:"泡泡玛特",aliases:["泡泡玛特","POP MART"]},nintendo:{name:"任天堂",displayTag:"任天堂",aliases:["任天堂","Nintendo"],orgNames:["Nintendo Co."],otherNames:["Nintendo Switch"]},adidas:{name:"阿迪达斯",displayTag:"阿迪达斯",aliases:["阿迪达斯","adidas"],otherNames:["adidas Originals"]}};
export const IDENTITY_LEXICON=Object.entries(ENTITIES).map(([id,e])=>({id,name:e.name,patterns:e.aliases.map(a=>new RegExp(a,"i"))}));
export const PUBLISHER_DOMAINS:ReadonlyArray<{entityId:string;domains:readonly string[]}>=[{entityId:"nike",domains:["nike.com"]},{entityId:"disney",domains:["disney.com"]}];
export const IDENTITY_CONTEXT_ALIASES:ReadonlyArray<{entityId:string;pattern:RegExp}>=[];

