import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
const args=process.argv.slice(2);
if(!args.includes('--base'))args.push('--base',process.env.CUE_PULSE_WEB||'http://127.0.0.1:4390');
const run=spawnSync(process.execPath,['scripts/smoke.ts',...args],{cwd:resolve('.tools/aihot-upstream'),stdio:'inherit'});
if(run.error)throw run.error;
process.exitCode=run.status??1;
