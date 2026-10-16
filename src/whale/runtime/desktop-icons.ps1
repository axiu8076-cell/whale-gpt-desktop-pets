param([int]$ParentPid=0,[switch]$Once)
$ErrorActionPreference='Stop'
[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)
Add-Type -Path (Join-Path $PSScriptRoot 'desktop-icons.cs') -ReferencedAssemblies System.Drawing
$shell=New-Object -ComObject Shell.Application
$windows=$shell.Windows();$sent=@{}
do {
 if($ParentPid -and !(Get-Process -Id $ParentPid -ErrorAction SilentlyContinue)){break}
 try {
  $location=0;$empty=$null;$hwnd=0
  $desktop=$windows.FindWindowSW([ref]$location,[ref]$empty,8,[ref]$hwnd,1)
  $size=48
  try{$saved=(Get-ItemProperty -LiteralPath 'HKCU:\Software\Microsoft\Windows\Shell\Bags\1\Desktop' -Name IconSize -ErrorAction Stop).IconSize;if($saved-ge 16 -and $saved-le 256){$size=[int]$saved}}catch{}
  $items=@([WhaleDesktopIcons]::Read($desktop,$size))
  foreach($item in $items){$key=$item.path+'|'+$item.width;if($sent[$key]-eq $item.icon){$item.icon=$null}else{$sent[$key]=$item.icon}}
  [Runtime.InteropServices.Marshal]::ReleaseComObject($desktop)|Out-Null
  @{ok=$true;at=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds();items=$items}|ConvertTo-Json -Depth 4 -Compress
 }catch{@{ok=$false;at=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds();items=@()}|ConvertTo-Json -Compress}
 if(!$Once){Start-Sleep -Milliseconds 500}
}while(!$Once)
