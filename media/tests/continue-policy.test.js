const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const db={streamShellContinueWatchingCompletePercent:80};
const chrome={storage:{local:{get:async keys=>Object.fromEntries((Array.isArray(keys)?keys:[keys]).map(k=>[k,db[k]])),set:async values=>Object.assign(db,values)},onChanged:{addListener(){}}}};
const c=vm.createContext({chrome,window:{},console});
vm.runInContext(fs.readFileSync(path.join(root,'media/continue-watching.js'),'utf8'),c);
const shell=fs.readFileSync(path.join(root,'common/shell.js'),'utf8');const start=shell.indexOf('    async function updateContinueWatching(media)');const end=shell.indexOf('    async function cancelPendingProviderResume',start);
Object.assign(c,{CONTINUE_WATCHING_STORAGE_KEY:'streamShellContinueWatching',CONTINUE_WATCHING_MAX_ITEMS:50,continueWatchingCompletePercent:80,getProviderMediaIdentity:(p,u)=>p+u,normalizeContinueWatchingItem:x=>x});vm.runInContext(shell.slice(start,end),c);
(async()=>{
const api=c.window.StreamShellContinueWatching;
assert.equal((await api.getPolicy()).minPercent,5);
const media={provider:'youtube',title:'Test',url:'https://youtube.com/watch?v=test',duration:1000,currentTime:10};
await c.updateContinueWatching(media);assert.equal(db.streamShellContinueWatching,undefined,'brief progress is not written');
await c.updateContinueWatching({...media,currentTime:100});assert.equal(db.streamShellContinueWatching.length,1);
await api.setPolicy({disabledProviders:['youtube']});await c.updateContinueWatching({...media,url:media.url+'2',currentTime:100});assert.equal(db.streamShellContinueWatching.length,1,'disabled provider cannot add');
await api.setPolicy({disabledProviders:[]});await c.updateContinueWatching({...media,currentTime:800});assert.equal(db.streamShellContinueWatching.length,0,'completion removes entry');
await api.setPolicy({minPercent:99});assert.equal((await api.getPolicy()).minPercent,79,'bounds ordered');
console.log('Continue policy: admission, disabled providers, completion and bounds PASS');
})().catch(e=>{console.error(e);process.exitCode=1});
