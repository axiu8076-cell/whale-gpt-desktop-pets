(() => {
 'use strict';
 function init(){
  const panelOnly=document.documentElement.hasAttribute('data-companion-panel');
  const dialog=document.querySelector('#whale-companion-dialog');if(!dialog){setTimeout(init,200);return;}
  dialog.classList.add('duo-console');dialog.setAttribute('aria-label','鲸鲸生活助手 · 操作台');
  dialog.querySelector('h2').textContent='鲸鲸生活助手';
  const subtitle=dialog.querySelector('.wc-sub');subtitle.textContent='动作与功能目录 · 看触发要求、直接演示';
  const original=document.createElement('section');original.id='duo-settings';original.hidden=true;
  const error=dialog.querySelector('#wc-error');
  while(subtitle.nextElementSibling&&subtitle.nextElementSibling!==error)original.append(subtitle.nextElementSibling);
  const nav=document.createElement('nav');nav.className='duo-nav';nav.setAttribute('aria-label','操作台页面');nav.innerHTML='<button data-duo-page="catalog" aria-pressed="true">操作目录</button><button data-duo-page="settings" aria-pressed="false">实时状态 · 开关 · 番茄钟</button>';
  const catalogue=document.createElement('section');catalogue.id='duo-catalog';
  catalogue.innerHTML='<div class="duo-intro"><div><strong>先选一个，看看她们怎么动</strong><p>图示是动作预览。点击按钮会让桌面上的角色实际演示；演示不修改自动触发条件。</p></div><span id="duo-online">连接中</span></div><div class="duo-filters" role="group" aria-label="筛选角色"><button data-duo-filter="all" aria-pressed="true">全部</button><button data-duo-filter="whale">鲸鲸</button><button data-duo-filter="gpt">GPT 娘</button><button data-duo-filter="duo">双宠 · 特效</button><button data-duo-filter="reminder">生活提醒</button></div><div id="duo-cards" class="duo-cards"></div><p class="duo-footnote">自动触发需对应开关开启。走过去递咖啡、发光炮需要她们在同一主屏幕；实际删除追踪原图标；手动演示使用示例文件。手动动作结束后恢复自动状态。</p>';
  dialog.insertBefore(nav,error);dialog.insertBefore(catalogue,error);dialog.insertBefore(original,error);
  let data=null,filter='all',loading=false,lastPanelId=null;
  async function api(route,body){const response=await fetch('/api/companion/'+route,{...(body?{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}:{})});const value=await response.json();if(!response.ok||!value.ok)throw new Error(value.error||'操作暂时没有成功');return value;}
  function page(name){catalogue.hidden=name!=='catalog';original.hidden=name!=='settings';nav.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.duoPage===name)));dialog.scrollTop=0;}
  function draw(){
    if(!data)return;const container=catalogue.querySelector('#duo-cards');container.replaceChildren();
    catalogue.querySelector('#duo-online').textContent=data.platform==='darwin'?'鲸鲸在线 · Apple Silicon':data.buddyVisible?'两只都在线':'鲸鲸在线 · 双宠功能需增强版 GPT 娘';
    if(data.platform==='darwin')catalogue.querySelector('.duo-footnote').textContent='Mac 单独版：温度和原图标删除监测暂不支持，相关卡片仅提供手动动作演示；GPT 娘联动不可用。';
    for(const item of data.items.filter(x=>filter==='all'||x.group===filter)){
      const card=document.createElement('article');card.className='duo-card';card.dataset.actionId=item.id;
      const figure=document.createElement('div');figure.className='duo-figure';const img=document.createElement('img');img.src='/assets/'+item.image;img.alt=item.title+'动作图示';img.loading='lazy';figure.append(img);
      const body=document.createElement('div');body.className='duo-card-body';const title=document.createElement('h3');title.textContent=item.title;
      const badge=document.createElement('span');badge.className='duo-badge'+(item.enabled===false?' off':'');badge.textContent=item.enabled===null?'手动 / 随任务':item.enabled?'自动已开启':'自动已关闭';
      const effect=document.createElement('p');effect.className='duo-effect';effect.textContent=item.effect;
      const list=document.createElement('dl');
      for(const [label,value] of [['触发条件',item.when],['需要满足',item.requires],['频率 / 结束',item.cadence]]){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;list.append(dt,dd);}
      const button=document.createElement('button');button.dataset.duoTrigger=item.id;button.textContent=item.unsupported?'Mac 暂不支持':item.button||'立即演示';button.className='duo-trigger';button.disabled=!!item.unsupported||!!item.buddy&&!data.buddyVisible;if(button.disabled)button.title=item.unsupported||'请先打开并显示 GPT 娘';
      body.append(title,badge,effect,list,button);card.append(figure,body);container.append(card);
    }
  }
  async function load(){if(loading)return;loading=true;try{data=await api('catalog');draw();error.textContent='';if(panelOnly)window.whalePanel?.ready();}catch(e){error.textContent=e.message;}finally{loading=false;}}
  function open(){page('catalog');if(!dialog.open)dialog.showModal();window.whaleDesktop?.keyboardFocus(true);void load();}
  dialog.addEventListener('click',async event=>{
    const button=event.target.closest('button');if(!button)return;
    if(button.dataset.duoPage){page(button.dataset.duoPage);if(button.dataset.duoPage==='catalog')void load();}
    else if(button.dataset.duoFilter){filter=button.dataset.duoFilter;catalogue.querySelectorAll('[data-duo-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));draw();}
    else if(button.dataset.duoTrigger){button.disabled=true;try{
      const result=await api('trigger',{id:button.dataset.duoTrigger});
      if(result.ui==='balance'){
        const response=await fetch('/dsh-whale/balance.json?refresh=1'),balance=await response.json();
        let output=button.parentElement.querySelector('.duo-result');if(!output){output=document.createElement('p');output.className='duo-result';output.setAttribute('role','status');button.after(output);}
        output.textContent=balance.ok&&balance.balanceStatus==='finite'&&typeof balance.totalBalance==='number'&&Number.isFinite(balance.totalBalance)?'API 余额：'+balance.totalBalance.toLocaleString('zh-CN',{maximumFractionDigits:6})+' '+(/^[A-Z]{3}$/.test(balance.currency)?balance.currency:''):balance.unlimited?'当前接口显示不限额':'余额暂不可读取，请在原挂件设置中检查连接。';
      }else dialog.close();
    }catch(e){error.textContent=e.message;error.scrollIntoView({block:'nearest'});}finally{button.disabled=!!data?.items.find(x=>x.id===button.dataset.duoTrigger)?.buddy&&!data?.buddyVisible;}}
  });
  new MutationObserver(()=>{if(dialog.open)void load();}).observe(dialog,{attributes:true,attributeFilter:['open']});
  window.addEventListener('whale-open-companion',open);
  window.addEventListener('whale-companion-state',event=>{if(panelOnly)return;const request=event.detail?.panelRequest;if(request&&request.id!==lastPanelId&&Date.now()-request.at<15000){lastPanelId=request.id;open();}});
  if(panelOnly){dialog.addEventListener('close',()=>{open();window.whalePanel?.minimize();});dialog.addEventListener('cancel',event=>{event.preventDefault();window.whalePanel?.minimize();});open();}
  if(dialog.open)void load();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
