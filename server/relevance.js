// Relevance is based on content evidence, never a search query or a hot-list rank.
import {meaningfulContent} from '../shared/quality.js';
const marketing=/品牌|营销|广告|联名|代言|品牌大使|IP\s*(授权|商业|运营|合作|联动|开发)|跨界合作|新消费|消费者|消费趋势|零售|快闪|种草|直播带货|电商|品牌出海|文创|商业化|创意企划|用户增长|投放|获客|赞助商|冠名/i;
const consumptionCulture=/潮玩|盲盒|谷子|谷店|痛包|二次元消费|二次元文化|同人展|漫展|周边经济|毛绒经济|情绪消费|手办|收藏玩具|游戏周边|亚文化|哥特|朋克|洛丽塔|lolita|街头文化/i;
const knownIp=/原神|崩坏|星穹铁道|绝区零|宝可梦|三丽鸥|蜡笔小新|迪士尼|哈利波特|名侦探柯南|海贼王|火影|高达|初音|chiikawa|labubu|molly|吉伊卡哇|罗小黑|蛋仔|恋与深空|鸣潮|明日方舟|怪奇物语|圣诞夜惊魂/i;
const commercialContext=/推出|发布|发售|预告|新品|新作|限定系列|周边|展览|展会|授权|合作|联动|开业|门店|快闪|商品|产品|市场|收入|消费|销量|商业/i;
const brands=/索尼|Sony|Leica|徕卡|FILA|罗意威|LOEWE|KidSuper|Mercedes|梅赛德斯|奔驰|Nike|耐克|adidas|阿迪达斯|星巴克|瑞幸|喜茶|霸王茶姬|麦当劳|肯德基|可口可乐|百事|百岁山|安踏|李宁|优衣库|UNIQLO|MUJI|小米|Apple|苹果|泡泡玛特|POP MART|Prada|Gucci|Burberry|Dior|Hermès|Chanel|New Balance|Puma|G-SHOCK|CeraVe|丝芙兰|欧莱雅|雅诗兰黛|兰芝|瑞幸|BAPE|Siegelman|G-Star|BALENCIAGA/i;
const unrelated=/军事|军民|战火|导弹|美军|俄军|元首|外交|APEC|央行|伪纪录片|全家福|立贤不立长|术式反转|搞笑剪辑|地震|车祸|命案/i;
export function relevance(item){
  if(!meaningfulContent(item))return null;
  const title=String(item.title||'');
  if(/急招|实习生|招聘岗位|招聘信息|求职|内推|简历|兼职招聘|日结兼职|现货补货|私信下单|代购接单|求购|出闲置|有路人|偶遇|代拍/.test(title))return null;
  if(unrelated.test(title)&&!marketing.test(title))return null;
  const commercial=marketing.test(title),culture=consumptionCulture.test(title),ip=knownIp.test(title)&&commercialContext.test(title);
  const industryNews=item.source==='socialbeta'||item.source==='brandstar'&&(commercialContext.test(title)||/品牌|融资|收购|美妆|香氛|奢侈|服饰|鞋履|餐饮|家居|零售|咖啡|酒店/.test(title));
  if(industryNews||commercial||culture||ip||/香水|香氛|香薰|perfume|fragrance/i.test(title)||(brands.test(title)&&commercialContext.test(title))){
    const categories=new Set(['content']);
    if(commercial||['socialbeta','brandstar'].includes(item.source)||brands.test(title))categories.add('brand');
    if(ip||/联名|IP授权|IP合作|IP联动/i.test(title))categories.add('ip');
    if(culture)categories.add('culture');
    return {categories:[...categories]};
  }
  return null;
}
export const isRelevant=item=>relevance(item)!==null;
export const scopedItems=items=>items.flatMap(item=>{const evidence=relevance(item);return evidence?[{...item,categories:evidence.categories}]:[];});
