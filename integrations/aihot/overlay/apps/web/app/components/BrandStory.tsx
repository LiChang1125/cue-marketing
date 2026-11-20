import {useState} from 'react';
import {useBrandData} from '../lib/use-brand-data';
type Report={url:string;title:string;publisher:string;publishedAt:string;identity:string;stage:string};
type Story={storyId:string;kind:string;title:string;content?:string;outlets:number;heat:number;eventCount:number;firstAt:string;lastAt:string;reports:Report[];trend:{at:number;value:number}[]};
const fmt=(s:string|number)=>new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(s));
export const storyLink=(id:string)=> (import.meta.env.VITE_PUBLIC_DATA==='true'?'#/hot':'/hot')+'?story='+encodeURIComponent(id);
export default function BrandStory({id}:{id:string}){
 const {data,failed,retry}=useBrandData<Story>('/api/brand-pulse/story?id='+encodeURIComponent(id));
 const [tab,setTab]=useState('事件概览'),[filter,setFilter]=useState('全部'),[hour,setHour]=useState(23);
 const back=import.meta.env.VITE_PUBLIC_DATA==='true'?'#/hot':'/hot';
 if(!data)return <section><a href={back}>← 热点榜</a><p role="status">{failed?'这份事件档案暂不可读。':'正在读取事件档案…'}</p>{failed&&<button onClick={retry}>重新读取</button>}</section>;
 const reports=[...data.reports].sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt)),latest=reports[0]!;
 const tabs=['事件概览','报道时间线','热度走势'];const stages=[...new Set(reports.map(r=>r.stage))];
 const max=Math.max(1,...data.trend.map(p=>p.value)),point=data.trend[hour];const ref=(r:Report)=><a href={r.url} target="_blank" rel="noreferrer" className="font-semibold text-ink hover:text-accent">{r.title} ↗</a>;
 const progress=new Map<string,Report[]>();for(const r of reports){const k=r.publishedAt.slice(0,10)+r.stage;progress.set(k,[...(progress.get(k)||[]),r]);}
 return <article className="mx-auto max-w-4xl pb-10"><a href={back} className="text-sm text-accent">← 品牌热点榜</a>
 <header className="my-5 border-b border-line-soft pb-5"><p className="mb-2 text-sm font-semibold text-accent">{data.kind}</p><h1 className="text-3xl font-bold leading-tight">{data.title}</h1>
 <p className="mt-3 text-sm text-ink-3">{reports.length} 篇报道 · {data.outlets} 个独立来源 · 首报 {fmt(data.firstAt)} · 最近进展 {fmt(data.lastAt)}</p></header>
 <nav className="mb-5 flex flex-wrap gap-2" aria-label="事件详情">{tabs.map(t=><button key={t} aria-pressed={tab===t} onClick={()=>setTab(t)} className={'rounded-full px-3 py-2 text-sm '+(tab===t?'bg-ink text-bg':'bg-well text-ink')}>{t}</button>)}</nav>
 {tab==='事件概览'?<><section className="card p-5"><h2 className="text-lg font-bold">先了解这件事</h2><p className="my-3 leading-relaxed">{data.content||reports.at(-1)?.title}</p><small className="text-ink-3">最新进展 · {fmt(latest.publishedAt)} · {latest.publisher}</small><div>{ref(latest)}</div></section>
 <section className="mt-5"><h2 className="text-xl font-bold">事件进展</h2>{[...progress.values()].map(list=><div key={list[0]!.url} className="border-b border-line-soft py-4"><small className="text-accent">{fmt(list[0]!.publishedAt)} · {list[0]!.stage} · {list.length} 篇</small><div>{ref(list[0]!)}</div></div>)}</section></>:tab==='报道时间线'?<section><label className="text-sm">报道类型　<select value={filter} onChange={e=>setFilter(e.target.value)}>{['全部',...stages].map(x=><option key={x}>{x}</option>)}</select></label><ol className="mt-3">{reports.filter(r=>filter==='全部'||r.stage===filter).map(r=><li key={r.url} className="border-t border-line-soft py-4"><small className="text-ink-3">{fmt(r.publishedAt)} · {r.publisher} · {r.stage}</small><div>{ref(r)}</div></li>)}</ol></section>:<section className="card p-5"><h2 className="text-xl font-bold">近 24 小时报道热度</h2><p className="my-2 text-sm text-ink-3">按独立来源的报道时间计算，同源转载合并。</p><svg viewBox="0 0 600 160" className="w-full text-accent" role="img" aria-label="逐小时报道热度折线" onPointerMove={e=>{const b=e.currentTarget.getBoundingClientRect();setHour(Math.max(0,Math.min(23,Math.round((e.clientX-b.left)/b.width*23))))}}><path d="M10 151H590" stroke="currentColor" opacity=".2"/><polyline points={data.trend.map((p,i)=>(10+i*580/23)+','+(150-135*p.value/max)).join(' ')} fill="none" stroke="currentColor" strokeWidth="3"/>{point&&<circle cx={10+hour*580/23} cy={150-135*point.value/max} r="5" fill="currentColor"/>}</svg>
 <label className="text-sm">{point&&fmt(point.at)+' · 热度 '+point.value}<input aria-label="选择热度时刻" type="range" min={0} max={23} value={hour} onChange={e=>setHour(Number(e.target.value))} className="block w-full"/></label></section>}</article>;
}
