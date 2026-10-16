export const DEFAULTS = Object.freeze({daily:true,temperature:true,load:true,memory:true,buddy:true,idle:true,battery:true,pomodoro:true,desktopDelete:true,cpuHot:85,gpuHot:85,loadAt:50,memoryAt:90,focusMinutes:25,breakMinutes:5});
export function validatedSettings(input={},current=DEFAULTS) {
  const result={...current};
  for(const [key,value] of Object.entries(input)) {
    if(!(key in DEFAULTS)) throw new Error('未知设置');
    if(typeof DEFAULTS[key]==='boolean') {if(typeof value!=='boolean')throw new Error('开关必须为布尔值');result[key]=value;}
    else {const ranges={cpuHot:[50,110],gpuHot:[50,110],loadAt:[10,95],memoryAt:[60,98],focusMinutes:[1,180],breakMinutes:[1,60]};const [min,max]=ranges[key];if(!Number.isFinite(value)||value<min||value>max)throw new Error('数值超出范围');result[key]=Math.round(value);}
  }
  return result;
}
const fresh=(at,now,limit)=>Number.isFinite(at)&&now>=at&&now-at<limit;
const valid=n=>typeof n==='number'&&Number.isFinite(n);
export class CompanionModel {
  constructor({settings={},timer=null,now=Date.now(),random=Math.random,celebrationWithoutBuddy=false}={}) {
    try {this.settings=validatedSettings(settings);}catch{this.settings={...DEFAULTS};}
    this.timer=timer && ['stopped','running','paused','ready'].includes(timer.status)&&['focus','break'].includes(timer.phase)&&Number.isFinite(timer.remainingMs)&&timer.remainingMs>=0&&Number.isFinite(timer.endAt)?timer:{status:'stopped',phase:'focus',remainingMs:0,endAt:0};
    this.now=now;this.lastTick=now;this.idleSince=null;this.idleSent=false;this.memorySince=null;this.hotSince=null;this.notice=null;this.events=[];this.sequence=0;this.done=new Set();this.tasks=new Map();this.previousActive=0;this.batteryStage='';this.cooldowns=new Map();this.action='idle';
    this.celebrationWithoutBuddy=celebrationWithoutBuddy;this.random=random;this.daily={action:'idle',until:now+25000,bag:[]};
  }
  dailyAction(available){
    const d=this.daily;
    if(!available||!this.settings.daily){d.action='idle';d.until=this.now+25000;return 'idle';}
    if(this.now>=d.until){
      if(d.action==='idle'){
        if(!d.bag.length)d.bag=this.random()<.5?['snack','sit']:['sit','snack'];
        d.action=d.bag.shift();d.until=this.now+(d.action==='snack'?9000:25000+Math.floor(this.random()*15000));
      }else{d.action='idle';d.until=this.now+25000+Math.floor(this.random()*20000);}
    }
    return d.action;
  }
  setSettings(patch){const previous=this.settings;this.settings=validatedSettings(patch,this.settings);if(!this.settings.idle||!previous.idle){this.idleSince=null;this.idleSent=false;}if(!this.settings.pomodoro)this.timerCommand('reset');if(!this.settings.memory)this.memorySince=null;if(!this.settings.temperature)this.hotSince=null;this.notice=null;return this.settings;}
  emit(kind,text,action='idle',priority=1,duration=12000,extra={}) {
    const event={id:++this.sequence,at:this.now,kind,text,action,priority,until:this.now+duration,...extra};
    this.events.push(event);if(this.events.length>12)this.events.shift();
    if(!this.notice||this.notice.until<=this.now||priority>=this.notice.priority)this.notice=event;
    return event;
  }
  cooled(kind,ms){if(this.now-(this.cooldowns.get(kind)??-Infinity)<ms)return false;this.cooldowns.set(kind,this.now);return true;}
  timerCommand(command,now=Date.now()) {
    this.now=now;const t=this.timer;
    if(command==='reset'){this.timer={status:'stopped',phase:'focus',remainingMs:0,endAt:0};return;}
    if(!this.settings.pomodoro)throw new Error('请先打开番茄钟');
    if(command==='start-focus'||command==='start-break'){
      t.phase=command==='start-focus'?'focus':'break';t.remainingMs=this.settings[t.phase==='focus'?'focusMinutes':'breakMinutes']*60000;t.endAt=now+t.remainingMs;t.status='running';
    }else if(command==='pause'&&t.status==='running'){t.remainingMs=Math.max(0,t.endAt-now);t.status='paused';}
    else if(command==='resume'&&t.status==='paused'){t.endAt=now+t.remainingMs;t.status='running';}
    else throw new Error('当前状态不能执行此操作');
  }
  tick({hardware={},activity={},buddyVisible=false,now=Date.now()}={}) {
    this.now=now;
    const gap=now-this.lastTick>30000||now<this.lastTick;this.lastTick=now;
    if(gap){this.memorySince=null;this.hotSince=null;}
    const sensorFresh=fresh(hardware.at,now,25000),activityFresh=fresh(activity.at,now,12000)&&activity.ok===true;
    const clientOpen=sensorFresh&&hardware.clientOpen===true;
    const threads=activityFresh?activity.threads||[]:[];
    const active=threads.filter(t=>['running','thinking','waiting'].includes(t.state));
    if(gap||!clientOpen||!activityFresh||active.length||threads.some(t=>t.state==='unknown')||!this.settings.idle){this.idleSince=null;this.idleSent=false;}
    else {this.idleSince??=now;if(!this.idleSent&&now-this.idleSince>=900000){this.idleSent=true;this.emit('idle','GPT 已经闲了 15 分钟啦，别浪费月供～','full',3,20000);}}
    if(clientOpen&&activityFresh){
      for(const t of threads){
        if(['running','thinking','waiting'].includes(t.state)){if(!this.tasks.has(t.id))this.tasks.set(t.id,valid(t.taskStartedAt)&&t.taskStartedAt>0?t.taskStartedAt:now);}
        const start=t.taskStartedAt||this.tasks.get(t.id),key=`${t.id}:${start}`;
        if(t.state==='idle'&&t.label==='已完成'&&valid(start)&&t.lastAt-start>=1800000&&fresh(t.lastAt,now,20000)&&!this.done.has(key)){
          this.done.add(key);if(this.settings.buddy&&(buddyVisible||this.celebrationWithoutBuddy))this.emit('celebrate','完成啦！好厉害！','cheer',4,18000);
        }
        if(t.state==='idle')this.tasks.delete(t.id);
      }
      if(active.length>0&&this.previousActive===0&&this.settings.buddy&&buddyVisible&&this.cooled('coffee',600000))this.emit('coffee','咖啡来啦，辛苦啦～','coffee',1,16000);
      this.previousActive=active.length;
    }else this.previousActive=0;
    if(this.done.size>100)this.done=new Set([...this.done].slice(-50));
    const ram=hardware.ramPercent,vr=hardware.vramPercent;
    const high= sensorFresh&&this.settings.memory&&((valid(ram)&&ram>=this.settings.memoryAt)||(valid(vr)&&vr>=this.settings.memoryAt));
    if(high)this.memorySince??=now;else this.memorySince=null;
    const full=high&&now-this.memorySince>=15000;
    if(full&&this.cooled('memory',300000))this.emit('memory','吃不下了……内存或专用显存快满啦！','full',6,16000);
    const hot=sensorFresh&&this.settings.temperature&&((valid(hardware.cpuTemp)&&hardware.cpuTemp>=this.settings.cpuHot)||(valid(hardware.gpuTemp)&&hardware.gpuTemp>=this.settings.gpuHot));
    if(hot)this.hotSince??=now;else this.hotSince=null;
    if(hot&&now-this.hotSince>=10000&&this.cooled('heat',300000))this.emit('heat','有点烫啦，让电脑喘口气～','full',7,16000);
    const b=sensorFresh?hardware.battery:null;
    if(this.settings.battery&&b?.present&&valid(b.percent)){
      const stage=b.plugged===false&&b.percent<=20?'low':b.plugged===true&&b.percent>=95?'full':b.charging?'charging':'normal';
      if(stage!==this.batteryStage){if(stage==='low')this.emit('battery-low',`电量剩 ${b.percent}%，给电脑加口饭吧！`,'full',5,18000);else if(stage==='full'&&this.batteryStage)this.emit('battery-full','电池吃饱啦～','cheer',2,10000);else if(stage==='charging')this.emit('charging','充电中，库库补充能量！','eating',2,10000);}
      this.batteryStage=stage;
    }else this.batteryStage='';
    if(this.settings.pomodoro&&this.timer.status==='running'&&now>=this.timer.endAt){
      const focus=this.timer.phase==='focus';this.timer.status='ready';this.timer.remainingMs=0;
      this.emit('timer',focus?'专注完成！起来走走，喝点水吧。':'休息结束，要继续下一轮吗？',focus?'cheer':'coffee',5,25000);
    }
    if(this.notice?.until<=now)this.notice=null;
    const eating=this.settings.load&&sensorFresh&&((valid(hardware.cpuLoad)&&hardware.cpuLoad>=this.settings.loadAt)||(valid(hardware.gpuLoad)&&hardware.gpuLoad>=this.settings.loadAt));
    const daily=this.dailyAction(!gap&&!this.notice&&!full&&!eating);
    this.action=this.notice?.action==='idle'?(full?'full':eating?'eating':'idle'):this.notice?.action||(full?'full':eating?'eating':daily);
    const text=this.notice?this.notice.text:(full?'吃不下了……':eating?'库库吃饭，努力干活！':'');
    return {action:this.action,text,notice:this.notice,idleSeconds:this.idleSince===null?0:Math.floor((now-this.idleSince)/1000),client:{open:clientOpen,fresh:activityFresh,active:active.length},sensorFresh,timer:{...this.timer,remainingMs:this.timer.status==='running'?Math.max(0,this.timer.endAt-now):this.timer.remainingMs}};
  }
}
