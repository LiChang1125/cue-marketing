import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash,randomBytes,scryptSync,pbkdf2Sync,createCipheriv} from 'node:crypto';
const [input,privateOutput,previewOutput]=process.argv.slice(2);
if(!input||!privateOutput)throw Error('Usage: provision-accounts.mjs PRIVATE_ROSTER PRIVATE_ACCOUNTS [PREVIEW_RECORDS]');
const roster=JSON.parse(await readFile(input,'utf8')),seen=new Set(),accounts=[],preview=[];
for(const person of roster){const username=person.username.trim().toLowerCase();if(!/^[a-z]{2,40}$/.test(username)||seen.has(username))throw Error('Duplicate or invalid username');seen.add(username);
 const salt=randomBytes(16).toString('base64');accounts.push({username,name:person.name,salt,hash:scryptSync(person.password,salt,64).toString('base64'),disabled:false});
 if(previewOutput){const salt=randomBytes(16),iv=randomBytes(12),key=pbkdf2Sync(username+':'+person.password,salt,150000,32,'sha256'),cipher=createCipheriv('aes-256-gcm',key,iv);const data=Buffer.concat([cipher.update(JSON.stringify({name:person.name,username}),'utf8'),cipher.final(),cipher.getAuthTag()]);preview.push({id:createHash('sha256').update(username).digest('hex'),salt:salt.toString('base64'),iv:iv.toString('base64'),data:data.toString('base64')});}
}
await writeFile(privateOutput,JSON.stringify(accounts),{mode:0o600});if(previewOutput)await writeFile(previewOutput,JSON.stringify(preview));console.log('Provisioned '+accounts.length+' accounts; no plaintext passwords in outputs');
