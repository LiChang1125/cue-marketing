import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';

const revision='262391603f3c2807606bffa0170547273fc273e5';
const digest='f875a1d563a9dd7235dc7acd2b7556d1345e04448270262efa8e5f720668c577';
export async function prepareLast30(){
  const root=resolve('.tools/last30days',revision),archive=join(root,'source.tar.gz');
  await mkdir(root,{recursive:true});
  let bytes;
  try{bytes=await readFile(process.env.CUE_LAST30_ARCHIVE||archive);}
  catch{
    const r=await fetch('https://codeload.github.com/mvanhorn/last30days-skill/tar.gz/'+revision,{signal:AbortSignal.timeout(120000)});
    if(!r.ok)throw Error('无法下载 last30days '+r.status);
    bytes=Buffer.from(await r.arrayBuffer());
  }
  if(createHash('sha256').update(bytes).digest('hex')!==digest)throw Error('last30days 版本校验失败');
  await writeFile(archive,bytes);
  const prefix='last30days-skill-'+revision+'/';
  execFileSync('tar',['-xzf',archive,'--strip-components=1','-C',root,prefix+'skills/last30days/scripts',prefix+'LICENSE']);
}

