import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';

// Apply the reader edition to the pinned upstream sources on each installation.
export async function applyReaderEdition(engine){
  async function edit(file,fn){
    const p=resolve(engine,file);
    await writeFile(p,fn(await readFile(p,'utf8')));
  }
  const app='apps/web/app/';
  const removed=['starred','about','changelog','feedback'];
  for(const route of removed){
    await writeFile(resolve(engine,app+'routes/'+route+'.tsx'),
      'import {redirect} from "react-router";\nexport function loader(){return redirect("/");}\nexport default function Retired(){return null;}\n');
  }
  await edit(app+'components/shell/nav.ts',s=>s.split('\n').filter(line=>!removed.some(k=>line.includes('to: "/'+k+'"'))).join('\n').replace('icon: IconUser, changelog: true','icon: IconUser'));
  await edit('packages/backend/src/publication/sitemap.ts',s=>s.split('\n').filter(l=>!removed.some(k=>l.includes('loc: "/'+k+'"'))).join('\n'));
  await edit('scripts/smoke.ts',s=>s.replace('const problem = res.status !== 200 ?', 'const retired = '+JSON.stringify(removed.map(k=>'/'+k))+'.includes(path);\n    const problem = retired ? (res.status === 302 && res.headers.get("location") === "/" ? null : "old route must redirect to home") : res.status !== 200 ?'));
  await edit(app+'routes/more.tsx',s=>s.replace(/\s*<Group title="关于">[\s\S]*?<\/Group>/,'').split('\n').filter(l=>!l.includes('to: "/starred"')).join('\n'));
  await edit(app+'routes/privacy.tsx',s=>s.replace(', { to: "/feedback", label: "反馈页" }',''));
  for(const file of ['routes/item.tsx','features/feed/FeedItem.tsx']){
    await edit(app+file,s=>s.replace(/\s*<StarButton\b[^>]*\/>/g,''));
  }
  await edit(app+'features/item/ReaderTools.tsx',s=>s.replace('const star = useStar(item);','').replace(/\s*<Tool\s+pressed=\{star\.on\}[\s\S]*?\n\s*\/>/,'').replace('"grid-cols-4" : "grid-cols-3"','"grid-cols-3" : "grid-cols-2"'));
  await edit(app+'routes/agent.tsx',s=>s.replace(/\s*<AsideCard title="没接上？">[\s\S]*?<\/AsideCard>/,'')
    .replace('<header className="lg:pt-5">','<header className="lg:pt-5"><a href="https://lichang1125.github.io/cue-marketing/agent/" target="_blank" rel="noreferrer" className="text-accent underline">公开版连接器、文章 JSON 与 RSS ↗</a>')
    .replace('全部匿名只读，不用注册，也不用 API Key。','本机接口使用当前站点会话，独立客户端可使用公开版连接器。')
    .replace('匿名只读 · 无需 Key','只读接入').replace('匿名 GET，自己写程序取数','通过 GET 读取发布数据')
    .replace('const { healthy, base } = useLoaderData<typeof loader>();','const { healthy, base: configured } = useLoaderData<typeof loader>();\n  const [base,setBase]=useState(configured);useEffect(()=>setBase(window.location.origin),[]);'));
  await edit(app+'features/agent/panels.tsx',s=>s.replace(/<>还连不上：[\s\S]*?<\/>,/,'<>若出现 401，请核对站点访问权限。公开版连接器可独立使用。</>,'));
}

