const status = document.querySelector('#status');
const files = ['vendor/gridstack-all.js', 'layout.js', 'app.js'];
const matchOrigin = url => { const u=new URL(url); return u.protocol+'//'+u.hostname+'/*'; };
async function tab() {
  const [t] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!t || !/^https?:/.test(t.url || '')) throw new Error('请先打开普通网页，浏览器内部页面不支持。');
  return t;
}
function run(fn) { return async () => { try { await fn(); } catch (e) { status.textContent = e.message; } }; }
document.querySelector('#edit').onclick = run(async () => {
  const t = await tab();
  await chrome.scripting.executeScript({ target: { tabId: t.id }, files });
  await chrome.scripting.executeScript({ target: { tabId: t.id }, func: () => globalThis.__webDesktop.open() });
  window.close();
});
document.querySelector('#auto').onclick = run(async () => {
  const t = await tab();
  const origin = matchOrigin(t.url);
  if (!await chrome.permissions.request({ origins: [origin] })) throw new Error('未获得网站授权；仍可手动打开。');
  const {enabledOrigins=[]}=await chrome.storage.local.get('enabledOrigins');
  await chrome.storage.local.set({enabledOrigins:[...new Set([...enabledOrigins,origin])]});
  const result=await chrome.runtime.sendMessage({type:'wd-reconcile'});
  if(!result.ok)throw new Error(result.error);
  status.textContent = '已开启：已保存的布局会在此网站自动恢复。';
});
document.querySelector('#disable').onclick = run(async () => {
  const t = await tab();
  const origin = matchOrigin(t.url);
  const scripts = await chrome.scripting.getRegisteredContentScripts();
  const {enabledOrigins=[]}=await chrome.storage.local.get('enabledOrigins');
  await chrome.storage.local.set({enabledOrigins:enabledOrigins.filter(o=>o!==origin)});
  const ids = scripts.filter(s => s.matches?.includes(origin)).map(s => s.id);
  if (ids.length) await chrome.scripting.unregisterContentScripts({ ids });
  await chrome.permissions.remove({ origins: [origin] });
  status.textContent = '已关闭自动恢复。当前页面可在编辑器中恢复原布局。';
});
