import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  Share,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import QRCode from "react-native-qrcode-svg";
import * as Clipboard from "expo-clipboard";

import { colors, spacing, radius, font } from "@/src/lib/theme";
import { AppButton, Toast } from "@/src/components/ui";

function getInstallUrl(): string {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    return window.location.origin;
  }
  return (process.env.EXPO_PUBLIC_BACKEND_URL || "").replace(/\/$/, "");
}

export default function ShareScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const url = useMemo(getInstallUrl, []);
  const [toast, setToast] = useState("");

  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(""), 2200);
  };

  const copyLink = async () => {
    await Clipboard.setStringAsync(url);
    flash("Link copied to clipboard");
  };

  const shareLink = async () => {
    const message =
      `Install the SPHR Security Log app:\n${url}\n\n` +
      `iPhone: open in Safari → Share → Add to Home Screen\n` +
      `Android: open in Chrome → menu (⋮) → Add to Home screen`;
    if (Platform.OS === "web") {
      const nav: any = typeof navigator !== "undefined" ? navigator : null;
      if (nav?.share) {
        try {
          await nav.share({ title: "SPHR Security Log", text: message, url });
          return;
        } catch {
          return;
        }
      }
      await copyLink();
      return;
    }
    try {
      await Share.share({ message });
    } catch {
      flash("Could not open share sheet");
    }
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="back-button" onPress={() => router.back()} hitSlop={8} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>Share App</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}>
        <Text style={styles.lead}>
          Scanning the code <Text style={styles.leadBold}>opens</Text> the app. To get the
          launch icon, the guard then taps{" "}
          <Text style={styles.leadBold}>Install</Text> (Android) or{" "}
          <Text style={styles.leadBold}>Add to Home Screen</Text> (iPhone) — see steps below.
        </Text>

        <View style={styles.qrCard} testID="qr-card">
          <View style={styles.qrBox}>
            {url ? (
              <QRCode
                value={url}
                size={220}
                backgroundColor="#FFFFFF"
                color="#101112"
              />
            ) : (
              <Text style={styles.noUrl}>App link unavailable</Text>
            )}
          </View>
          <Text style={styles.urlText} testID="install-url" numberOfLines={2}>
            {url}
          </Text>
        </View>

        <View style={styles.actions}>
          <View style={{ flex: 1 }}>
            <AppButton
              label="Copy Link"
              variant="secondary"
              testID="copy-link-button"
              onPress={copyLink}
              icon={<Ionicons name="copy" size={16} color={colors.brand} />}
            />
          </View>
          <View style={{ flex: 1 }}>
            <AppButton
              label="Share"
              testID="share-link-button"
              onPress={shareLink}
              icon={<Ionicons name="share-social" size={16} color={colors.onBrand} />}
            />
          </View>
        </View>

        <View style={styles.steps}>
          <Text style={styles.stepsTitle}>How guards install it</Text>
          <Step icon="logo-apple" text="iPhone: open the link in Safari, tap Share, then “Add to Home Screen”." />
          <Step icon="logo-android" text="Android: open in Chrome, tap menu (⋮), then “Add to Home screen”." />
          <Step icon="shield-checkmark" text="Open the SPHR icon, enter shift details, and start logging." />
        </View>
      </ScrollView>

      <Toast message={toast} visible={!!toast} />
    </View>
  );
}

function Step({ icon, text }: { icon: any; text: string }) {
  return (
    <View style={styles.stepRow}>
      <View style={styles.stepIcon}>
        <Ionicons name={icon} size={16} color={colors.brand} />
      </View>
      <Text style={styles.stepText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  iconBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: colors.onSurface, fontSize: font.lg, fontWeight: "800" },
  lead: {
    color: colors.onSurfaceSecondary,
    fontSize: font.base,
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  leadBold: { color: colors.brand, fontWeight: "800" },
  qrCard: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    padding: spacing.xl,
  },
  qrBox: {
    backgroundColor: "#FFFFFF",
    padding: spacing.lg,
    borderRadius: radius.md,
  },
  noUrl: { color: "#101112", width: 220, height: 220, textAlign: "center", textAlignVertical: "center" },
  urlText: {
    color: colors.brand,
    fontSize: font.sm,
    fontWeight: "700",
    marginTop: spacing.lg,
    textAlign: "center",
  },
  actions: { flexDirection: "row", gap: spacing.md, marginTop: spacing.lg },
  steps: {
    marginTop: spacing.xl,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  stepsTitle: {
    color: colors.onSurfaceSecondary,
    fontSize: font.sm,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: spacing.md,
  },
  stepRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.md },
  stepIcon: {
    width: 30,
    height: 30,
    borderRadius: radius.md,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  stepText: { flex: 1, color: colors.onSurfaceTertiary, fontSize: font.base, lineHeight: 20 },
});
