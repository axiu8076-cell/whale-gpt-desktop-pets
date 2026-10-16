param([Parameter(Mandatory=$true)][string]$InstallRoot,[switch]$Quiet,[switch]$DeleteData)
. (Join-Path $PSScriptRoot 'common.ps1')
try {
  $root=Assert-WhaleRoot $InstallRoot -RequireMarker
  if(!$Quiet){
    Add-Type -AssemblyName System.Windows.Forms
    if([Windows.Forms.MessageBox]::Show('卸载鲸鲸生活助手？设置、密钥和账本默认保留。','卸载鲸鲸','OKCancel','Question')-ne 'OK'){exit 0}
    $DeleteData=[Windows.Forms.MessageBox]::Show('是否同时删除本机的密钥、设置和账本？选「否」可以以后恢复。','个人数据','YesNo','Question','Button2')-eq 'Yes'
  }
  Set-WhaleEnvironment $root;Stop-Whale $root
  $target=Join-Path $root '鲸鲸.exe'
  $folders=@([Environment]::GetFolderPath('DesktopDirectory'),[Environment]::GetFolderPath('Startup'),(Join-Path ([Environment]::GetFolderPath('Programs')) '鲸鲸生活助手'))
  $shell=New-Object -ComObject WScript.Shell
  foreach($folder in $folders){if(Test-Path -LiteralPath $folder){Get-ChildItem -LiteralPath $folder -Filter '*.lnk' -File|ForEach-Object{if($shell.CreateShortcut($_.FullName).Arguments.Contains('"'+(Join-Path $root 'bin\launch.ps1')+'"')){Remove-Item -LiteralPath $_.FullName}}}}
  Start-Sleep -Milliseconds 1200
  $names=@('app-gpt','app','runtime','bin','鲸鲸.exe','使用说明.txt','功能与触发条件.txt','发行说明.txt','install-result.json')
  if($DeleteData){$names+=@('data-gpt','data','settings.json','installation.json')}
  foreach($name in $names){
    $path=[IO.Path]::GetFullPath((Join-Path $root $name))
    if(!(Test-Path -LiteralPath $path)){continue}
    if(!(Split-Path -Parent $path).Equals($root,[StringComparison]::OrdinalIgnoreCase)){throw '卸载路径检查失败。'}
    if((Get-Item -LiteralPath $path -Force).Attributes-band [IO.FileAttributes]::ReparsePoint){throw '卸载目录含链接，已停止。'}
    if(Test-Path -LiteralPath $path -PathType Container){if(Get-ChildItem -LiteralPath $path -Recurse -Force|Where-Object{$_.Attributes-band [IO.FileAttributes]::ReparsePoint}){throw '卸载目录含链接，已停止。'}}
    Remove-Item -LiteralPath $path -Recurse -Force
  }
  if($DeleteData -and !(Get-ChildItem -LiteralPath $root -Force)){Remove-Item -LiteralPath $root}
  if(!$Quiet){[void][Windows.Forms.MessageBox]::Show($(if($DeleteData){'已卸载并删除个人数据。'}else{'已卸载，个人数据已保留。'}),'鲸鲸生活助手')}
} catch {if(!$Quiet){[void][Windows.Forms.MessageBox]::Show('卸载未完成，请先退出鲸鲸后重试。','鲸鲸生活助手')}else{Write-Error $_ -ErrorAction Continue};exit 1}
finally{Remove-Item Env:DEEPSEEK_WHALE_API_KEY -ErrorAction SilentlyContinue}
