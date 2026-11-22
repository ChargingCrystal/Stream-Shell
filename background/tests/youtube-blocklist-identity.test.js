const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
let identify;class Element {constructor(data){this.data=data;}setAttribute(k,v){this[k]=v;}}
vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'../../providers/player/youtube-blocklist-main.js'),'utf8'),{Element,document:{addEventListener:(name,fn)=>identify=fn}});
const id='UC'+'a'.repeat(22),other='UC'+'b'.repeat(22);
function resolve(data){const node=new Element(data);identify({target:node});return node['data-ss-blocklist-channel'];}
assert.equal(resolve({content:{videoRenderer:{ownerText:{runs:[{navigationEndpoint:{browseEndpoint:{browseId:id}}}]}}}}),id);
assert.equal(resolve({ownerText:{runs:[{navigationEndpoint:{browseEndpoint:{browseId:other}}}]},recommendations:[{channelId:id}]}),other);
assert.equal(resolve({recommendations:[{channelId:id}]}),'');
const cyclic={};cyclic.owner=cyclic;assert.equal(resolve(cyclic),'');
console.log('PASS: renderer-local author ID, nested rich cards, no recommendation inheritance, bounded cyclic data');
