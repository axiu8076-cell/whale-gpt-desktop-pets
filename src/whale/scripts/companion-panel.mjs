import {bridgeRequest} from '../runtime/bridge.mjs';
import {startSupervisor} from '../runtime/process.mjs';
import {DATA_HOME,writeJson} from '../runtime/paths.mjs';
import path from 'node:path';
const receipt=path.join(DATA_HOME,'companion-panel-launch.json');
const record=(stage,extra={})=>writeJson(receipt,{at:new Date().toISOString(),stage,...extra});
async function requestOpen(){
 const result=await bridgeRequest('/api/companion/open',{method:'POST',timeoutMs:16000});
 if(!result.ok||!result.panel?.ready||!result.panel?.visible)throw new Error('操作台尚未显示');
 record('opened',{ready:true,visible:true});
}
async function open(){
 record('starting');
 let running=false;
 try{running=(await bridgeRequest('/api/status',{timeoutMs:1500})).ok;}catch{}
 if(!running){
  await startSupervisor();
  for(let i=0;i<40&&!running;i++){await new Promise(r=>setTimeout(r,500));try{running=(await bridgeRequest('/api/status',{timeoutMs:500})).ok;}catch{}}
 }
 if(!running)throw new Error('操作台暂时无法启动');
 await requestOpen();
}
open().catch(()=>{record('failed');process.exitCode=1;});
