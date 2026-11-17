import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {existsSync} from 'node:fs';
const revision='86584f5544c66d4e22132f9b87c44a7ea3a32fea';
const sha256='b1c5987f3ec44c233e72c01ced85ea104f600bfc4fae88ddb8215b4208cf1b24';
let bytes;
if(process.env.TRENDRADAR_ARCHIVE)bytes=await readFile(process.env.TRENDRADAR_ARCHIVE);
else{const r=await fetch(`https://codeload.github.com/sansan0/TrendRadar/zip/${revision}`,{signal:AbortSignal.timeout(180000)});
if(!r.ok)throw Error('Upstream download failed: '+r.status);
bytes=Buffer.from(await r.arrayBuffer());}
if(createHash('sha256').update(bytes).digest('hex')!==sha256)throw Error('Upstream archive checksum mismatch');
await mkdir('.tools',{recursive:true});await writeFile('.tools/trendradar-native.zip',bytes);
const python=process.env.PYTHON||(existsSync('.tools/python/Scripts/python.exe')?'.tools/python/Scripts/python.exe':'python');
const script=`import zipfile,pathlib
root=pathlib.Path('.tools/trendradar-native').resolve()
with zipfile.ZipFile('.tools/trendradar-native.zip') as z:
 for n in z.namelist():
  tail='/'.join(n.split('/')[1:])
  if not tail or n.endswith('/'): continue
  p=(root/tail).resolve()
  if not p.is_relative_to(root): raise ValueError('Unsafe archive path')
  p.parent.mkdir(parents=True,exist_ok=True)
  p.write_bytes(z.read(n))
`;
const result=spawnSync(python,['-c',script],{stdio:'inherit',windowsHide:true});if(result.status!==0)throw Error('Upstream extraction failed');
console.log('Complete, unmodified TrendRadar installed: '+revision);
