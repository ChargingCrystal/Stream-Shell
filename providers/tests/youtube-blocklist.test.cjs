const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const id = 'UC' + 'a'.repeat(22), other = 'UC' + 'b'.repeat(22);
const context = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(root,'shared/youtube-blocklist-core.js'),'utf8'),context);
assert.throws(()=>context.normalizeYoutubeBlocklist({channels:[{channelId:'bad'}]}));
assert.throws(()=>context.normalizeYoutubeBlocklist({platform:'instagram',channels:[]}));
const clean = context.normalizeYoutubeBlocklist({channels:[{channelId:id,handle:'@test'},{channelId:id}],archivedFunkChannels:[{channelId:other}]});
assert.equal(clean.channels.length,1);
assert.equal(clean.channels[0].channelId,id);
(async()=>{
 const {chromium} = require('playwright');
 const browser = await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',args:['--no-sandbox']});
 try {
  const page=await browser.newPage({viewport:{width:1000,height:700}});
  await page.route('https://www.youtube.com/**',route=>route.fulfill({contentType:'text/html',body:'<html><body></body></html>'}));
  await page.goto('https://www.youtube.com/');
  await page.evaluate(({id})=>{
   window.state={enabled:true,list:{channels:[{channelId:id,handle:'@test'}]}};
   window.chrome={runtime:{sendMessage:async()=>({ok:true,state:window.state})},storage:{onChanged:{addListener:fn=>window.storageChanged=fn}}};
   document.body.innerHTML='<ytd-video-renderer id="card"><ytd-thumbnail><a href="/watch?v=one"><img width="320" height="180"></a></ytd-thumbnail><a class="owner" href="/@test">Channel</a></ytd-video-renderer>';
   document.querySelector('#card').data={ownerText:{runs:[{navigationEndpoint:{browseEndpoint:{browseId:id}}}]}};
  },{id});
  await page.addScriptTag({content:fs.readFileSync(path.join(root,'shared/youtube-blocklist-core.js'),'utf8')});
  for(const file of ['youtube-blocklist-main.js','youtube-blocklist.js']) await page.addScriptTag({content:fs.readFileSync(path.join(root,'providers/player',file),'utf8')});
  await page.addStyleTag({content:fs.readFileSync(path.join(root,'providers/player/youtube-blocklist.css'),'utf8')});
  await page.waitForSelector('.ss-blocklist-label');
  assert.equal(await page.locator('.ss-blocklist-label').textContent(),'on blocklist');
  assert.equal(await page.locator('img').evaluate(img=>getComputedStyle(img).filter),'blur(13px)');
  await page.waitForTimeout(450);
  assert.equal(await page.locator('.ss-blocklist-label').count(),1,'no observer feedback duplicate');
  await page.evaluate(other=>{
   document.querySelector('#card').data={ownerText:{runs:[{navigationEndpoint:{browseEndpoint:{browseId:other}}}]}};
   document.querySelector('.owner').href='/@other';
  },other);
  await page.waitForFunction(()=>!document.querySelector('.ss-blocklist-label'));
  assert.equal(await page.locator('img').evaluate(img=>getComputedStyle(img).filter),'none');
  await page.evaluate(()=>{document.querySelector('#card').data=null;document.querySelector('.owner').href='/@test';});
  await page.waitForSelector('.ss-blocklist-label');
  await page.evaluate(()=>storageChanged({streamShellYoutubeBlocklistV1:{newValue:{enabled:false,list:state.list}}},'local'));
  assert.equal(await page.locator('.ss-blocklist-label').count(),0);
  await page.evaluate(()=>storageChanged({streamShellYoutubeBlocklistV1:{newValue:state}},'local'));
  await page.waitForSelector('.ss-blocklist-label');
  await page.evaluate(()=>{
   const card=document.createElement('ytd-video-renderer');card.innerHTML='<ytd-thumbnail><a><img width="320" height="180"></a></ytd-thumbnail><a href="/@test">Test</a>';document.body.append(card);
  });
  await page.waitForFunction(()=>document.querySelectorAll('.ss-blocklist-label').length===2);
  await page.evaluate(()=>storageChanged({streamShellYoutubeBlocklistV1:{newValue:undefined}},'local'));
  assert.equal(await page.locator('.ss-blocklist-label').count(),0,'remove list restores all thumbnails');
  console.log('PASS: schema validation, exact ID, handle fallback, lazy cards, recycled cards, enable/disable/removal and real CSS blur');
 } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
