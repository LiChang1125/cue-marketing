// Geography describes where the story happens, not the publisher's language or brand origin.
const domestic=/中国(?:市场|内地|大陆)?|国内|内地|全国|北京|上海|深圳|广州|杭州|成都|重庆|武汉|南京|苏州|天津|西安|长沙|郑州|青岛|厦门|福州|济南|宁波|东莞|佛山|合肥|昆明|无锡|珠海|海口|三亚|泉州|香港|澳门|台北|台湾|臺灣|臺北/;
const overseas=/美国|英国|法国|德国|意大利|日本|韩国|泰国|新加坡|澳大利亚|加拿大|印度|印尼|巴西|巴黎|伦敦|纽约|东京|首尔|大阪|米兰|悉尼|洛杉矶|旧金山|曼谷|国立市|海外|出海|\b(?:London|Paris|Tokyo|Seoul|New York|Australia|US market)\b/i;
export function chinaStory(item){
 const title=(item.title||'').replace(/中国(?:品牌|公司|企业|设计师)/g,''),excerpt=(item.excerpt||'').replace(/中国(?:品牌|公司|企业|设计师)/g,'');
 if(domestic.test(title))return true;
 if(overseas.test(title))return false;
 return domestic.test(excerpt)&&!overseas.test(excerpt);
}
export function curatedSelection(data,kind='all',chinaOnly=false){
 const rows=kind==='all'?Object.values(data).flat():data[kind]||[];
 const seen=new Set();return rows.filter(i=>{if(seen.has(i.id)||chinaOnly&&!chinaStory(i))return false;seen.add(i.id);return true;}).sort((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt));
}
