import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

const ACTION_TYPE = "PROJECT_N01_REMINDER";
const MANAGED = "projectN01";
let listenersReady = false;

function quietAdjusted(date, quietStart, quietEnd) {
  const candidate = new Date(date);
  if (!quietStart || !quietEnd || quietStart === quietEnd) return candidate;
  const minute = candidate.getHours() * 60 + candidate.getMinutes();
  const parse = value => {
    const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(value || ""));
    return match ? Number(match[1]) * 60 + Number(match[2]) : null;
  };
  const start = parse(quietStart), end = parse(quietEnd);
  if (start === null || end === null) return candidate;
  const inside = start < end ? minute >= start && minute < end : minute >= start || minute < end;
  if (!inside) return candidate;
  const next = new Date(candidate);
  next.setHours(Math.floor(end / 60), end % 60, 0, 0);
  if (start >= end && minute >= start) next.setDate(next.getDate() + 1);
  if (next <= candidate) next.setDate(next.getDate() + 1);
  return next;
}
function numericId(source) {
  let value = 2166136261;
  for (const char of String(source)) {
    value ^= char.charCodeAt(0);
    value = Math.imul(value, 16777619);
  }
  return (value >>> 0) % 2147483000 + 1;
}
function makeNotification({ id, title, body, at, originId, quietStart, quietEnd, privatePreview }) {
  return {
    id: numericId(id),
    title: title || "Project N-01",
    body: body || "Je hebt een geplande herinnering.",
    schedule: { at, allowWhileIdle: true },
    sound: undefined,
    actionTypeId: ACTION_TYPE,
    extra: { projectN01: MANAGED, originId, quietStart: quietStart || "", quietEnd: quietEnd || "", privatePreview: privatePreview === true, snoozed: String(id).startsWith("snooze:") }
  };
}
function upcomingItems(snapshot, prefs, now = new Date()) {
  const output = [];
  const horizon = new Date(now.getTime() + 30 * 86400000);
  const add = (key, title, at, quietStart, quietEnd, privatePreview) => {
    if (!(at instanceof Date) || !Number.isFinite(at.getTime())) return;
    const adjusted = quietAdjusted(at, quietStart, quietEnd);
    if (adjusted < now || adjusted > horizon) return;
    output.push(makeNotification({
      id: key, title: privatePreview ? "Project N-01" : title,
      body: privatePreview ? "Je hebt een geplande herinnering." : title,
      at: adjusted, originId: key, quietStart, quietEnd, privatePreview
    }));
  };
  const quietStart = prefs.quietStart || "";
  const quietEnd = prefs.quietEnd || "";
  const privatePreview = prefs.privateNotifications !== false;
  for (const appointment of snapshot.appointments || []) {
    if (!appointment.date || !(Number(appointment.reminderMins) > 0)) continue;
    if (!appointment.start && appointment.allDay !== true) continue;
    const at = new Date(appointment.date + "T" + (appointment.allDay === true ? "09:00" : appointment.start) + ":00");
    at.setTime(at.getTime() - Number(appointment.reminderMins) * 60000);
    add("appointment:" + appointment.id + ":" + appointment.date, appointment.title || "Afspraak", at, quietStart, quietEnd, privatePreview);
  }
  for (const reminder of snapshot.reminders || []) {
    const first = new Date(reminder.when || "");
    if (!Number.isFinite(first.getTime())) continue;
    const repeat = reminder.repeat || "none";
    if (repeat === "daily" || repeat === "weekly") {
      const step = repeat === "daily" ? 1 : 7;
      const candidate = new Date(first);
      while (candidate < now && candidate <= horizon) candidate.setDate(candidate.getDate() + step);
      for (let count = 0; count < 6 && candidate <= horizon; count++, candidate.setDate(candidate.getDate() + step)) {
        add("reminder:" + reminder.id + ":" + candidate.toISOString().slice(0, 10), reminder.title || "Herinnering", new Date(candidate), quietStart, quietEnd, privatePreview);
      }
    } else {
      add("reminder:" + reminder.id + ":" + first.toISOString(), reminder.title || "Herinnering", first, quietStart, quietEnd, privatePreview);
    }
  }
  const dedupe = new Map();
  for (const item of output.sort((a, b) => a.schedule.at - b.schedule.at)) if (!dedupe.has(item.id)) dedupe.set(item.id, item);
  return Array.from(dedupe.values()).slice(0, 55);
}
async function cancelManaged() {
  const pending = await LocalNotifications.getPending();
  const ids = (pending.notifications || []).filter(item => item.extra && item.extra.projectN01 === MANAGED && item.extra.snoozed !== true).map(item => ({ id: item.id }));
  if (ids.length) await LocalNotifications.cancel({ notifications: ids });
}
async function scheduleSnooze(notification) {
  const extra = notification && notification.extra || {};
  if (extra.projectN01 !== MANAGED) return;
  const at = quietAdjusted(new Date(Date.now() + 10 * 60000), extra.quietStart, extra.quietEnd);
  const title = extra.privatePreview ? "Project N-01" : String(notification.title || "Herinnering");
  await LocalNotifications.schedule({ notifications: [makeNotification({
    id: "snooze:" + (extra.originId || notification.id) + ":" + Math.floor(Date.now() / 60000),
    title,
    body: extra.privatePreview ? "Je uitgestelde herinnering." : String(notification.body || "Je uitgestelde herinnering."),
    at,
    originId: extra.originId || String(notification.id),
    quietStart: extra.quietStart, quietEnd: extra.quietEnd, privatePreview: extra.privatePreview
  })] });
}
async function readyActions() {
  if (listenersReady) return;
  await LocalNotifications.registerActionTypes({
    types: [{ id: ACTION_TYPE, actions: [
      { id: "open", title: "Openen" },
      { id: "snooze_10", title: "10 minuten uitstellen" }
    ] }]
  });
  await LocalNotifications.addListener("localNotificationActionPerformed", async action => {
    if (action.actionId === "snooze_10") {
      try { await scheduleSnooze(action.notification); } catch (error) { console.warn("Project N-01 snooze scheduling failed", error); }
    } else if (action.actionId === "open") {
      window.location.hash = "#life";
    }
  });
  listenersReady = true;
}
const isNative = () => Boolean(Capacitor.isNativePlatform());
window.ProjectN01NativeNotifications = {
  isNative,
  async checkPermissions() {
    if (!isNative()) return { display: "prompt", native: false, exact: "unsupported" };
    const display = await LocalNotifications.checkPermissions();
    let exact = "unsupported";
    if (LocalNotifications.checkExactNotificationSetting) {
      try { exact = (await LocalNotifications.checkExactNotificationSetting()).exactAlarm ? "enabled" : "disabled"; } catch {}
    }
    return { ...display, native: true, exact };
  },
  async requestPermissions() {
    if (!isNative()) return { display: "denied", native: false };
    let permissions = await LocalNotifications.checkPermissions();
    if (permissions.display !== "granted") permissions = await LocalNotifications.requestPermissions();
    return { ...permissions, native: true };
  },
  async checkExactNotificationSetting() {
    if (!isNative() || !LocalNotifications.checkExactNotificationSetting) return { exactAlarm: false, supported: false };
    return LocalNotifications.checkExactNotificationSetting();
  },
  async changeExactNotificationSetting() {
    if (!isNative() || !LocalNotifications.changeExactNotificationSetting) return { exactAlarm: false, supported: false };
    return LocalNotifications.changeExactNotificationSetting();
  },
  async replace(snapshot, preferences) {
    if (!isNative()) throw new Error("native-notifications-not-available");
    const permission = await LocalNotifications.checkPermissions();
    if (permission.display !== "granted") throw new Error("notification-permission-not-granted");
    await readyActions();
    const notifications = upcomingItems(snapshot, preferences || {});
    await cancelManaged();
    if (notifications.length) await LocalNotifications.schedule({ notifications });
    return { count: notifications.length, next: notifications[0] && notifications[0].schedule.at };
  },
  async cancelManaged,
  upcomingItems
};
