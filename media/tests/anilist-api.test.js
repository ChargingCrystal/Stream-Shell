const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname,'../anilist-api.js'),'utf8');
let calls=[],throwManga=false,timeout=false;
const good = (type,id,format=null) => ({id,type,format,
    title:{english:type==='ANIME'?'English title':'English manga',romaji:'Romaji name',native:'日本語'},
    coverImage:{large:'https://s4.anilist.co/file/anilistcdn/media/cover/large/123.jpg'},
    episodes:type==='ANIME'?12:null,chapters:type==='MANGA'?50:null,
    averageScore:82,seasonYear:2024,startDate:{year:2024}});
const ctx=vm.createContext({window:{},URL,AbortController,console,setTimeout,clearTimeout,
    fetch:async (url,init)=>{const variables=JSON.parse(init.body).variables;calls.push({url,init,variables});
        if(throwManga&&variables.type==='MANGA') throw Error('manga unavailable');
        const value=variables.type==='ANIME'?good('ANIME',1):good('MANGA',2,'NOVEL');
        if(variables.id) value.description='Lovely <b>story</b> and mystery';
        return {ok:true,json:async()=>({data:variables.id?{Media:value}:{Page:{media:[value]}}})};
    }});
vm.runInContext(source,ctx);
(async()=>{
const api=ctx.window.StreamShellAniList;
const results=await api.search('Solo Leveling');
assert.equal(results.length,2);
assert.equal(results[0].mediaType,'anime');
assert.equal(results[1].mediaType,'novel');
assert.equal(results[0].score,82);
assert.ok(calls.every(({url,init})=>url==='https://graphql.anilist.co/'&&init.method==='POST'));
assert.ok(calls.every(c=>!c.init.body.includes('description(asHtml:false)')),'search should remain lightweight');
const item=await api.details(results[0]);
assert.equal(item.description,'Lovely story and mystery');
assert.equal(api.validCover('javascript:alert(1)'), '');
throwManga=true;
assert.equal((await api.search('Solo Leveling')).length,1,'partial result when one type unavailable');
assert.equal((await api.search('')).length,0);
console.log('AniList: anonymous GraphQL, media classification, partial results, safe cover/metadata: PASS');
})().catch(e=>{console.error(e);process.exitCode=1});
