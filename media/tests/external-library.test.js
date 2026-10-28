const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');const assert=require('node:assert/strict');
const saved={};const ctx=vm.createContext({
    Date, console,crypto:{randomUUID:()=> '22222222-2222-4222-8222-222222222222'},
    window:{},chrome:{storage:{local:{get:async k=>({[k]:saved[k]}),set:async o=>Object.assign(saved,o)}}}
});
vm.runInContext(fs.readFileSync(path.join(__dirname,'../external-library.js'),'utf8'),ctx);
(async()=>{
    const store=ctx.window.StreamShellExternalLibrary;
    assert.equal((await store.getAll()).length,0);
    await store.add('Test Manga','manga');
    assert.equal((await store.getAll()).length,1);
    assert.equal((await store.getAll())[0].source,'mangayomi');
    await store.merge([{id:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',mediaType:'anime',title:'Anime'},
        {id:'no',mediaType:'movie',title:'Invalid'}, {id:'no',mediaType:'novel',title:'invalid id'}]);
    assert.equal((await store.getAll()).length,2);
    await store.remove('22222222-2222-4222-8222-222222222222');
    assert.equal((await store.getAll()).length,1);
    console.log('External Library: local IDs, safe media types, merge/remove: PASS');
})().catch(error=>{console.error(error);process.exitCode=1;});
