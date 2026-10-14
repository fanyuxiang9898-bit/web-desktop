(function () {
  'use strict';
  if (globalThis.__webDesktop) return;
  const L = globalThis.WebDesktopLayout;
  const extension = !!globalThis.chrome?.runtime?.id;
  const keyFor = () => 'web-desktop:v1:' + location.origin + location.pathname;
  const storage = {
    async get(key) { return extension ? (await chrome.storage.local.get(key))[key] : JSON.parse(localStorage.getItem(key) || 'null'); },
    async set(key, value) { if (extension) await chrome.storage.local.set({ [key]: value }); else localStorage.setItem(key, JSON.stringify(value)); },
    async remove(key) { if (extension) await chrome.storage.local.remove(key); else localStorage.removeItem(key); }
  };
  const host = document.createElement('div'); host.id = 'web-desktop-ui';
  host.style.cssText = 'all:initial!important;position:fixed!important;inset:0!important;pointer-events:none!important;z-index:2147483646!important;';
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `<style>
  :host{font:14px/1.5 system-ui,sans-serif;color:#15233b}*{box-sizing:border-box}button,input{font:inherit}button{cursor:pointer}button:focus-visible,input:focus-visible{outline:3px solid #72a1ff;outline-offset:2px}
  #panel{position:fixed;right:20px;top:20px;width:300px;padding:20px;border:1px solid #d8e0ed;background:#fff;border-radius:18px;box-shadow:0 12px 60px #14203d25;pointer-events:auto;color:#15233b;max-height:calc(100vh - 40px);overflow:auto}
  h2{font-size:20px;margin:0 0 4px}p{color:#5a6b82;margin:8px 0 16px;font-size:12px}.eyebrow{color:#245ce6;font-size:11px;letter-spacing:2px;font-weight:800}.row{display:flex;gap:8px;margin:10px 0}button{border:1px solid #dce3ee;background:#f5f7fb;border-radius:9px;color:#24344d;padding:9px 12px}.primary{background:#245ce6;border-color:#245ce6;color:#fff}button:disabled{opacity:.4;cursor:default}.row>*{flex:1}label{display:block;font-size:12px;color:#516078}input{width:100%;margin-top:4px;padding:7px;border:1px solid #dce3ee;border-radius:6px}#status{padding:10px;border-radius:8px;background:#eef4ff;font-size:12px;overflow-wrap:anywhere}#close{float:right;padding:2px 8px}#restore{color:#a33835;background:#fff}#hint{font-size:12px;color:#68778b;margin-top:12px}#badge{position:fixed;right:20px;bottom:20px;pointer-events:auto;background:#142747;color:white;box-shadow:0 4px 20px #14274733;border:0;padding:12px 18px;border-radius:24px}
  .tile{position:fixed;border:2px solid #487bf4;border-radius:10px;background:#447bff0b;pointer-events:auto;touch-action:none;cursor:grab}.tile:active{cursor:grabbing}.tile-label{position:absolute;left:5px;top:5px;background:#245ce6;color:#fff;border-radius:5px;padding:2px 7px;font-size:11px;max-width:90%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.resize{position:absolute;right:-3px;bottom:-3px;width:22px;height:22px;border:3px solid white;border-radius:7px;background:#245ce6;cursor:nwse-resize;touch-action:none}.tile.selected{border-color:#124ad7;box-shadow:0 0 0 3px #487bf42a}.ghost{position:fixed;pointer-events:none;background:#245ce622;border:2px dashed #245ce6;border-radius:10px}.pick{position:fixed;pointer-events:none;border:3px solid #245ce6;background:#245ce611;border-radius:5px}[hidden]{display:none!important}
  @media(max-width:600px){#panel{width:260px;right:8px;top:8px}} </style>
  <div id="tiles"></div><div class="pick" hidden></div><div class="ghost" hidden></div>
  <aside id="panel" hidden aria-label="网页桌面编辑器"><button id="close" aria-label="收起编辑器">×</button><div class="eyebrow">WEB DESKTOP</div><h2>网页，按你的方式</h2><p>拖动交换位置 · 拉角调整大小 · 空位自动填补</p><button id="pick" class="primary">选择一个网页区域</button><div class="row"><label>网格列数<input id="cols" type="number" min="1" max="12" value="6"></label><label>单格高度<input id="cell" type="number" min="48" max="300" value="112"></label></div><div class="row"><button id="edit" class="primary">编辑布局</button><button id="done">完成编辑</button></div><div class="row"><button id="undo">撤销</button><button id="redo">重做</button><button id="compact">补位</button></div><div class="row"><button id="smaller">缩小选中项</button><button id="larger">放大选中项</button></div><div class="row"><button id="restore">恢复网站原布局</button></div><div id="status" role="status">先选择包含多个按钮、标签或卡片的区域。</div><div id="hint">编辑时拖动蓝色框；完成后原按钮和表单可正常使用。布局保存在本机。</div></aside><button id="badge" hidden>网页桌面 · 编辑布局</button>`;
  document.documentElement.appendChild(host);
  const $ = s => shadow.querySelector(s);
  let active = null, picking = false, editing = false, candidate = null, gesture = null;
  let selected = null, history = [], future = [], currentKey = keyFor(), writes = Promise.resolve(), routeGeneration = 0;
  const ledger = new Map();
  const eligible = el => el instanceof HTMLElement && el !== host && !['SCRIPT','STYLE','LINK','TEMPLATE','META','NOSCRIPT'].includes(el.tagName) && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().width > 0;
  const children = el => Array.from(el.children).filter(eligible);
  function say(text) { $('#status').textContent = text; }
  function setStyle(el, prop, value) {
    if (!ledger.has(el)) ledger.set(el, new Map());
    const record = ledger.get(el);
    if (!record.has(prop)) record.set(prop, { value: el.style.getPropertyValue(prop), priority: el.style.getPropertyPriority(prop), applied: '' });
    record.get(prop).applied = value;
    el.style.setProperty(prop, value, 'important');
  }
  function release() {
    gesture = null; $('.ghost').hidden = true;
    for (const [el, props] of ledger) for (const [prop, saved] of props) {
      // A site's intervening inline style change belongs to the site.
      if (el.style.getPropertyValue(prop) === saved.applied && el.style.getPropertyPriority(prop) === 'important') {
        if (saved.value) el.style.setProperty(prop, saved.value, saved.priority); else el.style.removeProperty(prop);
      }
    }
    ledger.clear(); active = null; editing = false; selected = null;
    $('#tiles').replaceChildren(); history = []; future = []; controls();
  }
  function selector(el, scope = document) {
    if (el.id && scope.querySelectorAll('#' + CSS.escape(el.id)).length === 1) return '#' + CSS.escape(el.id);
    for (const attr of ['data-testid', 'data-key', 'name']) {
      const value = el.getAttribute(attr);
      if (value) { const s = el.localName + '[' + attr + '="' + CSS.escape(value) + '"]'; if (scope.querySelectorAll(s).length === 1) return s; }
    }
    const parts = []; let cur = el;
    while (cur && cur !== scope && cur !== document.documentElement) {
      const siblings = cur.parentElement ? Array.from(cur.parentElement.children).filter(n => n.tagName === cur.tagName) : [cur];
      parts.unshift(cur.localName + ':nth-of-type(' + (siblings.indexOf(cur) + 1) + ')');
      cur = cur.parentElement;
    }
    return parts.join(' > ');
  }
  function signature(el) { return [el.localName, el.id, el.getAttribute('role') || '', el.getAttribute('name') || '', el.getAttribute('data-key') || ''].join('|'); }
  function capture() { return { nodes: L.clone(active.nodes), cols: active.cols, cell: active.cell }; }
  function controls() {
    for (const id of ['edit','done','compact','restore','cols','cell']) $('#' + id).disabled = !active;
    $('#undo').disabled = !active || !history.length; $('#redo').disabled = !active || !future.length;
    $('#smaller').disabled = $('#larger').disabled = !active || !selected;
  }
  function render() {
    if (!active) return;
    const { container, nodes, items, cols, cell } = active;
    const gap = 12;
    const width = container.clientWidth;
    const cw = width / cols;
    setStyle(container, 'position', 'relative'); setStyle(container, 'display', 'block');
    setStyle(container, 'height', (Math.max(...nodes.map(n => n.y + n.h), 1) * cell) + 'px');
    setStyle(container, 'min-height', '0px'); setStyle(container, 'padding', '0px');
    for (const n of nodes) {
      const el = items.find(i => i.id === n.id).el;
      for (const [prop, value] of Object.entries({ position:'absolute', left:(n.x * cw + gap/2)+'px', top:(n.y * cell + gap/2)+'px', width:Math.max(1,n.w*cw-gap)+'px', height:(n.h*cell-gap)+'px', 'box-sizing':'border-box', margin:'0px', 'min-width':'0px', 'max-width':'none', 'min-height':'0px', 'max-height':'none', transform:'none', overflow:'auto' })) setStyle(el, prop, value);
    }
    $('#cols').value = cols; $('#cell').value = cell;
    overlays(); controls();
  }
  function rectStyle(el, rect) { Object.assign(el.style, { left:rect.left+'px', top:rect.top+'px', width:rect.width+'px', height:rect.height+'px' }); }
  function overlays() {
    const tiles = $('#tiles'); tiles.replaceChildren();
    if (!active || !editing) return;
    for (const item of active.items) {
      const n = active.nodes.find(n => n.id === item.id);
      const tile = document.createElement('div'); tile.className = 'tile' + (selected === item.id ? ' selected' : ''); tile.dataset.id = item.id;
      tile.tabIndex = 0; tile.setAttribute('role','button'); tile.setAttribute('aria-label', '移动 ' + item.label);
      rectStyle(tile, item.el.getBoundingClientRect());
      const label = document.createElement('span'); label.className = 'tile-label'; label.textContent = item.label + ' · ' + n.w + '×' + n.h;
      const resize = document.createElement('span'); resize.className = 'resize'; resize.setAttribute('aria-label','拖动调整尺寸');
      tile.append(label,resize); tiles.appendChild(tile);
      tile.addEventListener('pointerdown', e => startGesture(e, item, e.target === resize));
      tile.addEventListener('keydown', e => {
        if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)) return;
        e.preventDefault(); selected = item.id;
        const dx = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0;
        const dy = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0;
        if(e.shiftKey) commit(() => active.nodes = L.change(active.nodes,active.cols,item.id,{w:n.w+dx,h:n.h+dy}));
        else { const x=n.x+dx,y=n.y+dy; const target=active.nodes.find(b=>b.id!==n.id&&x>=b.x&&x<b.x+b.w&&y>=b.y&&y<b.y+b.h); commit(()=>active.nodes=L.change(active.nodes,active.cols,item.id,{x,y},target?.id)); }
      });
    }
  }
  function savedValue() {
    return { version:1, container:active.selector, cols:active.cols, cell:active.cell, nodes:L.clone(active.nodes), items:active.items.map(({id,sel,sig})=>({id,sel,sig})) };
  }
  function persist() {
    const key=currentKey, value=savedValue();
    writes=writes.catch(()=>{}).then(()=>storage.set(key,value));
    writes.then(()=>say('已保存到本机。完成编辑后即可正常使用网页。'),()=>say('保存失败：存储不可用或空间不足；当前布局仍可复原。'));
    return writes;
  }
  function commit(fn) {
    if(!active) return;
    const before=capture();
    try { fn(); if(!L.validate(active.nodes,active.cols)) throw new Error('布局冲突'); history.push(before); if(history.length>40) history.shift(); future=[]; render(); persist(); }
    catch(e) { Object.assign(active,before); render(); say('操作已取消：'+e.message); }
  }
  function startGesture(e,item,resize) {
    if(e.button!==0) return; e.preventDefault(); e.stopPropagation();
    selected=item.id; const n=active.nodes.find(n=>n.id===item.id);
    gesture={id:item.id,resize,startX:e.clientX,startY:e.clientY,rect:item.el.getBoundingClientRect(),node:{...n},snapshot:capture()};
    rectStyle($('.ghost'),gesture.rect); $('.ghost').hidden=false; controls();
  }
  document.addEventListener('pointermove', e=>{
    if(gesture&&active) {
      const dx=e.clientX-gesture.startX,dy=e.clientY-gesture.startY,r=gesture.rect;
      rectStyle($('.ghost'),{left:r.left+(gesture.resize?0:dx),top:r.top+(gesture.resize?0:dy),width:gesture.resize?Math.max(30,r.width+dx):r.width,height:gesture.resize?Math.max(30,r.height+dy):r.height}); return;
    }
    if(!picking||e.composedPath().includes(host)) return;
    let el=e.target instanceof HTMLElement?e.target:null;
    while(el&&el!==document.body&&children(el).length<2) el=el.parentElement;
    candidate=el&&el!==document.body?el:null;
    $('.pick').hidden=!candidate; if(candidate) rectStyle($('.pick'),candidate.getBoundingClientRect());
  },true);
  document.addEventListener('pointerup', e=>{
    if(!gesture||!active) return;
    const g=gesture; gesture=null; $('.ghost').hidden=true;
    const dx=e.clientX-g.startX,dy=e.clientY-g.startY;
    if(Math.abs(dx)+Math.abs(dy)<5){overlays();return;}
    const cw=active.container.clientWidth/active.cols;
    if(g.resize) commit(()=>active.nodes=L.change(g.snapshot.nodes,active.cols,g.id,{w:g.node.w+Math.round(dx/cw),h:g.node.h+Math.round(dy/active.cell)}));
    else {
      const target=active.items.find(i=>{const r=i.el.getBoundingClientRect();return i.id!==g.id&&e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom;});
      commit(()=>active.nodes=L.change(g.snapshot.nodes,active.cols,g.id,{x:g.node.x+Math.round(dx/cw),y:g.node.y+Math.round(dy/active.cell)},target?.id));
    }
  },true);
  document.addEventListener('pointercancel',()=>{gesture=null;$('.ghost').hidden=true;});
  document.addEventListener('click',e=>{
    if(!picking||e.composedPath().includes(host)) return;
    e.preventDefault();e.stopImmediatePropagation();
    if(candidate) { const el=candidate; endPick(); try{attach(el);}catch(err){say(err.message);} }
  },true);
  function endPick(){picking=false;candidate=null;$('.pick').hidden=true;$('#pick').textContent='选择另一个区域';}
  function attach(container,saved) {
    if(container===document.body||container===document.documentElement||['TABLE','TBODY','TR','SELECT','SVG','IFRAME','CANVAS'].includes(container.tagName)) throw new Error('请选择普通网页区域；表格、画布和嵌入页面暂不支持。');
    const els=children(container);
    if(els.length<2||els.length>100) throw new Error('请选择包含 2–100 个可见元素的区域。');
    if(Array.from(container.childNodes).some(n=>n.nodeType===3&&n.textContent.trim())) throw new Error('此区域包含未分组文字，请选择更具体的模块区域。');
    if(saved) {
      if(saved.version!==1||!L.validate(saved.nodes,saved.cols)||!Number.isInteger(saved.cell)||saved.cell<48||saved.cell>300||saved.items.length!==els.length||saved.nodes.length!==els.length) throw new Error('保存的布局与当前页面不匹配，已保留网站原布局。');
      const resolved=saved.items.map(i=>container.querySelector(i.sel));
      if(new Set(resolved).size!==els.length||saved.items.some((i,k)=>!resolved[k]||!els.includes(resolved[k])||signature(resolved[k])!==i.sig||!saved.nodes.some(n=>n.id===i.id))) throw new Error('网站结构已变化，已保留原布局，请重新选择区域。');
    }
    const measured=els.map(el=>el.getBoundingClientRect());
    release();
    const cols=saved?.cols||6,cell=saved?.cell||112;
    const items=saved?saved.items.map(i=>({...i,el:container.querySelector(i.sel),label:''})):els.map((el,k)=>({id:'tile-'+k,el,sel:selector(el,container),sig:signature(el),label:''}));
    items.forEach((i,k)=>i.label=i.el.getAttribute('aria-label')||i.el.querySelector('h1,h2,h3,h4')?.textContent?.trim().slice(0,24)||i.el.id||'元素 '+(k+1));
    const nodes=saved?L.clone(saved.nodes):L.compact(items.map((i,k)=>({id:i.id,x:0,y:k*20,w:Math.min(cols,Math.max(1,Math.round(measured[k].width/(container.clientWidth/cols)))),h:Math.min(20,Math.max(1,Math.ceil((measured[k].height+12)/cell)))})),cols);
    active={container,selector:saved?.container||selector(container),items,nodes,cols,cell};
    editing=!saved; $('#badge').hidden=false; render();
    say(saved?'已恢复保存的布局；原网页功能可正常使用。':'区域已转为网格。拖到另一个元素上交换，拉右下角调整大小。');
    if(!saved) persist();
  }
  async function restore(){endPick();release();const key=currentKey;writes=writes.catch(()=>{}).then(()=>storage.remove(key));try{await writes;say('已恢复网站原布局，并清除本页保存的配置。');}catch{say('页面已恢复，但清除保存配置失败。');}}
  function open(){$('#panel').hidden=false;$('#badge').hidden=true;if(active){editing=true;render();}controls();}
  $('#pick').onclick=()=>{picking=!picking;if(!picking)endPick();else{$('#pick').textContent='取消选择（Esc）';say('移动鼠标寻找区域，蓝框正确后单击。区域内至少需要两个元素。');}};
  $('#close').onclick=()=>{endPick();editing=false;overlays();$('#panel').hidden=true;$('#badge').hidden=false;};
  $('#badge').onclick=open;
  $('#edit').onclick=()=>{editing=true;render();};
  $('#done').onclick=()=>{editing=false;overlays();say('已退出编辑，网页可正常操作。');$('#panel').hidden=true;$('#badge').hidden=false;};
  $('#restore').onclick=restore;
  $('#compact').onclick=()=>commit(()=>active.nodes=L.compact(active.nodes,active.cols));
  for(const [id,delta] of [['smaller',-1],['larger',1]]) $('#'+id).onclick=()=>{const n=active?.nodes.find(n=>n.id===selected);if(n)commit(()=>active.nodes=L.change(active.nodes,active.cols,n.id,{w:n.w+delta,h:n.h+delta}));};
  $('#undo').onclick=()=>{if(!history.length)return;future.push(capture());Object.assign(active,history.pop());render();persist();};
  $('#redo').onclick=()=>{if(!future.length)return;history.push(capture());Object.assign(active,future.pop());render();persist();};
  $('#cols').onchange=()=>{const cols=Number($('#cols').value);if(!Number.isInteger(cols)||cols<1||cols>12){render();return;}commit(()=>{active.nodes=L.compact(active.nodes.map(n=>({...n,w:Math.min(n.w,cols),x:Math.min(n.x,Math.max(0,cols-n.w))})),cols);active.cols=cols;});};
  $('#cell').onchange=()=>{const cell=Number($('#cell').value);if(Number.isInteger(cell)&&cell>=48&&cell<=300)commit(()=>active.cell=cell);else render();};
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){endPick();gesture=null;$('.ghost').hidden=true;}});
  window.addEventListener('resize',()=>{if(active)render();});
  window.addEventListener('scroll',()=>{if(!gesture)overlays();},true);
  // Keep DOM ownership with the page. If the framework changes region membership,
  // release layout instead of fighting its renderer or silently binding another tile.
  const observer=new MutationObserver(()=>{
    if(!active)return;
    if(!active.container.isConnected||active.items.some(i=>i.el.parentElement!==active.container)||children(active.container).some(el=>!active.items.some(i=>i.el===el))){
      release();say('页面结构发生变化，已安全恢复原布局；保存配置仍保留，可重新选择区域。');$('#badge').hidden=false;
    }
  });
  observer.observe(document.body,{childList:true,subtree:true});
  async function autoRestore(){
    const generation=++routeGeneration;
    try{const saved=await storage.get(currentKey);if(!saved||generation!==routeGeneration)return;
      let attempts=0;
      const retry=()=>{if(generation!==routeGeneration||active)return;const el=document.querySelector(saved.container);if(el){try{attach(el,saved);}catch(e){say(e.message);$('#badge').hidden=false;}return;}if(++attempts<20)setTimeout(retry,500);};retry();
    }catch{say('无法读取本地布局，请重新选择区域。');}
  }
  setInterval(()=>{if(keyFor()!==currentKey){release();currentKey=keyFor();autoRestore();}},700);
  globalThis.__webDesktop={open,attach,restore,flush:()=>writes,state:()=>active?capture():null};
  autoRestore();
})();
