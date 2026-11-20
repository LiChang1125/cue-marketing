// Windows cannot execute POSIX shebang fixtures, chmod a directory to mode zero,
// or send SIGSTOP. Keep the real database, real tar/restore and every assertion.
// Inject the same OS errors at the filesystem/command boundary on this platform.
export async function windowsBackupFixtures(edit){
  await edit('packages/backend/src/operations/backup.ts',s=>s
    .replace('runBackup(now = new Date())','runBackup(now = new Date(), { command = run, rootStat = stat, listFiles = readdir } = {})')
    .replaceAll('await run("pg_', 'await command("pg_').replace('() => run("tar"', '() => command("tar"')
    .replace('await stat(path.join(config.dataDir, d))','await rootStat(path.join(config.dataDir, d))')
    .replace('await readdir(path.join(config.dataDir, d),','await listFiles(path.join(config.dataDir, d),'));
  await edit('tests/backup.test.ts',s=>{
    s=s.replace('await symlink("uploads", path.join(config.dataDir, "uploads"));','const loop = Object.assign(new Error("ELOOP reading uploads"), {code:"ELOOP"});')
      .replace('runBackup(new Date("2026-11-01T04:01:00Z"))','runBackup(new Date("2026-11-01T04:01:00Z"), {rootStat: async () => {throw loop;}})')
      .replace('await chmod(directory, 0);','const denied = Object.assign(new Error("EACCES reading attachments"), {code:"EACCES"});')
      .replace('assert.rejects(runBackup(NOW), /database backed up, but the file archive failed:.*EACCES/)', 'assert.rejects(runBackup(NOW,{listFiles:async()=>{throw denied;}}), /database backed up, but the file archive failed:.*EACCES/)')
      .replace('finally { await chmod(directory, 0o700); }','finally { assert.ok(await readFile(path.join(directory,"file.txt"))); }');
    const from=s.indexOf('  const bin =',s.indexOf('async function withPackingFailures')), end=s.indexOf('\n}',from);
    s=s.slice(0,from)+`  let attempts=0;
  const command = (async (...args: Parameters<typeof run>)=>{
    if(args[0]==="tar" && ++attempts<=failures)throw Object.assign(new Error("fixture"),{stderr:"fictional packing failure"});
    return run(...args);
  }) as typeof run;
  await action(async()=>attempts,command);`+s.slice(end);
    s=s.replace('action: (count: () => Promise<number>)','action: (count: () => Promise<number>, command: typeof run)').replaceAll('async count => {','async (count,command) => {');
    const a=s.indexOf('test("packing retries'),b=s.indexOf('test("local retention',a);
    s=s.slice(0,a)+s.slice(a,b).replaceAll('runBackup(NOW)','runBackup(NOW,{command})')+s.slice(b);
    const fake=s.indexOf('  await writeFile(path.join(bin, "pg_dump")'),next=s.indexOf('  const originalUrl',fake);
    s=s.slice(0,fake)+`  const command=(async (tool:string,args:string[],options:{env:NodeJS.ProcessEnv})=>{
    assert.equal(tool,"pg_dump");
    await writeFile(captured,JSON.stringify({args,user:options.env.PGUSER,password:options.env.PGPASSWORD}));
    throw Object.assign(new Error("fictional dump refusal"),{stderr:"fictional dump refusal"});
  }) as typeof run;
`+s.slice(next);
    s=s.replace('process.env.PATH = `${bin}:${originalPath}`;','').replace('assert.rejects(runBackup(NOW), (error: Error)', 'assert.rejects(runBackup(NOW,{command}), (error: Error)');
    // Gate child completion with IPC while the real tar runs. The worker must drain the job.
    s=s.replace('const exec = cp.execFile;',`const exec = cp.execFile;
      let finishTar;
      const drain = new Promise(ok=>{finishTar=ok});
      process.on("message", m=>{if(m==="shutdown"){process.emit("SIGTERM");finishTar();}});`)
      .replace('const child = exec(...args);',`if(args[0]==="tar") {const callback=args.pop();args.push((...reply)=>drain.then(()=>callback(...reply)));}
        const child = exec(...args);`)
      .replace('process.kill(held, "SIGSTOP");','').replace('process.kill(child.pid!, "SIGTERM");','child.send("shutdown");')
      .replaceAll('process.kill(held, "SIGCONT")','void held').replace('process.kill(-child.pid!, "SIGKILL")','child.kill()');
    return s.replace('timeout: 30_000','timeout: 90_000').replace('Date.now() + 15_000','Date.now() + 50_000').replace("import { chmod, mkdir","import { mkdir").replace("rm, symlink, writeFile","rm, writeFile").replaceAll("}) as typeof run;","}) as unknown as typeof run;");
  });
}

