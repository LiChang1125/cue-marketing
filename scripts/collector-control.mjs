import {mkdirSync,writeFileSync,unlinkSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
const directory=resolve(process.env.DATA_DIR||'data'),file=resolve(directory,'collector.pause');
const action=process.argv[2];
if(!['pause','resume'].includes(action))throw Error('用法：collector-control.mjs pause|resume');
mkdirSync(directory,{recursive:true});
if(action==='pause'){writeFileSync(file,new Date().toISOString());console.log('已暂停新的浏览器采集。当前读取结束后，可在云端浏览器登录；网站阅读及公开新闻更新不受影响。');}
else{if(existsSync(file))unlinkSync(file);writeFileSync(resolve(directory,'collector-resume'),new Date().toISOString());console.log('已恢复后台采集；下一轮将重新检查平台连接。');}
