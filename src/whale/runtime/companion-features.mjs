import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {ROOT,readJson,writeJson} from './paths.mjs';
import {CompanionModel} from './companion-model.mjs';
import {companionCatalog} from './companion-catalog.mjs';
import {DesktopIconCache} from './desktop-icon-cache.mjs';
const read=(file,fallback={})=>{try{return readJson(file,fallback);}catch{return fallback;}};
export function recycledDesktopFile(bytes,desktopPaths,now=Date.now()) {
  if(bytes.length<28||bytes.length>65536)return null;
  const version=bytes.readBigUInt64LE(0),at=Number(bytes.readBigUInt64LE(16)/10000n)-11644473600000;
  if(![1n,2n].includes(version)||now-at<0||now-at>20000)return null;
  const original=bytes.subarray(version===2n?28:24).toString('utf16le').replace(/\0.*$/s,'');
  if(!desktopPaths.some(dir=>path.win32.dirname(original).toLowerCase()===path.win32.resolve(dir).toLowerCase()))return null;
  return {name:path.win32.basename(original).slice(0,40),at,original};
}
export function createCompanion({dataDir,pointToLocal=p=>p,enabled=true,buddyDataDir=null}={}) {
  const file=path.join(dataDir,'companion-settings.json'),timerFile=path.join(dataDir,'companion-timer.json');
  const model=new CompanionModel({settings:read(file),timer:read(timerFile,null),celebrationWithoutBuddy:!!process.env.WHALE_STANDALONE_HOME});
  const buddyDir=buddyDataDir||process.env.WHALE_BUDDY_HOME||path.join(process.env.LOCALAPPDATA||path.join(os.homedir(),'AppData','Local'),'GPTNiangUsage','state');
  let panelRequest=null;
  function sendBuddy(mode){const p=read(path.join(buddyDir,'presence.json'));if(!p.visible||Date.now()-p.at<0||Date.now()-p.at>=12000)throw new Error('请先打开 GPT 娘');writeJson(path.join(buddyDir,'display-request.json'),{mode,at:Date.now(),nonce:crypto.randomUUID()});}
  let worker=null,closed=false,telemetry={},lastCpu=null,lastState={},eventId=0,lastTimer='',lastStart=0,lastDelete=0;
  const recycleWatchers=new Map(),timers=new Set();
  let activityWorker=null,lastActivityStart=0;
  function startActivityWorker(){
    if(!enabled||closed||process.env.WHALE_CLIENT_ACTIVITY==='0'||activityWorker||Date.now()-lastActivityStart<15000)return;
    lastActivityStart=Date.now();const env={...process.env,ELECTRON_RUN_AS_NODE:'1'};
    for(const key of Object.keys(env))if(/key|token|secret|password/i.test(key))delete env[key];
    activityWorker=spawn(process.execPath,[path.join(ROOT,'runtime','client-activity.mjs'),path.join(dataDir,'client-activity.json'),String(process.pid)],{windowsHide:true,env,stdio:'ignore'});
    const own=activityWorker;own.on('error',()=>{if(activityWorker===own)activityWorker=null;});own.on('exit',()=>{if(activityWorker===own)activityWorker=null;});
  }
  const desktopIcons=new DesktopIconCache();let iconWorker=null,lastIconStart=0;
  function startIconWorker(){
    if(!enabled||closed||process.platform!=='win32'||!model.settings.desktopDelete||iconWorker||Date.now()-lastIconStart<15000)return;
    lastIconStart=Date.now();const env={...process.env};for(const key of Object.keys(env))if(/key|token|secret|password/i.test(key))delete env[key];
    iconWorker=spawn('powershell.exe',['-NoProfile','-STA','-ExecutionPolicy','Bypass','-File',path.join(ROOT,'runtime','desktop-icons.ps1'),'-ParentPid',String(process.pid)],{windowsHide:true,env,stdio:['ignore','pipe','ignore']});
    const current=iconWorker;createInterface({input:current.stdout}).on('line',line=>{if(line.length>8*1024*1024)return;try{desktopIcons.update(JSON.parse(line));}catch{}});
    current.on('error',()=>{if(iconWorker===current)iconWorker=null;});current.on('exit',()=>{if(iconWorker===current)iconWorker=null;});
  }
  function persist(){writeJson(file,model.settings);const key=JSON.stringify(model.timer);if(key!==lastTimer){writeJson(timerFile,model.timer);lastTimer=key;}}
  function watchRecycle(){
    if(!model.settings.desktopDelete){for(const w of recycleWatchers.values())w.close();recycleWatchers.clear();iconWorker?.kill();iconWorker=null;return;}
    startIconWorker();
    for(const root of telemetry.recycleRoots||[]){
      if(recycleWatchers.has(root)||!fs.existsSync(root))continue;
      try {
        const seen=new Set(fs.readdirSync(root));
        const watcher=fs.watch(root,(_kind,filename)=>{
          const name=String(filename||'');if(!name.startsWith('$I')||seen.has(name))return;
          seen.add(name);if(seen.size>1000){seen.clear();for(const n of fs.readdirSync(root))seen.add(n);}
          const t=setTimeout(()=>{timers.delete(t);try{
            const stat=fs.statSync(path.join(root,name));if(stat.size>65536)return;
            const event=recycledDesktopFile(fs.readFileSync(path.join(root,name)),telemetry.desktopPaths||[]);
            if(event&&model.settings.desktopDelete&&Date.now()-lastDelete>2500){const icon=desktopIcons.take(event.original,event.at,pointToLocal);if(!icon)return;lastDelete=Date.now();model.now=lastDelete;model.emit('desktop-delete','','eating',4,20000,{effect:crypto.randomInt(2)?'eat':'beam',fileName:event.name,icon});}
          }catch{}},350);t.unref();timers.add(t);
        });watcher.on('error',()=>{watcher.close();recycleWatchers.delete(root);});recycleWatchers.set(root,watcher);
      }catch{}
    }
  }
  function startWorker(){
    if(!enabled||closed||process.platform!=='win32'||worker||Date.now()-lastStart<15000)return;
    lastStart=Date.now();const env={...process.env};for(const key of Object.keys(env))if(/KEY|TOKEN|SECRET|PASSWORD/i.test(key))delete env[key];
    worker=spawn(path.join(process.env.SystemRoot||'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe'),['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(ROOT,'runtime','companion-telemetry.ps1'),'-ParentPid',String(process.pid)],{windowsHide:true,env,stdio:['ignore','pipe','ignore']});
    const current=worker;createInterface({input:current.stdout}).on('line',line=>{if(line.length>65536)return;try{const data=JSON.parse(line);if(Number.isFinite(data.at)){telemetry=data;watchRecycle();}}catch{}});
    current.on('error',()=>{if(worker===current)worker=null;});current.on('exit',()=>{if(worker===current)worker=null;});
  }
  function sample(){
    const now=Date.now(),cpu=os.cpus().reduce((a,c)=>{a.idle+=c.times.idle;a.total+=Object.values(c.times).reduce((x,y)=>x+y,0);return a;},{idle:0,total:0});
    const cpuLoad=lastCpu&&cpu.total>lastCpu.total?Math.round(100*(1-(cpu.idle-lastCpu.idle)/(cpu.total-lastCpu.total))):null;lastCpu=cpu;
    const total=os.totalmem(),ramUsed=total-os.freemem();
    const hardware={...telemetry,cpuLoad,ramUsed,ramTotal:total,ramPercent:Math.round(ramUsed/total*100),vramPercent:telemetry.vramTotal>0&&Number.isFinite(telemetry.vramUsed)?Math.round(telemetry.vramUsed/telemetry.vramTotal*100):null};
    const presence=read(path.join(buddyDir,'presence.json')),buddyVisible=presence.visible===true&&now-presence.at>=0&&now-presence.at<12000;
    startActivityWorker();
    const activity=process.env.WHALE_CLIENT_ACTIVITY==='0'?{}:read(path.join(dataDir,'client-activity.json'));
    const previousStatus=model.timer.status;
    const state=model.tick({hardware,activity,buddyVisible,now});
    if(previousStatus!==model.timer.status)persist();
    for(const event of model.events.filter(e=>e.id>eventId)){
      eventId=event.id;
      if(buddyVisible&&['coffee','celebrate'].includes(event.kind)){
        // Coffee acknowledgment is sent by the UI only after arrival.
        if(event.kind==='celebrate')writeJson(path.join(buddyDir,'display-request.json'),{mode:'buddy-celebrate',at:now,nonce:crypto.randomUUID()});
      }
    }
    const {desktopPaths,recycleRoots,...publicHardware}=hardware;
    lastState={ok:true,at:now,settings:model.settings,...state,hardware:publicHardware,buddy:{visible:buddyVisible,position:buddyVisible&&presence.petPoint?pointToLocal(presence.petPoint):null,mouth:buddyVisible&&presence.mouthPoint?pointToLocal(presence.mouthPoint):null},events:model.events.filter(e=>e.until>now),desktopDeleteWatching:recycleWatchers.size>0,desktopIconsReady:now-desktopIcons.at<3000,panelRequest};
    startWorker();return lastState;
  }
  const interval=enabled?setInterval(sample,2000):null;interval?.unref();if(enabled){persist();sample();startWorker();}
  return {
    get:()=>lastState.at?lastState:sample(),
    catalog:()=>({ok:true,items:companionCatalog(model.settings),buddyVisible:sample().buddy.visible}),
    openPanel:()=>{panelRequest={id:crypto.randomUUID(),at:Date.now()};sample();return {ok:true};},
    trigger:id=>{
      if(['gpt-running','gpt-thinking'].includes(id))id='gpt-working';
      const item=companionCatalog(model.settings).find(x=>x.id===id);if(!item)throw new Error('未知操作');
      if(item.ui)return {ok:true,ui:item.ui};
      if(item.mode){sendBuddy(item.mode);return {ok:true,message:'已发送到 GPT 娘'};}
      if(item.buddy){const p=read(path.join(buddyDir,'presence.json'));if(!p.visible||Date.now()-p.at>=12000)throw new Error('请先打开 GPT 娘');}
      if(id==='cheer'){try{sendBuddy('buddy-celebrate');}catch{}}
      model.now=Date.now();
      model.emit('preview',item.message||'',item.action.startsWith('delete')?'eating':item.action,9,14000,{preview:id,effect:id==='delete-eat'?'eat':id==='delete-beam'?'beam':null,fileName:'预览文件.txt'});
      sample();return {ok:true,message:'正在演示，结束后恢复自动动作'};
    },
    settings:patch=>{model.setSettings(patch);persist();watchRecycle();return sample();},
    timer:command=>{model.timerCommand(command);persist();return sample();},
    preview:action=>{if(!['snack','sit','eating','full','coffee','cheer','delete-eat','delete-beam'].includes(action))throw new Error('未知动作');model.now=Date.now();model.emit('preview',({eating:'库库吃饭！',full:'吃不下了……',coffee:'咖啡来啦，辛苦啦～',cheer:'完成啦！好厉害！'})[action]||'',action.startsWith('delete')?'eating':action,9,14000,{preview:action,effect:action==='delete-eat'?'eat':action==='delete-beam'?'beam':null,fileName:'预览文件.txt'});return sample();},
    buddyArrived:()=>{const p=read(path.join(buddyDir,'presence.json'));if(p.visible&&Date.now()-p.at<12000)writeJson(path.join(buddyDir,'display-request.json'),{mode:'buddy-coffee',at:Date.now(),nonce:crypto.randomUUID()});return {ok:true};},
    close:()=>{closed=true;clearInterval(interval);activityWorker?.kill();worker?.kill();iconWorker?.kill();for(const w of recycleWatchers.values())w.close();for(const t of timers)clearTimeout(t);}
  };
}
