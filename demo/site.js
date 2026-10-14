window.originalNodes = Array.from(document.querySelector('#dashboard').children);
document.querySelector('#increment').addEventListener('click',()=>{document.querySelector('#count').textContent=Number(document.querySelector('#count').textContent)+1;});
document.querySelector('#search-form').addEventListener('submit',e=>{e.preventDefault();document.querySelector('#search-result').textContent='已搜索：'+document.querySelector('#query').value;});
document.querySelector('#tabs').addEventListener('click',e=>{if(!e.target.dataset.tab)return;for(const b of e.currentTarget.children)b.setAttribute('aria-selected',String(b===e.target));document.querySelector('#tab-content').textContent=e.target.dataset.tab+'：网页桌面原型';});
document.querySelector('#quiet').addEventListener('change',e=>{document.querySelector('#quiet-state').textContent=e.target.checked?'专注模式已开启':'提醒已开启';});
document.querySelector('#mutate').addEventListener('click',()=>{const el=document.createElement('article');el.id='new-card';el.className='card';el.textContent='网站动态新增的卡片';document.querySelector('#dashboard').appendChild(el);});
