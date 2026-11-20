import {useEffect,useState} from "react";
import {useLocation} from 'react-router';
import BrandStory,{storyLink} from './BrandStory';
import {Sparkline} from "../features/hot/Sparkline";
import {useBrandData} from "../lib/use-brand-data";
type Report={publisher:string;url:string;title:string;publishedAt:string};
type Person={name:string;domain:string;avatar?:string;role:string;url:string};
type Point={at:number;value:number};
type Item={storyId?:string;url:string;title:string;content?:string;source:string;publisher?:string;brand?:string;author?:string;role?:string;image?:string;imageLocal?:string;people?:Person[];trend?:Point[];delta?:number|null;angle?:string;parties?:string[];reports:Report[];outlets:number;heat:number;score:number|null;metricDisplay?:string;publishedAt:string;review?:{score:number;grounds:string[];accepted:boolean}};
type Coverage={name:string;count:number;read:number;status:string;reason?:string};
const coverUrl=import.meta.env.VITE_PUBLIC_DATA==="true"?"../covers/brand.png":"/covers/brand.png";
type Pattern={label:string;count:number;origins:number;brands:string[];examples:{title:string;url:string;brand:string}[]};
type Result={relatedArticles?:Item[];patterns?:Pattern[];results:Item[];reportingOutlets?:number;brief?:{searching?:boolean;reach?:{liveCases?:number;readOrigins:number;matchedOrigins:number;readArticles:number;displayedOrigins:number};coverage:Coverage[]}};
const labels:Record<string,string>={media:"媒体",official:"品牌官方",creator:"创作者",community:"社区"};
const day=(s:string)=>new Intl.DateTimeFormat("zh-CN",{month:"numeric",day:"numeric",timeZone:"Asia/Shanghai"}).format(new Date(s));
function picture(url?:string){
  try{const u=new URL(url||"", "https://cue.invalid");if(u.hostname==="cue.invalid")return /^\/(?:covers|media)\//.test(u.pathname)?u.pathname:undefined;
    return u.protocol==="https:"&&!u.username&&!u.password&&/^[a-z\d.-]+\.[a-z]{2,}$/i.test(u.hostname)&&!u.hostname.endsWith(".local")?u.href:undefined;
  }catch{return undefined;}
}
function Cover({item}:{item:Item}){
  const [failed,setFailed]=useState(false);
  const src=!failed&&(picture(item.imageLocal)||picture(item.image));
  return <a href={item.storyId?storyLink(item.storyId):item.url} target={item.storyId?undefined:"_blank"} rel="noreferrer" aria-label={item.title} style={{backgroundImage:"url("+coverUrl+")",backgroundSize:"cover"}} className="relative block overflow-hidden rounded-tile bg-well">
    <img loading="lazy" className="h-full w-full object-cover" alt="" referrerPolicy="no-referrer" src={src||coverUrl} onError={()=>setFailed(true)}/>
    {!src&&<span className="absolute bottom-1 right-1 rounded-mark bg-white px-1 text-[10px] text-black">配图</span>}
  </a>;
}
function Avatar({person}:{person:Person}){
  const [loaded,setLoaded]=useState(false),url=picture(person.avatar)||picture("https://"+person.domain+"/favicon.ico");
  return <span title={person.name} className="relative inline-flex size-7 items-center justify-center overflow-hidden rounded-full bg-well text-[10px] font-bold text-ink-2 ring-2 ring-bg">{person.name.slice(0,2)}{url&&<img loading="lazy" src={url} alt="" onLoad={()=>setLoaded(true)} onError={()=>setLoaded(false)} referrerPolicy="no-referrer" className={"absolute inset-0 size-full rounded-full bg-well object-contain p-1 "+(loaded?"opacity-100":"opacity-0")}/>}</span>;
}
function Curve({points}:{points:Point[]}){
  const [active,setActive]=useState<number|null>(null),point=active===null?null:points[active];
  return <div className="relative min-w-0 px-1" tabIndex={0} role="slider" aria-label="逐小时热度" aria-valuemin={0} aria-valuemax={23} aria-valuenow={active??23} aria-valuetext={point?String(point.value):String(points.at(-1)?.value)} onBlur={()=>setActive(null)}
    onKeyDown={e=>{if(e.key==="ArrowLeft"||e.key==="ArrowRight"){e.preventDefault();setActive(Math.max(0,Math.min(23,(active??23)+(e.key==="ArrowLeft"?-1:1))));}}}
    onPointerMove={e=>{const r=e.currentTarget.getBoundingClientRect();setActive(Math.max(0,Math.min(23,Math.round(23*(e.clientX-r.left)/r.width))));}} onPointerLeave={()=>setActive(null)}>
    <Sparkline values={points.map(p=>p.value)} className="h-7 w-full"/>
    {point&&<small className="absolute bottom-full left-1 rounded-mark bg-well px-1 text-ink">{new Intl.DateTimeFormat("zh-CN",{hour:"2-digit",minute:"2-digit",timeZone:"Asia/Shanghai"}).format(point.at)} · {point.value}</small>}
  </div>;
}
function HeatRow({item,index}:{item:Item;index:number}){
  const people=item.people||[];
  return <li className="border-t border-line-soft py-4">
    <div className="grid grid-cols-[82px_minmax(0,1fr)] gap-3 sm:grid-cols-[110px_minmax(0,1fr)] lg:grid-cols-[112px_minmax(0,1fr)_minmax(230px,31%)] lg:items-center">
      <div className="grid aspect-[4/3]"><Cover item={item}/></div>
      <div className="min-w-0"><p className="mb-1 text-xs font-semibold text-accent">{String(index+1).padStart(2,"0")}　{item.brand}</p><h3 className="line-clamp-2 font-semibold leading-snug text-ink"><a href={item.storyId?storyLink(item.storyId):item.url} target={item.storyId?undefined:"_blank"} rel="noreferrer">{item.title}</a></h3>{item.content&&<p className="mt-1.5 line-clamp-2 text-sm text-ink-3">{item.content}</p>}</div>
      <div className="col-span-2 grid grid-cols-[1fr_1.1fr_52px] items-center gap-3 lg:col-span-1">
        <div className="flex items-center -space-x-2">{people.slice(0,3).map(p=><Avatar key={p.url} person={p}/>)}{people.length>3&&<span className="relative rounded-full bg-well px-1.5 py-1 text-xs text-ink-3">+{people.length-3}</span>}</div>
        {item.trend&&<Curve points={item.trend}/>}<div className="text-right"><strong className="num text-xl text-ink">{item.heat}</strong><div className="text-xs text-ink-3">{item.delta==null?"新上榜":!item.delta?"持平":(item.delta>0?"↑ ":"↓ ")+Math.abs(item.delta)+"%"}</div></div>
      </div>
    </div>
    <details className="mt-2 text-xs text-ink-3"><summary>参与者 {people.length} · {item.reports.length} 篇相关报道</summary><div className="mt-2 flex flex-wrap gap-2">{people.map(p=><a key={p.url} href={p.url} target="_blank" rel="noreferrer" className="rounded-full bg-well px-2 py-1">{labels[p.role]||"媒体"} · {p.name} ↗</a>)}</div></details>
  </li>;
}
function Podium({item,index}:{item:Item;index:number}){
  const lead=index===0,people=item.people||[];
  const progress=item.reports.filter(r=>r.url!==item.url&&/[一-龥]/.test(r.title)&&!/[ぁ-ヿ]/.test(r.title)).sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt))[0];
  return <article className={"card flex min-w-0 flex-col justify-between p-5 "+(lead?"lg:row-span-2 lg:p-7":"lg:p-5")}>
    <div className="mb-4 flex items-center justify-between"><span className="mono text-xs font-bold tracking-widest text-accent">NO.{String(index+1).padStart(2,"0")}</span><small className="rounded-full bg-well px-2 py-1 text-ink-3">{item.delta==null?"新上榜":item.delta===0?"持平":(item.delta>0?"↑ ":"↓ ")+Math.abs(item.delta)+"%"}</small></div>
    <div className={lead?"grid items-start gap-4 sm:grid-cols-[1.3fr_1fr]":""}><div><h3 className={lead?"text-2xl font-bold leading-tight text-accent lg:text-3xl":"text-lg font-semibold leading-snug text-ink"}><a href={item.storyId?storyLink(item.storyId):item.url} target={item.storyId?undefined:"_blank"} rel="noreferrer">{item.title}</a></h3>{item.content&&item.content!==item.title&&<p className={"mt-2 text-sm leading-relaxed text-ink-3 "+(lead?"line-clamp-4":"line-clamp-2")}>{item.content}</p>}</div>{lead&&<div className="grid aspect-[4/3] overflow-hidden rounded-tile"><Cover item={item}/></div>}</div>
    {lead&&progress&&<p className="mt-4 line-clamp-2 text-sm"><strong className="mr-2 text-accent">最新进展</strong><a href={progress.url} target="_blank" rel="noreferrer">{progress.title}</a></p>}
    <div className="mt-4 flex flex-wrap items-end justify-between gap-2"><details className="min-w-0 text-xs text-ink-3"><summary className="cursor-pointer"><span className="mb-1 flex items-center -space-x-2">{people.slice(0,4).map(p=><Avatar key={p.url} person={p}/>)}{people.length>4&&<span className="rounded-full bg-well p-1">+{people.length-4}</span>}</span>{item.outlets} 个来源 · {people.length} 位报道参与者</summary>{people.map(p=><a key={p.url} className="mt-1 block text-accent" href={p.url} target="_blank" rel="noreferrer">{p.name} ↗</a>)}</details>
    <div className="flex items-end gap-2"><div className={lead?"w-24 lg:w-32":"w-16"}>{item.trend&&<Curve points={item.trend}/>}</div><strong className={lead?"num text-4xl":"num text-2xl"}>{item.heat}</strong></div></div>
  </article>;
}
function SearchRow({item}:{item:Item}){
  return <li className="grid grid-cols-[80px_minmax(0,1fr)] gap-3 border-t border-line-soft py-4 sm:grid-cols-[112px_minmax(0,1fr)]"><div className="grid aspect-[4/3] h-fit"><Cover item={item}/></div><div>
    <p className="mb-1 text-xs text-ink-4">{day(item.publishedAt)} · {item.author||item.publisher} · {labels[item.role||"media"]||"媒体"}</p>
    <h3 className="font-semibold text-ink"><a href={item.storyId?storyLink(item.storyId):item.url} target={item.storyId?undefined:"_blank"} rel="noreferrer">{item.title} ↗</a></h3>
    {item.content&&<p className="mt-1 line-clamp-2 text-sm text-ink-3">{item.content}</p>}
    {item.metricDisplay&&<p className="mt-2 text-xs text-ink-3">{item.metricDisplay}</p>}
    {item.review&&<details className="mt-2 text-xs text-ink-3"><summary>证据评分 {item.review.score} · {item.review.accepted?"已收录":"待核实"}</summary><p className="mt-1">{item.review.grounds.join(" · ")}</p>{item.reports.map(r=><a className="mr-2 text-accent" key={r.url} href={r.url} target="_blank" rel="noreferrer">{r.publisher} ↗</a>)}</details>}
  </div></li>;
}
export default function BrandCases(props:{query?:string;compact?:boolean}){
  const id=new URLSearchParams(useLocation().search).get('story');
  return id&&/^[a-f0-9]{20}$/.test(id)?<BrandStory key={id} id={id}/>:<ReadingCases {...props}/>;
}
function ReadingCases({query="",compact=false}:{query?:string;compact?:boolean}){
  const {data,failed,retry}=useBrandData<Result>(query?"/api/brand-pulse/search?q="+encodeURIComponent(query):"/api/brand-pulse/hot");
  const [visible,setVisible]=useState(24);useEffect(()=>setVisible(24),[query]);
  const [sort,setSort]=useState("推荐"),items=[...(data?.results||[])];
  useEffect(()=>{
    if(query||compact||!data?.patterns?.length||!location.hash.startsWith("#trend-"))return;
    let id;try{id=decodeURIComponent(location.hash.slice(1));}catch{return;}
    const section=document.getElementById(id);
    if(section instanceof HTMLDetailsElement){section.open=true;section.scrollIntoView({block:"start"});}
  },[query,compact,data?.patterns]);
  if(sort==="最新")items.sort((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt));
  if(sort==="证据评分")items.sort((a,b)=>(b.review?.score??0)-(a.review?.score??0));
  return <section aria-label={query?"近期营销案例":"当前品牌热点"} className="mb-6">
    {!compact&&!query&&<header className="mb-5"><p className="mb-1 text-xs font-bold text-accent">● 动态热度</p><h1 className="text-3xl font-bold text-ink">品牌热点榜</h1><p className="mt-2 text-sm text-ink-3">近 7 天的消费营销趋势 · 按近 48 小时报道人气排序</p></header>}

    {query&&data?.brief?.reach&&<p className="mb-2 text-xs text-ink-3">{data.brief.reach.liveCases!=null?("联网找到 "+data.brief.reach.liveCases+" 个案例 · "):""}共 {items.length} 个案例{data.brief.searching?" · 正在联网检索…":""}{data.relatedArticles?.length?(" · "+data.relatedArticles.length+" 篇相关报道"):""}</p>}
    <div className="mb-2 flex items-center justify-between gap-2"><h2 className="font-semibold text-ink">{query?"近 30 天 · 品牌现场":compact?"正在发生":"本期热点"}</h2>
    {compact?<a href={import.meta.env.VITE_PUBLIC_DATA==="true"?"#/hot":"/hot"} className="text-sm text-accent">完整榜单 ↗</a>:query?<select aria-label="事件排序" className="rounded-full bg-well px-2 py-1 text-sm" value={sort} onChange={e=>setSort(e.target.value)}>{["推荐","最新","证据评分"].map(s=><option key={s}>{s}</option>)}</select>:<small className="text-ink-4">参与者 · 24 小时走势 · 热度指数</small>}</div>
    {!data&&<p role="status" className="py-3 text-sm text-ink-3">{failed?<button onClick={retry}>重新加载</button>:query?"正在查找近期案例…":"正在汇集品牌报道…"}</p>}
    {data&&<>{query?<><ol>{items.slice(0,visible).map(r=><SearchRow key={r.url} item={r}/>)}</ol>{items.length>visible&&<button className="rounded-full bg-well px-4 py-2" onClick={()=>setVisible(n=>n+24)}>更多案例（还有 {items.length-visible} 个）</button>}</>:compact?<ol>{items.slice(0,3).map((r,i)=><HeatRow key={r.storyId||r.url} item={r} index={i}/>)}</ol>:<><div className="grid gap-3 lg:grid-cols-[2fr_1fr]">{items.slice(0,3).map((r,i)=><Podium key={r.storyId||r.url} item={r} index={i}/>)}</div>{items.length>3&&<><h2 className="mb-2 mt-6 font-semibold text-ink">继续看 <span className="ml-1 text-sm font-normal text-ink-3">No.04–{items.length}</span></h2><ol start={4} className="card px-4">{items.slice(3).map((r,i)=><HeatRow key={r.storyId||r.url} item={r} index={i+3}/>)}</ol></>}</>}
    {!items.length&&!data.relatedArticles?.length&&<p className="py-4 text-sm text-ink-3">{query?(data.brief?.coverage.some(s=>s.reason)?"部分公开来源暂未返回，本次尚未核实近期案例。":"近 30 天尚未找到可核实的案例。"):"近 48 小时暂无符合选题的事件。"}</p>}
    {query&&Boolean(data.relatedArticles?.length)&&<section className="mt-5"><h3 className="font-semibold">相关报道</h3><ul>{data.relatedArticles?.map(r=><SearchRow key={r.url} item={r}/>)}</ul></section>}
    {query&&data.brief&&<details className="py-2 text-xs text-ink-4"><summary>检索与证据</summary>{data.brief.coverage.map(s=><p key={s.name}>{s.name} · {s.count?s.count+" 条相关案例":s.reason||("已读取 "+s.read+" 条，未命中")}</p>)}<p className="mt-2">可展开各条报道查看评分依据与原文。</p></details>}
    {!query&&!compact&&<details className="py-2 text-xs text-ink-4"><summary>指数依据 · 本榜涉及 {data.reportingOutlets} 个报道来源</summary><p className="mt-2">每个趋势汇集近 7 天的多个案例，近 48 小时至少有两个独立来源报道，同一事件的转载归并，已识别的同集团分站合并。每个来源按最近一篇计 10 分，每过 24 小时减半。曲线按已获取原文的发布时间回算，涨跌与 24 小时前相比。</p></details>}</>}
    {!query&&!compact&&Boolean(data?.patterns?.length)&&<section aria-label="跨品牌动向" className="mb-6"><h2 className="mb-2 font-semibold">跨品牌动向 <span className="text-xs font-normal text-ink-3">近 7 天</span></h2><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{data?.patterns?.map(p=><details id={"trend-"+p.label} key={p.label} className="card p-3"><summary className="cursor-pointer text-sm font-semibold">{p.label}<span className="mt-1 block text-xs font-normal text-ink-3">{p.count} 个事件 · {p.brands.length} 个品牌或 IP · {p.origins} 个来源</span></summary><p className="mt-2 text-xs text-ink-3">{p.brands.slice(0,8).join("、")}</p>{p.examples.map(e=><a className="mt-2 block text-xs text-accent" key={e.url} href={e.url} target="_blank" rel="noreferrer">{e.title} ↗</a>)}</details>)}</div></section>}
  </section>;
}
