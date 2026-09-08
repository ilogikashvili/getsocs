process.env.NODE_ENV='development';process.env.LOGIN_RATE_LIMIT_MAX='3';
const express=require('../../server/node_modules/express');
const request=require('../../server/node_modules/supertest');
const fs=require('fs');const path=require('path');
const modulePath=require.resolve('../../server/middleware/rateLimitMiddleware');
function app(){delete require.cache[modulePath];const limiter=require(modulePath).loginLimiter;const a=express();a.set('trust proxy',1);a.post('/login',limiter,(req,res)=>res.json({ok:true}));return a;}
(async()=>{const a=app(),b=app();const results=[];for(let i=0;i<5;i++){const r=await request(a).post('/login').set('X-Forwarded-For','192.0.2.10');results.push({worker:'a',status:r.status,headers:r.headers,body:r.body});}for(const [worker,ip,instance] of [['a','192.0.2.11',a],['b','192.0.2.10',b]]){const r=await request(instance).post('/login').set('X-Forwarded-For',ip);results.push({worker,ip,status:r.status,headers:r.headers});}fs.writeFileSync(path.join(__dirname,'rate-results.json'),JSON.stringify(results,null,2));})().catch(e=>{console.error(e);process.exitCode=1;});
