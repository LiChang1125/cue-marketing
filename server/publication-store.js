import {writeFile,rename} from 'node:fs/promises';
import {reportSchedule,yesterdayWindow,marketingSection} from './reports.js';
import {selectMediaNews} from './media-news.js';

export function withDailyReport(data,now=new Date()) {
 const schedule=reportSchedule(now),reports=data.reports?.reports||[];
 if(!schedule.ready||reports.some(r=>r.date===schedule.day&&r.entries?.length))return data;
 const window=yesterdayWindow(now);
 const entries=selectMediaNews((data.feed?.items||[]).filter(i=>Date.parse(i.publishedAt)>=window.start&&Date.parse(i.publishedAt)<window.end),now.getTime(),12)
  .map(i=>({...i,sourceName:i.publisher||i.sourceName,section:marketingSection(i)||'品牌与公司',attribution:'行业媒体报道'}));
 if(!entries.length&&reports.some(r=>r.date===schedule.day))return data;
 const report={date:schedule.day,newsDate:window.newsDate,title:'CUE 早报',subtitle:entries.slice(0,3).map(i=>i.title).join('；')||'本期暂无可核实的昨日新闻',scheduledAt:schedule.due,generatedAt:now.toISOString(),status:entries.length?'ready':'insufficient',entries};
 return {...data,reports:{...data.reports,reports:[report,...reports.filter(r=>r.date!==schedule.day)].slice(0,90)}};
}

// A slow collection must not overwrite a report generated while it was running.
export function createPublicationStore({initial,path,onPublish=()=>{},now=()=>new Date()}) {
 let data=initial,queue=Promise.resolve();
 function publish(incoming) {
  const task=queue.then(async()=>{
   let next=incoming||data;
   if(incoming){const byDate=new Map((data.reports?.reports||[]).map(r=>[r.date,r]));for(const r of incoming.reports?.reports||[])if(r.entries?.length||!byDate.has(r.date))byDate.set(r.date,r);next={...incoming,reports:{...incoming.reports,reports:[...byDate.values()].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,90)}};}
   next=withDailyReport(next,now());if(next===data)return false;
   await writeFile(path+'.publish.tmp',JSON.stringify(next),{mode:0o600});await rename(path+'.publish.tmp',path);
   data=next;await onPublish(data);return true;
  });queue=task.catch(()=>{});return task;
 }
 return {get:()=>data,publish,flush:()=>queue};
}
