param([int]$ParentPid=0,[switch]$Once)
$ErrorActionPreference='Stop'
[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)
Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public static class WhaleTelemetry {
 [StructLayout(LayoutKind.Sequential)] public struct Power {public byte AC, Flags, Percent, Saver; public uint Seconds, FullSeconds;}
 [DllImport("kernel32.dll")] public static extern bool GetSystemPowerStatus(out Power p);
 [StructLayout(LayoutKind.Sequential)] struct Adapter {public uint Handle, Low; public int High; public uint Sources; public int Preferred;}
 [StructLayout(LayoutKind.Sequential)] struct EnumAdapters {public uint Count; public IntPtr Adapters;}
 [StructLayout(LayoutKind.Sequential)] struct Query {public uint Handle; public int Type; public IntPtr Data; public uint Size;}
 [StructLayout(LayoutKind.Sequential, Pack=8)] struct Perf {public uint Index; public ulong Mem,MaxMem,OverMem,Band,PCIE; public uint Fan,Power,Temp; public byte Override;}
 [DllImport("gdi32.dll")] static extern int D3DKMTEnumAdapters2(ref EnumAdapters a);
 [DllImport("gdi32.dll")] static extern int D3DKMTQueryAdapterInfo(ref Query q);
 [DllImport("gdi32.dll")] static extern int D3DKMTCloseAdapter(ref uint h);
 public static double? GpuTemperature() {
  IntPtr a=Marshal.AllocHGlobal(20*64), p=Marshal.AllocHGlobal(Marshal.SizeOf(typeof(Perf)));
  double? result=null;
  try {
   var en=new EnumAdapters {Count=64,Adapters=a};
   if(D3DKMTEnumAdapters2(ref en)!=0) return null;
   for(int i=0;i<Math.Min(en.Count,64);i++) {
    var adapter=(Adapter)Marshal.PtrToStructure(IntPtr.Add(a,i*20),typeof(Adapter));
    try {
     Marshal.StructureToPtr(new Perf(),p,false);
     var q=new Query {Handle=adapter.Handle,Type=62,Data=p,Size=(uint)Marshal.SizeOf(typeof(Perf))};
     if(D3DKMTQueryAdapterInfo(ref q)==0) {
      var d=(Perf)Marshal.PtrToStructure(p,typeof(Perf)); double t=d.Temp/10.0;
      if(t>0 && t<150 && (!result.HasValue || t>result.Value)) result=t;
     }
    } finally {uint h=adapter.Handle; D3DKMTCloseAdapter(ref h);}
   }
  } finally {Marshal.FreeHGlobal(a);Marshal.FreeHGlobal(p);}
  return result;
 }
}
'@
$video=@(Get-CimInstance Win32_VideoController -ErrorAction SilentlyContinue)
$vramTotal=($video | Measure-Object AdapterRAM -Maximum).Maximum
$sensorNamespace=$null
$desktopPaths=@([Environment]::GetFolderPath('Desktop'),[Environment]::GetFolderPath('CommonDesktopDirectory'))
$userSid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value
$recycleRoots=@([IO.DriveInfo]::GetDrives()|Where-Object{$_.IsReady -and $_.DriveType-eq 'Fixed'}|ForEach-Object{Join-Path $_.RootDirectory.FullName ('$Recycle.Bin\'+$userSid)})
foreach($ns in @('root\LibreHardwareMonitor','root\OpenHardwareMonitor')) {
 try { $null=Get-CimInstance -Namespace $ns -ClassName Sensor -ErrorAction Stop; $sensorNamespace=$ns; break } catch {}
}
do {
 if($ParentPid -and !(Get-Process -Id $ParentPid -ErrorAction SilentlyContinue)){break}
 $battery=$null;$gpuTemp=$null;$cpuTemp=$null;$gpuLoad=$null;$vramUsed=$null;$sharedUsed=$null
 try {
  $p=New-Object WhaleTelemetry+Power
  if([WhaleTelemetry]::GetSystemPowerStatus([ref]$p)){
   $present=($p.Flags-ne 255 -and ($p.Flags-band 128)-eq 0)
   $battery=@{present=$present;percent=$(if($present -and $p.Percent-le 100){[int]$p.Percent}else{$null});plugged=$(if($p.AC-eq 255){$null}else{$p.AC-eq 1});charging=($present -and ($p.Flags-band 8)-ne 0);saver=$p.Saver-eq 1}
  }
 } catch {}
 try { $gpuTemp=[WhaleTelemetry]::GpuTemperature() } catch {}
 if($sensorNamespace){
  try {
   $sensors=@(Get-CimInstance -Namespace $sensorNamespace -ClassName Sensor -Filter "SensorType='Temperature'")
   $cpu=@($sensors|Where-Object{$_.Parent-match 'cpu' -and $_.Value-gt 0 -and $_.Value-lt 150})
   if($cpu.Count){$cpuTemp=($cpu|Measure-Object Value -Maximum).Maximum}
  } catch {}
 }
 try {
  $engines=@(Get-CimInstance Win32_PerfFormattedData_GPUPerformanceCounters_GPUEngine -OperationTimeoutSec 3)
  $values=@($engines|Group-Object {$_.Name-replace '^pid_\d+_',''}|ForEach-Object {($_.Group|Measure-Object UtilizationPercentage -Sum).Sum})
  if($values.Count){$gpuLoad=[Math]::Min(100,($values|Measure-Object -Maximum).Maximum)}
  $memory=@(Get-CimInstance Win32_PerfFormattedData_GPUPerformanceCounters_GPUAdapterMemory -OperationTimeoutSec 3)
  if($memory.Count){$vramUsed=($memory|Measure-Object DedicatedUsage -Maximum).Maximum;$sharedUsed=($memory|Measure-Object SharedUsage -Maximum).Maximum}
 } catch {}
 $clientOpen=@(Get-Process -Name Codex,ChatGPT -ErrorAction SilentlyContinue|Where-Object{$_.MainWindowHandle-ne 0}).Count-gt 0
 @{at=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds();cpuTemp=$cpuTemp;gpuTemp=$gpuTemp;gpuLoad=$gpuLoad;vramUsed=$vramUsed;vramTotal=$vramTotal;sharedUsed=$sharedUsed;battery=$battery;clientOpen=$clientOpen;gpuName=($video.Name-join ', ');desktopPaths=$desktopPaths;recycleRoots=$recycleRoots;temperatureSource=$(if($null-ne $gpuTemp){'Windows D3DKMT'}else{$null})} | ConvertTo-Json -Depth 4 -Compress
 if(!$Once){Start-Sleep -Seconds 8}
}while(!$Once)
