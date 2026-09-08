const {chromium}=require('../../e2e/node_modules/playwright');const fs=require('fs');const path=require('path');
const out=[];(async()=>{const b=await chromium.launch({args:['--host-resolver-rules=MAP getsocs.localhost 127.0.0.1','--no-proxy-server']});
// CSP bypass is only for injecting the accessibility scanner; CSP was tested separately without bypass.
const c=await b.newContext({bypassCSP:true,serviceWorkers:'block'});const p=await c.newPage();
for(const theme of ['dark','light'])for(const width of [375,1366])for(const route of ['/','/products','/policy','/login','/register','/reset-password']){
await p.setViewportSize({width,height:900});await p.goto('http://getsocs.localhost:3101'+route,{waitUntil:'networkidle'});await p.evaluate(t=>{localStorage.setItem('gs_theme',t);},theme);await p.reload({waitUntil:'networkidle'});await p.addScriptTag({path:path.resolve(__dirname,'../../client/node_modules/axe-core/axe.min.js')});
const r=await p.evaluate(async()=>{const r=await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}});return {version:r.testEngine.version,violations:r.violations.map(v=>({id:v.id,impact:v.impact,description:v.description,help:v.help,nodes:v.nodes.map(n=>({html:n.html,target:n.target,failureSummary:n.failureSummary}))})),incomplete:r.incomplete.map(v=>({id:v.id,nodes:v.nodes.length})),passes:r.passes.length};});out.push({theme,width,route,...r});fs.writeFileSync(path.join(__dirname,'accessibility-results.json'),JSON.stringify(out,null,2));}
await b.close();})().catch(e=>{console.error(e);process.exitCode=1;});
