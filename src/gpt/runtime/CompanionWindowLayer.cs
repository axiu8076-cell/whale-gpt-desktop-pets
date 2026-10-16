using System;
using System.Runtime.InteropServices;
using System.Text;
public static class CompanionWindowLayer {
 [StructLayout(LayoutKind.Sequential)]public struct Rect {public int Left,Top,Right,Bottom;}
 [StructLayout(LayoutKind.Sequential)]struct Point {public int X,Y;}
 [StructLayout(LayoutKind.Sequential)]struct Monitor {public int Size;public Rect Bounds,Work;public uint Flags;}
 [DllImport("user32.dll")]static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll")]static extern bool IsWindow(IntPtr h);
 [DllImport("user32.dll")]static extern bool IsWindowVisible(IntPtr h);
 [DllImport("user32.dll")]static extern bool IsIconic(IntPtr h);
 [DllImport("user32.dll")]static extern bool GetClientRect(IntPtr h,out Rect r);
 [DllImport("user32.dll")]static extern bool ClientToScreen(IntPtr h,ref Point p);
 [DllImport("user32.dll")]static extern IntPtr MonitorFromWindow(IntPtr h,uint flags);
 [DllImport("user32.dll")]static extern bool GetMonitorInfo(IntPtr h,ref Monitor info);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)]static extern int GetClassName(IntPtr h,StringBuilder name,int count);
 [DllImport("user32.dll",EntryPoint="GetWindowLongPtrW")]static extern IntPtr GetWindowLongPtr(IntPtr h,int index);
 [DllImport("user32.dll")]static extern bool SetWindowPos(IntPtr h,IntPtr after,int x,int y,int w,int height,uint flags);
 public static bool CoversMonitor(Rect client,Rect monitor){return client.Left<=monitor.Left+2&&client.Top<=monitor.Top+2&&client.Right>=monitor.Right-2&&client.Bottom>=monitor.Bottom-2;}
 public static bool FullscreenOnPetMonitor(long pet){
  return FullscreenForWindow(pet,GetForegroundWindow().ToInt64());
 }
 public static bool FullscreenForWindow(long pet,long candidate){
  IntPtr h=new IntPtr(candidate),p=new IntPtr(pet);if(h==IntPtr.Zero||h==p||!IsWindowVisible(h)||IsIconic(h))return false;
  var name=new StringBuilder(128);GetClassName(h,name,128);if(name.ToString()=="Progman"||name.ToString()=="WorkerW"||name.ToString().Contains("TrayWnd"))return false;
  IntPtr monitor=MonitorFromWindow(h,2);if(monitor!=MonitorFromWindow(p,2))return false;
  var m=new Monitor{Size=Marshal.SizeOf(typeof(Monitor))};Rect r;Point origin=new Point();
  if(!GetMonitorInfo(monitor,ref m)||!GetClientRect(h,out r)||!ClientToScreen(h,ref origin))return false;
  return CoversMonitor(new Rect{Left=origin.X,Top=origin.Y,Right=origin.X+r.Right,Bottom=origin.Y+r.Bottom},m.Bounds);
 }
 public static bool IsTopmost(long pet){return (GetWindowLongPtr(new IntPtr(pet),-20).ToInt64()&8)!=0;}
 public static string Inspect(long pet,long candidate=0){IntPtr h=candidate==0?GetForegroundWindow():new IntPtr(candidate),monitor=MonitorFromWindow(h,2);var m=new Monitor{Size=Marshal.SizeOf(typeof(Monitor))};bool a=GetMonitorInfo(monitor,ref m);Rect r;bool b=GetClientRect(h,out r);Point p=new Point();bool c=ClientToScreen(h,ref p);var name=new StringBuilder(128);GetClassName(h,name,128);return name+":"+a+","+b+","+c+":"+IsWindowVisible(h)+","+IsIconic(h)+","+(h==new IntPtr(pet))+":"+h.ToInt64()+":"+(monitor==MonitorFromWindow(new IntPtr(pet),2))+":"+p.X+","+p.Y+","+r.Right+","+r.Bottom+":"+m.Bounds.Left+","+m.Bounds.Top+","+m.Bounds.Right+","+m.Bounds.Bottom;}
 public static bool Apply(long pet){if(!IsWindow(new IntPtr(pet)))return false;bool top=!FullscreenOnPetMonitor(pet);if(IsTopmost(pet)!=top)SetWindowPos(new IntPtr(pet),new IntPtr(top?-1:-2),0,0,0,0,0x213);return top;}
}
