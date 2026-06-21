// Injects PWA / "Add to Home Screen" tags into the document head on web.
// Works with Expo's "single" (SPA) web output, where app/+html.tsx is ignored.
export function setupPwaHead(): void {
  if (typeof document === "undefined") return;

  const ensureMeta = (name: string, content: string) => {
    let el = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
    if (!el) {
      el = document.createElement("meta");
      el.setAttribute("name", name);
      document.head.appendChild(el);
    }
    el.setAttribute("content", content);
  };

  const ensureLink = (rel: string, href: string) => {
    let el = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
    if (!el) {
      el = document.createElement("link");
      el.setAttribute("rel", rel);
      document.head.appendChild(el);
    }
    el.setAttribute("href", href);
  };

  ensureLink("manifest", "/manifest.json");
  ensureLink("apple-touch-icon", "/icons/apple-touch-icon.png");
  ensureMeta("theme-color", "#101112");
  ensureMeta("mobile-web-app-capable", "yes");
  ensureMeta("apple-mobile-web-app-capable", "yes");
  ensureMeta("apple-mobile-web-app-status-bar-style", "black-translucent");
  ensureMeta("apple-mobile-web-app-title", "SPHR");

  // Standalone / fullscreen when launched from the home screen
  const vp = document.querySelector('meta[name="viewport"]') as HTMLMetaElement | null;
  if (vp) {
    vp.setAttribute(
      "content",
      "width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
    );
  }
  if (document.title !== "SPHR Security Log") document.title = "SPHR Security Log";

  // Register the service worker — required so Android Chrome offers a real
  // "Install" (launcher icon that opens fullscreen), and to open offline.
  if ("serviceWorker" in navigator) {
    const reg = () => navigator.serviceWorker.register("/sw.js").catch(() => {});
    if (document.readyState === "complete") reg();
    else window.addEventListener("load", reg);
  }

  // Capture the Android/Chrome install prompt globally (it can fire before the
  // React banner mounts). Stash it so the banner can trigger a one-tap install.
  const w = window as any;
  if (!w.__sphrInstallHooked) {
    w.__sphrInstallHooked = true;
    window.addEventListener("beforeinstallprompt", (e: any) => {
      e.preventDefault();
      w.__sphrInstallPrompt = e;
      window.dispatchEvent(new Event("sphr-installable"));
    });
    window.addEventListener("appinstalled", () => {
      w.__sphrInstallPrompt = null;
      window.dispatchEvent(new Event("sphr-installed"));
    });
  }
}
