param([string]$InstallRoot=(Join-Path $env:USERPROFILE '.whale-companion'),[switch]$Quiet,[switch]$NoShortcuts,[switch]$NoLaunch)
. (Join-Path $PSScriptRoot 'payload\bin\common.ps1')
. (Join-Path $PSScriptRoot 'payload\bin\settings.ps1')
try {
  if(![Environment]::Is64BitOperatingSystem){throw '本安装包需要 64 位 Windows。'}
  $root=Assert-WhaleRoot $InstallRoot
  $exists=Test-Path -LiteralPath $root
  if($exists -and @(Get-ChildItem -LiteralPath $root -Force).Count){$null=Assert-WhaleRoot $root -RequireMarker}
  $choice=if($Quiet){@{apiEnabled=$false;clientIntegration=$false;startup=$false;protectedKey=$null}}else{Show-WhaleSettings $root -Installing}
  if($null-eq $choice){exit 0}
  $payload=Join-Path $PSScriptRoot 'payload'
  $manifest=Read-WhaleJson (Join-Path $PSScriptRoot 'manifest.json')
  if($manifest.product-ne 'whale-companion-standalone'){throw '安装清单无效。'}
  foreach($item in $manifest.files){
    $file=[IO.Path]::GetFullPath((Join-Path $payload $item.path))
    if(!$file.StartsWith($payload+'\',[StringComparison]::OrdinalIgnoreCase) -or !(Test-Path -LiteralPath $file -PathType Leaf)){throw '安装包不完整，请全部解压后再安装。'}
    if((Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant()-ne $item.sha256){throw '安装文件校验失败，请重新解压。'}
  }
  if($exists -and (Test-Path -LiteralPath (Join-Path $root 'bin\helper.mjs'))){Set-WhaleEnvironment $root;Stop-Whale $root}
  [IO.Directory]::CreateDirectory($root)|Out-Null
  foreach($item in $manifest.files){
    $dest=[IO.Path]::GetFullPath((Join-Path $root $item.path))
    if(!$dest.StartsWith($root+'\',[StringComparison]::OrdinalIgnoreCase)){throw '安装路径无效。'}
    $null=Assert-WhaleRoot (Split-Path -Parent $dest)
    [IO.Directory]::CreateDirectory((Split-Path -Parent $dest))|Out-Null
    for($attempt=0;$attempt-lt 20;$attempt++){
      try{Copy-Item -LiteralPath (Join-Path $payload $item.path) -Destination $dest -Force;break}
      catch{if($attempt-eq 19){throw};Start-Sleep -Milliseconds 250}
    }
  }
  Write-WhaleJson (Join-Path $root 'installation.json') @{product='whale-companion-standalone';version=$manifest.version;installedAt=[DateTime]::UtcNow.ToString('o');shortcuts=(-not $NoShortcuts)}
  Save-WhaleSettings $root $choice;Set-WhaleEnvironment $root;Invoke-WhaleNode $root 'init'
  if(!$NoShortcuts){
    $desktop=[Environment]::GetFolderPath('DesktopDirectory');$menu=Join-Path ([Environment]::GetFolderPath('Programs')) '鲸鲸生活助手'
    [IO.Directory]::CreateDirectory($menu)|Out-Null
    foreach($pair in @(@('鲸鲸生活助手','start'),@('鲸鲸操作台','panel'))){New-WhaleShortcut (Join-Path $desktop ($pair[0]+'.lnk')) $root $pair[1]}
    foreach($pair in @(@('打开鲸鲸','start'),@('鲸鲸操作台','panel'),@('连接与启动设置','settings'),@('退出鲸鲸','stop'),@('卸载鲸鲸','uninstall'))){New-WhaleShortcut (Join-Path $menu ($pair[0]+'.lnk')) $root $pair[1]}
    Set-WhaleStartup $root $choice.startup
  }
  if(!$NoLaunch){Start-Process -FilePath (Join-Path $PSHOME 'powershell.exe') -ArgumentList @('-NoLogo','-NoProfile','-STA','-ExecutionPolicy','Bypass','-WindowStyle','Hidden','-File',('"'+(Join-Path $root 'bin\launch.ps1')+'"'),'-Mode','panel') -WindowStyle Hidden|Out-Null}
  Write-WhaleJson (Join-Path $root 'install-result.json') @{ok=$true;version=$manifest.version;at=[DateTime]::UtcNow.ToString('o')}
  if(!$Quiet){[void][Windows.Forms.MessageBox]::Show("安装完成！`n桌面有「鲸鲸生活助手」和「鲸鲸操作台」。`n更换 Key 或设置开机启动：开始菜单 → 鲸鲸生活助手 → 连接与启动设置。",'鲸鲸生活助手')}
} catch {
  try{if($root -and (Test-Path -LiteralPath $root)){Write-WhaleJson (Join-Path $root 'install-result.json') @{ok=$false;error=$_.Exception.Message;at=[DateTime]::UtcNow.ToString('o')}}}catch{}
  if(!$Quiet){Add-Type -AssemblyName System.Windows.Forms;[void][Windows.Forms.MessageBox]::Show(('安装未完成：'+$_.Exception.Message),'鲸鲸生活助手','OK','Warning')}
  else{Write-Error $_ -ErrorAction Continue}
  exit 1
} finally {Remove-Item Env:DEEPSEEK_WHALE_API_KEY -ErrorAction SilentlyContinue}
