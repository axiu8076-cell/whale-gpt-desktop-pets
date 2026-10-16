function Show-WhaleSettings([string]$Root,[switch]$Installing) {
  Add-Type -AssemblyName System.Windows.Forms,System.Drawing,System.Security
  [Windows.Forms.Application]::EnableVisualStyles()
  $current=Read-WhaleJson (Join-Path $Root 'settings.json')
  $form=[Windows.Forms.Form]::new();$form.Text=if($Installing){'安装鲸鲸生活助手'}else{'鲸鲸 · 连接与启动设置'}
  $form.ClientSize=[Drawing.Size]::new(540,412);$form.StartPosition='CenterScreen';$form.FormBorderStyle='FixedDialog';$form.MaximizeBox=$false;$form.MinimizeBox=$false
  $form.Font=[Drawing.Font]::new('Microsoft YaHei UI',10)
  $title=[Windows.Forms.Label]::new();$title.Text='让鲸鲸住在桌面上';$title.Location=[Drawing.Point]::new(24,20);$title.Size=[Drawing.Size]::new(490,32);$title.Font=[Drawing.Font]::new('Microsoft YaHei UI',16,[Drawing.FontStyle]::Bold)
  $intro=[Windows.Forms.Label]::new();$intro.Text="动作、硬件提醒和番茄钟无需 API Key。`n需要查询 DeepSeek 官方余额时，再填写你自己的 Key。";$intro.Location=[Drawing.Point]::new(24,62);$intro.Size=[Drawing.Size]::new(490,52)
  $api=[Windows.Forms.CheckBox]::new();$api.Text='启用 DeepSeek 官方 API 余额记账';$api.Location=[Drawing.Point]::new(24,126);$api.Size=[Drawing.Size]::new(480,28);$api.Checked=$current.apiEnabled-eq $true
  $key=[Windows.Forms.TextBox]::new();$key.Location=[Drawing.Point]::new(24,160);$key.Size=[Drawing.Size]::new(490,28);$key.UseSystemPasswordChar=$true;$key.MaxLength=512
  $hint=[Windows.Forms.Label]::new();$hint.Text='首次使用请填写；已有 Key 时留空保留。只加密保存在本机。';$hint.Location=[Drawing.Point]::new(24,196);$hint.Size=[Drawing.Size]::new(490,28)
  $activity=[Windows.Forms.CheckBox]::new();$activity.Text='读取本机 Codex 任务和订阅额度，用于动作与提醒';$activity.Location=[Drawing.Point]::new(24,234);$activity.Size=[Drawing.Size]::new(490,28);$activity.Checked=$current.clientIntegration-ne $false
  $startup=[Windows.Forms.CheckBox]::new();$startup.Text='登录 Windows 后自动启动鲸鲸';$startup.Location=[Drawing.Point]::new(24,270);$startup.Size=[Drawing.Size]::new(490,28);$startup.Checked=$current.startup-eq $true
  $where=[Windows.Forms.Label]::new();$where.Text='无需管理员权限。安装在当前用户目录，设置与账本单独保留。';$where.Location=[Drawing.Point]::new(24,306);$where.Size=[Drawing.Size]::new(490,28)
  $ok=[Windows.Forms.Button]::new();$ok.Text=if($Installing){'安装并打开'}else{'保存并重启'};$ok.Location=[Drawing.Point]::new(270,356);$ok.Size=[Drawing.Size]::new(132,34)
  $cancel=[Windows.Forms.Button]::new();$cancel.Text='取消';$cancel.Location=[Drawing.Point]::new(414,356);$cancel.Size=[Drawing.Size]::new(100,34);$cancel.DialogResult='Cancel'
  $form.Controls.AddRange(@($title,$intro,$api,$key,$hint,$activity,$startup,$where,$ok,$cancel));$form.CancelButton=$cancel;$form.AcceptButton=$ok
  $ok.Add_Click({
    if($api.Checked -and !$key.Text.Trim() -and !(Test-Path -LiteralPath (Join-Path $Root 'data\deepseek.dpapi'))){[void][Windows.Forms.MessageBox]::Show('请填写自己的 API Key，或取消勾选余额记账。','鲸鲸');return}
    if($key.Text.Trim() -match '[\x00-\x20\x7f]'){[void][Windows.Forms.MessageBox]::Show('Key 中不能有空格或换行。','鲸鲸');return}
    $form.DialogResult='OK';$form.Close()
  })
  try{
    if($form.ShowDialog()-ne 'OK'){return $null}
    $encrypted=$null
    if($key.Text.Trim()){$raw=[Text.Encoding]::UTF8.GetBytes($key.Text.Trim());try{$encrypted=[Security.Cryptography.ProtectedData]::Protect($raw,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)}finally{[Array]::Clear($raw,0,$raw.Length);$key.Clear()}}
    return @{apiEnabled=$api.Checked;clientIntegration=$activity.Checked;startup=$startup.Checked;protectedKey=$encrypted}
  }finally{$form.Dispose()}
}
function Save-WhaleSettings([string]$Root,$Choice) {
  [IO.Directory]::CreateDirectory((Join-Path $Root 'data'))|Out-Null
  if($null-ne $Choice.protectedKey){[IO.File]::WriteAllBytes((Join-Path $Root 'data\deepseek.dpapi'),[byte[]]$Choice.protectedKey)}
  Write-WhaleJson (Join-Path $Root 'settings.json') @{apiEnabled=[bool]$Choice.apiEnabled;clientIntegration=[bool]$Choice.clientIntegration;startup=[bool]$Choice.startup}
}
