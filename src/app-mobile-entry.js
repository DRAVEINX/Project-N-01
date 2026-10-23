import { SpeechRecognition } from "@capgo/capacitor-speech-recognition";

// Expose the native recognizer before the existing application initializes.
window.PlanSamenSpeechRecognition = SpeechRecognition;
await import("./app.js");
