// @ts-nocheck
// Web-only "Install app" banner.
// - Android/Chrome: shows a one-tap "Install" button that fires the native
//   install prompt (drops the app + launcher icon on the phone).
// - iOS/Safari: Apple provides no install API, so we show the exact manual
//   "Share → Add to Home Screen" step instead.
// Renders nothing on native or once the app is already installed.
import React, { useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { storage } from "@/src/utils/storage";
import { colors, spacing, radius, font } from "@/src/lib/theme";

const DISMISS_KEY = "sphr.install_banner_dismissed";

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const mm = window.matchMedia && window.matchMedia("(display-mode: standalone)").matches;
  return Boolean(mm || (window.navigator as any)?.standalone);
}

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent || "");
}

export function InstallBanner() {
  const [visible, setVisible] = useState(false);
  const [ios, setIos] = useState(false);
  const [canInstall, setCanInstall] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    if (isStandalone()) return;

    let mounted = true;
    const w = window as any;

    (async () => {
      const dismissed = await storage.getItem<boolean>(DISMISS_KEY, false);
      if (!mounted || dismissed) return;
      setIos(isIOS());
      setCanInstall(Boolean(w.__sphrInstallPrompt));
      setVisible(true);
    })();

    const onInstallable = () => setCanInstall(true);
    const onInstalled = () => setVisible(false);
    window.addEventListener("sphr-installable", onInstallable);
    window.addEventListener("sphr-installed", onInstalled);

    return () => {
      mounted = false;
      window.removeEventListener("sphr-installable", onInstallable);
      window.removeEventListener("sphr-installed", onInstalled);
    };
  }, []);

  const dismiss = async () => {
    setVisible(false);
    await storage.setItem(DISMISS_KEY, true);
  };

  const install = async () => {
    const w = window as any;
    const prompt = w.__sphrInstallPrompt;
    if (prompt) {
      prompt.prompt();
      try {
        const choice = await prompt.userChoice;
        if (choice?.outcome === "accepted") setVisible(false);
      } catch {}
      w.__sphrInstallPrompt = null;
      setCanInstall(false);
      return;
    }
    // No prompt available (iOS, or criteria not met yet) → show guidance.
    setShowIosHelp(true);
  };

  if (!visible) return null;

  // ----- iOS layout: instruction only (Apple blocks auto-install) -----
  if (ios) {
    return (
      <View style={styles.bar} testID="install-banner">
        <View style={styles.iconBox}>
          <Ionicons name="phone-portrait" size={18} color={colors.onBrand} />
        </View>
        <View style={styles.textWrap}>
          <Text style={styles.title}>Install SPHR</Text>
          <Text style={styles.sub} numberOfLines={2}>
            Tap the Share icon below, then “Add to Home Screen”.
          </Text>
        </View>
        <Ionicons name="arrow-down" size={20} color={colors.brand} />
        <Pressable testID="install-banner-dismiss" onPress={dismiss} hitSlop={10} style={styles.close}>
          <Ionicons name="close" size={18} color={colors.onSurfaceSecondary} />
        </Pressable>
      </View>
    );
  }

  // ----- Android / Chrome layout: one-tap install -----
  return (
    <View style={styles.bar} testID="install-banner">
      <View style={styles.iconBox}>
        <Ionicons name="download" size={18} color={colors.onBrand} />
      </View>
      <View style={styles.textWrap}>
        <Text style={styles.title}>Install SPHR on your phone</Text>
        <Text style={styles.sub} numberOfLines={2}>
          {canInstall
            ? "Tap Install to add the app and icon to your home screen."
            : showIosHelp
            ? "Open the browser menu (⋮), then “Install app” / “Add to Home screen”."
            : "Add it to your home screen for one-tap access."}
        </Text>
      </View>

      <Pressable testID="install-banner-install" onPress={install} style={styles.cta}>
        <Text style={styles.ctaText}>Install</Text>
      </Pressable>

      <Pressable testID="install-banner-dismiss" onPress={dismiss} hitSlop={10} style={styles.close}>
        <Ionicons name="close" size={18} color={colors.onSurfaceSecondary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surfaceTertiary,
    borderBottomWidth: 1,
    borderBottomColor: colors.brand,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  iconBox: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  textWrap: { flex: 1 },
  title: { color: colors.onSurface, fontSize: font.base, fontWeight: "800" },
  sub: { color: colors.onSurfaceSecondary, fontSize: font.sm, marginTop: 1 },
  cta: {
    backgroundColor: colors.brand,
    paddingHorizontal: spacing.lg,
    height: 36,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: { color: colors.onBrand, fontWeight: "800", fontSize: font.base },
  close: { padding: 4 },
});
