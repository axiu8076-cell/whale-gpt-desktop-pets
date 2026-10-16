// Read-only Shell folder-view access. No icon moves, selection changes or file operations.
// APIs: https://devblogs.microsoft.com/oldnewthing/20130318-00/?p=4933/
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Runtime.InteropServices;
public static class WhaleDesktopIcons {
 [StructLayout(LayoutKind.Sequential)] public struct Point {public int X,Y;}
 [StructLayout(LayoutKind.Sequential)] struct Size {public int X,Y;}
 [ComImport,Guid("6D5140C1-7436-11CE-8034-00AA006009FA"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] interface IServiceProvider {[PreserveSig]int QueryService(ref Guid service,ref Guid iid,[MarshalAs(UnmanagedType.Interface)]out object result);}
 [ComImport,Guid("000214E2-0000-0000-C000-000000000046"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] interface IShellBrowser {
  void GetWindow(out IntPtr hwnd);void ContextSensitiveHelp(bool enter);void InsertMenusSB();void SetMenuSB();void RemoveMenusSB();void SetStatusTextSB();void EnableModelessSB();void TranslateAcceleratorSB();void BrowseObject();void GetViewStateStream();void GetControlWindow();void SendControlMsg();
  void QueryActiveShellView([MarshalAs(UnmanagedType.Interface)]out object view);
 }
 [ComImport,Guid("CDE725B0-CCC9-4519-917E-325D72FAB4CE"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] interface IFolderView {
  void GetCurrentViewMode(out uint mode);void SetCurrentViewMode(uint mode);void GetFolder(ref Guid iid,out IntPtr folder);void Item(int index,out IntPtr pidl);void ItemCount(uint flags,out int count);void Items(uint flags,ref Guid iid,out IntPtr items);void GetSelectionMarkedItem(out int index);void GetFocusedItem(out int index);void GetItemPosition(IntPtr pidl,out Point point);void GetSpacing(out Point spacing);
 }
 [ComImport,Guid("000214E3-0000-0000-C000-000000000046"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] interface IShellView {void GetWindow(out IntPtr hwnd);}
 [ComImport,Guid("BCC18B79-BA16-442F-80C4-8A59C30C463B"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] interface IImageFactory {[PreserveSig]int GetImage(Size size,uint flags,out IntPtr bitmap);}
 [DllImport("shell32.dll")]static extern int SHGetNameFromIDList(IntPtr pidl,uint type,out IntPtr name);
 [DllImport("shell32.dll")]static extern int SHCreateItemFromIDList(IntPtr pidl,ref Guid iid,[MarshalAs(UnmanagedType.Interface)]out object item);
 [DllImport("user32.dll")]static extern bool ClientToScreen(IntPtr hwnd,ref Point point);
 [DllImport("user32.dll")]static extern bool SetProcessDPIAware();
 [DllImport("user32.dll")]static extern uint GetDpiForWindow(IntPtr hwnd);
 [DllImport("gdi32.dll")]static extern bool DeleteObject(IntPtr h);
 [DllImport("gdi32.dll")]static extern int GetObject(IntPtr h,int size,out BitmapInfo info);
 [DllImport("gdi32.dll")]static extern int GetDIBits(IntPtr dc,IntPtr bitmap,uint start,uint lines,byte[] bits,ref Header header,uint usage);
 [DllImport("user32.dll")]static extern IntPtr GetDC(IntPtr hwnd);
 [DllImport("user32.dll")]static extern int ReleaseDC(IntPtr hwnd,IntPtr dc);
 [StructLayout(LayoutKind.Sequential)]struct BitmapInfo{public int Type,Width,Height,WidthBytes;public ushort Planes,BitsPixel;public IntPtr Bits;}
 [StructLayout(LayoutKind.Sequential)]struct Header{public uint Size;public int Width,Height;public ushort Planes,BitCount;public uint Compression,SizeImage;public int XPels,YPels;public uint Colors,Important;}
 public class Entry {public string path,name,icon;public int x,y,width,height;}
 static string Name(IntPtr pidl,uint type){IntPtr p;if(SHGetNameFromIDList(pidl,type,out p)!=0||p==IntPtr.Zero)return null;try{return Marshal.PtrToStringUni(p);}finally{Marshal.FreeCoTaskMem(p);}}
 static Dictionary<string,string> icons=new Dictionary<string,string>(StringComparer.OrdinalIgnoreCase);
 static long refreshed=0;
 static string IconPng(IntPtr pidl,string path,int size){
  string key=path+"|"+size,encoded;if(icons.TryGetValue(key,out encoded))return encoded;
  Guid iid=new Guid("BCC18B79-BA16-442F-80C4-8A59C30C463B");object factory=null;IntPtr bitmap=IntPtr.Zero,dc=IntPtr.Zero;
  try{
   if(SHCreateItemFromIDList(pidl,ref iid,out factory)!=0)return null;
   var f=(IImageFactory)factory;
   // Reuse the Shell thumbnail cache; fall back to its existing file icon.
   if(f.GetImage(new Size{X=size,Y=size},0x10,out bitmap)!=0&&f.GetImage(new Size{X=size,Y=size},0x4,out bitmap)!=0)return null;
   BitmapInfo b;if(GetObject(bitmap,Marshal.SizeOf(typeof(BitmapInfo)),out b)==0||b.Width<1||b.Height<1||b.Width>512||b.Height>512)return null;
   var h=new Header{Size=40,Width=b.Width,Height=-b.Height,Planes=1,BitCount=32};byte[] bytes=new byte[b.Width*b.Height*4];dc=GetDC(IntPtr.Zero);
   if(GetDIBits(dc,bitmap,0,(uint)b.Height,bytes,ref h,0)==0)return null;
   bool alpha=false;for(int i=3;i<bytes.Length;i+=4)if(bytes[i]!=0){alpha=true;break;}
   if(!alpha)for(int i=3;i<bytes.Length;i+=4)bytes[i]=255;
   using(var image=new Bitmap(b.Width,b.Height,PixelFormat.Format32bppArgb)){
    var data=image.LockBits(new Rectangle(0,0,b.Width,b.Height),ImageLockMode.WriteOnly,PixelFormat.Format32bppArgb);
    try{Marshal.Copy(bytes,0,data.Scan0,bytes.Length);}finally{image.UnlockBits(data);}
    using(var stream=new MemoryStream()){image.Save(stream,ImageFormat.Png);encoded=Convert.ToBase64String(stream.ToArray());}
   }
   if(icons.Count>512)icons.Clear();icons[key]=encoded;return encoded;
  }catch{return null;}finally{if(dc!=IntPtr.Zero)ReleaseDC(IntPtr.Zero,dc);if(bitmap!=IntPtr.Zero)DeleteObject(bitmap);if(factory!=null)Marshal.ReleaseComObject(factory);}
 }
 public static Entry[] Read(object desktop,int iconSize){
  if(DateTime.UtcNow.Ticks-refreshed>TimeSpan.TicksPerSecond*2){icons.Clear();refreshed=DateTime.UtcNow.Ticks;}
  SetProcessDPIAware();Guid service=new Guid("4C96BE40-915C-11CF-99D3-00AA004AE837"),iid=new Guid("000214E2-0000-0000-C000-000000000046");object browser=null,view=null;
  try{
   Marshal.ThrowExceptionForHR(((IServiceProvider)desktop).QueryService(ref service,ref iid,out browser));((IShellBrowser)browser).QueryActiveShellView(out view);var folder=(IFolderView)view;
   IntPtr hwnd;((IShellView)view).GetWindow(out hwnd);Point origin=new Point();ClientToScreen(hwnd,ref origin);
   iconSize=Math.Min(512,Math.Max(16,(int)Math.Round(iconSize*GetDpiForWindow(hwnd)/96.0)));
   int count;folder.ItemCount(2,out count);var result=new List<Entry>();
   for(int i=0;i<Math.Min(count,1500);i++){IntPtr pidl=IntPtr.Zero;try{folder.Item(i,out pidl);string path=Name(pidl,0x80058000);if(String.IsNullOrEmpty(path))continue;Point p;folder.GetItemPosition(pidl,out p);string image=IconPng(pidl,path,iconSize);if(image==null)continue;result.Add(new Entry{path=path,name=Name(pidl,0),x=origin.X+p.X,y=origin.Y+p.Y,width=iconSize,height=iconSize,icon=image});}catch{}finally{if(pidl!=IntPtr.Zero)Marshal.FreeCoTaskMem(pidl);}}
   return result.ToArray();
  }finally{if(view!=null)Marshal.ReleaseComObject(view);if(browser!=null)Marshal.ReleaseComObject(browser);}
 }
}
