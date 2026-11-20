import {brandNewsrooms,sections} from '../integrations/hot-monitor/brand-newsrooms.mjs';
const desk=brandNewsrooms(process.argv[2]||'.artifacts/hot-monitor-preview');
const target=Number(process.argv[3]||1600),offset=Number(process.argv[4]||0);
if(!Number.isSafeInteger(target)||target<1||!Number.isSafeInteger(offset)||offset<0)throw Error('批次参数无效');
const jobs=Array.from({length:100},(_,i)=>sections.map(s=>[s,1+(i*17)%100])).flat().slice(offset);let completed=0,failed=0;
async function backfill(){while(jobs.length&&desk.channels().length<target){
 const [section,page]=jobs.shift();try{await desk.page('main_category',section,page);completed++;}catch{failed++;}
 if((completed+failed)%8===0)console.log(completed,failed,desk.channels().length,'active official newsrooms');
}}
try{await Promise.all(Array.from({length:6},backfill));console.log(desk.channels().length,'active official newsrooms');}finally{desk.close();}
