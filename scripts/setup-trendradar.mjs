import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
export const revision='86584f5544c66d4e22132f9b87c44a7ea3a32fea';
await mkdir('.tools/trendradar/trendradar/crawler',{recursive:true});
await mkdir('.tools/trendradar/trendradar/crawler/rss',{recursive:true});
const files={
  "trendradar/core/analyzer.py": "716a3b30efcdb40a8dd7ca4c500d5177ba7695aa",
  "trendradar/core/frequency.py": "7fe3a2c9793dccb09a8d813f5b1dbb0f5f5cd484",
  "trendradar/utils/time.py": "f802ff9f911d84c4800e28b37d4c397fbd633c51",
  "trendradar/report/generator.py": "721915ac48e29acd2882f5ccd69698396bab0be4",
  "trendradar/report/rss_html.py": "a19f28c67bb01d6ea289aa8e2b15e6582dec73bd",
  "trendradar/report/helpers.py": "c9e3b1daaffd2d39a26502272778aaa18b4c77a5",
  "trendradar/crawler/fetcher.py": "7fbc6d745fa3ac0be73a3320b56710b71ba15f16",
  "trendradar/crawler/rss/parser.py": "8f38ecbd85e1db7f90c20570eaeb6b4799bc7b95"
};
for(const path of [...Object.keys(files),'LICENSE']){
 if(path.includes('/'))await mkdir('.tools/trendradar/'+path.slice(0,path.lastIndexOf('/')),{recursive:true});
 const response=await fetch(`https://raw.githubusercontent.com/sansan0/TrendRadar/${revision}/${path}`,{signal:AbortSignal.timeout(30000)});
 if(!response.ok)throw Error('TrendRadar download failed '+response.status);
 const bytes=Buffer.from(await response.arrayBuffer());
 if(files[path]){const hash=createHash('sha1').update(Buffer.from(`blob ${bytes.length}\0`)).update(bytes).digest('hex');if(hash!==files[path])throw Error('TrendRadar upstream checksum mismatch');}
 await writeFile('.tools/trendradar/'+path,bytes);
}
console.log('TrendRadar collector, keyword analysis and report renderer installed at '+revision);
