// AIHOT's upstream regression cases contain concrete AI companies, tags and topic URLs.
// Exercise the same membership, correction and withdrawal assertions with this site's catalogue.
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {windowsBackupFixtures} from './windows-backup-fixtures.mjs';

export async function customizeFixtures(engine,archive){
  const edit=async(file,fn)=>{const path=join(engine,file);await writeFile(path,fn(await readFile(path,'utf8')));};
  const cases=['topics','mentions','topic-membership','topic-cache-deadline','topics-withdrawal','reading','pool-relevance','content-publication','discovery-focus','discovery-scope','independent-selected'];
  const labels=[
    ['Kimi / 月之暗面','POP MART / 泡泡玛特'],['月之暗面 / Kimi','泡泡玛特 / POP MART'],
    ['Agent 智能体','亚文化'],['开源/仓库','快闪'],['model-releases','collabs'],['open-source','retail'],
    ['"agent"','"subculture"'],["'agent'","'subculture'"],['"Agent"','"亚文化"'],['Agent:', '"亚文化":'],
    ['Anthropic','Nike'],['ANTHROPIC','NIKE'],['anthropic','nike'],['OpenAI','Disney'],['openai','disney'],
    ['Claude','Jordan'],['claude','jordan'],['Sonnet','Air Max'],['ChatGPT','Disney Parks'],
    ['Metadata','Adidasdata'],['Meta的新','Adidas的新'],['"meta"','"adidas"'],['entity:meta','entity:adidas'],
    ['Qwen Team','Nintendo Co.'],['Qwen','Nintendo'],['qwen','nintendo'],['Kimi','POP MART'],['kimi','popmart'],
    ['MiniMax','LEGO'],['minimax','lego'],['"cursor"','"lego"'],['英伟达','泡泡玛特'],['nvidia','popmart'],
    ['谷歌','任天堂'],['google','nintendo'],['world-labs','nike'],['World Labs','Nike'],
    ['xai','nintendo'],['SpaceXSI','Nintendo Co.'],['Grok Bot','Nintendo Switch'],['"Muse"','"adidas Originals"']
  ];
  for(const name of cases)await edit('tests/'+name+'.test.ts',s=>{
    for(const [a,b] of labels)s=s.replaceAll(a,b);
    // Display tags use Chinese names. English names in headlines still test source-language matching.
    if(name==='topics')s=s.replaceAll('"Nike", "Disney"','"耐克", "迪士尼"').replaceAll('Nike: "nike"','"耐克": "nike"').replaceAll('Disney: "disney"','"迪士尼": "disney"');
    if(name==='topics')s=s.replace('["nike", "subculture", "retail", "collabs"]','["nike", "subculture", "collabs", "retail"]');
    if(name==='discovery-focus')s=s.replaceAll('nintendo','google'); // robots metadata belongs to Google
    if(name==='content-publication')s=s.replace('AMD + Nike','Disney + Nike');
    return s;
  });
  await edit('tests/category-corrections.test.ts',s=>s.replaceAll('品牌联名/更新','品牌合作').replaceAll('产品发布/更新','新品与零售'));
  await edit('tests/page-metadata.standalone.test.ts',s=>s.replaceAll('category=paper','category=culture'));
  await archiveChecks(engine,archive);
  // Windows reuses process IDs before a long run has finished. File names identify test suites.
  await edit('tests/databases.ts',s=>s.replace('const copy = `${name}_f${process.pid}_${suffix}`;','const fileId = Buffer.from((await import("node:crypto")).createHash("sha256").update(process.argv[1]!).digest().subarray(0,6)).readUIntBE(0,6);\n    const copy = `${name}_f${fileId}_${suffix}`;'));
  await edit('apps/web/tests/navigation-performance.test.ts',s=>s.replaceAll("name:'模型',exact:true","name:'IP 联名',exact:true").replaceAll("name:'产品',exact:true","name:'新品与零售',exact:true"));
  await edit('apps/web/tests/article-outline.test.ts',s=>s.replace('        await page.evaluate(() => window.scrollTo(0, 800));','').replace('        const before = await page.evaluate(() => scrollY);','        // WebKit may finish moving the page to a focused outline link asynchronously.\n        // Establish the outside scroll position after focus has settled, before pressing a key.\n        await page.waitForTimeout(350);\n        await page.evaluate(() => window.scrollTo(0, 800));\n        await expect.poll(()=>page.evaluate(()=>scrollY)).toBe(800);\n        const before = await page.evaluate(() => scrollY);'));
  if(process.platform==='win32') {
    await windowsBackupFixtures(edit);
    await edit('tests/outbound-headers.standalone.test.ts',s=>s.replace('console.log(JSON.stringify({ results, requests })); process.exit(0);','mock.restoreAll(); console.log(JSON.stringify({ results, requests }));'));
    await edit('tests/error-logging.test.ts',s=>s.replace('timeout: 10_000','timeout: 30_000'));
    await edit('tests/outbound-protocol.standalone.test.ts',s=>s.replace('error = String(failure);','error = String(failure) + ": " + String(failure.cause);'));
  }
}


export async function archiveChecks(engine,archive){
  const edit=async(file,fn)=>{const path=join(engine,file);await writeFile(path,fn(await readFile(path,'utf8')));};
  // GitHub source archives contain the tracked filenames but do not contain a Git index.
  const manifest=execFileSync('tar',['-tzf',archive],{encoding:'utf8'}).split(/\r?\n/).map(s=>s.slice(s.indexOf('/')+1)).filter(s=>s&&!s.endsWith('/'));
  const tracked=manifest.filter(s=>s.endsWith('.env.example')||s.endsWith('.service'));
  await edit('tests/architecture.test.ts',s=>s.replace(/^import \{ execFileSync \} from "node:child_process";\r?\n/m,'').replace(/^const tracked = .*;$/m,'const tracked = (pattern: string) => '+JSON.stringify(tracked)+'.filter(name => name.endsWith(pattern.slice(1)));'));
  // Scan all files archived upstream as well as our reader and importer. A tarball
  // has no reliable git index, and the parent repository can otherwise hide a violation.
  const files=[...new Set([...manifest,'apps/web/app/components/BrandCases.tsx','scripts/import-cue.ts','packages/backend/src/lib/proxy-transport.ts'])];
  await writeFile(join(engine,'.cue-source-files.json'),JSON.stringify(files));
  await edit('tests/outbound-protocol.standalone.test.ts',s=>{
    const start=s.indexOf('  const { stdout } = await exec("git"');
    if(start<0)return s;
    const end=s.indexOf('  assert.equal(stdout',start);
    return s.slice(0,start)+
      '  const {readFileSync}=await import("node:fs");\n'+
      '  const root=new URL("../",import.meta.url);\n'+
      '  const files=JSON.parse(readFileSync(new URL(".cue-source-files.json",root),"utf8")) as string[];\n'+
      '  const stdout=files.filter(p=>p!=="tests/outbound-protocol.standalone.test.ts").filter(p=>{const bytes=readFileSync(new URL(p,root));return !bytes.includes(0)&&/rejectUnauthorized\\s*:\\s*false|NODE_TLS_REJECT_UNAUTHORIZED/.test(bytes.toString("utf8"));}).join("\\n");\n'+
      s.slice(end);
  });
}
