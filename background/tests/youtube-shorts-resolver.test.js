const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const source=fs.readFileSync(path.resolve(__dirname,'../src/09b-youtube-shorts-resolver.js'),'utf8');
const id='UC'+'a'.repeat(22),vid='abc123def45';let fetches=0;
const db={list:{enabled:true,list:{channels:[{channelId:id}]}}};
const html='var ytInitialPlayerResponse = '+JSON.stringify({videoDetails:{videoId:vid,channelId:id,title:'braces } and " quoted'}})+';';
const c=vm.createContext({URL,Date,Map,TextDecoder,AbortController,setTimeout,clearTimeout,YOUTUBE_BLOCKLIST_KEY:'list',chrome:{runtime:{onMessage:{addListener(){}},id:'test'},storage:{local:{get:async keys=>Object.fromEntries((Array.isArray(keys)?keys:[keys]).map(k=>[k,db[k]])),set:async x=>Object.assign(db,x)}}},fetch:async()=>{fetches++;return new Response(html);}});
vm.runInContext(source,c);
assert.equal(c.ssShortsPlayerIdentity(html,vid),id);
assert.equal(c.ssShortsPlayerIdentity(html,'otherVideo1'),null,'never assign unrelated player channel');
assert.equal(c.ssShortsPlayerIdentity('{"channelId":"'+id+'"}',vid),null,'generic IDs outside player details ignored');
(async()=>{
 const [a,b]=await Promise.all([c.ssResolveShortIdentity(vid),c.ssResolveShortIdentity(vid)]);
 assert.equal(a.channelId,id);assert.equal(b.channelId,id);assert.equal(fetches,1,'deduplicate concurrent resolution');
 await c.ssResolveShortIdentity(vid);assert.equal(fetches,1,'persistent cache hit');
 db.list.enabled=false;assert.equal((await c.ssResolveShortIdentity('anotherVid1')).channelId,null);assert.equal(fetches,1,'disabled list cannot fetch');
 await assert.rejects(c.ssResolveShortIdentity('../../x'));
 console.log('PASS: balanced player JSON, video identity binding, concurrent dedupe, persistent cache, disabled state, URL input validation');
})().catch(e=>{console.error(e);process.exitCode=1;});
