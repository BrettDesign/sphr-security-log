// Voice-to-text using the device's built-in speech recognition.
// - Web preview: uses the browser SpeechRecognition API.
// - Native build: uses expo-speech-recognition (requires a dev/production build;
//   not available inside Expo Go, so we degrade gracefully).
import { Platform } from "react-native";

export type VoiceHandlers = {
  onResult: (text: string) => void;
  onError?: (message: string) => void;
  onEnd?: () => void;
};

type VoiceController = {
  supported: boolean;
  start: () => Promise<void>;
  stop: () => void;
};

function createWebController(handlers: VoiceHandlers): VoiceController {
  const w = globalThis as any;
  const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
  if (!SR) {
    return {
      supported: false,
      start: async () => handlers.onError?.("Voice not supported on this device."),
      stop: () => {},
    };
  }
  const recognition = new SR();
  recognition.lang = "en-AU";
  recognition.interimResults = true;
  recognition.continuous = true;
  recognition.onresult = (event: any) => {
    let transcript = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      transcript += event.results[i][0].transcript;
    }
    handlers.onResult(transcript);
  };
  recognition.onerror = (e: any) => handlers.onError?.(e?.error || "Voice error");
  recognition.onend = () => handlers.onEnd?.();
  return {
    supported: true,
    start: async () => recognition.start(),
    stop: () => recognition.stop(),
  };
}

function createNativeController(handlers: VoiceHandlers): VoiceController {
  let mod: any = null;
  try {
    // Lazy require so a missing native module (Expo Go) is contained here.
    mod = require("expo-speech-recognition");
  } catch {
    mod = null;
  }
  const SpeechModule = mod?.ExpoSpeechRecognitionModule;
  if (!SpeechModule) {
    return {
      supported: false,
      start: async () =>
        handlers.onError?.(
          "Voice-to-text needs the installed app build. Type your report for now."
        ),
      stop: () => {},
    };
  }

  let subs: any[] = [];
  const cleanup = () => {
    subs.forEach((s) => s?.remove?.());
    subs = [];
  };

  return {
    supported: true,
    start: async () => {
      try {
        const perm = await SpeechModule.requestPermissionsAsync();
        if (!perm?.granted) {
          handlers.onError?.("Microphone permission denied.");
          return;
        }
        subs.push(
          SpeechModule.addListener?.("result", (e: any) => {
            const t = e?.results?.[0]?.transcript;
            if (t) handlers.onResult(t);
          })
        );
        subs.push(
          SpeechModule.addListener?.("error", (e: any) =>
            handlers.onError?.(e?.message || "Voice error")
          )
        );
        subs.push(
          SpeechModule.addListener?.("end", () => {
            handlers.onEnd?.();
            cleanup();
          })
        );
        SpeechModule.start({
          lang: "en-AU",
          interimResults: true,
          continuous: true,
        });
      } catch (err: any) {
        handlers.onError?.(err?.message || "Voice unavailable on this device.");
      }
    },
    stop: () => {
      try {
        SpeechModule.stop?.();
      } catch {}
      cleanup();
    },
  };
}

export function createVoiceController(handlers: VoiceHandlers): VoiceController {
  if (Platform.OS === "web") return createWebController(handlers);
  return createNativeController(handlers);
}
