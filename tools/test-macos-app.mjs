import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { pathToFileURL } from 'node:url';
const app=path.resolve(process.argv[2]), report=path.resolve(process.argv[3]);
assert.equal(process.platform,'darwin');assert.equal(process.arch,'arm64');
const data=fs.mkdtempSync('/tmp/whale-mac-test-'), binary=path.join(app,'Contents/MacOS/Electron');
process.env.WHALE_HOME=data;process.env.CODEX_HOME=path.join(data,'empty-codex');
const {bridgeRequest}=await import(pathToFileURL(path.join(app,'Contents/Resources/app/runtime/bridge.mjs')));
const request=(route,body)=>bridgeRequest(route,{dataDir:data,timeoutMs:20000,...(body?{method:'POST',body}:{})});
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const env={...process.env,WHALE_MAC_TEST_HOME:data};delete env.ELECTRON_RUN_AS_NODE;
for(const key of Object.keys(env))if(/token|secret|password|api.?key/i.test(key))delete env[key];
let child,exited,diagnostics='';
function start(){
  child=spawn(binary,[],{env,stdio:['ignore','ignore','pipe']});
  exited=once(child,'exit');
  child.stderr.on('data',bytes=>{diagnostics=(diagnostics+bytes.toString()).slice(-12000);});
}
async function ready(){
  for(let n=0;n<90;n++){
    if(child.exitCode!==null)throw new Error('Application exited: '+diagnostics);
    try{const s=await request('/api/status');if(s.rendererReady&&s.visible)return s;}catch{}
    await wait(500);
  }
  throw new Error('App did not become visible/ready: '+diagnostics+' '+(fs.existsSync(path.join(data,'desktop-error.json'))?fs.readFileSync(path.join(data,'desktop-error.json'),'utf8'):''));
}
async function stop(){await request('/api/stop',{});await Promise.race([exited,wait(10000).then(()=>{throw new Error('Application did not exit');})]);assert.equal(child.exitCode,0);}
const checks=[];
try{
  // Native probe executes on this Mac; no Codex account or API key is needed.
  const probe=JSON.parse(execFileSync(path.join(app,'Contents/Resources/app/bin/window-probe'),['--once'],{encoding:'utf8',timeout:10000,env}));
  assert.equal(typeof probe.hostAlive,'boolean');assert.equal(typeof probe.fullscreen,'boolean');checks.push('compiled native arm64 window probe');
  start();const status=await ready();assert.equal(status.platform,'darwin');assert.equal(status.desktopMode,'standalone');checks.push('packaged app launch and visible whale renderer');
  const panel=await request('/api/companion/open',{});assert.equal(panel.panel.ready,true);assert.equal(panel.panel.visible,true);checks.push('embedded operation panel loaded and visible');
  const catalog=await request('/api/companion/catalog');assert.equal(catalog.platform,'darwin');assert.equal(catalog.items.length,21);checks.push('21 capability-aware operation cards');
  for(const id of ['snack','sit','eating','full','cheer','delete-eat'])assert.equal((await request('/api/companion/trigger',{id})).ok,true);
  checks.push('six manual action triggers');
  assert.equal((await request('/api/companion/timer',{command:'start-focus'})).timer.status,'running');
  assert.equal((await request('/api/companion/timer',{command:'pause'})).timer.status,'paused');checks.push('pomodoro start and pause');
  await wait(3000);const state=await request('/api/companion');assert.equal(state.sensorFresh,true);assert.equal(state.hardware.cpuTemp,null);assert.equal(typeof state.hardware.cpuLoad,'number');checks.push('fresh CPU/RAM telemetry with unknown unsupported sensors');
  await request('/api/desktop-mode',{mode:'follow-codex'});await wait(1500);assert.equal((await request('/api/status')).ok,true);
  await request('/api/desktop-mode',{mode:'standalone'});await ready();checks.push('missing Codex does not kill app; standalone recovery');
  await request('/api/companion/settings',{load:false});await stop();start();await ready();
  assert.equal((await request('/api/companion')).settings.load,false);checks.push('quit, cold restart and settings preserved');
  await stop();
  fs.writeFileSync(report,JSON.stringify({ok:true,platform:process.platform,arch:process.arch,macOS:os.release(),electron:process.versions.electron,node:process.versions.node,checks,notTested:['personal API key and Keychain authorization','real battery transitions and physical thermal sensors','interactive Dock/multi-monitor/Spaces visual inspection','Gatekeeper first-download consent','live Codex login and session data']},null,2));
  console.log(JSON.stringify({ok:true,checks:checks.length}));
}finally{
  if(child&&child.exitCode===null){child.kill('SIGTERM');await Promise.race([exited,wait(5000)]);if(child.exitCode===null)child.kill('SIGKILL');}
  assert.equal(path.dirname(data),'/tmp');assert.ok(path.basename(data).startsWith('whale-mac-test-'));fs.rmSync(data,{recursive:true,force:true});
}
