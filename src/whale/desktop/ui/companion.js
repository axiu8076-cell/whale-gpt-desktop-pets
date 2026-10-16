(() => {
 'use strict';
 function init(){
  const panelOnly=document.documentElement.hasAttribute('data-companion-panel');
  const pet=document.querySelector('.dshwv-img');if(!pet){setTimeout(init,300);return;}
  const options=[['daily','日常小动作','站着、悄悄吃饭和坐在任务栏上休息，安静随机轮换'],['temperature','温度小哨兵','GPU 实测温度；CPU 传感器可用时自动显示'],['load','库库吃饭','CPU / GPU 忙起来，就大口吃饭'],['memory','抱饭吃不下','内存 / 专用显存持续 15 秒过高时提醒'],['buddy','和 GPT 娘串门','走过去递咖啡；30 分钟以上任务完成才庆祝'],['idle','别浪费月供','GPT 连续闲置 15 分钟，每段闲置只提醒一次'],['battery','电量饭量表','低于 20% 提醒，充电和充满时响应'],['pomodoro','专注番茄钟','默认专注 25 分钟，休息 5 分钟，手动开始'],['desktopDelete','桌面删除特效','移入回收站后，随机吃文件或发光炮；不改变删除结果']];
  const toggle=document.createElement('button');toggle.className='whale-companion-toggle';toggle.textContent='双宠操作台';toggle.title='打开鲸鲸与 GPT 娘的操作目录';toggle.hidden=true;
  const notice=document.createElement('div');notice.className='whale-companion-notice';notice.hidden=true;
  const dialog=document.createElement('dialog');dialog.id='whale-companion-dialog';dialog.setAttribute('aria-label','鲸鲸生活助手');
  dialog.innerHTML=`<header><h2>鲸鲸生活助手</h2><button id="wc-close" aria-label="关闭">×</button></header><p class="wc-sub">电脑状态 × 生活提醒 × 双宠互动</p><div class="wc-grid">${[['temp','显卡温度'],['cpu','CPU / GPU 负载'],['ram','内存'],['vram','专用显存'],['battery','电池'],['client','GPT 客户端']].map(([id,label])=>`<div class="wc-metric"><span>${label}</span><strong id="wc-${id}">读取中</strong></div>`).join('')}</div><p class="wc-sub" id="wc-sensor-note"></p>${options.map(([key,title,description])=>`<label class="wc-option"><input type="checkbox" data-setting="${key}"><div>${title}<small>${description}</small></div></label>`).join('')}<section class="wc-timer"><span id="wc-timer-label">尚未开始</span><strong id="wc-countdown">25:00</strong><div>专注 <input type="number" min="1" max="180" data-number="focusMinutes" aria-label="专注分钟"> 分钟 · 休息 <input type="number" min="1" max="60" data-number="breakMinutes" aria-label="休息分钟"> 分钟</div><div class="wc-controls"><button data-timer="start-focus">开始专注</button><button data-timer="start-break">开始休息</button><button data-timer="pause">暂停</button><button data-timer="resume">继续</button><button data-timer="reset">重置</button></div></section><details><summary>动作预览</summary><div class="wc-controls">${[['eating','库库吃饭'],['full','吃不下了'],['coffee','走过去递咖啡'],['cheer','撒花庆祝'],['delete-eat','吃文件'],['delete-beam','发光炮']].map(([a,t])=>`<button data-preview="${a}">${t}</button>`).join('')}</div><p class="wc-sub">预览会关闭面板展示动作；文件特效使用虚拟纸片。</p></details><details><summary>提醒阈值</summary>${[['cpuHot','CPU 温度 °C',50,110],['gpuHot','GPU 温度 °C',50,110],['loadAt','开始吃饭的负载 %',10,95],['memoryAt','内存 / 显存提醒 %',60,98]].map(([k,t,min,max])=>`<label class="wc-threshold">${t}<input type="number" min="${min}" max="${max}" data-number="${k}"></label>`).join('')}</details><p id="wc-error" role="status"></p>`;
  document.body.append(toggle,notice,dialog);
  let state=null,seenEvents=new Set(),busy=false,travel=false,lastCursor=null,polling=false,pending=false;
  const eventQueue=[];
  let effectAbort=null;
  let seatOffset=0;
  const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
  const asset=action=>`/assets/companion-${action}.png`;
  const valid=n=>typeof n==='number'&&Number.isFinite(n);
  const fmt=(n,suffix='')=>valid(n)?`${Math.round(n)}${suffix}`:'不可读取';
  const text=(id,value)=>{const e=dialog.querySelector('#wc-'+id);if(e.textContent!==value)e.textContent=value;};
  async function request(route='',body){const response=await fetch('/api/companion'+route,{...(body?{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}:{})});const data=await response.json();if(!response.ok||!data.ok)throw new Error(data.error||'操作未成功，请稍后重试');return data;}
  function geometry(){
    if(!pet.isConnected)return;let r=pet.getBoundingClientRect();const root=pet.closest('.dshwv-root'),anchor=pet.closest('.dshwv-position')||root;
    if(anchor){
      // Standalone viewport ends at the taskbar. Align the seated artwork's
      // opaque baseline (286 / 300) to that edge without changing saved position.
      const next=state?.action==='sit'&&!travel?Math.round((seatOffset+innerHeight-r.bottom+r.height*14/300)*100)/100:0;
      if(Math.abs(next-seatOffset)>.01){seatOffset=next;if(next)anchor.style.translate=`0 ${next}px`;else anchor.style.removeProperty('translate');r=pet.getBoundingClientRect();window.WhaleRendering?.presentFor?.(100);}
    }
    const action=/\/assets\/companion-(\w+)\.png/.exec(pet.getAttribute('src')||'')?.[1];
    if(root&&action){
      // Keep the bubble's layout mirror, but orient each sprite toward the screen centre.
      const nativeFacing=['idle','walk','coffee'].includes(action)?1:-1;
      const facing=r.left+r.width/2<innerWidth/2?1:-1;
      const transform=getComputedStyle(root).transform;
      const rootMirror=transform!=='none'&&new DOMMatrixReadOnly(transform).a<0?-1:1;
      const scale=String(facing*nativeFacing*rootMirror)+' 1';
      if(pet.style.scale!==scale)pet.style.scale=scale;
    }
    toggle.style.left=clamp(r.right-72,8,innerWidth-92)+'px';toggle.style.top=clamp(r.bottom-12,8,innerHeight-33)+'px';notice.style.left=clamp(r.left+r.width/2-104,8,innerWidth-216)+'px';notice.style.top=clamp(r.top-80,8,innerHeight-90)+'px';
  }
  function position(element,x,y){element.style.left=x+'px';element.style.top=y+'px';}
  function transient(className){const el=document.createElement('div');el.className=className;document.body.append(el);return el;}
  const wait=ms=>new Promise((resolve,reject)=>{const signal=effectAbort?.signal;if(signal?.aborted){reject(new Error('演示已切换'));return;}const finish=()=>{signal?.removeEventListener('abort',cancel);resolve();};const timer=setTimeout(finish,ms);const cancel=()=>{clearTimeout(timer);reject(new Error('演示已切换'));};signal?.addEventListener('abort',cancel,{once:true});});
  async function animate(el,keyframes,options){const signal=effectAbort?.signal;if(signal?.aborted)throw new Error('演示已切换');window.WhaleRendering?.presentFor?.(options.duration+100);const a=el.animate(keyframes,{fill:'forwards',...options}),cancel=()=>a.cancel();signal?.addEventListener('abort',cancel,{once:true});try{await a.finished;}catch{}finally{signal?.removeEventListener('abort',cancel);}if(signal?.aborted)throw new Error('演示已切换');return a;}
  function onScreen(p){return p&&valid(p.x)&&valid(p.y)&&p.x>=10&&p.x<innerWidth-10&&p.y>=10&&p.y<innerHeight-10;}
  async function walkTo(target,{coffee=false,paper=null}={}){
    const r=pet.getBoundingClientRect(),root=pet.closest('.dshwv-root'),h=root?root.getBoundingClientRect().width*.5945:r.height,w=h*272/300;
    const start={x:r.left+r.width/2-w/2,y:r.bottom-h};
    const end={x:clamp(target.x-w*.85,3,innerWidth-w-3),y:clamp(target.y-h,3,innerHeight-h-3)};
    const img=document.createElement('img');img.className='whale-companion-traveller';img.src=asset('walk');img.style.width=w+'px';img.style.height=h+'px';position(img,start.x,start.y);document.body.append(img);
    travel=true;const oldOpacity=pet.style.opacity;pet.style.opacity='0';
    const duration=clamp(Math.hypot(end.x-start.x,end.y-start.y)*4,1400,5000),sign=end.x>=start.x?1:-1;
    try{
      const outbound=await animate(img,[{transform:`translate(0,0) scaleX(${sign})`},{transform:`translate(${end.x-start.x}px,${end.y-start.y}px) scaleX(${sign})`}],{duration,easing:'linear'});
      const recipientFacing=target.x>=end.x+w/2?1:-1;
      position(img,end.x,end.y);outbound.cancel();img.style.transform=`scaleX(${coffee?recipientFacing:-sign})`;img.src=asset(coffee?'coffee':'eating');
      if(coffee){await request('/arrived',{});await wait(3400);}else if(paper){const pr=paper.getBoundingClientRect(),dx=end.x+w*.5-(pr.left+pr.width/2),dy=end.y+h*.45-(pr.top+pr.height/2);await animate(paper,[{transform:'scale(1)',opacity:1},{transform:`translate(${dx}px,${dy}px) scale(.05)`,opacity:0}],{duration:900,easing:'ease-in'});paper.remove();await wait(1300);}
      img.src=asset('walk');await animate(img,[{transform:`translate(0,0) scaleX(${-sign})`},{transform:`translate(${start.x-end.x}px,${start.y-end.y}px) scaleX(${-sign})`}],{duration,easing:'linear'});
    }finally{img.remove();pet.style.opacity=oldOpacity;travel=false;render();}
  }
  async function beam(target,paper){
    const mouth=state?.buddy?.mouth;
    const rect=paper.getBoundingClientRect(),center={x:rect.left+rect.width/2,y:rect.top+rect.height/2};
    if(!onScreen(mouth)){await walkTo({x:center.x+22,y:rect.bottom},{paper});return;}
    const glow=transient('whale-companion-glow');position(glow,mouth.x-17,mouth.y-17);
    let ray;
    try{
      await animate(glow,[{transform:'scale(.15)',opacity:.3},{transform:'scale(1.1)',opacity:1}],{duration:1000,easing:'ease-in'});
      ray=transient('whale-companion-beam');const dx=center.x-mouth.x,dy=center.y-mouth.y;position(ray,mouth.x,mouth.y-5);ray.style.width=Math.hypot(dx,dy)+'px';ray.style.transform=`rotate(${Math.atan2(dy,dx)}rad)`;
      await animate(ray,[{opacity:0},{opacity:1,offset:.2},{opacity:.9}],{duration:450});paper.remove();
      const fragments=Array.from({length:12},(_,i)=>{const el=transient('whale-companion-fragment');position(el,center.x,center.y);const a=i*Math.PI/6;return animate(el,[{transform:'translate(0,0) rotate(0)',opacity:1},{transform:`translate(${Math.cos(a)*95}px,${Math.sin(a)*70+35}px) rotate(210deg)`,opacity:0}],{duration:950,easing:'ease-out'}).finally(()=>el.remove());});
      ray.remove();glow.remove();await Promise.all(fragments);
    }finally{glow.remove();ray?.remove();paper.remove();}
  }
  async function playEvent(event){
    if(panelOnly)return;
    const coffee=event.kind==='coffee'||event.preview==='coffee',deletion=event.kind==='desktop-delete'||event.effect;
    if(event.kind==='preview'&&busy){eventQueue.length=0;eventQueue.push(event);effectAbort?.abort();return;}
    if(!coffee&&!deletion)return;
    if(busy){if(eventQueue.length<3)eventQueue.push(event);return;}
    busy=true;effectAbort=new AbortController();let paper;
    try {
      if(coffee){if(onScreen(state?.buddy?.position))await walkTo(state.buddy.position,{coffee:true});else {notice.hidden=false;notice.textContent='GPT 娘不在当前屏幕，咖啡先替你留着～';await wait(4500);}}
      else {
        let target;
        if(event.kind==='desktop-delete'){
          const icon=event.icon;
          if(!icon||!onScreen({x:icon.x+icon.width/2,y:icon.y+icon.height/2})||!String(icon.src).startsWith('data:image/png;base64,'))return;
          target={x:icon.x,y:icon.y};paper=transient('whale-companion-paper whale-companion-original-icon');
          paper.style.width=icon.width+'px';paper.style.height=icon.height+'px';const img=document.createElement('img');img.src=icon.src;img.alt=event.fileName||'';paper.append(img);
        }else{
          const r=pet.getBoundingClientRect(),cursor=lastCursor||{x:r.right+170,y:r.bottom-110};target={x:clamp(cursor.x-33,12,innerWidth-85),y:clamp(cursor.y-40,12,innerHeight-100)};
          paper=transient('whale-companion-paper');paper.textContent='示例文件';
        }
        position(paper,target.x,target.y);const rect=paper.getBoundingClientRect();
        if(event.effect==='beam')await beam(target,paper);else await walkTo({x:rect.left+rect.width*.8,y:rect.bottom},{paper});
      }
    }catch{paper?.remove();}finally{busy=false;effectAbort=null;paper?.remove();render();const next=eventQueue.shift();if(next)void playEvent(next);}
  }
  function render(){
    if(!state)return;const h=state.hardware||{},fresh=state.sensorFresh;
    const current=pet.getAttribute('src');
    pet.toggleAttribute('data-companion-idle',state.action==='idle');
    const desired=asset(state.action);if(!travel&&current!==desired)pet.setAttribute('src',desired);
    if(!busy){notice.hidden=!state.text;notice.textContent=state.text||'';}
    geometry();const t=state.timer;
    toggle.textContent=t.status==='running'?`◷ ${Math.ceil(t.remainingMs/60000)}分`:'双宠操作台';
    if(!dialog.open)return;
    text('temp',fresh?fmt(h.gpuTemp,'°C'):'等待传感器');text('cpu',fresh?`${fmt(h.cpuLoad,'%')} / ${fmt(h.gpuLoad,'%')}`:'等待采样');text('ram',fmt(h.ramPercent,'%'));text('vram',fresh?fmt(h.vramPercent,'%'):'等待采样');
    const b=h.battery;text('battery',fresh&&b?.present?`${fmt(b.percent,'%')} · ${b.charging?'充电':b.plugged?'已接电':'用电池'}`:b?.present===false?'未安装电池':'等待采样');
    text('client',!state.client.open?'未运行':!state.client.fresh?'等待读取':state.client.active?`${state.client.active} 个任务`:`闲置 ${Math.floor(state.idleSeconds/60)} 分钟`);
    text('sensor-note',`CPU 温度：${valid(h.cpuTemp)?fmt(h.cpuTemp,'°C'):'暂不支持'}。${h.temperatureSource?'显卡温度来自系统传感器。':''}专用显存不含共享内存。${state.desktopDeleteWatching?' 桌面回收监听已就绪。':' 桌面回收监听待就绪。'}`);
    for(const e of dialog.querySelectorAll('[data-setting]'))if(!pending)e.checked=state.settings[e.dataset.setting];
    for(const e of dialog.querySelectorAll('[data-number]'))if(document.activeElement!==e)e.value=state.settings[e.dataset.number];
    const ms=t.status==='stopped'?state.settings.focusMinutes*60000:t.remainingMs,seconds=Math.ceil(ms/1000);text('countdown',`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`);
    text('timer-label',({stopped:'尚未开始',running:t.phase==='focus'?'专注中':'休息中',paused:'已暂停',ready:t.phase==='focus'?'专注完成，休息一下':'休息完成，准备下一轮'})[t.status]);
    for(const e of dialog.querySelectorAll('[data-timer]'))e.disabled=!state.settings.pomodoro||(e.dataset.timer==='pause'&&t.status!=='running')||(e.dataset.timer==='resume'&&t.status!=='paused');
  }
  async function poll(){if(polling)return;polling=true;try{state=await request();window.dispatchEvent(new CustomEvent('whale-companion-state',{detail:state}));render();for(const event of state.events||[])if(!seenEvents.has(event.id)){seenEvents.add(event.id);void playEvent(event);}if(seenEvents.size>200)seenEvents=new Set([...seenEvents].slice(-100));}catch(error){if(dialog.open)text('error',error.message);}finally{polling=false;}}
  toggle.addEventListener('click',async()=>{if(window.whaleDesktop&&!panelOnly){try{await request('/open',{});}catch{notice.hidden=false;notice.textContent='操作台未能打开，请重试桌面入口';}return;}dialog.showModal();window.whaleDesktop?.keyboardFocus(true);render();});dialog.querySelector('#wc-close').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>window.whaleDesktop?.keyboardFocus(false));
  dialog.addEventListener('change',async event=>{const e=event.target;const key=e.dataset.setting||e.dataset.number;if(!key)return;pending=true;e.disabled=true;try{state=await request('/settings',{[key]:e.dataset.setting?e.checked:Number(e.value)});text('error','已保存');}catch(error){text('error',error.message);}finally{pending=false;e.disabled=false;render();}});
  dialog.addEventListener('click',async event=>{const e=event.target.closest('button');if(!e)return;try{if(e.dataset.timer){state=await request('/timer',{command:e.dataset.timer});render();}else if(e.dataset.preview){dialog.close();state=await request('/preview',{action:e.dataset.preview});await poll();}}catch(error){text('error',error.message);}});
  window.whaleDesktop?.onCursor(point=>{if(valid(point.x)&&valid(point.y))lastCursor=point;});window.WhaleRendering?.onFrame(geometry);window.addEventListener('resize',geometry);
  new ResizeObserver(geometry).observe(pet);new MutationObserver(geometry).observe(pet.closest('.dshwv-root')||pet,{attributes:true,attributeFilter:['style','class']});
  for(const name of ['idle','snack','sit','eating','full','coffee','cheer','walk']){const img=new Image();img.src=asset(name);}
  setInterval(poll,2000);setInterval(()=>{if(state?.timer.status==='running'){state.timer.remainingMs=Math.max(0,state.timer.endAt-Date.now());render();}},1000);void poll();geometry();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
