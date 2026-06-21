import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";

import { colors, spacing, radius, font } from "@/src/lib/theme";
import { AppButton } from "@/src/components/ui";
import { getShift, syncShift, Shift } from "@/src/lib/store";
import { PatrolEntry } from "@/src/lib/api";

const NIGHT_IMG =
  "https://images.unsplash.com/photo-1501418611786-e29f9929fe03?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMzN8MHwxfHNlYXJjaHwxfHxuaWdodCUyMHNreSUyMG1vb24lMjBzdGFyc3xlbnwwfHx8fDE3ODIwMTUyMDV8MA&ixlib=rb-4.1.0&q=85";

export default function Dashboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [shift, setShift] = useState<Shift | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const s = await getShift();
    if (!s) {
      router.replace("/");
      return;
    }
    setShift(s);
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = async () => {
    if (!shift) return;
    setRefreshing(true);
    const ok = await syncShift(shift);
    const s = await getShift();
    setShift(s);
    setRefreshing(false);
  };

  if (!shift) return <View style={styles.root} />;

  const synced = shift.synced;

  const renderItem = ({ item, index }: { item: PatrolEntry; index: number }) => (
    <View style={styles.entryCard} testID={`entry-card-${index}`}>
      <View style={styles.entryTop}>
        <View style={styles.entryNum}>
          <Text style={styles.entryNumText}>{index + 1}</Text>
        </View>
        <Text style={styles.entryLocation} numberOfLines={1}>
          {item.location}
        </Text>
        <Text style={styles.entryTime}>{item.time_label}</Text>
      </View>
      <Text style={styles.entryAction}>{item.action}</Text>
      <View style={styles.entryMeta}>
        {item.latitude != null && (
          <View style={styles.metaPill}>
            <Ionicons name="location" size={12} color={colors.success} />
            <Text style={styles.metaPillText}>
              {item.latitude.toFixed(4)}, {item.longitude?.toFixed(4)}
            </Text>
          </View>
        )}
        {item.photo ? (
          <View style={styles.metaPill}>
            <Ionicons name="image" size={12} color={colors.info} />
            <Text style={styles.metaPillText}>Photo</Text>
          </View>
        ) : null}
      </View>
    </View>
  );

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.headerTopRow}>
          <View>
            <Text style={styles.headerTitle}>Patrol Dashboard</Text>
            <Text style={styles.headerSub}>
              {shift.guard_name} · {shift.security_number}
            </Text>
          </View>
          <Pressable
            testID="summary-nav-button"
            onPress={() => router.push("/summary")}
            style={styles.iconBtn}
            hitSlop={8}
          >
            <Ionicons name="document-text" size={22} color={colors.brand} />
          </Pressable>
        </View>

        <View style={styles.statsRow}>
          <View style={[styles.statusPill, synced ? styles.statusSynced : styles.statusOffline]}>
            <Ionicons
              name={synced ? "cloud-done" : "cloud-offline"}
              size={14}
              color={synced ? colors.success : colors.warning}
            />
            <Text
              style={[
                styles.statusText,
                { color: synced ? colors.success : colors.warning },
              ]}
              testID="sync-status-text"
            >
              {synced ? "Synced" : "Saved offline"}
            </Text>
          </View>
          <View style={styles.statBlock}>
            <Text style={styles.statLabel}>DATE</Text>
            <Text style={styles.statValue}>{shift.shift_date}</Text>
          </View>
          <View style={styles.statBlock}>
            <Text style={styles.statLabel}>DIVERSION</Text>
            <Text style={styles.statValue} numberOfLines={1}>
              {shift.manager_name || "—"}
            </Text>
          </View>
        </View>
      </View>

      <FlatList
        data={shift.entries}
        keyExtractor={(e) => e.id}
        renderItem={renderItem}
        contentContainerStyle={{
          padding: spacing.lg,
          paddingBottom: 120,
          flexGrow: 1,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.brand}
          />
        }
        ListHeaderComponent={
          shift.entries.length ? (
            <Text style={styles.listHeader}>
              {shift.entries.length} PATROL{" "}
              {shift.entries.length === 1 ? "ENTRY" : "ENTRIES"}
            </Text>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Image source={{ uri: NIGHT_IMG }} style={styles.emptyImg} contentFit="cover" />
            <Text style={styles.emptyTitle}>No logs yet</Text>
            <Text style={styles.emptySub}>
              Start your patrol and log your first checkpoint.
            </Text>
          </View>
        }
      />

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + spacing.md }]}>
        <AppButton
          label="LOG PATROL ENTRY"
          testID="log-entry-button"
          onPress={() => router.push("/log-entry")}
          icon={<Ionicons name="add" size={20} color={colors.onBrand} />}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: { color: colors.onSurface, fontSize: font.xl, fontWeight: "900" },
  headerSub: { color: colors.onSurfaceSecondary, fontSize: font.base, marginTop: 2 },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  statusSynced: { borderColor: colors.success, backgroundColor: "rgba(46,202,106,0.1)" },
  statusOffline: { borderColor: colors.warning, backgroundColor: "rgba(255,193,7,0.1)" },
  statusText: { fontSize: font.sm, fontWeight: "800" },
  statBlock: { flex: 1 },
  statLabel: { color: colors.onSurfaceSecondary, fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  statValue: { color: colors.onSurface, fontSize: font.base, fontWeight: "700", marginTop: 2 },
  listHeader: {
    color: colors.onSurfaceSecondary,
    fontSize: font.sm,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: spacing.md,
  },
  entryCard: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 3,
    borderLeftColor: colors.brand,
  },
  entryTop: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  entryNum: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  entryNumText: { color: colors.brand, fontWeight: "900", fontSize: font.sm },
  entryLocation: { flex: 1, color: colors.onSurface, fontSize: font.lg, fontWeight: "800" },
  entryTime: { color: colors.brand, fontSize: font.sm, fontWeight: "700" },
  entryAction: { color: colors.onSurfaceTertiary, fontSize: font.base, marginTop: spacing.sm, lineHeight: 20 },
  entryMeta: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md, flexWrap: "wrap" },
  metaPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.surfaceTertiary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  metaPillText: { color: colors.onSurfaceSecondary, fontSize: font.sm, fontWeight: "600" },
  empty: { alignItems: "center", justifyContent: "center", paddingTop: spacing.xxxl },
  emptyImg: { width: 180, height: 180, borderRadius: radius.lg, marginBottom: spacing.xl, opacity: 0.85 },
  emptyTitle: { color: colors.onSurface, fontSize: font.xl, fontWeight: "800" },
  emptySub: {
    color: colors.onSurfaceSecondary,
    fontSize: font.base,
    marginTop: spacing.sm,
    textAlign: "center",
    paddingHorizontal: spacing.xl,
  },
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
