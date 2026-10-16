import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {DatabaseSync} from 'node:sqlite';
import {fileURLToPath} from 'node:url';
import {StringDecoder} from 'node:string_decoder';
import {allowedRollout} from './thread-speed.mjs';
import {atomicJson} from './usage.mjs';

// Read-only local metadata. No conversation bodies, tool arguments, outputs,
// credentials or reasoning text are persisted or sent over the network.
export function shortTitle(row) {
  let text=String(row.name || row.title || '').trim();
  if (text.includes('## My request:')) text=text.split('## My request:').pop().trim();
  text=text.split(/\r?\n/).find(line=>line.trim() && !line.startsWith('#')) || '未命名聊天';
  return text.replace(/https?:\/\/\S+/g,'').replace(/\s+/g,' ').trim().slice(0,100) || '未命名聊天';
}
export function toolLabel(name) {
  if (/request_user_input|approval/.test(name)) return '等待你的回复';
  if (/imagegen|image_gen/.test(name)) return '正在生成图片';
  if (/search|web|browse/.test(name)) return '正在查找资料';
  if (/apply_patch|write_file|edit_file/.test(name)) return '正在修改文件';
  if (/exec_command|shell|terminal/.test(name)) return '正在运行命令';
  if (/wait|sleep/.test(name)) return '正在等待执行结果';
  return '正在执行操作';
}
export class ActivityCounters {
  constructor(){this.state='unknown';this.label='等待任务状态';this.lastAt=0;this.taskStartedAt=0;this.pending=new Map();this.completedLabel=null;}
  accept(record){
    const p=record?.payload,at=Date.parse(record?.timestamp);
    if(!p || !Number.isFinite(at))return;
    const set=(state,label)=>{this.state=state;this.label=label;this.lastAt=at;};
    if(record.type==='event_msg'){
      if(p.type==='task_started'){this.taskStartedAt=at;this.pending.clear();this.completedLabel=null;set('thinking','正在思考');}
      else if(p.type==='task_complete'){this.pending.clear();set('idle','已完成');}
      else if(p.type==='turn_aborted'){this.pending.clear();set('idle','已停止');}
      else if(/approval_request|request_user_input/.test(p.type))set('waiting','等待你的回复');
      else if(p.type==='item_completed' && ['CommandExecution','FileChange','WebSearch','McpToolCall'].includes(p.item?.type)){
        this.completedLabel=({CommandExecution:'已运行命令',FileChange:'已修改文件',WebSearch:'已查找资料',McpToolCall:'工具已返回'})[p.item.type];
        if(!this.pending.size)set('thinking',this.completedLabel+' · 继续思考');
      }
      return;
    }
    if(record.type!=='response_item')return;
    if(['function_call','custom_tool_call'].includes(p.type)){
      this.completedLabel=null;
      const label=toolLabel(String(p.name||''));
      this.pending.set(p.call_id||p.id||String(at),label);
      set(label==='等待你的回复'?'waiting':'running',label);
    }else if(['function_call_output','custom_tool_call_output'].includes(p.type)){
      const label=this.pending.get(p.call_id);this.pending.delete(p.call_id);
      if(this.pending.size){const next=[...this.pending.values()].at(-1);set(next==='等待你的回复'?'waiting':'running',next);}
      else set('thinking',(this.completedLabel || (label==='正在运行命令'?'已运行命令':'操作已返回'))+' · 继续思考');
    }else if(p.type==='reasoning' || (p.type==='message' && p.role==='assistant' && p.phase!=='final_answer' && p.phase!=='final')){
      if(!this.pending.size)set('thinking',this.completedLabel?this.completedLabel+' · 继续思考':'正在思考');
    }else if(p.type==='message' && p.role==='assistant' && ['final_answer','final'].includes(p.phase)){
      this.pending.clear();set('idle','已完成');
    }
  }
  snapshot(now=Date.now()){
    if(['running','thinking','waiting'].includes(this.state) && now-this.lastAt>30*60*1000)
      return {state:'unknown',label:'状态较久未更新',lastAt:this.lastAt,taskStartedAt:this.taskStartedAt};
    return {state:this.state,label:this.label,lastAt:this.lastAt,taskStartedAt:this.taskStartedAt};
  }
}
// Recover the latest task-start timestamp after a widget restart, even when a
// long task's start precedes the normal 2 MiB tail. Only event metadata is kept.
export function findLatestTaskStart(file,before=Date.now()){
  const fd=fs.openSync(file,'r');
  try{
    const size=fs.fstatSync(fd).size;let end=size,carry='';const floor=Math.max(0,size-32*1024*1024);
    while(end>floor){
      const begin=Math.max(floor,end-256*1024),buffer=Buffer.alloc(end-begin);fs.readSync(fd,buffer,0,buffer.length,begin);
      const lines=(buffer.toString('utf8')+carry).split('\n');carry=lines.shift()||'';
      if(begin===0)lines.unshift(carry);
      for(let i=lines.length-1;i>=0;i--){const line=lines[i];if(!line.includes('"task_started"')||!line.includes('"event_msg"'))continue;try{const r=JSON.parse(line),at=Date.parse(r.timestamp);if(r.type==='event_msg'&&r.payload?.type==='task_started'&&Number.isFinite(at)&&at<=before)return at;}catch{}}
      end=begin;
    }
    return 0;
  }finally{fs.closeSync(fd);}
}
export class ActivityTail {
  constructor(file){this.file=file;this.offset=0;this.identity=null;this.pending='';this.decoder=new StringDecoder('utf8');this.counters=new ActivityCounters();}
  update(){
    const stat=fs.statSync(this.file);
    if(stat.ino!==this.identity || stat.size<this.offset){
      this.identity=stat.ino;this.offset=Math.max(0,stat.size-2*1024*1024);this.skipFirst=this.offset>0;
      this.pending='';this.decoder=new StringDecoder('utf8');this.counters=new ActivityCounters();this.startSearchDone=false;
    }
    const length=Math.min(stat.size-this.offset,2*1024*1024);
    if(length<=0)return this.counters;
    const fd=fs.openSync(this.file,'r'),buffer=Buffer.alloc(length);let count;
    try{count=fs.readSync(fd,buffer,0,length,this.offset);}finally{fs.closeSync(fd);}
    this.offset+=count;
    const lines=(this.pending+this.decoder.write(buffer.subarray(0,count))).split('\n');this.pending=lines.pop();
    if(this.skipFirst && lines.length){lines.shift();this.skipFirst=false;}
    for(const line of lines){
      if(!line.includes('"event_msg"') && !line.includes('"response_item"'))continue;
      try{this.counters.accept(JSON.parse(line));}catch{}
    }
    if(this.pending.length>2*1024*1024){this.pending='';this.skipFirst=true;}
    if(!this.startSearchDone){this.startSearchDone=true;if(!this.counters.taskStartedAt)this.counters.taskStartedAt=findLatestTaskStart(this.file,this.counters.lastAt||Date.now());}
    return this.counters;
  }
}
export function createActivityReader(codexHome=process.env.CODEX_HOME || path.join(os.homedir(),'.codex')){
  const tails=new Map();
  return ()=>{
    const at=Date.now();let db;
    try{
      const names=fs.readdirSync(codexHome).filter(n=>/^state_\d+\.sqlite$/.test(n)).sort((a,b)=>Number(b.match(/\d+/)[0])-Number(a.match(/\d+/)[0]));
      if(!names.length)throw new Error('没有可读取的本机任务记录');
      db=new DatabaseSync(path.join(codexHome,names[0]),{readOnly:true,timeout:500});
      const columns=new Set(db.prepare('PRAGMA table_info(threads)').all().map(c=>c.name));
      // Exclude hidden subagents; show the user's actual client chats.
      const filter=columns.has('agent_path')?" AND (agent_path IS NULL OR agent_path='' OR agent_path='/root')":'';
      const rows=db.prepare(`SELECT id,title,rollout_path,${columns.has('name')?'name':'NULL AS name'} FROM threads WHERE archived=0${filter} ORDER BY updated_at DESC LIMIT 30`).all();
      const live=new Set();
      const threads=rows.map(row=>{
        const file=allowedRollout(row.rollout_path,codexHome);
        if(!file)return null;
        live.add(file);
        try{
          if(!tails.has(file))tails.set(file,new ActivityTail(file));
          return {id:row.id,title:shortTitle(row),...tails.get(file).update().snapshot(at)};
        }catch{return null;}
      }).filter(Boolean).sort((a,b)=>b.lastAt-a.lastAt);
      for(const file of tails.keys())if(!live.has(file))tails.delete(file);
      const active=threads.filter(t=>['running','thinking','waiting'].includes(t.state));
      return {at,ok:true,source:'local-client-events',activeCount:active.length,threads:[...active,...threads.filter(t=>!active.includes(t))].slice(0,8)};
    }catch(error){return {at,ok:false,activeCount:0,threads:[],error:error.message.includes('没有可读取')?error.message:'本机任务状态暂不可读取'};}
    finally{db?.close();}
  };
}
function run(){
  const output=process.argv[2],parent=Number(process.argv[3]||0),once=process.argv.includes('--once');
  if(!output)throw new Error('activity output path required');
  const read=createActivityReader();
  const tick=()=>{
    if(parent){try{process.kill(parent,0);}catch{process.exit(0);}}
    try{atomicJson(output,read());}catch{}
  };
  tick();if(!once)setInterval(tick,2000);
}
if(process.argv[1] && fileURLToPath(import.meta.url)===path.resolve(process.argv[1]))run();
