export function searchPlan(query){
  const normalized=query.trim().toLowerCase();
  if(['香水','香氛','香薰'].includes(normalized))return [query,'香氛','香水新品'];
  if(['亚文化','圈层文化'].includes(normalized))return [query,'哥特 朋克','二次元文化'];
  if(['潮玩','盲盒'].includes(normalized))return [query,'盲盒新品','潮玩联名'];
  if(['品牌联名','ip联名'].includes(normalized))return [query,'联名新品','跨界联名'];
  return [query,query+' 品牌'];
}
