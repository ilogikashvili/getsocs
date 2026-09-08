import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://127.0.0.1:3001';
const MAX_VUS = Number(__ENV.MAX_VUS || 300);
const PRODUCT_ID = __ENV.PRODUCT_ID || '';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || '';
const production = /https?:\/\/(www\.)?getsocs\.com/i.test(BASE_URL);
if (production && __ENV.ALLOW_PRODUCTION_LOAD_TEST !== 'true') throw new Error('Refusing production load test without ALLOW_PRODUCTION_LOAD_TEST=true');
const levels=[50,100,200,300,500,750,1000].filter(v=>v<=MAX_VUS);
const stages=[];
for (const target of levels) { stages.push({duration:'1m',target},{duration:'2m',target}); }
stages.push({duration:'30s',target:0});
export const options={
  stages,
  thresholds:{ http_req_failed:[{threshold:'rate<0.02',abortOnFail:true,delayAbortEval:'30s'}], http_req_duration:['p(95)<1000','p(99)<2000'] },
  noConnectionReuse:false,
  userAgent:'GetsocsControlledLoadTest/1.0'
};
const browseLatency=new Trend('browse_latency',true); const searchLatency=new Trend('search_latency',true); const appErrors=new Rate('application_errors');
function get(path, metric, auth=false){
  const headers=auth&&AUTH_TOKEN?{Authorization:`Bearer ${AUTH_TOKEN}`}:{ };
  const r=http.get(`${BASE_URL}${path}`,{headers,tags:{scenario_group:metric===searchLatency?'search':'browse'}});
  metric.add(r.timings.duration); const ok=check(r,{'status < 500':x=>x.status<500}); appErrors.add(!ok); return r;
}
export default function(){
  const roll=Math.random();
  if(roll<0.45) get('/api/products?page=1&limit=20',browseLatency);
  else if(roll<0.70) get(`/api/products/search?search=${encodeURIComponent(__ENV.SEARCH_TERM||'test')}&page=1&limit=20`,searchLatency);
  else if(roll<0.85) get('/api/meta/platforms',browseLatency);
  else if(PRODUCT_ID) get(`/api/products/${encodeURIComponent(PRODUCT_ID)}`,browseLatency);
  else get('/api/badges/all',browseLatency);
  if(AUTH_TOKEN && Math.random()<0.05) get('/api/auth/me',browseLatency,true);
  sleep(Math.random()*2+0.5);
}
