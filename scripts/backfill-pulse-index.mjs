import {pressIndex} from '../integrations/hot-monitor/press-index.mjs';
const idx=pressIndex(process.argv[2]||'.artifacts/hot-monitor-preview');
const target=Number(process.argv[3]||1500),limit=Number(process.argv[4]||4000);
if(!Number.isSafeInteger(target)||target<1||!Number.isSafeInteger(limit)||limit<1)throw Error('请输入有效的来源目标和批次数');
const base=Math.floor(Date.now()/900000)*900000-900000;
let next=0,ok=0,failed=0,count=idx.sourceCount();
const stop=new AbortController();
process.once('SIGINT',()=>stop.abort());
async function worker(){
 while(count<target&&next<limit&&!stop.signal.aborted){
  const slot=next++;
  try{await idx.minute(base-((slot*173)%2773)*900000+(1+Math.floor(slot/2773)%2)*60000,stop.signal);ok++;}catch{failed++;}
  if((ok+failed)%12===0){count=idx.sourceCount();console.log(ok,failed,'indexed domains',count);}
 }
}
try{await Promise.all(Array.from({length:18},worker));console.log('indexed domains',idx.sourceCount(),'read',ok,'failed',failed);}finally{idx.close();}
