const files = ['vendor/gridstack-all.js','layout.js','app.js'];
const scriptId = origin => 'wd-' + Array.from(new TextEncoder().encode(origin)).map(n => n.toString(16).padStart(2,'0')).join('');
let pending = Promise.resolve();
function reconcile() {
  pending = pending.catch(()=>{}).then(async()=>{
    const { enabledOrigins = [] } = await chrome.storage.local.get('enabledOrigins');
    const desired=[];
    for(const origin of enabledOrigins) {
      if(typeof origin==='string' && /^https?:\/\//.test(origin) && await chrome.permissions.contains({origins:[origin]})) desired.push({id:scriptId(origin),origin});
    }
    const scripts=await chrome.scripting.getRegisteredContentScripts();
    const stale=scripts.filter(s=>s.id.startsWith('wd-')&&!desired.some(d=>d.id===s.id));
    if(stale.length)await chrome.scripting.unregisterContentScripts({ids:stale.map(s=>s.id)});
    for(const {id,origin} of desired) if(!scripts.some(s=>s.id===id)) {
      await chrome.scripting.registerContentScripts([{id,matches:[origin],js:files,runAt:'document_idle',persistAcrossSessions:true}]);
      // Startup can finish after a restored tab has already loaded.
      const tabs=await chrome.tabs.query({url:origin});
      await Promise.all(tabs.filter(t=>t.id&&t.status==='complete').map(t=>chrome.scripting.executeScript({target:{tabId:t.id},files}).catch(()=>{})));
    }
  });
  return pending;
}
chrome.runtime.onInstalled.addListener(()=>{reconcile().catch(console.error);});
chrome.runtime.onStartup.addListener(()=>{reconcile().catch(console.error);});
chrome.permissions.onRemoved.addListener(()=>{reconcile().catch(console.error);});
chrome.runtime.onMessage.addListener((message,sender,reply)=>{
  if(message?.type!=='wd-reconcile'||sender.id!==chrome.runtime.id)return;
  reconcile().then(()=>reply({ok:true}),e=>reply({ok:false,error:e.message}));return true;
});
reconcile().catch(console.error);
