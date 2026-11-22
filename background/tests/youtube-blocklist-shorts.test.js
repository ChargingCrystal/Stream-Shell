const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const source=fs.readFileSync(path.resolve(__dirname,'../../providers/player/youtube-blocklist.js'),'utf8');
const id='UC'+'a'.repeat(22), other='UC'+'b'.repeat(22);
const c=vm.createContext({matchRule:key=>key===id,learned:new Map(),shorts:"ytm-shorts-lockup-view-model",shortVideoId:()=>"",requestIdentity:()=>{},ids:new Set([id]),handles:new Set(),URL,CustomEvent:class{},location:{href:'https://www.youtube.com/results',pathname:'/results'}});
vm.runInContext(source.slice(source.indexOf('    function channelMatch('),source.indexOf('    const geometry')),c);
function node(extra={}){return {dispatchEvent(){},getAttribute(){return '';},querySelectorAll(){return [];},querySelector(){return null;},matches(){return false;},closest(){return null;},...extra};}
const channel=node({getAttribute:()=>id,querySelector:()=>({textContent:'ZDF'})});
const heading=node({textContent:'Latest Shorts from ZDF'});
const section=node({querySelector:()=>channel});
const shelf=node({querySelector:()=>heading,closest:()=>section});
const short=node({matches:selector=>selector.includes("ytm-shorts-lockup-view-model"),closest:()=>shelf});
assert.equal(c.channelMatch(short),true,'explicit channel-specific Shorts group inherits blocked owner');
heading.textContent='Latest Shorts from Another channel';assert.equal(c.channelMatch(short),false,'unrelated heading cannot inherit previous result');
heading.textContent='Shorts';assert.equal(c.channelMatch(short),false,'generic mixed shelf does not inherit a channel result');
heading.textContent='Latest Shorts from ZDF';short.getAttribute=()=>other;assert.equal(c.channelMatch(short),false,'individual author overrides shelf');
console.log('PASS: channel Shorts shelf, generic/mismatched shelves, individual identity precedence');
