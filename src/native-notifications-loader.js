(function () {
  "use strict";
  const capacitor = window.Capacitor;
  if (!capacitor || typeof capacitor.isNativePlatform !== "function" || !capacitor.isNativePlatform()) return;
  const script = document.createElement("script");
  script.src = "native-notifications.bundle.js";
  script.async = true;
  script.onerror = () => window.dispatchEvent(new CustomEvent("projectn-native-notifications-error"));
  script.onload = () => window.dispatchEvent(new CustomEvent("projectn-native-notifications-ready"));
  document.head.appendChild(script);
})();
