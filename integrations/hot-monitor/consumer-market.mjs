const tech=/^(?:YouTube|ユーチューブ|TikTok|Instagram|Alphabet|谷歌|英伟达)(?:[，、：：: ]|一手|启动|发布|推出|宣布|上线|平台|将|は|が|to | launches| announces| rolls out)|Anthropic|OpenAI|DeepMind|Nvidia|AI初创|AI公司|云计算公司|CyberAgent|Duolingo|Razer|GigaCrysta|GPT[- ]?\d|手机品牌|(?:网易|网易严选|ATK|傲风).{0,15}(?:鼠标|人体工学椅|联名键盘)|京蓝科技|英伟达|科技股|Nintendo Switch|任天堂.{0,8}(?:主机|游戏机|Switch)|雷军|小米\s*(?:SU7|YU7|\d{2})|京东MALL|京东商城|PS5|(?:Kick|Twitch)看播|GeForce|腾讯游戏|搜狐视频|关注流|张朝阳|科技巨頭|Beats Pill|Beats Studio|索尼耳机|字节跳动|互联网平台|AI合成|AI 合成|AI授权|AI 授权|AI 科技|(?:小红书|抖音|哔哩哔哩|百度|腾讯|京东|美团|拼多多|阿里巴巴|阿里云|淘宝|天猫|小米|三星|索尼|雷鸟)(?:公司|集团|推出|携手|官宣|发布|升级|宣布|上线)|小鹏汽车|蔚来汽车|谷歌|苹果携手|英偉達|OpenAI|Meta (?:launch|partner|release|announce)|Spotify|Netflix|Salesforce|ChatGPT|Apple Music|Apple TV|科技巨头|人工智能|生成式AI|索尼集团|Sony Group|索尼发布|索尼推出|百度发布|阿里云|京东集团|Meta unveils|Meta launches|Open AI|苹果公司|苹果(?:发布|推出|手机|芯片|电脑|新品|服务)|苹果[®™]|英伟达|微软|谷歌|亚马逊|特斯拉|小米(?:集团|汽车|手机|生态|发布|商城|新品)|华为|鸿蒙|字节跳动|百度(?:云|集团|发布|智能)|美团(?:集团|外卖|发布)|阿里巴巴|腾讯(?:云|公司|集团|发布)|高通|联发科|英特尔|人工智能|大模型|显卡|芯片|软件更新|操作系统|云计算|科技公司|互联网公司|iPhone|OpenAI|DeepSeek|Anthropic|ChatGPT|Google|Microsoft|NVIDIA|Qualcomm|Snapdragon|Apple(?:'s| Inc| Intelligence| Watch| TV)?\b|Amazon(?:'s| Web Services)?\b|Huawei|Xiaomi|ByteDance|Alibaba|Tesla|三星电子|三星手机|Samsung|Meta Platforms|\bGemini\b|\bAI(?:公司|模型|平台|芯片| agent| model| tool)|\bSDK\b|\bGPU\b|Android|macOS|Windows 1[01]|PlayStation|Xbox|ソニー|ソフトウェア/i;
const irrelevant=/送礼参考|送礼指南|送[老公妻子男友女友]{2,4}的心意|结婚纪念日送|價值重估|价值重估|股价预测|股價預測|(?:中期|季度)业绩解读|财报点评|\bdies\b|passed away|found dead|意外去世|意外死亡|去世享年|巨乳|グラビア|ビキニ|脚線美|限界ギリギリ|写真8枚|美脚|腰回り|胸元|目标价|评级维持|美股盘前|博彩|股价下跌|跌[\d.]+%|谍照|传闻|rumou?r|季度裁员|门票被盗|coupon code|股价|换手率|跌停|成交额|上市公司公告|净利润|招聘|融资公告|官宣离婚|机场路透|培训报名|入门教程|游戏攻略|开箱教程|episode\s+\d+\s+(?:review|recap)|patch notes|troubleshoot|earnings call|price target|stock price/i;
const market=/hotel|resort|hospitality|lager|beer|brewing|sporting goods|sports event|equipment brand|lodging|hotel chain|restaurant|grocery|supermarket|酒店|旅宿|門市|新商品|新メニュー|スポーツ用品|飲食店|宿泊|体験プラン|ビール|喫茶|飲料|出店|レストラン|シュラフ|焚き火|ランタン|キャンプシェード|キャンプ用品|バンドック|ユニフレーム|Coleman|snow peak|コールマン|スノーピーク|camping tent|sleeping bag|アウトドア|キャンプ|キャンプ場|アウトドアブランド|camping|campground|campsite|outdoor gear|outdoor apparel|コーヒー|ジュエリー|チョコレート|ヘアケア|ブランド|衣装展示|フィギュア|コスプレ|耐克|阿迪达斯|安踏|李宁|新百伦|香奈儿|欧莱雅|珀莱雅|始祖鸟|拉夫劳伦|麦富迪|鞋款|运动品牌|茶具|家居|家具|乳品|家纺|个护|洗护|护发|家清|咖啡馆|书店|眼镜|新中式|包袋|首饰|袜|红酒|威士忌|零售|护肤|烘焙|瑞幸|库迪|肯德基|麦当劳|优衣库|泡泡玛特|名创优品|喜茶|蜜雪冰城|霸王茶姬|可口可乐|茅台|迪士尼|乐高|宝可梦|三丽鸥|麦当劳|咖啡|饮料|香水|香氛|香薰|化妆|彩妆|美妆|护肤|服装|时装|服饰|球鞋|运动鞋|潮牌|潮玩|玩具|手办|奶茶|饮品|茶饮|食品|餐厅|餐饮|零食|酒庄|啤酒|快餐|巧克力|运动服|箱包|珠宝|腕表|文创|文旅|酒店|联名|联乘|餐廳|服飾|時尚|香氛|玩偶|門店|联动|服饰|快闪|品牌大使|代言人|周边|coser|文旅节|游园会|签售会|漫展|动漫|谷子|二次元|角色扮演|户外|露营|百货|免税店|奢侈|零售|コラボ|グッズ|香水|フィギュア|カフェ|コスプレ|ファッション|ブランド|限定|アパレル|玩具|百貨店|快閃|聯名|發售|美妝|キャラクター|collab|cosplay|merch(?:andise)?\b|anime|manga|licensed|licensing|Luckin|Cotti|Starbucks|McDonald|Nike|Adidas|Uniqlo|Chanel|Gucci|Prada|Dior|Lego|Disney|Pokémon|Sanrio|fragrance|perfume|lipstick|cosmetic|skincare|beauty|makeup|fashion|apparel|sneaker|footwear|streetwear|couture|runway|clothing|handbag|jewel(?:ry|lery)|luxury|toy[s ]|figurine|collectible|beverage|coffee|whisk[e]?y|brewery|distillery|chocolate|restaurant|retail|supermarket|packaging|pop[- ]up|brand ambassador|brand campaign|capsule collection|sportswear|athleisure|mascot|consumer goods|ice cream|grocery|food brand|wine brand/i;
// Direct evidence of a retail launch, consumer promotion or in-store activation can
// establish the market without a predefined list of brands or product categories.
export const retailActivation=/期间限定店|限时门店|开放预售|全(?:国|渠道)发售|指定零售商|线下首店|期間限定(?:ショップ|メニュー|販売)|公式オンライン(?:ストア|ショップ)|全国の.{0,10}店舗|店頭販売|店頭にて|予約販売|宿泊プラン|available (?:now )?(?:in stores|at (?:select|participating) retailers)|at retail locations|in-store (?:activation|launch|experience)|limited[- ]edition (?:collection|release)|flagship (?:store|opening)|consumer-facing campaign/iu;
export function consumerContent(r){
 const title=String(r.title||''),original=String(r.originalTitle||'');
 const head=title+' '+original;
 const subject=head.replace(/\bapple(?= (?:pie|cider|juice|cinnamon|tart|butter|fritter|flavou?r)\b)/gi,'fruit').replace(/(?:在|通过|登陆|入驻|借助|通过其)\s*(?:小红书|抖音|哔哩哔哩|京东|天猫|淘宝|美团|Instagram|TikTok|Amazon)(?=上|平台|渠道|发布|营销|上架|开售|发售|推出|活动)/gi,'在平台');
 if(tech.test(subject)||irrelevant.test(head)||/\bWATCH (?:Ultimate|GT|Series|Fit)\s*\d|\b(?:smartwatch|smartphone|gaming keyboard|wireless earbuds)\b|智能手表|蓝牙耳机|电竞鼠标|手机评测/i.test(head))return false;
 const text=head+' '+String(r.content||r.excerpt||'').slice(0,700);
 return market.test(text)||retailActivation.test(text);
}
export function excludedTopic(topic){return tech.test(topic)||/^(苹果|小米|三星|索尼|科技|互联网|AI|Kimi|Meta|腾讯|百度|美团|阿里巴巴|亚马逊|谷歌|英伟达|微软|字节跳动)$/i.test(topic);}

export function excludedSearchSource(row){
 const credits=[row.publisher,row.sourceName,row.attribution,row.author,row.publisherId,row.source];
 if(credits.some(v=>/株式[会會]社|珠[师師式][会會]社|^pr\s*times(?:$|[:\s/])/i.test(String(v||'').normalize('NFKC').trim())))return true;
 return [row.url,row.originalUrl,row.issuerChannel].some(value=>{
   if(!value)return false;
   try{return /(^|\.)prtimes\.jp$/i.test(new URL(value).hostname);}catch{return false;}
 });
}

export function publicationCategory(row){
 const rules=[
  ['collab',/联名|联动|联乘|聯[名動乘]|跨界合作|IP授权|collab|licensing deal/i],
  ['opinion',/复盘|解读|调研|研究报告|洞察|调查报告|趋势报告|消费者调查|consumer insights|market research|survey finds/i],
  ['campaign',/快闪|快閃|代言|品牌大使|广告片|廣告片|广告大片|品牌活动|营销活动|campaign|pop.up|ambassador|sponsor/i],
  ['culture',/亚文化|二次元|街头文化|谷子文化|消费文化|消费趋势|圈层|潮玩文化|兴趣消费|fandom|subculture/i],
  ['launch',/新品|上新|推出|发布|上市|门店|首店|旗舰店|开业|发售|launch|flagship|debut/i]
 ];
 for(const text of [[row.title,row.originalTitle].join(' '),String(row.excerpt||row.content||row.summary||'').slice(0,240)]){
   for(const [key,test] of rules)if(test.test(text))return key;
 }
 return row.categories?.includes('culture')?'culture':'industry';
}
