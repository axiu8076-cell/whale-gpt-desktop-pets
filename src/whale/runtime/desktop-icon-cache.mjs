import path from 'node:path';
export class DesktopIconCache {
 constructor(){this.items=new Map();this.at=0;}
 update(snapshot){
  if(!snapshot?.ok||!Number.isFinite(snapshot.at)||!Array.isArray(snapshot.items))return;
  this.at=snapshot.at;
  for(const item of snapshot.items){
   if(typeof item.path!=='string'||![item.x,item.y,item.width,item.height].every(Number.isFinite)||item.width<8||item.height<8||item.width>512||item.height>512)continue;
   const key=path.win32.resolve(item.path).toLowerCase(),old=this.items.get(key);
   const icon=typeof item.icon==='string'&&item.icon.length<1048576&&/^[A-Za-z0-9+/=]+$/.test(item.icon)?item.icon:old?.icon;
   if(icon)this.items.set(key,{...item,icon,at:snapshot.at});
  }
  for(const [key,item] of this.items)if(snapshot.at-item.at>15000)this.items.delete(key);
 }
 take(original,deletedAt,pointToLocal=p=>p){
  const key=path.win32.resolve(original).toLowerCase(),item=this.items.get(key);
  if(!item||deletedAt-item.at>15000||item.at-deletedAt>1000)return null;
  this.items.delete(key);
  const start=pointToLocal({x:item.x,y:item.y}),end=pointToLocal({x:item.x+item.width,y:item.y+item.height});
  return {x:start.x,y:start.y,width:end.x-start.x,height:end.y-start.y,name:item.name,src:'data:image/png;base64,'+item.icon};
 }
}
