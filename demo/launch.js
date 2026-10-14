document.querySelector('#launch').onclick=()=>globalThis.__webDesktop.open();
document.querySelector('#demo-edit').onclick=()=>{globalThis.__webDesktop.open();globalThis.__webDesktop.attach(document.querySelector('#dashboard'));};
