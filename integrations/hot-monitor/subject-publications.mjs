// Scope comes from a specialist publication and a concrete product or activation in the original headline.
const beats=[
 {topic:/^(露营|露營|camping|户外露营)$/i,sites:['campreview.jp','camphack.nap-camp.com','dod.camp','coleman.co.jp','store.alpen-group.jp'],product:/テント|シュラフ|焚き火|シェルター|キャンプ|アウトドア|寝袋|テーブル|ランタン|フィールドライト|シェード|タープ|バーナー|クーラー|スティックターボ|ポップアップ|フェス|アウトドアチェア|グリル|グランドシート|マット|camp|tent|lantern|帐篷|天幕|营地/i},
 {topic:/^(香水|香氛|perfume|fragrance)$/i,sites:['fragrantica.com','nstperfume.com','perfumersworld.com'],product:/parfum|perfume|fragrance|eau de|cologne|香氛|香水/i},
 {topic:/^(跑鞋|球鞋|sneakers?)$/i,sites:['sneakernews.com','sneakerbardetroit.com','solecollector.com'],product:/shoe|sneaker|jordan|air max|gel.lyte|zoom|adizero|asics/i},
 {topic:/^(潮玩|手办|二次元爆款|盲盒)$/i,sites:['toyark.com','toysrevil.net','figsoku.net'],product:/figure|toy|フィギュア|盲盒|ねんどろいど|限定グッズ/i}];
export function editorialBeat(query,row){
 let host;try{host=new URL(row.url).hostname.replace(/^www\./,'');}catch{return false;}
 const beat=beats.find(r=>r.topic.test(query));
 return Boolean(beat?.sites.some(h=>host===h||host.endsWith('.'+h))&&beat.product.test(row.originalTitle||row.title||'')&&!/black friday|最大.{1,5}OFF|セール開催|discount|购物攻略/i.test(row.title));
}
export function beatSites(query){return beats.find(r=>r.topic.test(query))?.sites||[];}

