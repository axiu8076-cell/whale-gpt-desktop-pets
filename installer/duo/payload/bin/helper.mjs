import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {bridgeRequest} from '../app/runtime/bridge.mjs';
import {ConfigStore} from '../app/runtime/config.mjs';
import {writeJson} from '../app/runtime/paths.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dataDir=path.join(root,'data');
const settings=JSON.parse(fs.readFileSync(path.join(root,'settings.json'),'utf8').replace(/^\uFEFF/,''));
const request=(route,body,timeoutMs=1500)=>bridgeRequest(route,{dataDir,timeoutMs,...(body?{method:'POST',body}:{})});
async function waitReady(){
 for(let n=0;n<70;n++){
  try{const s=await request('/api/status');if(s.ok)return s;}catch{}
  await new Promise(r=>setTimeout(r,400));
 }
 throw new Error('service-not-ready');
}
try{
 const action=process.argv[2];
 if(action==='init'){
  fs.mkdirSync(dataDir,{recursive:true});
  const store=new ConfigStore({dataDir});
  const config=store.prepare({monitorSessions:settings.clientIntegration===true,connectionMode:'fixed',selectedConnection:'deepseek-official',connections:[{id:'deepseek-official',name:'DeepSeek 官方 API',baseUrl:'https://api.deepseek.com',keyEnv:'DEEPSEEK_WHALE_API_KEY',balance:{adapter:settings.apiEnabled?'deepseek':'none',mapping:{currency:'CNY',confirmed:true}}}]});
  writeJson(path.join(dataDir,'api-settings.json'),config);
  const file=path.join(dataDir,'follow-config.json');let old={};try{old=JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));}catch{}
  writeJson(file,{...old,enabled:true,mode:old.mode||'standalone',launchMode:'standalone-package',pluginRoot:path.join(root,'app'),electronPath:path.join(root,'runtime','electron.exe'),startupLauncher:path.join(root,'bin','launch.ps1')});
 }else if(action==='stop'){
  try{await request('/api/stop',{});}catch{}
 }else if(action==='open'||action==='panel'){
  await waitReady();await request('/api/show',{});
  if(action==='panel'){const p=await request('/api/companion/open',{},16000);if(!p.ok||!p.panel?.ready||!p.panel?.visible)throw new Error('panel-not-ready');}
 }else if(action==='check'){
  const status=await waitReady(),catalog=await request('/api/companion/catalog'),companion=await request('/api/companion');
  writeJson(path.join(dataDir,'package-check.json'),{ok:status.ok,catalogItems:catalog.items.length,daily:companion.settings.daily,at:Date.now()});
 }else throw new Error('unknown-action');
}catch{process.exitCode=1;}
