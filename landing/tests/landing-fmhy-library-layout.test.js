const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..', '..');
const fmhy = fs.readFileSync(path.join(root,'landing/src/fmhy.js'), 'utf8');
const library = fs.readFileSync(path.join(root,'landing/src/library.js'), 'utf8');
const wideCSS = fs.readFileSync(path.join(root,'landing/landing.css'),'utf8');
const compactCSS = fs.readFileSync(path.join(root,'dashboard/dashboard.css'),'utf8');

class E {
  constructor(tag, className='', content='') { this.tag=tag; this.className=className; this.textContent=content;
    this.children=[]; this.dataset={}; this.listeners={}; this.attrs={};
    this.classList={add:c=>this.className += ` ${c}`,toggle:(c,on)=>{if(on)this.className += ` ${c}`}}; }
  append(...values){this.children.push(...values)}
  appendChild(value){this.children.push(value)}
  setAttribute(k,v){this.attrs[k]=v}
  addEventListener(type,handler){this.listeners[type]=handler}
  replaceChildren(...values){this.children=values}
}
const createElement=(tag, cls,content)=>new E(tag,cls,content);
const ui={
  URL,Date,console,createElement,searchGeneration:1,mediaSearchSource:{value:"fmhy"},mediaSearchInput:{value:"manga"},
  searchHeaderTitle:new E('h2'),mediaPanelSubtitle:new E('p'),mediaPanelBody:new E('div'),
  chrome:{runtime:{sendMessage:async()=>({ok:true})}},
  window:{StreamShellDirectLinks:{merge:async()=>true}},
  document:{createElement:tag=>new E(tag)}
};
const c=vm.createContext(ui);
vm.runInContext(fmhy,c);
vm.runInContext('renderFmhyResults([{title:"Manga Site",url:"https://example.org/",category:"reading",section:"Manga",description:"Read manga titles"}],1)',c);
const [list]=ui.mediaPanelBody.children;
assert.equal(list.children.length,1);
const [card]=list.children;
assert.equal(card.children.length,3,'launch, flexible details, save action');
assert.match(card.children[0].className,/direct-link-launch/);
assert.match(card.children[1].className,/media-item-main/);
assert.equal(card.children[1].children[0].children[0].textContent,'Manga Site');
assert.equal(card.children[1].children[2].textContent,'Read manga titles');
assert.equal(card.children[2].children.length,1,'save action only; open belongs at start');
assert.match(card.className,/direct-link-item/);
assert.equal(vm.runInContext('streamShellParseFmhyMarkdown("* ↪️ [▷ Manga](https://example.com/wiki)\\n* [Manga Books](https://example.com/books) - Manga", "reading").length',c),1);

const lib=vm.createContext({createElement, document:{createElement:tag=>new E(tag)}});
vm.runInContext(library,lib);
function toolbar(types = []) {
  vm.runInContext('streamShellLibrarySelectedTypes.clear()',lib);
  for (const type of types) vm.runInContext(`streamShellLibrarySelectedTypes.add("${type}")`,lib);
  return vm.runInContext('streamShellLibraryToolbar()',lib);
}
const filters = toolbar();
assert.equal(filters.children.length,1,'No extra All types toggle');
assert.equal(filters.children[0].children.length,5,'All media types visible as chips');
assert.ok(filters.children[0].children.every(chip => chip.attrs['aria-pressed']==='false'));
const both = toolbar(['movie','anime']);
assert.equal(both.children.length,1,'Multiple types selected without ambiguous manual-add form');
assert.equal(both.children[0].children[0].attrs['aria-pressed'],'true');
assert.equal(both.children[0].children[2].attrs['aria-pressed'],'true');
assert.equal(vm.runInContext('streamShellLibrarySelectedTypes.size',lib),2);
for (const type of ['anime','manga','novel']) {
  const t=toolbar([type]);
  assert.equal(t.children.length,2);
  const form=t.children[1];
  assert.equal(form.children.length,3);
  assert.equal(form.children[1].textContent,'Find on AniList');
  assert.match(form.children[0].attrs['aria-label'],new RegExp(type,'i'));
}
for(const type of ['movie','tv']) assert.equal(toolbar([type]).children.length,1);
for(const css of [wideCSS,compactCSS]) {
  assert.match(css,/\.fmhy-result-description\s*\{/);
  assert.match(css,/\.ss-library-filter\.selected\s*\{/);
  assert.doesNotMatch(css,/\.ss-library-filter-toggle\s*\{/);
  assert.match(css,/\.ss-library-native-item\s*\{/);
  assert.doesNotMatch(css,/rgba\(130,119,210/,'no disconnected purple accent');
}
console.log('PASS FMHY and Library multi-select visible media filters across Wide/Compact');
