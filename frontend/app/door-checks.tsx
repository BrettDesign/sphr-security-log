import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { colors, spacing, radius, font } from "@/src/lib/theme";
import { AppButton } from "@/src/components/ui";
import { getShift, saveShift, syncShift, Shift } from "@/src/lib/store";
import { DOOR_CHECK_AREAS } from "@/src/lib/doorChecks";

export default function DoorChecks() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [shift, setShift] = useState<Shift | null>(null);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const s = await getShift();
        if (!s) {
          router.replace("/");
          return;
        }
        setShift(s);
      })();
    }, [router])
  );

  if (!shift) return <View style={styles.root} />;

  const checks = shift.door_checks || {};
  const doneCount = DOOR_CHECK_AREAS.filter((a) => checks[a]).length;
  const total = DOOR_CHECK_AREAS.length;
  const allDone = doneCount === total;

  const persist = (next: Record<string, boolean>) => {
    const updated = { ...shift, door_checks: next, synced: false };
    setShift(updated);
    saveShift(updated);
    syncShift(updated);
  };

  const toggle = (area: string) => {
    Haptics.selectionAsync().catch(() => {});
    persist({ ...checks, [area]: !checks[area] });
  };

  const setAll = (value: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const next: Record<string, boolean> = {};
    DOOR_CHECK_AREAS.forEach((a) => (next[a] = value));
    persist(next);
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="back-button" onPress={() => router.back()} hitSlop={8} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>Final Door Checks</Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={styles.progressBar}>
        <View style={styles.progressTextWrap}>
          <Text style={styles.progressCount} testID="door-checks-count">
            {doneCount}/{total}
          </Text>
          <Text style={styles.progressLabel}>areas secured</Text>
        </View>
        <Pressable
          testID={allDone ? "clear-all-checks" : "check-all-doors"}
          onPress={() => setAll(!allDone)}
          style={styles.allBtn}
          hitSlop={6}
        >
          <Ionicons
            name={allDone ? "refresh" : "checkmark-done"}
            size={16}
            color={colors.brand}
          />
          <Text style={styles.allBtnText}>{allDone ? "Reset" : "Check all"}</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 110 }}>
        {DOOR_CHECK_AREAS.map((area) => {
          const done = !!checks[area];
          return (
            <Pressable
              key={area}
              testID={`door-check-${area}`}
              onPress={() => toggle(area)}
              style={[styles.row, done && styles.rowDone]}
            >
              <Text style={[styles.rowLabel, done && styles.rowLabelDone]}>{area}</Text>
              <View style={[styles.box, done && styles.boxDone]}>
                {done && <Ionicons name="checkmark" size={20} color={colors.onSuccess} />}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + spacing.md }]}>
        <AppButton
          label={allDone ? "ALL DOORS CHECKED" : "DONE"}
          testID="door-checks-done"
          onPress={() => router.back()}
          icon={
            <Ionicons
              name={allDone ? "shield-checkmark" : "arrow-back"}
              size={18}
              color={colors.onBrand}
            />
          }
        />
      </View>
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
  progressBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  progressTextWrap: { flexDirection: "row", alignItems: "baseline", gap: spacing.sm },
  progressCount: { color: colors.brand, fontSize: font.xxl, fontWeight: "900" },
  progressLabel: { color: colors.onSurfaceSecondary, fontSize: font.base, fontWeight: "600" },
  allBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  allBtnText: { color: colors.brand, fontWeight: "800", fontSize: font.base },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    marginBottom: spacing.md,
    minHeight: 60,
  },
  rowDone: { borderColor: colors.success, backgroundColor: "rgba(46,202,106,0.08)" },
  rowLabel: { color: colors.onSurface, fontSize: font.lg, fontWeight: "700", flex: 1 },
  rowLabelDone: { color: colors.onSurfaceTertiary },
  box: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  boxDone: { backgroundColor: colors.success, borderColor: colors.success },
  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
