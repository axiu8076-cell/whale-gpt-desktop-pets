'use strict';
const el = id => document.getElementById(id);
window.whaleSettings.read().then(value => {
  if (!value) return;
  el('client').checked = value.clientIntegration;
  el('startup').checked = value.startup;
  el('startup').disabled = !value.startupAvailable;
  el('key-note').textContent = value.hasKey ? '已有加密 Key；留空保留，输入新 Key 则替换。' : '使用 macOS 钥匙串保护的加密存储；不传给其他角色或上传到 GitHub。';
  el('status').textContent = value.keyError || '';
}).catch(() => { el('status').textContent = '设置暂不可读取，请重新打开。'; });
el('save').addEventListener('click', async () => {
  el('save').disabled = true;
  try {
    const value = await window.whaleSettings.save({ key: el('key').value, clearKey: el('clear').checked, clientIntegration: el('client').checked, startup: el('startup').checked });
    el('key').value = '';
    el('status').textContent = value.ok ? '设置已保存，正在重新启动…' : value.error || '未能保存';
  } catch { el('status').textContent = '未能保存，请重试。'; }
  finally { el('save').disabled = false; }
});
