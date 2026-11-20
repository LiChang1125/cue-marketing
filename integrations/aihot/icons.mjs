import {createRequire} from 'node:module';import {resolve} from 'node:path';import {readFile,writeFile,cp} from 'node:fs/promises';
const root=resolve('.tools/aihot-upstream'),sharp=createRequire(resolve(root,'package.json'))('sharp'),dir=resolve(root,'site/brand'),svg=await readFile('public/favicon.svg');
for(const [file,size] of [['icon.png',512],['icon-192.png',192],['apple-icon.png',180]])await sharp(svg).resize(size,size).png().toFile(resolve(dir,file));
const image=await sharp(svg).resize(48,48).png().toBuffer(),header=Buffer.alloc(22);
header.writeUInt16LE(1,2);header.writeUInt16LE(1,4);header[6]=48;header[7]=48;header.writeUInt16LE(1,10);header.writeUInt16LE(32,12);header.writeUInt32LE(image.length,14);header.writeUInt32LE(22,18);await writeFile(resolve(dir,'favicon.ico'),Buffer.concat([header,image]));
// Report nameplates are cropped only when an image is provided. Replace the template art.
const plates={daily:'品牌日报',weekly:'品牌周报',monthly:'品牌月报',archive:'往期日报'};
for(const [period,label] of Object.entries(plates)){
 const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 160"><text x="10" y="123" font-family="Microsoft YaHei,Noto Sans CJK SC,sans-serif" font-size="110" font-weight="bold" fill="currentColor">'+label+'</text></svg>';
 await writeFile(resolve(dir,'nameplates',period+'.svg'),svg);
}
await writeFile(resolve(dir,'nameplates/index.json'),JSON.stringify(Object.fromEntries(Object.keys(plates).map(k=>[k,'0 0 720 160']))));