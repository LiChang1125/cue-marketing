import { cli, Strategy } from '@jackwener/opencli/registry';
import { CommandExecutionError } from '@jackwener/opencli/errors';

// Observed on https://weibo.com/hot/search, 2026-11-16.
// The upstream /ajax/statuses/hot_band endpoint currently returns HTTP 404.
cli({
  site: 'zhichao', name: 'weibo-hot', access: 'read',
  description: '微博热搜：使用当前网页实际请求的 hotSearch 接口',
  domain: 'weibo.com', strategy: Strategy.COOKIE,
  args: [{name:'limit',type:'int',default:20}],
  columns: ['rank','word','hot_value','label','url'],
  func: async(page,args)=>{
    await page.goto('https://weibo.com/hot/search');
    const result=await page.evaluate(`(async()=>{
      const r=await fetch('/ajax/side/hotSearch',{credentials:'include'});
      if(!r.ok)return {error:'HTTP '+r.status};
      const d=await r.json();
      if(d.ok!==1 || !Array.isArray(d.data?.realtime))return {error:'Unexpected hotSearch response'};
      return d.data.realtime.filter(x=>typeof x.word==='string' && !x.is_ad).map(x=>({
        rank:x.realpos??null,word:x.word,hot_value:x.num??null,label:x.label_name||'',
        url:'https://s.weibo.com/weibo?q='+encodeURIComponent(x.word_scheme||x.word)
      }));
    })()`);
    const data=result?.value??result;
    if(!Array.isArray(data))throw new CommandExecutionError(`微博热搜读取失败：${data?.error||'数据格式变化'}`);
    return data.slice(0,Math.min(50,Math.max(1,Number(args.limit)||20)));
  }
});
