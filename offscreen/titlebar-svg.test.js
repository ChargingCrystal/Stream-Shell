const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const listeners=[];
const pixels = new Uint8ClampedArray(32*32*4);
for(let i=0;i<pixels.length;i+=4){pixels[i]=250;pixels[i+1]=0;pixels[i+2]=30;pixels[i+3]=128;}
let outputPixels;
const canvas={
 width:0,height:0,
 getContext(){return {
   drawImage(){},
   getImageData(){return {data:pixels}},
   putImageData(image){outputPixels=image.data.slice()}
 }},
 toDataURL(){return 'data:image/png;base64,QUJDRA=='}
};
const ctx=vm.createContext({
 console,URL:{createObjectURL:()=> 'blob:test', revokeObjectURL(){}},
 Image:class{naturalWidth=128;naturalHeight=128;async decode(){}},
 document:{createElement:tag=>{assert.equal(tag,'canvas');return canvas}},
 fetch:async url=>({ok:!String(url).includes('missing'),blob:async()=>({size:150})}),
 chrome:{runtime:{id:'self',getURL:f=>'ext://'+f,onMessage:{addListener:cb=>listeners.push(cb)}}}
});
vm.runInContext(fs.readFileSync(path.join(__dirname,'titlebar-svg.js'),'utf8'),ctx);
const render = path=>new Promise(resolve=>listeners[0]({target:'stream-shell-titlebar-svg-offscreen',type:'titlebar-render-icon',path},{id:'self'},resolve));
(async()=>{
 const ok=await render('native/titlebar-icons/custom/custom_paramount.png');
 assert.equal(ok.ok,true);assert.equal(ok.pngBase64,'QUJDRA==');
 assert.equal(outputPixels[0],213);assert.equal(outputPixels[1],208);assert.equal(outputPixels[2],221);assert.equal(outputPixels[3],128);
 // Re-render a logo with an opaque blue tile and white lettering.
 for(let i=0;i<pixels.length;i+=4){pixels[i]=0;pixels[i+1]=90;pixels[i+2]=200;pixels[i+3]=255;}
 const letterAt=(16*32+16)*4;
 pixels[letterAt]=255;pixels[letterAt+1]=255;pixels[letterAt+2]=255;
 await render('native/titlebar-icons/custom/custom_tile.png');
 assert.equal(outputPixels[3],0,'solid backdrop must become transparent');
 assert.equal(outputPixels[letterAt+3],255,'contrasting logo lettering must remain visible');
 assert.equal(outputPixels[letterAt],213,'lettering remains neutral gray');
 assert.equal((await render('native/titlebar-icons/custom/custom_paramount.svg')).reason,'invalid-path');
 const missing=await render('assets/providers/custom/custom_missing_icon.svg');
 assert.equal(missing.reason,'file-missing');
 assert.equal((await render('native/titlebar-icons/custom/../bad.png')).reason,'invalid-path');
 console.log('Offscreen PNG/SVG decode, neutral monochrome + alpha retention, safe path: PASS');
})().catch(e=>{console.error(e);process.exitCode=1});
