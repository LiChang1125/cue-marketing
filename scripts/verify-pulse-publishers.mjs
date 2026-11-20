import {publisherDesk} from '../integrations/hot-monitor/publisher-desk.mjs';
const desk=publisherDesk(process.argv[2]||'.artifacts/hot-monitor-preview');
await desk.refresh(16);const status=desk.summary(),live=status.filter(s=>s.active);
console.log('可用出版域名',live.length,'检查',status.length,'近期原文',desk.items().length);desk.close();
process.exitCode=live.length>100?0:1;
