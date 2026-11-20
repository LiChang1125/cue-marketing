import {useState} from "react";
import {useBrandData} from "../lib/use-brand-data";
import {Link,useLocation} from "react-router";
import {PhoneBar} from "../components/shell/PhoneBar";
export const handle={tab:"me",name:"品牌工具"};
type Base={title:string;url:string;publisher:string;names:string[]};
type Leader={name:string;focus?:{label:string;count:number}[];logo?:string;reason?:string;example?:string;current:number;previous:number;delta:number;outlets:number;cases:{title:string;url:string;date:string}[]};
type Moment=Base&{start:string;end:string|null;evidence:string};
type Tools={ranking:Leader[];calendar:Moment[];today:string};
const tabs=[["ranking","品牌榜"],["calendar","营销日历"]] as const;
const formats=["品牌榜","营销日历"];
const short=(d:string)=>d.slice(5,10).replace("-","/");
const button="rounded-full px-3 py-1.5 text-sm ring-1 ring-inset ring-line-soft";
function monthAt(month:string,offset:number){const [year,m]=month.split("-").map(Number);return new Date(Date.UTC(year!,m!-1+offset,1)).toISOString().slice(0,7);}
function Story({item}:{item:Base}){return <><small className="text-ink-4">{item.publisher}</small><h3 className="mt-1 text-base font-semibold text-ink"><a href={item.url} target="_blank" rel="noreferrer">{item.title} ↗</a></h3></>}
function Calendar({data}:{data:Tools}){
  const [month,setMonth]=useState(data.today.slice(0,7)),[date,setDate]=useState("");
  function move(n:number){setMonth(monthAt(month,n));setDate("");}
  const days=new Date(Date.parse(monthAt(month,1)+"-01T00:00:00Z")-86400000).getUTCDate();
  const blanks=(new Date(month+"-01T00:00:00Z").getUTCDay()+6)%7;
  const eventsFor=(d:string)=>data.calendar.filter(e=>e.start<=d&&(e.end||e.start)>=d);
  const events=date?eventsFor(date):data.calendar.filter(e=>e.start<=(month+"-31")&&(e.end||e.start)>=(month+"-01"));
  return <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(240px,0.8fr)_1.3fr]">
    <div className="card h-fit p-4">
      <div className="flex items-center justify-between"><button className={button} aria-label="上个月" onClick={()=>move(-1)}>‹</button><strong>{month.replace("-"," 年 ")} 月</strong><button className={button} aria-label="下个月" onClick={()=>move(1)}>›</button></div>
      <div className="mt-4 grid grid-cols-7 gap-1 text-center text-sm">{Array.from("一二三四五六日",d=><span key={d} className="pb-2 text-xs text-ink-4">{d}</span>)}{Array.from({length:blanks},(_,i)=><span key={"b"+i}/>)}{Array.from({length:days},(_,i)=>{const d=month+"-"+String(i+1).padStart(2,"0"),has=eventsFor(d).length>0;return <button type="button" key={d} aria-label={d+"，"+eventsFor(d).length+"项活动"} aria-pressed={date===d} onClick={()=>setDate(date===d?"":d)} className={"relative min-h-10 rounded-tile "+(date===d?"bg-accent text-white":d===data.today?"bg-accent-soft text-accent":"text-ink")}>{i+1}{has&&<span aria-hidden="true" className="absolute inset-x-0 bottom-1 mx-auto size-1 rounded-full bg-current"/>}</button>})}</div>
      <button className="mt-3 text-xs text-accent" onClick={()=>{setMonth(data.today.slice(0,7));setDate("");}}>回到本月</button>
    </div><div><h2 className="mb-2 text-sm text-ink-3">{date?short(date):"本月活动"} · {events.length} 项</h2>{events.map(e=><article key={e.url} className="border-b border-line-soft py-3"><span className="mr-2 text-xs font-semibold text-accent">{short(e.start)}{e.end?" – "+short(e.end):""}</span><Story item={e}/><p className="mt-2 text-sm text-ink-3">{e.evidence}</p></article>)}{!events.length&&<p className="text-sm text-ink-4">这段时间尚无已核实日程。</p>}</div>
  </div>;
}
function CasePage({name,page}:{name:string;page:number}){
  const {data,failed,retry}=useBrandData<{items:{title:string;url:string;date:string;outlets:number;reports:{url:string;publisher:string;attribution?:string}[]}[];total:number}>("/api/brand-pulse/brand-cases?brand="+encodeURIComponent(name)+"&page="+page);
  const [more,setMore]=useState(false);
  if(!data)return failed?<button onClick={retry}>重新读取案例</button>:<p>正在读取案例…</p>;
  return <>{data.items.map(c=><div className="my-3" key={c.url}><a target="_blank" rel="noreferrer" href={c.url}>{short(c.date)}　{c.title} ↗</a><div className="mt-1 flex flex-wrap gap-2 text-xs text-ink-3"><span>{c.outlets} 个来源</span>{c.reports.map(r=><a key={r.url} href={r.url} target="_blank" rel="noreferrer">{r.publisher}{r.attribution&&r.attribution!==r.publisher?"（稿源："+r.attribution+"）":""} ↗</a>)}</div></div>)}{data.total>page*8&&(more?<CasePage name={name} page={page+1}/>:<button className="text-sm text-accent" onClick={()=>setMore(true)}>更多案例</button>)}</>;
}
export default function BrandTools(){
  const path=useLocation().pathname.split("/").pop(),title=formats[tabs.findIndex(t=>t[0]===path)]||"品牌工具";
  const {data,failed,retry}=useBrandData<Tools>("/api/brand-pulse/tools");
  const {data:hot}=useBrandData<{patterns?:{label:string;brands:string[];count:number;origins:number}[]}>("/api/brand-pulse/hot");
  const [openBrands,setOpenBrands]=useState<Set<string>>(()=>new Set());
  const [order,setOrder]=useState("报道来源"),[query,setQuery]=useState("");
  const ranking=(data?.ranking||[]).filter(r=>r.name.toLowerCase().includes(query.trim().toLowerCase())).sort((a,b)=>order==="较上周新增"?b.delta-a.delta:order==="报道来源"?b.outlets-a.outlets:b.current-a.current);
  return <div className="pb-10"><PhoneBar title={title} large/><h1 className="mb-4 hidden text-2xl font-bold text-ink lg:block">{title}</h1>
    <nav aria-label="品牌工具" className="flex flex-wrap gap-2">{tabs.map(([id,label])=><Link className={button+(path===id?" bg-ink text-white":" text-ink-3")} aria-current={path===id?"page":undefined} to={"/brand-lab/"+id} key={id}>{label}</Link>)}</nav>
    {!data&&<p role="status" className="my-6 text-sm text-ink-3">{failed?<button onClick={retry}>读取失败 · 重试</button>:"正在汇集品牌案例…"}</p>}
    {data&&path==="ranking"&&<><div className="my-4 flex flex-wrap items-center justify-between gap-2"><p className="text-sm text-ink-3">近七日 · 至少四个报道来源</p><div className="flex flex-wrap gap-2"><input aria-label="筛选品牌" value={query} onChange={e=>setQuery(e.target.value)} placeholder="筛选品牌或 IP" className={button+" bg-well"}/><select aria-label="品牌榜排序" className={button+" bg-well"} value={order} onChange={e=>setOrder(e.target.value)}>{["报道来源","事件数","较上周新增"].map(x=><option key={x}>{x}</option>)}</select></div></div>
    <ol className="grid gap-3 md:grid-cols-2">{ranking.map((b,i)=><li key={b.name} className="card p-5"><div className="flex items-center gap-3">
    <div className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-tile bg-well">{b.logo?<img src={b.logo} alt={b.name+"标志"} className="size-9 object-contain"/>:<span className="font-bold text-ink-3">{b.name.slice(0,2)}</span>}</div>
    <div className="min-w-0 flex-1"><span className="mono text-xs text-accent">NO.{String(i+1).padStart(2,"0")}</span><h2 className="text-xl font-bold text-ink">{b.name}</h2></div><span className="text-xs text-ink-3">{b.outlets} 个来源</span></div>
    {hot?.patterns?.filter(p=>p.brands.includes(b.name)).slice(0,2).map(p=><Link key={p.label} className="mt-2 block text-xs text-accent" to={"/hot#"+encodeURIComponent("trend-"+p.label)}>{p.label} · {p.count} 个事件 ↗</Link>)}
    {Boolean(b.focus?.length)&&<p className="mt-3 text-xs font-medium text-accent">{b.focus?.map(t=>t.label+" "+t.count+" 件").join(" · ")}</p>}
    {b.reason&&<p className="my-3 text-sm leading-relaxed text-ink"><a href={b.example} target="_blank" rel="noreferrer">{b.reason} ↗</a></p>}
    <p className="my-3 text-xs text-ink-3">本周 {b.current} 个事件 · 较上周{b.delta===0?"持平":b.delta>0?"增加 "+b.delta+" 件":"减少 "+Math.abs(b.delta)+" 件"}</p>
    <details className="border-t border-line-soft pt-2" onToggle={e=>{if(e.currentTarget.open)setOpenBrands(prev=>prev.has(b.name)?prev:new Set([...prev,b.name]));}}><summary className="cursor-pointer text-xs text-accent">查看上榜依据</summary>{openBrands.has(b.name)&&<CasePage name={b.name} page={1}/>}<Link className="text-xs text-accent" to={"/all?q="+encodeURIComponent(b.name)}>搜索这个品牌</Link></details></li>)}</ol>{!ranking.length&&<p className="my-4 text-sm text-ink-4">没有匹配的品牌。</p>}</>}
    {data&&path==="calendar"&&<Calendar data={data}/>}
  </div>;
}


