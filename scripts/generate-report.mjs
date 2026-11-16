import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {mkdirSync,writeFileSync} from 'node:fs';
import {openStore} from '../server/store.js';
import {collectSource,sourceDefinitions} from '../server/sources.js';
import {buildReport,reportSchedule} from '../server/reports.js';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const directory=process.env.DATA_DIR||resolve(root,'data'),store=openStore(directory);
try{
  const existing=store.report(reportSchedule().day);
  if(existing?.editorial||existing?.status==='ready'&&!process.argv.includes('--refresh')){
    console.log(JSON.stringify({date:existing.date,newsDate:existing.newsDate,status:existing.status,entries:existing.entries.length,cached:true}));
  }else{
    for(const source of sourceDefinitions.filter(s=>['socialbeta','brandstar'].includes(s.id))){
      const at=new Date().toISOString(),prior=store.sources().find(s=>s.id===source.id);
      try{const items=await collectSource(source.id,at);store.saveItems(items,at);store.saveSource({...source,state:'ok',lastSuccess:at,attemptedAt:at,count:items.length});}
      catch(e){store.saveSource({...source,state:'error',lastSuccess:prior?.lastSuccess||null,attemptedAt:at,message:e.message});}
    }
    const report=await buildReport(store.items(),store.sources());
    store.saveReport(report);
    mkdirSync(resolve(directory,'reports'),{recursive:true});
    writeFileSync(resolve(directory,'reports',report.date+'.json'),JSON.stringify(report,null,2));
    console.log(JSON.stringify({date:report.date,newsDate:report.newsDate,status:report.status,entries:report.entries.length}));
    if(report.status!=='ready')process.exitCode=1;
  }
}finally{store.close();}
