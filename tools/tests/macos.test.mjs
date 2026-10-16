import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { companionCatalog } from '../../src/whale/runtime/companion-catalog.mjs';
import { CompanionModel } from '../../src/whale/runtime/companion-model.mjs';
const require = createRequire(import.meta.url);
const { parseBattery, loginPlist, publicTelemetry } = require('../../src/whale/desktop/macos/platform.cjs');
const { createVisibilityController } = require('../../src/whale/desktop/visibility.cjs');

test('battery parsing distinguishes charging, plugged idle, full and missing battery', () => {
  assert.deepEqual(parseBattery("Now drawing from 'AC Power'\n -InternalBattery-0 45%; charging; 1:20 remaining"), { present:true,percent:45,plugged:true,charging:true });
  assert.equal(parseBattery("Now drawing from 'AC Power'\n -InternalBattery-0 80%; not charging;").charging, false);
  assert.equal(parseBattery("Now drawing from 'Battery Power'\n -InternalBattery-0 19%; discharging;").plugged, false);
  assert.equal(parseBattery("Now drawing from 'AC Power'\n -InternalBattery-0 100%; charged;").percent, 100);
  assert.deepEqual(parseBattery("Now drawing from 'AC Power'"), { present:false });
});
test('Mac capabilities do not promise Windows sensors, Finder tracking or GPT interaction', () => {
  const cards = companionCatalog(undefined, 'darwin');
  assert.equal(cards.length, 21);
  for (const card of cards.filter(c => c.buddy)) assert.ok(card.unsupported);
  assert.match(cards.find(c => c.id === 'delete-eat').when, /不监测 Finder/);
  assert.match(cards.find(c => c.id === 'heat').when, /暂不支持/);
  assert.equal(companionCatalog(undefined, 'win32').some(c => c.unsupported), false);
});
test('telemetry keeps absent sensors unknown and strips unrelated process data', () => {
  const value = publicTelemetry({hostAlive:true,secret:'not-for-export',bounds:{x:1}}, {present:false}, 123);
  assert.equal(value.at,123); assert.equal(value.clientOpen,true); assert.equal(value.cpuTemp,null);
  assert.equal(value.secret,undefined); assert.equal(value.bounds,undefined);
  assert.equal(publicTelemetry(null, {}).clientOpen,false);
});
test('login plist escapes paths and does not keep relaunching after exit', () => {
  const app = process.platform === 'win32' ? 'C:/Apps/A&B 鲸鲸.app' : '/Applications/A&B 鲸鲸.app';
  const value = loginPlist(app);
  assert.match(value,/A&amp;B/);assert.match(value,/--login-start/);assert.doesNotMatch(value,/KeepAlive|password|key=/i);
  assert.throws(() => loginPlist('relative.app'));
});
test('fullscreen suppression also applies to standalone; restore after fullscreen exits', () => {
  let visible = false;
  const state = {ready:true,standalone:true,systemFullscreen:true};
  const window = {isDestroyed:()=>false,isVisible:()=>visible,hide:()=>{visible=false;},showInactive:()=>{visible=true;}};
  const v = createVisibilityController({getWindow:()=>window,getState:()=>state});
  v.update();assert.equal(visible,false);state.systemFullscreen=false;v.update();assert.equal(visible,true);
  state.systemFullscreen=true;v.update();assert.equal(visible,false);v.dispose();
});
test('long successful Mac task celebrates once without a buddy; aborted task never celebrates', () => {
  const now=Date.now(), model=new CompanionModel({now,celebrationWithoutBuddy:true});
  const t={id:'local',state:'idle',label:'已完成',taskStartedAt:now-1900000,lastAt:now};
  const state={now,hardware:{at:now,clientOpen:true},activity:{at:now,ok:true,threads:[t]}};
  model.tick(state);model.tick(state);assert.equal(model.events.filter(e=>e.kind==='celebrate').length,1);
  t.label='已停止';const aborted=new CompanionModel({now,celebrationWithoutBuddy:true});aborted.tick(state);assert.equal(aborted.events.length,0);
});
test('fresh Mac telemetry enables CPU/battery reactions without invented GPU values', () => {
  const now=Date.now(), model=new CompanionModel({now});
  const hardware={...publicTelemetry({hostAlive:false},{present:false},now),cpuLoad:75,ramPercent:25};
  assert.equal(model.tick({now,hardware}).action,'eating');
  hardware.battery={present:true,percent:15,plugged:false,charging:false};
  assert.equal(model.tick({now,hardware}).notice.kind,'battery-low');
});
