/* No FMHY HTTP request without explicit stored acknowledgement. */
const assert=require('node:assert/strict');const fs=require('node:fs');
const path=require('node:path');const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../src/fmhy.js'),'utf8');
(async()=>{
  let enabled=false;let fetched=0;
  const ctx=vm.createContext({URL, Date,console,setTimeout,clearTimeout,AbortController,
    chrome:{storage:{local:{get:async()=>({streamShellSevenSeasAcknowledged:enabled})}}},
    fetch:async()=>{fetched++;throw Error('offline');}
  });
  vm.runInContext(source,ctx);
  await assert.rejects(vm.runInContext('streamShellFetchFmhyResources()',ctx),/Seven Seas/);
  assert.equal(fetched,0,'FMHY never sends HTTP requests before acknowledgement');
  enabled=true;
  const result=await vm.runInContext('streamShellFetchFmhyResources()',ctx);
  assert.ok(result.length,'offline fallback still works once enabled');
  assert.ok(fetched>0,'after enabling it attempts the FMHY index');
  console.log('Seven Seas: FMHY denied before HTTP and unlocked after opt-in: PASS');
})().catch(e=>{console.error(e);process.exitCode=1});
