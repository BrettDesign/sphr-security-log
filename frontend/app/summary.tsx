import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { colors, spacing, radius, font } from "@/src/lib/theme";
import { AppButton, Toast } from "@/src/components/ui";
import { getShift, saveShift, syncShift, clearShift, Shift } from "@/src/lib/store";
import { exportPdf, submitReport, DM_EMAIL } from "@/src/lib/report";
import { api } from "@/src/lib/api";
import { DOOR_CHECK_AREAS } from "@/src/lib/doorChecks";

function shiftDuration(startedAt: string): string {
  const start = new Date(startedAt).getTime();
  const mins = Math.max(0, Math.round((Date.now() - start) / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function Summary() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [shift, setShift] = useState<Shift | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [toast, setToast] = useState("");
  const [endModal, setEndModal] = useState(false);
  const [warnModal, setWarnModal] = useState(false);

  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(""), 2600);
  };

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

  const onExport = async () => {
    setPdfLoading(true);
    try {
      await exportPdf(shift);
    } catch {
      flash("Could not generate PDF.");
    }
    setPdfLoading(false);
  };

  const onSubmit = () => {
    if (shift.entries.length === 0) {
      flash("No patrol entries to submit.");
      return;
    }
    const done = DOOR_CHECK_AREAS.filter((a) => (shift.door_checks || {})[a]).length;
    if (done < DOOR_CHECK_AREAS.length) {
      setWarnModal(true);
      return;
    }
    performSubmit();
  };

  const performSubmit = async () => {
    if (shift.entries.length === 0) {
      flash("No patrol entries to submit.");
      return;
    }
    setSubmitLoading(true);
    const updated = { ...shift, submitted: true };
    await saveShift(updated);
    setShift(updated);
    try {
      // Universal server-side send (works on every device, formatted body + PDF).
      const res = await api.sendReport({
        id: updated.id,
        security_number: updated.security_number,
        guard_name: updated.guard_name,
        shift_date: updated.shift_date,
        manager_name: updated.manager_name,
        manager_mobile: updated.manager_mobile,
        entries: updated.entries,
        door_checks: updated.door_checks || {},
        submitted: true,
      });
      flash(res.message || `Report emailed to ${DM_EMAIL}`);
    } catch (e) {
      // Fallback: open the device mail app pre-filled.
      try {
        await submitReport(updated);
        flash("Couldn't auto-send — opened your mail app as a fallback.");
      } catch {
        flash("Could not send the report. Check your connection.");
      }
    }
    setSubmitLoading(false);
  };

  const endShift = async () => {
    await clearShift();
    setEndModal(false);
    router.replace("/");
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="back-button" onPress={() => router.back()} hitSlop={8} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>Shift Summary</Text>
        <Pressable testID="end-shift-button" onPress={() => setEndModal(true)} hitSlop={8} style={styles.iconBtn}>
          <Ionicons name="exit-outline" size={22} color={colors.error} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 160 }}>
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryStat}>
              <Text style={styles.summaryNum} testID="total-patrols">
                {shift.entries.length}
              </Text>
              <Text style={styles.summaryStatLabel}>PATROLS</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryStat}>
              <Text style={styles.summaryNum}>{shiftDuration(shift.started_at)}</Text>
              <Text style={styles.summaryStatLabel}>DURATION</Text>
            </View>
          </View>
          <View style={styles.detailList}>
            <Detail icon="person" label="Guard" value={`${shift.guard_name} · ${shift.security_number}`} />
            <Detail icon="calendar" label="Date" value={shift.shift_date} />
            <Detail
              icon="call"
              label="Diversion"
              value={`${shift.manager_name || "—"}${shift.manager_mobile ? " · " + shift.manager_mobile : ""}`}
            />
            <Detail
              icon={shift.synced ? "cloud-done" : "cloud-offline"}
              label="Sync"
              value={shift.synced ? "Synced to management" : "Saved offline"}
            />
          </View>
        </View>

        <View style={styles.doorSummary}>
          <View style={styles.doorSummaryHead}>
            <Text style={styles.listHeader}>FINAL DOOR CHECKS</Text>
            <Text style={styles.doorSummaryCount}>
              {DOOR_CHECK_AREAS.filter((a) => (shift.door_checks || {})[a]).length}/
              {DOOR_CHECK_AREAS.length}
            </Text>
          </View>
          <View style={styles.doorGrid}>
            {DOOR_CHECK_AREAS.map((area) => {
              const done = !!(shift.door_checks || {})[area];
              return (
                <View key={area} style={styles.doorChip} testID={`summary-door-${area}`}>
                  <Ionicons
                    name={done ? "checkmark-circle" : "ellipse-outline"}
                    size={16}
                    color={done ? colors.success : colors.onSurfaceSecondary}
                  />
                  <Text style={[styles.doorChipText, done && styles.doorChipDone]}>{area}</Text>
                </View>
              );
            })}
          </View>
        </View>

        <Text style={styles.listHeader}>PATROL LOG</Text>
        {shift.entries.length === 0 ? (
          <Text style={styles.emptyText}>No entries recorded yet.</Text>
        ) : (
          shift.entries.map((e, i) => (
            <View key={e.id} style={styles.entryRow} testID={`summary-entry-${i}`}>
              <Text style={styles.entryRowNum}>{i + 1}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.entryRowLoc}>{e.location}</Text>
                <Text style={styles.entryRowAction}>{e.action}</Text>
                <Text style={styles.entryRowMeta}>
                  {e.time_label}
                  {e.latitude != null ? `  ·  GPS ${e.latitude.toFixed(4)}, ${e.longitude?.toFixed(4)}` : ""}
                  {e.photo ? "  ·  📷" : ""}
                </Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + spacing.md }]}>
        <View style={{ flex: 1 }}>
          <AppButton
            label="Export PDF"
            variant="secondary"
            testID="export-pdf-button"
            loading={pdfLoading}
            onPress={onExport}
            icon={<Ionicons name="download" size={18} color={colors.brand} />}
          />
        </View>
        <View style={{ flex: 1.4 }}>
          <AppButton
            label="Submit to DM"
            testID="submit-report-button"
            loading={submitLoading}
            onPress={onSubmit}
            icon={<Ionicons name="send" size={16} color={colors.onBrand} />}
          />
        </View>
      </View>

      <Modal visible={warnModal} transparent animationType="fade" onRequestClose={() => setWarnModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Door checks incomplete</Text>
            <Text style={styles.modalBody}>
              {DOOR_CHECK_AREAS.length -
                DOOR_CHECK_AREAS.filter((a) => (shift.door_checks || {})[a]).length}{" "}
              of {DOOR_CHECK_AREAS.length} final door check areas are not yet ticked.
              Please complete all door checks before submitting the nightly report.
            </Text>
            <View style={{ flexDirection: "row", gap: spacing.md, marginTop: spacing.lg }}>
              <View style={{ flex: 1 }}>
                <AppButton
                  label="Submit Anyway"
                  variant="secondary"
                  testID="submit-anyway-button"
                  onPress={() => {
                    setWarnModal(false);
                    performSubmit();
                  }}
                />
              </View>
              <View style={{ flex: 1 }}>
                <AppButton
                  label="Review Checks"
                  testID="review-checks-button"
                  onPress={() => {
                    setWarnModal(false);
                    router.push("/door-checks");
                  }}
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={endModal} transparent animationType="fade" onRequestClose={() => setEndModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>End Shift?</Text>
            <Text style={styles.modalBody}>
              This clears the current shift from this device. Make sure you have submitted your
              report first.
            </Text>
            <View style={{ flexDirection: "row", gap: spacing.md, marginTop: spacing.lg }}>
              <View style={{ flex: 1 }}>
                <AppButton label="Cancel" variant="secondary" testID="cancel-end-button" onPress={() => setEndModal(false)} />
              </View>
              <View style={{ flex: 1 }}>
                <AppButton label="End Shift" testID="confirm-end-button" onPress={endShift} />
              </View>
            </View>
          </View>
        </View>
      </Modal>

      <Toast message={toast} visible={!!toast} />
    </View>
  );
}

function Detail({ icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Ionicons name={icon} size={16} color={colors.brand} />
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue} numberOfLines={1}>
        {value}
      </Text>
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
  summaryCard: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryRow: { flexDirection: "row", alignItems: "center", marginBottom: spacing.lg },
  summaryStat: { flex: 1, alignItems: "center" },
  summaryNum: { color: colors.brand, fontSize: 34, fontWeight: "900" },
  summaryStatLabel: { color: colors.onSurfaceSecondary, fontSize: font.sm, fontWeight: "800", letterSpacing: 1 },
  summaryDivider: { width: 1, height: 48, backgroundColor: colors.border },
  detailList: { gap: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.lg },
  detailRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  detailLabel: { color: colors.onSurfaceSecondary, fontSize: font.base, width: 84 },
  detailValue: { color: colors.onSurface, fontSize: font.base, fontWeight: "700", flex: 1 },
  listHeader: {
    color: colors.onSurfaceSecondary,
    fontSize: font.sm,
    fontWeight: "800",
    letterSpacing: 1,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  emptyText: { color: colors.onSurfaceSecondary, fontSize: font.base },
  doorSummary: { marginTop: spacing.sm },
  doorSummaryHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  doorSummaryCount: { color: colors.brand, fontSize: font.lg, fontWeight: "900", marginBottom: spacing.md },
  doorGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  doorChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  doorChipText: { color: colors.onSurfaceSecondary, fontSize: font.sm, fontWeight: "600" },
  doorChipDone: { color: colors.onSurface },
  entryRow: {
    flexDirection: "row",
    gap: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  entryRowNum: { color: colors.brand, fontWeight: "900", fontSize: font.lg, width: 20 },
  entryRowLoc: { color: colors.onSurface, fontSize: font.lg, fontWeight: "800" },
  entryRowAction: { color: colors.onSurfaceTertiary, fontSize: font.base, marginTop: 2 },
  entryRowMeta: { color: colors.onSurfaceSecondary, fontSize: font.sm, marginTop: spacing.sm },
  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", padding: spacing.xl },
  modalCard: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalTitle: { color: colors.onSurface, fontSize: font.xl, fontWeight: "800", marginBottom: spacing.sm },
  modalBody: { color: colors.onSurfaceSecondary, fontSize: font.base, lineHeight: 20 },
});
