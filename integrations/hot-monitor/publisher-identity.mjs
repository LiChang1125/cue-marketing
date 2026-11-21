const publisherFamilies=[
 ['Industry Dive',['marketingdive.com','restaurantdive.com','fooddive.com','grocerydive.com','retaildive.com','socialmediatoday.com']],
 ['William Reed',['foodnavigator.com','foodnavigator-asia.com','dairyreporter.com','bakeryandsnacks.com','cosmeticsdesign.com']],
 ['东方财富',['eastmoney.com']],
 ['新浪',['sina.com.cn','sina.cn']],
 ['36氪',['36kr.com','36kr.jp']],
];
const sourceNames=new Map([
 ['每日经济新闻','nbd.com.cn'],['每经网','nbd.com.cn'],['新华社','news.cn'],['中新社','chinanews.com.cn'],['中国新闻网','chinanews.com.cn'],['界面新闻','jiemian.com'],['新京报','bjnews.com.cn'],['路透社','reuters.com'],['Reuters','reuters.com'],['美联社','apnews.com'],['Associated Press','apnews.com']
]);
export function publisherIdentity(address,attribution){
 if(sourceNames.has(attribution))return sourceNames.get(attribution);
 const domain=new URL(address).hostname.toLowerCase().replace(/^www\./,'');
 for(const [family,sites] of publisherFamilies)if(sites.some(d=>domain===d||domain.endsWith('.'+d)))return family;
 return domain;
}
