/* DOM offscreen conversion, primary/fallback priority and neutral icon contract. */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.join(__dirname, '../..');
const renders=[];
const fetches=[];
const samplePng=fs.readFileSync(path.join(root,'native/titlebar-icons/settings.png'));
const rawPng=(buffer)=>({ok:true,status:200,headers:{get:()=>String(buffer.length)},
    arrayBuffer:async()=>buffer.buffer.slice(buffer.byteOffset,buffer.byteOffset+buffer.byteLength)});
const ctx=vm.createContext({
 URL, btoa, TextEncoder, Uint8Array, console, setTimeout, clearTimeout,
 fetch:async url=>{fetches.push(url);return url==='ext://native/titlebar-icons/custom/custom_primary.png' ? rawPng(samplePng) : {ok:false,status:404};},
 shuttingDown:false,titlebarPort:null,titlebarProtocolReady:false,TITLEBAR_PROTOCOL_VERSION:9,
 ensureVolumeOffscreenDocument:async()=>{},
 chrome:{runtime:{getURL:f=>'ext://'+f,sendMessage:async m=>{
     renders.push(m.path);
     if(m.path==='assets/providers/custom/custom_fallback_icon.svg')return {ok:true,pngBase64:'BAUG'};
     return {ok:false,reason:'file-missing'};
 }},storage:{onChanged:{addListener(){}},local:{get:async()=>({})}}}
});
for(const rel of ['shared/provider-registry-core.js','background/src/06-titlebar.js'])
 vm.runInContext(fs.readFileSync(path.join(root,rel),'utf8'),ctx);
const run=js=>vm.runInContext(js,ctx);
(async()=>{
 assert.equal(run('streamShellNativeCustomIconPath("PaRaMoUnT")'),'native/titlebar-icons/custom/custom_paramount.png');
 assert.equal(run('streamShellNativeCustomIconPath("../escape")'),null);
 const reg=JSON.parse(JSON.stringify(run('defaultStreamShellProviderRegistry()')));
 const add=(id,key,color)=>{
  reg.providers.push({id:'custom-'+id,kind:'custom',name:id,url:'https://example.com/',icon:'X+',artKey:key,
      titlebarColor:color,enabled:true,showOnDashboard:false,showInTitlebar:true});
  reg.titlebarOrder.push('custom-'+id);
 };
 add('aaaaaaaa','primary','#F00000');add('bbbbbbbb','fallback','#13AA43');add('cccccccc','missing','#8844CC');
 ctx.reg=reg;
 const payload=await run('streamShellTitlebarPayload(reg)');
 const rows=Buffer.from(payload,'base64').toString('utf8').split('\n').map(r=>r.split('\t'));
 assert.equal(rows.length,8);assert.ok(rows.every(r=>r.length===5));
 assert.deepEqual(Buffer.from(rows.at(-3)[4],'base64'),samplePng);assert.equal(rows.at(-2)[4],'BAUG');assert.equal(rows.at(-1)[4],'');
 assert.equal(rows.at(-3)[3],'#F00000');
 assert.ok(fetches.includes('ext://native/titlebar-icons/custom/custom_primary.png'));
 assert.ok(!renders.some(x=>x.endsWith('custom_primary.png')), 'PNG must never enter offscreen renderer');
 assert.ok(!renders.includes('assets/providers/custom/custom_primary_icon.svg'));
 assert.ok(fetches.includes('ext://native/titlebar-icons/custom/custom_fallback.png'));
 assert.ok(renders.includes('assets/providers/custom/custom_fallback_icon.svg'));
 const count=renders.length, fetchCount=fetches.length;await run('streamShellTitlebarPayload(reg)');
 assert.equal(renders.length,count,'SVG fallback must be cached');
 assert.equal(fetches.length,fetchCount,'PNG reads must be cached');
 assert.equal(run('streamShellTitlebarArtworkStatus.get("custom-aaaaaaaa").source'),'native-png');
 assert.equal(run('streamShellTitlebarArtworkStatus.get("custom-aaaaaaaa").reason'),'raw-png-direct');
 assert.equal(run('streamShellTitlebarArtworkStatus.get("custom-bbbbbbbb").primaryFailure'),'file-missing');
 assert.equal(run('streamShellTitlebarArtworkStatus.get("custom-bbbbbbbb").source'),'provider-svg');
 assert.equal(run('streamShellTitlebarArtworkStatus.get("custom-cccccccc").source'),'text');
 const native=fs.readFileSync(path.join(root,'native/StreamShellTitlebarHost.cs'),'utf8');
 assert.match(native,/TITLEBAR_PROTOCOL_VERSION = 9/);
 assert.match(native,/TryDecodeTitlebarIcon/);
 assert.match(native,/CustomChromeTheme/);
 assert.doesNotMatch(native,/TintIcon/);
 const dash=fs.readFileSync(path.join(root,'dashboard/src/provider-registry.js'),'utf8');
 assert.equal((dash.match(/data-registry-titlebar-color-picker=\\"\$\{id\}\\"/g)||[]).length,0); // raw template contains plain quotes
 assert.equal((dash.match(/data-registry-titlebar-color-picker="\$\{id\}"/g)||[]).length,1);
 assert.doesNotMatch(dash,/settings-custom-provider-artwork-help|For artwork key <code>|Native titlebar: custom SVG/);
 assert.doesNotMatch(dash,/Custom pages use ordinary managed Opera windows/);
 const offscreen=fs.readFileSync(path.join(root,'offscreen/titlebar-svg.js'),'utf8');
 assert.match(offscreen,/image\.decode\(\)/);
 assert.match(offscreen,/data\[i\] = 213/);
 assert.ok(fs.readFileSync(path.join(root,'offscreen/volume-audio.html'),'utf8').includes('titlebar-svg.js'));
 console.log('Custom titlebar PNG primary / provider SVG fallback, neutral icon, theme color, single picker/hex: PASS');
})().catch(e=>{console.error(e);process.exitCode=1});
