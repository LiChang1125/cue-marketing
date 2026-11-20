import {useRef,useState} from 'react';
import {useBrandData} from '../lib/use-brand-data';
type Report={url:string;title:string;publisher:string;publishedAt:string;identity:string;stage:string;role?:string};
type Story={storyId:string;kind:string;title:string;content?:string;outlets:number;heat:number;eventCount:number;firstAt:string;lastAt:string;reports:Report[];trend:{at:number;value:number}[]};
const fmt=(s:string|number)=>new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(s));
export const storyLink=(id:string)=> (import.meta.env.VITE_PUBLIC_DATA==='true'?'#/hot':'/hot')+'?story='+encodeURIComponent(id);
export default function BrandStory({id}:{id:string}){
 const {data,failed,retry}=useBrandData<Story>('/api/brand-pulse/story?id='+encodeURIComponent(id));
 const [tab,setTab]=useState('事件概览'),[filter,setFilter]=useState('全部'),[hour,setHour]=useState(23);
 const sections=useRef<Record<string,HTMLElement|null>>({});
 const jump=(name:string)=>{setTab(name);sections.current[name]?.scrollIntoView({block:'start',behavior:'instant'});};
 const back=import.meta.env.VITE_PUBLIC_DATA==='true'?'#/hot':'/hot';
 if(!data)return <section><a href={back}>← 热点榜</a><p role="status">{failed?'这份事件档案暂不可读。':'正在读取事件档案…'}</p>{failed&&<button onClick={retry}>重新读取</button>}</section>;
 const reports=[...data.reports].sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt)),latest=reports[0]!;
 const tabs=['事件概览','报道时间线','热度走势'];const stages=[...new Set(reports.map(r=>r.stage))];
 const max=Math.max(1,...data.trend.map(p=>p.value)),point=data.trend[hour];const ref=(r:Report)=><a href={r.url} target="_blank" rel="noreferrer" className="font-semibold text-ink hover:text-accent">{r.title} ↗</a>;
 const progress=new Map<string,Report[]>();for(const r of reports){const k=r.publishedAt.slice(0,10)+r.stage;progress.set(k,[...(progress.get(k)||[]),r]);}
 const summary=data.content&&/[一-龥]/.test(data.content)&&!/[ぁ-ヿ]/.test(data.content)?data.content:reports.at(-1)?.title;
 const independent=[...new Map(reports.map(r=>[r.identity,r])).values()];
 const officials=reports.filter(r=>r.role==='official');
 const panel='card scroll-mt-4 p-4 sm:p-6';
 return <article className="mx-auto max-w-6xl pb-12"><a href={back} className="text-sm text-accent">← 品牌热点榜</a>
 <header className="mt-5 border-b border-line-soft pb-5"><p className="text-sm font-semibold text-accent">{data.kind}</p><h1 className="my-3 text-3xl font-bold leading-tight lg:text-4xl">{data.title}</h1>
 <p className="text-sm text-ink-3">{reports.length} 篇报道 · {data.outlets} 个独立来源 · 首报 {fmt(data.firstAt)} · 最近进展 {fmt(data.lastAt)}</p></header>
 <nav className="my-4 flex flex-wrap gap-2" aria-label="事件详情">{tabs.map(t=><button key={t} aria-pressed={tab===t} onClick={()=>jump(t)} className={'rounded-full px-3 py-2 text-sm '+(tab===t?'bg-ink text-bg':'bg-well text-ink')}>{t}</button>)}</nav>
 <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
 <div className="grid min-w-0 gap-4">
 <section ref={el=>{sections.current['事件概览']=el}} className={panel}><h2 className="text-xl font-bold">先了解这件事</h2><p className="my-4 leading-relaxed">{summary}</p><div className="border-t border-line-soft pt-3"><p className="mb-1 text-sm text-accent">最新进展 · {fmt(latest.publishedAt)}</p>{ref(latest)}</div></section>
 <section className={panel}><h2 className="text-xl font-bold">事件进展</h2><ol className="mt-3">{[...progress.values()].slice(0,8).map(group=><li key={group[0]!.url} className="border-l border-line-soft py-2 pl-4"><small className="text-ink-3">{fmt(group[0]!.publishedAt)} · {group[0]!.stage}</small><div>{ref(group[0]!)}</div></li>)}</ol></section>
 <section ref={el=>{sections.current['报道时间线']=el}} className={panel}><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-xl font-bold">报道时间线</h2><select aria-label="按报道类型筛选" value={filter} onChange={e=>setFilter(e.target.value)} className="rounded-full bg-well px-3 py-1 text-sm">{['全部',...stages].map(s=><option key={s}>{s}</option>)}</select></div><ol className="mt-3">{reports.filter(r=>filter==='全部'||r.stage===filter).map(r=><li key={r.url} className="border-t border-line-soft py-4"><small className="text-ink-3">{fmt(r.publishedAt)} · {r.publisher} · {r.stage}</small><div>{ref(r)}</div></li>)}</ol></section>
 <section ref={el=>{sections.current['热度走势']=el}} className={panel}><h2 className="text-xl font-bold">近 24 小时报道热度</h2><svg viewBox="0 0 600 160" className="mt-4 w-full text-accent" role="img" aria-label="逐小时报道热度折线" onPointerMove={e=>{const b=e.currentTarget.getBoundingClientRect();setHour(Math.max(0,Math.min(23,Math.round((e.clientX-b.left)/b.width*23))))}}><path d="M10 151H590" stroke="currentColor" opacity=".2"/><polyline points={data.trend.map((p,i)=>(10+i*580/23)+','+(150-135*p.value/max)).join(' ')} fill="none" stroke="currentColor" strokeWidth="3"/>{point&&<circle cx={10+hour*580/23} cy={150-135*point.value/max} r="5" fill="currentColor"/>}</svg>
 <label className="text-sm">{point&&fmt(point.at)+' · 热度 '+point.value}<input aria-label="选择热度时刻" type="range" min={0} max={23} value={hour} onChange={e=>setHour(Number(e.target.value))} className="mt-2 block w-full"/></label></section>
 </div><aside className="grid gap-4"><section className={panel}><h2 className="text-base font-bold">为什么热</h2><p className="my-3 text-3xl font-bold text-accent">{data.heat}<small className="ml-2 text-xs font-normal text-ink-3">报道热度</small></p><p className="text-sm leading-relaxed">{data.outlets} 个独立来源报道，最新一篇由{latest.publisher}发布。</p><div className="mt-3 flex flex-wrap gap-2">{independent.map(r=><a href={r.url} target="_blank" rel="noreferrer" className="rounded-full bg-well px-2 py-1 text-xs" key={r.identity}>{r.publisher} ↗</a>)}</div></section>
 {officials.length>0&&<section className={panel}><h2 className="mb-2 font-bold">官方一手</h2>{officials.slice(0,4).map(r=><p key={r.url} className="mt-2 text-sm">{ref(r)}</p>)}</section>}</aside></div></article>;
}
