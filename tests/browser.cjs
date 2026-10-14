const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
// Reuse the installed automation library and browser; no downloads or env changes.
const candidates=[path.resolve('node_modules/playwright'), 'D:/Codex/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'];
const {chromium}=require(candidates.find(p=>fs.existsSync(p))||'playwright');
const executable=process.argv[2]||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const root=path.resolve(__dirname,'..');
const results=[];
const record=name=>{results.push(name);console.log('PASS',name);};
const profile=path.join(root,'work','browser-profile-'+Date.now());
const out=path.join(root,'test-results');fs.mkdirSync(out,{recursive:true});
async function launch(){return chromium.launchPersistentContext(profile,{executablePath:executable,headless:true,viewport:{width:1440,height:1100}});}
async function ready(page){await page.goto('http://127.0.0.1:4178');await page.waitForFunction(()=>!!globalThis.__webDesktop);}
async function drag(page,from,to){await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(to.x,to.y,{steps:14});await page.mouse.up();}
(async()=>{
  let context=await launch();let page=context.pages()[0];const errors=[];page.on('pageerror',e=>errors.push(e.message));
  try{
    await ready(page);
    await page.locator('#notes').fill('布局调整前输入，应该保留');
    await page.locator('#demo-edit').click();
    await page.locator('#web-desktop-ui .tile').first().waitFor();
    const getState=()=>page.evaluate(()=>__webDesktop.state());
    const before=await getState();
    const a=await page.locator('#web-desktop-ui .tile[data-id="tile-0"]').boundingBox();
    const b=await page.locator('#web-desktop-ui .tile[data-id="tile-1"]').boundingBox();
    await drag(page,{x:a.x+30,y:a.y+40},{x:b.x+30,y:b.y+40});
    let after=await getState();
    assert.equal(after.nodes.find(n=>n.id==='tile-0').x,before.nodes.find(n=>n.id==='tile-1').x);
    assert.equal(after.nodes.find(n=>n.id==='tile-1').x,before.nodes.find(n=>n.id==='tile-0').x);record('real pointer drag swaps occupied tiles');
    await page.locator('#web-desktop-ui #undo').click();assert.deepEqual((await getState()).nodes,before.nodes);record('undo restores previous layout');
    await page.locator('#web-desktop-ui #redo').click();assert.deepEqual((await getState()).nodes,after.nodes);record('redo restores swap');
    const box=await page.locator('#web-desktop-ui .tile[data-id="tile-1"] .resize').boundingBox();
    await drag(page,{x:box.x+10,y:box.y+10},{x:box.x+190,y:box.y+122});
    const resized=await getState();assert.ok(resized.nodes.find(n=>n.id==='tile-1').w>after.nodes.find(n=>n.id==='tile-1').w);assert.ok(resized.nodes.find(n=>n.id==='tile-1').h>after.nodes.find(n=>n.id==='tile-1').h);record('real corner drag resizes in grid units');
    assert.ok(await page.evaluate(()=>WebDesktopLayout.validate(__webDesktop.state().nodes,__webDesktop.state().cols)));record('no overlap after resize and automatic compaction');
    await page.locator('#web-desktop-ui #done').click();
    await page.locator('#increment').click();assert.equal(await page.locator('#count').textContent(),'1');
    await page.locator('#query').fill('布局实验');await page.locator('#search-form button').click();assert.equal(await page.locator('#search-result').textContent(),'已搜索：布局实验');
    await page.locator('[data-tab="已完成"]').click();assert.match(await page.locator('#tab-content').textContent(),/^已完成/);
    await page.locator('#quiet').check();assert.equal(await page.locator('#quiet-state').textContent(),'专注模式已开启');
    assert.equal(await page.locator('#notes').inputValue(),'布局调整前输入，应该保留');
    assert.ok(await page.evaluate(()=>originalNodes.every(n=>n.parentElement===document.querySelector('#dashboard'))));record('native listeners, delegated tabs, form submit, checkbox, input values and parents survive');
    await page.evaluate(()=>__webDesktop.flush());const saved=await getState();await page.reload();await page.waitForFunction(()=>__webDesktop.state());assert.deepEqual(await getState(),saved);record('reload re-applies saved layout');
    await context.close();context=await launch();page=context.pages()[0];await ready(page);await page.waitForFunction(()=>__webDesktop.state());assert.deepEqual(await page.evaluate(()=>__webDesktop.state()),saved);record('browser restart restores persistent layout');
    await page.locator('#launch').click();await page.screenshot({path:path.join(out,'editor.png'),fullPage:true});
    await page.locator('#web-desktop-ui #restore').click();assert.equal(await page.evaluate(()=>__webDesktop.state()),null);assert.equal(await page.locator('#dashboard').evaluate(el=>el.style.position),'');assert.equal(await page.locator('#counter-card').evaluate(el=>el.style.position),'');
    await page.reload();assert.equal(await page.evaluate(()=>__webDesktop.state()),null);record('restore removes layout styles and saved configuration');
    await page.locator('#demo-edit').click();await page.locator('#web-desktop-ui #done').click();await page.locator('#mutate').click();await page.waitForFunction(()=>__webDesktop.state()===null);assert.equal(await page.locator('#new-card').count(),1);record('framework membership change safely releases layout and preserves new content');
    await page.evaluate(()=>{const c=document.createElement('div');c.id='padded-regression';c.style.cssText='width:400px;padding:40px;box-sizing:content-box';c.innerHTML='<button>First</button><button>Second</button>';document.body.append(c);__webDesktop.attach(c);});
    const padded=await page.locator('#padded-regression').evaluate(c=>({width:c.clientWidth,children:[...c.children].map(e=>({left:e.offsetLeft,width:e.offsetWidth}))}));
    assert.ok(padded.children.every(e=>e.left+e.width<=padded.width),'padded container uses final content geometry');
    const beforeWidth=padded.children[0].width;await page.evaluate(()=>window.dispatchEvent(new Event('resize')));assert.equal(await page.locator('#padded-regression button').first().evaluate(e=>e.offsetWidth),beforeWidth);record('padded content-box region remains stable on first render and resize');
    await page.evaluate(()=>__webDesktop.restore());assert.equal(await page.locator('#padded-regression').evaluate(e=>e.style.padding),'40px');assert.deepEqual(await page.locator('#padded-regression button').evaluateAll(es=>es.map(e=>e.style.cssText)),['','']);
    await page.evaluate(async()=>{const c=document.querySelector('#padded-regression');__webDesktop.attach(c);c.children[0].style.setProperty('width','23px','important');await __webDesktop.restore();});assert.equal(await page.locator('#padded-regression button').first().evaluate(e=>e.style.width),'23px');record('reset clears fractional geometry while preserving later site changes');
    assert.deepEqual(errors,[]);record('no browser page errors');
    fs.writeFileSync(path.join(out,'browser-results.json'),JSON.stringify({passed:results.length,checks:results},null,2));
  }finally{await context.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
