import { LocalNotifications } from "@capacitor/local-notifications";

// Imported only in the installed Capacitor phone/tablet/iOS shell.
// Permissions are requested by the app after the user chooses to enable them.
if (window.Capacitor?.isNativePlatform?.()) {
  window.ProjectN01NativeNotifications = LocalNotifications;
}
