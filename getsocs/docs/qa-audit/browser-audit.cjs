const { chromium } = require('../../e2e/node_modules/playwright');
const fs = require('fs');
const path = require('path');
const base = 'http://getsocs.localhost:3101';
const out = { pages: [], interactions: [], api: [], console: [], failures: [] };
const save = () => fs.writeFileSync(path.join(__dirname, 'browser-results.json'), JSON.stringify(out, null, 2));
(async () => {
 const browser = await chromium.launch({ args: ['--host-resolver-rules=MAP getsocs.localhost 127.0.0.1', '--no-proxy-server'] });
 out.browser = browser.version();
 const context = await browser.newContext();
 const page = await context.newPage();
 page.on('console', m => { if (['error','warning'].includes(m.type())) out.console.push({url:page.url(),type:m.type(),text:m.text()}); });
 page.on('pageerror', e => out.failures.push({url:page.url(),error:e.message}));
 page.on('requestfailed', r => out.failures.push({url:r.url(),error:r.failure()?.errorText}));
 page.on('response', r => { if(r.status()>=400) out.failures.push({url:r.url(),status:r.status()}); });
 await page.addInitScript(() => {
  window.qaVitals = {lcp:0,cls:0};
  new PerformanceObserver(l => {for(const e of l.getEntries()) window.qaVitals.lcp=e.startTime;}).observe({type:'largest-contentful-paint',buffered:true});
  new PerformanceObserver(l => {for(const e of l.getEntries()) if(!e.hadRecentInput) window.qaVitals.cls+=e.value;}).observe({type:'layout-shift',buffered:true});
 });
 for (const route of ['/', '/products', '/policy', '/login', '/register', '/reset-password']) {
  for (const width of [320,375,414,768,1024,1366,1920,2560]) {
   await page.setViewportSize({width,height:900});
   await page.goto(base+route,{waitUntil:'networkidle'});
   const data = await page.evaluate(() => ({title:document.title,scrollWidth:document.documentElement.scrollWidth,width:innerWidth,
    main:document.querySelectorAll('main').length,h1:document.querySelectorAll('h1').length,
    brokenImages:[...document.images].filter(i=>!i.complete||i.naturalWidth===0).map(i=>i.getAttribute('src')),
    missingAlt:[...document.images].filter(i=>!i.hasAttribute('alt')).length,
    unnamedInputs:[...document.querySelectorAll('input:not([type=hidden]),select,textarea')].filter(i=>!i.labels?.length&&!i.getAttribute('aria-label')&&!i.getAttribute('aria-labelledby')).map(i=>i.outerHTML.slice(0,200)),
    smallText:[...document.querySelectorAll('p,label,a,button')].filter(e=>e.getBoundingClientRect().width&&parseFloat(getComputedStyle(e).fontSize)<12).length,
    links:[...document.querySelectorAll('a[href]')].map(a=>a.getAttribute('href')),
    loadMs:performance.getEntriesByType('navigation')[0]?.loadEventEnd,...window.qaVitals
   }));
   out.pages.push({route,...data});
   if([320,1366].includes(width)) await page.screenshot({path:path.join(__dirname,`${route.replaceAll('/','')||'home'}-${width}.png`),fullPage:true});
   save();
  }
 }
 for (const route of ['/profile','/upload','/orders','/cart','/favorites','/messages','/notifications','/admin','/settings','/support','/qa-nonexistent','/product/qa-missing','/users/qa-missing']) {
  await page.goto(base+route,{waitUntil:'networkidle'});
  out.interactions.push({test:'route',route,finalUrl:page.url(),text:(await page.locator('body').innerText()).slice(0,650)});
 }
 await page.goto(base+'/register');
 try { await page.getByLabel('Password').fill('AuditPass123!'); out.interactions.push({test:'original-password-selector',pass:true}); }
 catch(e) {out.interactions.push({test:'original-password-selector',pass:false,error:e.message});}
 await page.locator('input[name=username]').fill('auditbrowser');
 await page.locator('input[name=name]').fill('Audit');
 await page.locator('input[name=lastname]').fill('User');
 await page.locator('input[name=email]').fill('auditbrowser@example.com');
 await page.locator('input[name=password]').fill('AuditPass123!');
 await page.getByRole('checkbox').check();
 await page.getByRole('button',{name:/create account/i}).click();
 await page.waitForTimeout(600);
 out.interactions.push({test:'registration',text:await page.locator('body').innerText()});
 await page.screenshot({path:path.join(__dirname,'registration-result.png'),fullPage:true});
 for(const url of ['/health','/api/v1/products','/api/v1/products/search?q=%27%20OR%201%3D1--','/api/v1/products/search?q=%3Cscript%3Ealert(1)%3C%2Fscript%3E','/api/v1/meta/platforms','/api/v1/meta/languages','/api/v1/products/mine','/api/v1/admin/users','/api/v1/qa-nonexistent','/uploads/qa-missing.png','/static/js/qa-missing.js']) {
  const begin=Date.now(); const r=await fetch('http://127.0.0.1:3101'+url); const body=await r.text();
  out.api.push({url,status:r.status,ms:Date.now()-begin,headers:Object.fromEntries(r.headers),body:body.slice(0,350)});
 }
 // Slow 3G laboratory sample; no field Web Vitals claim.
 const cdp=await context.newCDPSession(page);
 await cdp.send('Network.enable');
 await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
 await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:400,downloadThroughput:50000,uploadThroughput:50000});
 await page.goto(base+'/products',{waitUntil:'networkidle',timeout:90000});
 out.slow3g=await page.evaluate(()=>({loadMs:performance.getEntriesByType('navigation')[0].loadEventEnd,...window.qaVitals}));
 save(); await browser.close();
})().catch(e=>{out.fatal=e.stack;save();console.error(e);process.exitCode=1;});
