import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
export const revision='86584f5544c66d4e22132f9b87c44a7ea3a32fea';
await mkdir('.tools/trendradar/trendradar/crawler',{recursive:true});
await mkdir('.tools/trendradar/trendradar/crawler/rss',{recursive:true});
for(const path of ['trendradar/crawler/fetcher.py','trendradar/crawler/rss/parser.py','LICENSE']){
 const response=await fetch(`https://raw.githubusercontent.com/sansan0/TrendRadar/${revision}/${path}`,{signal:AbortSignal.timeout(30000)});
 if(!response.ok)throw Error('TrendRadar download failed '+response.status);
 const bytes=Buffer.from(await response.arrayBuffer());
 if(path.endsWith('.py')){const gitBlob=createHash('sha1').update(Buffer.from(`blob ${bytes.length}\0`)).update(bytes).digest('hex');if(gitBlob!==(path.endsWith('parser.py')?'8f38ecbd85e1db7f90c20570eaeb6b4799bc7b95':'7fbc6d745fa3ac0be73a3320b56710b71ba15f16'))throw Error('TrendRadar upstream checksum mismatch');}
 await writeFile('.tools/trendradar/'+path,bytes);
}
console.log('TrendRadar collector installed at pinned revision '+revision);
