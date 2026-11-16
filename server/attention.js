import {topicMatches,sectorId,isMarketingCase} from '../shared/insights.js';

const definitions=[['comments','评论'],['likes','点赞'],['saves','收藏'],['shares','分享'],['answers','回答'],['questionFollowers','问题关注'],['views','视频播放'],['topicViews','话题累计播放']];
export function attentionTrends(items,historyFor,{query='',sector=null,days=7,now=Date.now(),sources=[]}={}){
  const matching=items.filter(i=>query?topicMatches(i,query):isMarketingCase(i)&&(!sector||sectorId(i)===sector));
  const platforms=[];
  for(const source of ['xiaohongshu','douyin','bilibili-cli','bilibili','weibo','zhihu']){
    const candidates=matching.filter(i=>i.source===source),series=[];
    const histories=new Map(candidates.map(i=>[i.id,historyFor(i.id).filter(p=>Date.parse(p.at)<=now&&Date.parse(p.at)>=now-days*86400000)]));
    for(const [metric,label] of definitions){
      // A hashtag is one cumulative counter. Never sum overlapping hashtags.
      const eligible=metric==='topicViews'?candidates.filter(i=>query&&i.title.replace(/^#/,'').trim().toLowerCase()===query.toLowerCase()).slice(0,1):candidates.filter(i=>i.contentType!=='topic'&&!Number.isFinite(i.metrics?.topicViews));
      const buckets=new Map();
      for(const item of eligible)for(const p of histories.get(item.id)||[]){
        if(!Number.isFinite(p[metric])||p[metric]<0)continue;
        const values=buckets.get(p.at)||new Map();values.set(item.id,p[metric]);buckets.set(p.at,values);
      }
      const times=[...buckets.keys()].sort((a,b)=>Date.parse(a)-Date.parse(b));
      const end=times.at(-1);if(!end||now-Date.parse(end)>86400000)continue;
      const latest=buckets.get(end),min=Math.min(latest.size,Math.max(3,Math.ceil(latest.size*.6)));
      const baseline=times.find(at=>Date.parse(end)-Date.parse(at)>=600000&&[...latest.keys()].filter(id=>buckets.get(at).has(id)).length>=min);
      const ids=[...latest.keys()].filter(id=>!baseline||buckets.get(baseline).has(id));
      const points=(baseline?times.filter(at=>Date.parse(at)>=Date.parse(baseline)):[end]).filter(at=>ids.every(id=>buckets.get(at).has(id))).map(at=>({at,value:ids.reduce((sum,id)=>sum+buckets.get(at).get(id),0)}));
      const value=points.at(-1).value,first=points[0];
      const sourceState=sources.find(s=>s.id===source);
      const stale=now-Date.parse(end)>30*60000||['error','setup'].includes(sourceState?.state);
      series.push({metric,label,value,points,sampleSize:ids.length,scope:metric==='topicViews'?'平台话题累计播放':'公开内容样本累计互动',
        delta:points.length>1?value-first.value:null,change:points.length>1&&first.value>0?(value-first.value)/first.value:null,
        stale,items:eligible.filter(i=>ids.includes(i.id)).map(i=>({id:i.id,title:i.title,url:i.url,value:latest.get(i.id)})).sort((a,b)=>b.value-a.value)});
    }
    if(series.length)platforms.push({source,name:({xiaohongshu:'小红书',douyin:'抖音','bilibili-cli':'B站搜索',bilibili:'B站',weibo:'微博',zhihu:'知乎'})[source],series});
  }
  return {query,sector,days,platforms};
}
