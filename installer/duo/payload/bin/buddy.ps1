function Initialize-WhaleBuddy([string]$Root) {
  $app=Join-Path $Root 'app-gpt';if(!(Test-Path -LiteralPath $app)){return}
  $data=Join-Path $Root 'data-gpt';[IO.Directory]::CreateDirectory($data)|Out-Null
  Write-WhaleJson (Join-Path $app 'installation.json') @{appDir=$app;dataDir=$data;nodePath=(Join-Path $Root 'runtime\electron.exe');codexPath='codex.exe';version='1.3.4';distribution='whale-duo'}
  if(!(Test-Path -LiteralPath (Join-Path $data 'settings.json'))){Write-WhaleJson (Join-Path $data 'settings.json') @{layoutVersion=2;followHost=$false;desktopTopmost=$true;scale=1;side='right';anchor='right';collapsed=$true;showActivity=$true}}
  Write-WhaleJson (Join-Path $data 'update-preferences.json') @{automatic=$false}
}
function Start-WhaleBuddy([string]$Root) {
  $app=Join-Path $Root 'app-gpt';$data=Join-Path $Root 'data-gpt'
  if(!(Test-Path -LiteralPath $app)){return}
  $runtime=Read-WhaleJson (Join-Path $data 'runtime.json')
  if($runtime.pid){
    $p=Get-CimInstance Win32_Process -Filter ('ProcessId='+[int]$runtime.pid) -ErrorAction SilentlyContinue
    if($p -and $p.CommandLine -and $p.CommandLine.Contains('"'+(Join-Path $app 'widget.ps1')+'"')){return}
  }
  foreach($name in @('stop.flag','supervisor-pause.json','supervisor-disabled.flag','supervisor-stop.flag')){$f=Join-Path $data $name;if(Test-Path -LiteralPath $f){Remove-Item -LiteralPath $f}}
  $p=[Diagnostics.ProcessStartInfo]::new()
  $p.FileName=Join-Path $env:WINDIR 'System32\WindowsPowerShell\v1.0\powershell.exe'
  $p.Arguments='-NoLogo -NoProfile -STA -ExecutionPolicy Bypass -WindowStyle Hidden -File "'+(Join-Path $app 'widget.ps1')+'"'
  $p.WorkingDirectory=$app;$p.UseShellExecute=$false;$p.CreateNoWindow=$true;$p.WindowStyle='Hidden'
  $p.EnvironmentVariables['ELECTRON_RUN_AS_NODE']='1'
  $p.EnvironmentVariables.Remove('DEEPSEEK_WHALE_API_KEY')
  $child=[Diagnostics.Process]::Start($p)
  for($i=0;$i-lt 100;$i++){
    if($child.HasExited){throw 'GPT 娘未能启动。'}
    $presence=Read-WhaleJson (Join-Path $data 'presence.json')
    if($presence.pid-eq $child.Id -and $presence.visible){$child.Dispose();return}
    Start-Sleep -Milliseconds 200
  }
  $child.Dispose();throw 'GPT 娘显示超时。'
}
function Stop-WhaleBuddy([string]$Root) {
  $app=Join-Path $Root 'app-gpt';$data=Join-Path $Root 'data-gpt'
  if(!(Test-Path -LiteralPath (Join-Path $app 'runtime\supervisor-task.ps1'))){return}
  . (Join-Path $app 'runtime\supervisor-task.ps1')
  Stop-WidgetGui -AppDir $app -DataDir $data
}
