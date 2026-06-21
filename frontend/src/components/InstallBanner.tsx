// @ts-nocheck
// Web-only "Add to Home Screen" hint. Renders nothing on native or once the
// app is already installed (standalone). Dismissal is remembered locally.
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
  const [deferred, setDeferred] = useState<any>(null);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    if (isStandalone()) return;

    let mounted = true;
    (async () => {
      const dismissed = await storage.getItem<boolean>(DISMISS_KEY, false);
      if (!mounted || dismissed) return;
      setIos(isIOS());
      setVisible(true);
    })();

    const onBIP = (e: any) => {
      e.preventDefault();
      setDeferred(e);
    };
    window.addEventListener("beforeinstallprompt", onBIP);
    const onInstalled = () => setVisible(false);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      mounted = false;
      window.removeEventListener("beforeinstallprompt", onBIP);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const dismiss = async () => {
    setVisible(false);
    await storage.setItem(DISMISS_KEY, true);
  };

  const install = async () => {
    if (deferred) {
      deferred.prompt();
      try {
        await deferred.userChoice;
      } catch {}
      setDeferred(null);
      setVisible(false);
    }
  };

  if (!visible) return null;

  return (
    <View style={styles.bar} testID="install-banner">
      <View style={styles.iconBox}>
        <Ionicons name="phone-portrait" size={18} color={colors.onBrand} />
      </View>
      <View style={styles.textWrap}>
        <Text style={styles.title}>Install SPHR on your phone</Text>
        {ios ? (
          <Text style={styles.sub} numberOfLines={2}>
            Tap the Share icon, then “Add to Home Screen”.
          </Text>
        ) : deferred ? (
          <Text style={styles.sub} numberOfLines={1}>
            Add it to your home screen for one-tap access.
          </Text>
        ) : (
          <Text style={styles.sub} numberOfLines={2}>
            Open the browser menu (⋮), then “Add to Home screen”.
          </Text>
        )}
      </View>

      {!ios && deferred ? (
        <Pressable testID="install-banner-install" onPress={install} style={styles.cta}>
          <Text style={styles.ctaText}>Install</Text>
        </Pressable>
      ) : null}

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
