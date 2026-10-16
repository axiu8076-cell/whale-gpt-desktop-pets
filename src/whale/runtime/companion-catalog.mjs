import {DEFAULTS} from './companion-model.mjs';
export function companionCatalog(settings=DEFAULTS){
 const s={...DEFAULTS,...settings};
 const items=[
  {id:'snack',group:'whale',title:'悄悄吃口米饭',image:'companion-snack.png',setting:'daily',effect:'左右看看，小口吃米饭，全程不说话。',when:'正常待机 25～45 秒后，与坐着休息随机轮换。',requires:'日常小动作开启；没有负载动作、提醒或双宠互动。',cadence:'每次约 9 秒，结束后站回原位；重要事件立即优先。',action:'snack',message:''},
  {id:'sit',group:'whale',title:'坐在任务栏上休息',image:'companion-sit.png',setting:'daily',effect:'坐在任务栏上沿，轻轻眨眼休息，不弹气泡。',when:'正常待机 25～45 秒后，与悄悄吃饭随机轮换。',requires:'日常小动作开启；桌面模式下贴任务栏上沿。',cadence:'每次约 25～40 秒，结束后回到原来的位置；手动演示 14 秒。',action:'sit',message:''},
  {id:'whale-balance',group:'whale',title:'查看鲸鲸 API 余额',image:'companion-coffee.png',effect:'在此卡片读取当前连接的真实 API 余额。',when:'点击「查询余额」；原记账挂件也会定时刷新。',requires:'余额接口可用，已有凭据配置有效。',cadence:'手动查询；API 余额与 GPT 订阅额度分别计算。',ui:'balance',button:'查询余额'},
  {id:'eating',group:'whale',title:'库库吃饭',image:'companion-eating.png',setting:'load',effect:'鲸鲸大口吃米饭。',when:`CPU 或 GPU 负载达到 ${s.loadAt}%。`,requires:'负载监测已开启，系统采样有效。',cadence:'忙碌期间保持动作；重要提醒优先。',action:'eating',message:'库库吃饭！'},
  {id:'full',group:'whale',title:'抱饭说「吃不下了」',image:'companion-full.png',setting:'memory',effect:'抱着米饭，一脸吃不下的表情。',when:`内存或专用显存达到 ${s.memoryAt}%，持续 15 秒。`,requires:'内存提醒已开启；专用显存不包含共享内存。',cadence:'提醒间隔至少 5 分钟；持续过高时保留抱饭动作。',action:'full',message:'吃不下了……'},
  {id:'gpt-working',group:'gpt',title:'工作中 · 随机敲电脑 / 叼笔',image:'buddy-running.gif',effect:'敲电脑累晕和叼笔思考合并为工作动作，随机轮播。',when:'客户端有执行、思考或等待中的任务。',requires:'GPT 娘在运行，客户端任务记录有效。',cadence:'每套动作完整播完再随机切换；两种动作都会出现。手动演示约 16 秒。',buddy:true,mode:'animate-working'},
  {id:'coffee',group:'duo',title:'走过去递咖啡',image:'companion-walk.png',setting:'buddy',effect:'鲸鲸走到 GPT 娘旁边递咖啡；GPT 娘挥手，鲸鲸回原位。',when:'客户端从没有任务变为有任务。',requires:'双宠互动开启；两只角色显示在同一主屏幕。',cadence:'最多每 10 分钟一次；手动演示无需等待。',buddy:true,action:'coffee',message:'咖啡来啦，辛苦啦～'},
  {id:'cheer',group:'duo',title:'30 分钟大任务庆祝',image:'companion-cheer.png',setting:'buddy',effect:'鲸鲸撒花；增强版 GPT 娘在线时一起庆祝。',when:'单个任务用时 ≥ 30 分钟，且正常完成。',requires:'互动提醒开启；本机 Codex 任务读取开启且记录有效。',cadence:'每个任务一次；短任务或中止不触发。',action:'cheer',message:'完成啦！好厉害！'},
  {id:'delete-eat',group:'duo',title:'鲸鲸走过去吃文件',image:'companion-eating.png',setting:'desktopDelete',effect:'鲸鲸走到被删除文件原来的位置，吃掉原图标后回原位。',when:'桌面顶层文件或文件夹移入回收站，随机选中吃文件。',requires:'删除特效开启，原图标已缓存，文件在主屏幕。Shift+Delete 不触发。',cadence:'连续删除会合并，触发至少间隔约 2.5 秒。',action:'delete-eat'},
  {id:'delete-beam',group:'duo',title:'GPT 娘嘴里发光炮',image:'buddy-idle.gif',setting:'desktopDelete',effect:'嘴部蓄光，瞄准被删除文件原来的图标并击碎。',when:'桌面文件移入回收站，随机选中发光炮。',requires:'删除特效开启，GPT 娘在同一主屏幕；否则改为鲸鲸吃文件。',cadence:'实际删除使用缓存的原图标；立即演示使用示例文件。',buddy:true,action:'delete-beam'},
  {id:'idle-reminder',group:'reminder',title:'别浪费月供',image:'companion-full.png',setting:'idle',effect:'鲸鲸说「GPT 已经闲了 15 分钟啦，别浪费月供～」。',when:'GPT 客户端连续 15 分钟没有活动任务。',requires:'提醒开启；Codex 仍打开，安装设置中的任务读取已开启且记录有效。',cadence:'每段闲置仅一次；新任务、退出、休眠或未知状态重新计时。',action:'full',message:'GPT 已经闲了 15 分钟啦，别浪费月供～'},
  {id:'heat',group:'reminder',title:'温度有点烫',image:'companion-full.png',setting:'temperature',effect:'鲸鲸提醒「有点烫啦，让电脑喘口气～」。',when:`CPU ≥ ${s.cpuHot}°C 或 GPU ≥ ${s.gpuHot}°C，持续 10 秒。`,requires:'温度监测开启且传感器有效；CPU 温度需 LibreHardwareMonitor / OpenHardwareMonitor 提供传感器，无法读取时显示未知。',cadence:'提醒间隔至少 5 分钟；演示不改变实测温度。',action:'full',message:'有点烫啦，让电脑喘口气～'},
  {id:'battery-low',group:'reminder',title:'电池饿了',image:'companion-full.png',setting:'battery',effect:'提醒「电量低啦，给电脑加口饭吧！」。',when:'未接电源，电量 ≤ 20%。',requires:'电池提醒开启，系统能读取电池。',cadence:'进入低电量状态时提醒一次。',action:'full',message:'电量低啦，给电脑加口饭吧！'},
  {id:'battery-charging',group:'reminder',title:'充电 · 补充能量',image:'companion-eating.png',setting:'battery',effect:'吃饭并说「充电中，库库补充能量！」。',when:'系统电池状态变为充电中。',requires:'电池提醒开启；接电但没有充电时不误报。',cadence:'每次进入充电状态提醒一次。',action:'eating',message:'充电中，库库补充能量！'},
  {id:'battery-full',group:'reminder',title:'电池吃饱了',image:'companion-cheer.png',setting:'battery',effect:'鲸鲸说「电池吃饱啦～」。',when:'接着电源，电量进入 ≥ 95% 状态。',requires:'电池提醒开启；刚启动时已满电不重复提示。',cadence:'进入该状态时一次。',action:'cheer',message:'电池吃饱啦～'},
  {id:'focus-done',group:'reminder',title:'专注结束 · 休息一下',image:'companion-cheer.png',setting:'pomodoro',effect:'撒花，提醒起来走走、喝水。',when:`手动开始的专注计时走完，当前设定 ${s.focusMinutes} 分钟。`,requires:'番茄钟开启并处于运行状态，暂停期间不计时。',cadence:'每轮结束一次；下一轮需手动开始。',action:'cheer',message:'专注完成！起来走走，喝点水吧。'},
  {id:'break-done',group:'reminder',title:'休息结束',image:'companion-coffee.png',setting:'pomodoro',effect:'鲸鲸提醒「休息结束，要继续下一轮吗？」。',when:`手动开始的休息计时走完，当前设定 ${s.breakMinutes} 分钟。`,requires:'番茄钟开启；演示不会启动真实计时。',cadence:'每轮一次。',action:'coffee',message:'休息结束，要继续下一轮吗？'},
  {id:'gpt-quota',group:'gpt',title:'查看 GPT 订阅额度',image:'buddy-idle.gif',effect:'打开 GPT 娘的真实额度气泡。',when:'点击 GPT 娘，或这里的「打开额度」。',requires:'GPT 娘在运行；额度取决于实际登录账号及本机读取结果。',cadence:'手动查看。',buddy:true,mode:'quota',button:'打开额度'},
  {id:'gpt-quote',group:'gpt',title:'GPT 娘语录',image:'buddy-waving.gif',effect:'切换到 GPT 娘的语录气泡。',when:'手动切换。',requires:'GPT 娘在运行。',cadence:'手动触发。',buddy:true,mode:'quote',button:'打开语录'},
  {id:'gpt-menu',group:'gpt',title:'GPT 娘完整设置',image:'buddy-idle.gif',effect:'打开原挂件菜单，调整大小、显示和其他设置。',when:'右键 GPT 娘，或点击此处。',requires:'GPT 娘在运行且可见。',cadence:'手动打开。',buddy:true,mode:'menu',button:'打开菜单'},
  {id:'gpt-auto',group:'gpt',title:'GPT 娘恢复自动',image:'buddy-idle.gif',effect:'结束手动动作覆盖，重新跟随客户端任务状态。',when:'手动点击；动作演示约 16 秒后也会自动恢复。',requires:'GPT 娘在运行。',cadence:'立即生效。',buddy:true,mode:'animate-auto',button:'恢复自动'},
 ];
 return items.map(item=>({...item,enabled:item.setting?s[item.setting]:null}));
}
