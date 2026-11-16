import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {homedir} from 'node:os';
import {existsSync,realpathSync} from 'node:fs';
const root=fileURLToPath(new URL('../',import.meta.url));
const plugin=resolve(root,'adapters/zhichao-sources');
const installed=resolve(homedir(),'.opencli/plugins/zhichao-sources');
if(existsSync(installed)&&realpathSync(installed)===realpathSync(plugin)){
  console.log('CUE 只读适配器已连接到当前项目。');
  process.exit(0);
}
const result=spawnSync(process.execPath,[resolve(root,'node_modules/@jackwener/opencli/dist/src/main.js'),'plugin','install','file://'+plugin],{cwd:root,stdio:'inherit',windowsHide:true});
if(result.error)throw result.error;
process.exitCode=result.status??1;
