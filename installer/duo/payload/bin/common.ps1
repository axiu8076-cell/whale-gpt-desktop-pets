$ErrorActionPreference='Stop'
function Read-WhaleJson([string]$File,$Fallback=@{}) {
  if(Test-Path -LiteralPath $File){return Get-Content -LiteralPath $File -Raw -Encoding UTF8 | ConvertFrom-Json}
  return $Fallback
}
function Write-WhaleJson([string]$File,$Value) {
  $temp=$File+'.'+$PID+'.tmp'
  [IO.File]::WriteAllText($temp,($Value|ConvertTo-Json -Depth 20),[Text.UTF8Encoding]::new($false))
  if(Test-Path -LiteralPath $File){[IO.File]::Replace($temp,$File,[System.Management.Automation.Language.NullString]::Value)}else{[IO.File]::Move($temp,$File)}
}
function Assert-WhaleRoot([string]$Root,[switch]$RequireMarker) {
  $full=[IO.Path]::GetFullPath($Root).TrimEnd('\')
  $forbidden=@([IO.Path]::GetPathRoot($full).TrimEnd('\'),$env:USERPROFILE,$env:WINDIR,$env:ProgramFiles,[Environment]::GetFolderPath('Desktop'))
  if($full.Length-lt 12 -or $full-in $forbidden){throw '安装目录无效。'}
  $current=$full
  while($current){
    if(Test-Path -LiteralPath $current){if((Get-Item -LiteralPath $current -Force).Attributes-band [IO.FileAttributes]::ReparsePoint){throw '安装目录不能经过链接或重定向目录。'}}
    $parent=[IO.Directory]::GetParent($current);$current=if($parent){$parent.FullName}else{$null}
  }
  if($RequireMarker){$m=Read-WhaleJson (Join-Path $full 'installation.json');if($m.product-ne 'whale-companion-standalone'){throw '不是鲸鲸安装目录，已停止。'}}
  return $full
}
function Set-WhaleEnvironment([string]$Root) {
  $env:WHALE_HOME=Join-Path $Root 'data'
  $env:WHALE_STANDALONE_HOME=$Root
  $env:WHALE_BUDDY_HOME=Join-Path $Root 'data-gpt'
  $settings=Read-WhaleJson (Join-Path $Root 'settings.json')
  $env:WHALE_CLIENT_ACTIVITY=if($settings.clientIntegration-eq $false){'0'}else{'1'}
  Remove-Item Env:DEEPSEEK_WHALE_API_KEY -ErrorAction SilentlyContinue
  $secret=Join-Path $Root 'data\deepseek.dpapi'
  if($settings.apiEnabled-eq $true -and (Test-Path -LiteralPath $secret)){
    Add-Type -AssemblyName System.Security
    $clear=[Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes($secret),$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)
    try{$env:DEEPSEEK_WHALE_API_KEY=[Text.Encoding]::UTF8.GetString($clear)}finally{[Array]::Clear($clear,0,$clear.Length)}
  }
}
function Invoke-WhaleNode([string]$Root,[string]$Action,[int]$Timeout=45000) {
  $start=[Diagnostics.ProcessStartInfo]::new()
  $start.FileName=Join-Path $Root 'runtime\electron.exe'
  $start.Arguments='"'+(Join-Path $Root 'bin\helper.mjs')+'" '+$Action
  $start.WorkingDirectory=$Root;$start.UseShellExecute=$false;$start.CreateNoWindow=$true
  $start.RedirectStandardOutput=$true;$start.RedirectStandardError=$true
  $start.EnvironmentVariables['ELECTRON_RUN_AS_NODE']='1'
  $p=[Diagnostics.Process]::new();$p.StartInfo=$start
  try{
    [void]$p.Start();$out=$p.StandardOutput.ReadToEndAsync();$err=$p.StandardError.ReadToEndAsync()
    if(!$p.WaitForExit($Timeout)){try{$p.Kill()}catch{};throw '本地服务响应超时。'}
    $null=$out.GetAwaiter().GetResult();$null=$err.GetAwaiter().GetResult()
    if($p.ExitCode-ne 0){throw ('鲸鲸操作未完成：'+$Action+'，错误码 '+$p.ExitCode)}
  }finally{$p.Dispose()}
}
function Stop-Whale([string]$Root) {
  . (Join-Path $Root 'bin\buddy.ps1');Stop-WhaleBuddy $Root
  $supervisor=Join-Path $Root 'app\desktop\supervisor.ps1'
  if(Test-Path -LiteralPath $supervisor){& $supervisor -DataDir (Join-Path $Root 'data') -Stop}
  try{Invoke-WhaleNode $Root 'stop' 10000}catch{}
  for($i=0;$i-lt 40;$i++){
    $state=Read-WhaleJson (Join-Path $Root 'data\supervisor-state.json')
    $live=if($state.pid){Get-Process -Id $state.pid -ErrorAction SilentlyContinue}else{$null}
    if(!$live){break};Start-Sleep -Milliseconds 250
  }
  $runtimePath=Join-Path $Root 'runtime\electron.exe'
  for($i=0;$i-lt 48;$i++){
    $children=@(Get-Process -Name electron -ErrorAction SilentlyContinue|Where-Object{try{$_.Path-eq $runtimePath}catch{$false}})
    if(!$children.Count){return};Start-Sleep -Milliseconds 250
  }
  throw '鲸鲸仍在退出，请稍后重试。'
}
function New-WhaleShortcut([string]$File,[string]$Root,[string]$Mode) {
  $shell=New-Object -ComObject WScript.Shell
  $shortcut=$shell.CreateShortcut($File);$shortcut.TargetPath=Join-Path $env:WINDIR 'System32\WindowsPowerShell\v1.0\powershell.exe'
  $shortcut.Arguments='-NoLogo -NoProfile -STA -WindowStyle Hidden -ExecutionPolicy Bypass -File "'+(Join-Path $root 'bin\launch.ps1')+'" -Mode '+$Mode
  $shortcut.WorkingDirectory=$root;$shortcut.WindowStyle=7;$shortcut.IconLocation=(Join-Path $root 'runtime\electron.exe')+',0';$shortcut.Description='鲸鲸生活助手'
  $shortcut.Save()
}
function Set-WhaleStartup([string]$Root,[bool]$Enabled) {
  $file=Join-Path ([Environment]::GetFolderPath('Startup')) '鲸鲸生活助手.lnk'
  if($Enabled){New-WhaleShortcut $file $Root 'start'}
  elseif(Test-Path -LiteralPath $file){$s=(New-Object -ComObject WScript.Shell).CreateShortcut($file);if($s.Arguments.Contains('"'+(Join-Path $Root 'bin\launch.ps1')+'"')){Remove-Item -LiteralPath $file}}
}
