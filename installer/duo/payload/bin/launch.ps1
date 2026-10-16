param([ValidateSet('start','panel','settings','stop','uninstall')][string]$Mode='start')
. (Join-Path $PSScriptRoot 'common.ps1')
$root=Assert-WhaleRoot (Split-Path -Parent $PSScriptRoot) -RequireMarker
try {
  if($Mode-eq 'uninstall'){
    $temp=Join-Path ([IO.Path]::GetTempPath()) ('whale-remove-'+[Guid]::NewGuid().ToString('N'));[IO.Directory]::CreateDirectory($temp)|Out-Null
    foreach($file in @('uninstall.ps1','common.ps1')){Copy-Item -LiteralPath (Join-Path $PSScriptRoot $file) -Destination (Join-Path $temp $file)}
    Start-Process -FilePath (Join-Path $PSHOME 'powershell.exe') -WindowStyle Hidden -ArgumentList @('-NoLogo','-NoProfile','-STA','-ExecutionPolicy','Bypass','-WindowStyle','Hidden','-File',('"'+(Join-Path $temp 'uninstall.ps1')+'"'),'-InstallRoot',('"'+$root+'"'))|Out-Null
    exit 0
  }
  Set-WhaleEnvironment $root
  if($Mode-eq 'stop'){Stop-Whale $root;exit 0}
  if($Mode-eq 'settings'){
    . (Join-Path $PSScriptRoot 'settings.ps1')
    $choice=Show-WhaleSettings $root
    if($null-eq $choice){exit 0}
    Stop-Whale $root;Save-WhaleSettings $root $choice;Set-WhaleEnvironment $root
    Invoke-WhaleNode $root 'init';. (Join-Path $root 'bin\buddy.ps1');Initialize-WhaleBuddy $root;Set-WhaleStartup $root $choice.startup
  }
  . (Join-Path $root 'bin\buddy.ps1');Start-WhaleBuddy $root
  $data=Join-Path $root 'data'
  $pause=Join-Path $data 'pause-until-host-exit.json'
  if(Test-Path -LiteralPath $pause){Remove-Item -LiteralPath $pause}
  $followFile=Join-Path $data 'follow-config.json';$follow=Read-WhaleJson $followFile
  if($follow.enabled-ne $true){$follow.enabled=$true;Write-WhaleJson $followFile $follow}
  Start-Process -FilePath (Join-Path $PSHOME 'powershell.exe') -ArgumentList @('-NoLogo','-NoProfile','-ExecutionPolicy','Bypass','-WindowStyle','Hidden','-File',('"'+(Join-Path $root 'app\desktop\supervisor.ps1')+'"'),'-DataDir',('"'+$data+'"')) -WorkingDirectory $root -WindowStyle Hidden|Out-Null
  Invoke-WhaleNode $root $(if($Mode-eq 'panel'){'panel'}else{'open'})
  Write-WhaleJson (Join-Path $data 'last-launch.json') @{ok=$true;mode=$Mode;at=[DateTime]::UtcNow.ToString('o')}
} catch {
  if(Test-Path -LiteralPath (Join-Path $root 'data')){Write-WhaleJson (Join-Path $root 'data\last-launch.json') @{ok=$false;mode=$Mode;category='launch-failed';at=[DateTime]::UtcNow.ToString('o')}}
  Add-Type -AssemblyName System.Windows.Forms
  [void][Windows.Forms.MessageBox]::Show('鲸鲸暂时未能启动。请重新运行安装包修复，设置与账本会保留。','鲸鲸生活助手','OK','Warning')
  exit 1
} finally {Remove-Item Env:DEEPSEEK_WHALE_API_KEY -ErrorAction SilentlyContinue}
