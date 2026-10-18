import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

const STORAGE_KEY = "project-n-01-native-notification-ids-v1";
function hashId(value) {
  let hash = 2166136261;
  for (const char of String(value)) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); }
  return (hash >>> 0) % 2147483000 + 1;
}
function localAt(dateValue, timeValue) {
  const date = new Date(String(dateValue) + "T" + String(timeValue || "09:00") + ":00");
  return Number.isFinite(date.getTime()) ? date : null;
}
function buildSchedule(items, quietStart = "22:00", quietEnd = "07:00", showDetails = false) {
  const now = Date.now();
  const quiet = (date) => {
    const hhmm = date.toTimeString().slice(0,5);
    return quietStart > quietEnd ? hhmm >= quietStart || hhmm < quietEnd : hhmm >= quietStart && hhmm < quietEnd;
  };
  const result = [];
  const add = (id, when, detail, category) => {
    if (!(when instanceof Date) || !Number.isFinite(when.getTime()) || when.getTime() <= now || result.length >= 60) return;
    let actual = when;
    if (quiet(actual)) {
      const [h,m] = quietEnd.split(":").map(Number);
      actual = new Date(actual);
      actual.setDate(actual.getDate() + (actual.toTimeString().slice(0,5) >= quietStart && quietStart > quietEnd ? 1 : 0));
      actual.setHours(h || 0,m || 0,0,0);
      if (actual.getTime() <= now) actual.setDate(actual.getDate()+1);
    }
    if (actual.getTime() <= now) return;
    result.push({
      id: hashId(id + ":" + actual.toISOString()),
      title: "Project N-01 · herinnering",
      body: showDetails && detail ? String(detail).slice(0,100) : category === "appointment" ? "Je hebt een afspraak gepland." : "Je hebt een herinnering.",
      schedule: { at: actual, allowWhileIdle: true },
      sound: undefined,
      extra: { category: "private-reminder" }
    });
  };
  for (const item of items || []) {
    if (item.type === "appointment") {
      const date = localAt(item.date,item.start);
      if (!date) continue;
      const mins = Math.max(0,Number(item.reminderMins)||0);
      if (mins<=0)continue;
      add("appointment:"+item.id,new Date(date.getTime()-mins*60000),item.title,"appointment");
      continue;
    }
    if (!item.when) continue;
    let base = new Date(item.when);
    if (!Number.isFinite(base.getTime())) continue;
    const repeat = ["daily","weekly"].includes(item.repeat) ? item.repeat : "none";
    const steps = repeat === "daily" ? 1 : repeat === "weekly" ? 7 : 0;
    const advanceLocalDays = (date,days) => { const next = new Date(date); next.setDate(next.getDate()+days); return next; };
    let count = 0;
    while (base.getTime() <= now && steps && count < 400) { base = advanceLocalDays(base,steps); count++; }
    add("reminder:"+item.id,base,item.title,"reminder");
    if (steps) for (let i=1;i<30/steps && result.length<60;i++) add("reminder:"+item.id+":"+i,advanceLocalDays(base,steps*i),item.title,"reminder");
  }
  return result.slice(0,60);
}
async function schedule(items, preferences = {}) {
  if (!Capacitor.isNativePlatform()) return { native: false, count: 0 };
  let permission = await LocalNotifications.checkPermissions();
  if (permission.display !== "granted") permission = await LocalNotifications.requestPermissions();
  if (permission.display !== "granted") return { native: true, permission: "denied", count: 0 };
  const previous = (() => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)||"[]"); } catch { return []; } })();
  if (previous.length) await LocalNotifications.cancel({ notifications: previous.map(id=>({id})) }).catch(()=>{});
  const notifications = buildSchedule(items,preferences.quietHoursStart||"22:00",preferences.quietHoursEnd||"07:00",preferences.showReminderDetails===true);
  if (notifications.length) await LocalNotifications.schedule({ notifications });
  localStorage.setItem(STORAGE_KEY,JSON.stringify(notifications.map(n=>n.id)));
  return { native: true, count: notifications.length, permission: permission.display };
}
window.ProjectN01NativeNotifications = Object.freeze({
  isNative: () => Capacitor.isNativePlatform(),
  requestPermission: async () => {
    if (!Capacitor.isNativePlatform()) return { native: false, permission: "browser-only" };
    const current = await LocalNotifications.checkPermissions();
    const result = current.display === "granted" ? current : await LocalNotifications.requestPermissions();
    return { native: true, permission: result.display };
  },
  schedule
});
