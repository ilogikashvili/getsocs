#!/usr/bin/env node
const path = require('path');
try { require('dotenv').config({ path: path.join(__dirname, '..', '.env') }); } catch (_) {}
const { initializeDatabase, closeDatabase } = require('../config/db');
const { loadState } = require('../repositories/stateRepository');
const storage = require('../services/storageService');
(async()=>{
  await initializeDatabase(); const state=await loadState(); const refs=[];
  for(const p of state.products||[]) for(const key of (p.images||[])) refs.push({type:'product-image',visibility:'public',owner:p.id,key});
  for(const u of state.users||[]){
    if(u.profilePhoto) refs.push({type:'profile-photo',visibility:'public',owner:u.id,key:u.profilePhoto});
    if(u.backgroundPhoto) refs.push({type:'background-photo',visibility:'public',owner:u.id,key:u.backgroundPhoto});
    if(u.verificationDocument?.imageFile) refs.push({type:'id-document',visibility:'private',owner:u.id,key:u.verificationDocument.imageFile});
  }
  const missing=[]; for(const ref of refs) if(!(await storage.exists(ref.key,ref.visibility))) missing.push(ref);
  console.log(JSON.stringify({driver:storage.getDriver(),references:refs.length,missing:missing.length,missingObjects:missing.slice(0,100)},null,2));
  if(missing.length) process.exitCode=2;
})().catch(e=>{console.error(e.stack||e.message);process.exitCode=1;}).finally(async()=>{await storage.close().catch(()=>{});await closeDatabase().catch(()=>{});});
