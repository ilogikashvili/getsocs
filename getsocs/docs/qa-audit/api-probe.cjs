const {request}=require('../../e2e/node_modules/playwright');const fs=require('fs');const path=require('path');
const file=path.join(__dirname,'audit.test.json');const out={};
(async()=>{const c=await request.newContext({baseURL:'http://127.0.0.1:3101'});const email='qaprobe@example.com';
let r=await c.post('/api/v1/auth/register',{multipart:{username:'qaprobe',name:'Audit',lastname:'User',email,password:'AuditPass123!'}});out.registration={status:r.status(),body:await r.json()};
let db=JSON.parse(fs.readFileSync(file));let u=db.users.find(u=>u.email===email);
r=await c.post('/api/v1/auth/verify-email/code',{data:{email,code:u.verificationCode}});const session=await r.json();out.verification={status:r.status(),cookie:r.headers()['set-cookie']?.replace(/getsocs_refresh=[^;]+/,'getsocs_refresh=[redacted]')};
r=await c.post('/api/v1/auth/refresh');out.versionedRefresh={status:r.status(),body:await r.json()};
r=await c.post('/api/auth/refresh');out.legacyRefresh={status:r.status()};
db=JSON.parse(fs.readFileSync(file));db.memberships=[{id:'qa-paid',name:'QA Paid Tier',price:29,platformFee:0.04,features:[]}];fs.writeFileSync(file,JSON.stringify(db));
r=await c.post('/api/v1/membership/subscribe',{headers:{Authorization:`Bearer ${session.accessToken||session.token}`},data:{tierId:'qa-paid',billingCycle:'monthly'}});out.unpaidMembership={status:r.status(),body:await r.json()};
out.cors={};for(const origin of ['http://getsocs.test:3101','https://untrusted.example']){r=await c.get('/api/v1/products',{headers:{Origin:origin}});out.cors[origin]={status:r.status(),allowOrigin:r.headers()['access-control-allow-origin']||null};}
await c.dispose();fs.writeFileSync(path.join(__dirname,'api-probe-results.json'),JSON.stringify(out,null,2));})().catch(e=>{out.fatal=e.stack;fs.writeFileSync(path.join(__dirname,'api-probe-results.json'),JSON.stringify(out,null,2));process.exitCode=1;});
