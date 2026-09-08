const {chromium}=require('../../e2e/node_modules/playwright');const fs=require('fs');const path=require('path');
const out={};const base='http://getsocs.localhost:3101';
(async()=>{const browser=await chromium.launch({args:['--host-resolver-rules=MAP getsocs.localhost 127.0.0.1','--no-proxy-server']});const context=await browser.newContext({viewport:{width:375,height:812},isMobile:true,hasTouch:true});const p=await context.newPage();
await p.goto(base+'/login');await p.getByRole('button',{name:/sign in/i}).tap();out.required=await p.locator('input:invalid').count();
await p.locator('input').first().fill('qa-invalid-user');await p.locator('input[type=password]').fill('wrong');
await p.route('**/api/auth/login',async r=>{await new Promise(resolve=>setTimeout(resolve,1600));await r.fulfill({status:503,contentType:'application/json',body:JSON.stringify({success:false,error:'QA simulated service unavailable'})});});
await p.getByRole('button',{name:/sign in/i}).tap();await p.waitForTimeout(300);out.pending=await p.locator('body').innerText();await p.waitForTimeout(1600);out.apiFailure=await p.locator('body').innerText();await p.screenshot({path:path.join(__dirname,'login-api-failure.png'),fullPage:true});
await p.unroute('**/api/auth/login');await p.goto(base+'/');
out.touchButtons=await p.getByRole('button').evaluateAll(es=>es.map(e=>({name:e.getAttribute('aria-label')||e.innerText,width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height})).filter(e=>e.width>0));
const toggle=p.getByRole('button',{name:/switch to light/i});if(await toggle.count()){await toggle.tap();out.theme=await p.locator('html').getAttribute('data-theme');await p.reload();out.themeReload=await p.locator('html').getAttribute('data-theme');}
for(const viewport of [{width:375,height:812},{width:812,height:375}]){await p.setViewportSize(viewport);out['orientation'+viewport.width]=await p.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth}));}
await p.goto(base+'/login');await p.keyboard.press('Tab');out.keyboardFocus=await p.evaluate(()=>({tag:document.activeElement.tagName,text:document.activeElement.textContent,outline:getComputedStyle(document.activeElement).outline}));
await p.getByRole('link',{name:/create an account/i}).click();out.link=p.url();await p.goBack();out.back=p.url();
await p.goto(base+'/qa-nonexistent');await p.screenshot({path:path.join(__dirname,'unknown-route.png'),fullPage:true});
await browser.close();
for(const channel of ['msedge','chrome']){try{const b=await chromium.launch({channel});out[channel]={version:b.version(),launched:true};const q=await b.newPage();await q.goto('http://127.0.0.1:3101/login');out[channel].heading=await q.locator('h1').innerText();await b.close();}catch(e){out[channel]={error:e.message.split('\n')[0]};}}
fs.writeFileSync(path.join(__dirname,'interaction-results.json'),JSON.stringify(out,null,2));})().catch(e=>{out.fatal=e.stack;fs.writeFileSync(path.join(__dirname,'interaction-results.json'),JSON.stringify(out,null,2));process.exitCode=1;});
