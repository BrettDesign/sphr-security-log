import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { colors, spacing, radius, font } from "@/src/lib/theme";
import { AppButton, Toast } from "@/src/components/ui";
import { Manager } from "@/src/lib/api";
import { api } from "@/src/lib/api";
import { getShift, saveShift, uid, fetchManagers, Shift } from "@/src/lib/store";

function todayLabel(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export default function ShiftLogin() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [secNum, setSecNum] = useState("");
  const [name, setName] = useState("");
  const [date, setDate] = useState(todayLabel());
  const [managers, setManagers] = useState<Manager[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");
  const [modal, setModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [mName, setMName] = useState("");
  const [mMobile, setMMobile] = useState("");

  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(""), 2200);
  };

  const loadManagers = useCallback(async () => {
    const list = await fetchManagers();
    setManagers(list);
    if (list.length && !selected) setSelected(list[0].id);
    setLoading(false);
  }, [selected]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const existing = await getShift();
        if (existing && active) {
          router.replace("/dashboard");
          return;
        }
        loadManagers();
      })();
      return () => {
        active = false;
      };
    }, [loadManagers, router])
  );

  const openAddManager = () => {
    setEditingId(null);
    setMName("");
    setMMobile("");
    setModal(true);
  };

  const openEditManager = (m: Manager) => {
    setEditingId(m.id);
    setMName(m.name);
    setMMobile(m.mobile);
    setModal(true);
    Haptics.selectionAsync().catch(() => {});
  };

  const saveManager = async () => {
    if (!mName.trim() || !mMobile.trim()) {
      flash("Enter manager name and mobile.");
      return;
    }
    try {
      if (editingId) {
        const updated = await api.updateManager(editingId, mName.trim(), mMobile.trim());
        setManagers((prev) => prev.map((m) => (m.id === editingId ? updated : m)));
      } else {
        const created = await api.addManager(mName.trim(), mMobile.trim());
        setManagers((prev) => [...prev, created]);
        setSelected(created.id);
      }
      setModal(false);
      setEditingId(null);
      setMName("");
      setMMobile("");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch {
      flash(editingId ? "Could not update manager." : "Could not add manager. Check connection.");
    }
  };

  const startShift = async () => {
    if (!secNum.trim() || !name.trim() || !date.trim()) {
      flash("Fill in all guard details.");
      return;
    }
    const mgr = managers.find((m) => m.id === selected);
    const shift: Shift = {
      id: uid(),
      security_number: secNum.trim(),
      guard_name: name.trim(),
      shift_date: date.trim(),
      manager_name: mgr?.name ?? null,
      manager_mobile: mgr?.mobile ?? null,
      entries: [],
      submitted: false,
      started_at: new Date().toISOString(),
      synced: false,
    };
    await saveShift(shift);
    router.replace("/dashboard");
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 140 }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.brandRow}>
            <View style={styles.logoBox}>
              <Ionicons name="shield-checkmark" size={26} color={colors.onBrand} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.brandTitle}>SPHR SECURITY LOG</Text>
              <Text style={styles.brandSub}>Night Patrol · Shift Start</Text>
            </View>
            <Pressable
              testID="share-app-button"
              onPress={() => router.push("/share")}
              hitSlop={8}
              style={styles.shareBtn}
            >
              <Ionicons name="qr-code" size={22} color={colors.brand} />
            </Pressable>
          </View>

          <Text style={styles.sectionLabel}>GUARD DETAILS</Text>
          <Field
            label="Security Number"
            placeholder="e.g. SG-204"
            value={secNum}
            onChangeText={setSecNum}
            autoCapitalize="characters"
            testID="security-number-input"
          />
          <Field
            label="Guard Name"
            placeholder="e.g. John Smith"
            value={name}
            onChangeText={setName}
            testID="guard-name-input"
          />
          <Field
            label="Shift Date"
            placeholder="DD/MM/YYYY"
            value={date}
            onChangeText={setDate}
            testID="shift-date-input"
          />

          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionLabel}>MANAGER ON DIVERSION</Text>
            <Pressable
              onPress={openAddManager}
              testID="open-add-manager-button"
              style={styles.addLink}
              hitSlop={8}
            >
              <Ionicons name="add-circle" size={18} color={colors.brand} />
              <Text style={styles.addLinkText}>Add</Text>
            </Pressable>
          </View>

          {loading ? (
            <ActivityIndicator color={colors.brand} style={{ marginVertical: spacing.xl }} />
          ) : managers.length === 0 ? (
            <Text style={styles.emptyManagers}>
              No managers yet. Tap “Add” to create one.
            </Text>
          ) : (
            managers.map((m) => {
              const active = selected === m.id;
              return (
                <Pressable
                  key={m.id}
                  testID={`manager-card-${m.id}`}
                  onPress={() => {
                    setSelected(m.id);
                    Haptics.selectionAsync().catch(() => {});
                  }}
                  style={[styles.managerCard, active && styles.managerCardActive]}
                >
                  <View style={[styles.radio, active && styles.radioActive]}>
                    {active && <View style={styles.radioDot} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.managerName}>{m.name}</Text>
                    <Text style={styles.managerMobile}>{m.mobile}</Text>
                  </View>
                  <Pressable
                    testID={`edit-manager-${m.id}`}
                    onPress={() => openEditManager(m)}
                    hitSlop={10}
                    style={styles.editBtn}
                  >
                    <Ionicons name="create-outline" size={20} color={colors.brand} />
                  </Pressable>
                  <Ionicons
                    name="call"
                    size={18}
                    color={active ? colors.brand : colors.onSurfaceSecondary}
                  />
                </Pressable>
              );
            })
          )}
        </ScrollView>

        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + spacing.md }]}>
          <AppButton
            label="START SHIFT"
            testID="start-shift-button"
            onPress={startShift}
            icon={<Ionicons name="play" size={18} color={colors.onBrand} />}
          />
        </View>
      </KeyboardAvoidingView>

      <Modal visible={modal} transparent animationType="fade" onRequestClose={() => setModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{editingId ? "Edit Manager" : "Add Manager"}</Text>
            <Field
              label="Name"
              placeholder="e.g. Duty Manager"
              value={mName}
              onChangeText={setMName}
              testID="manager-name-input"
            />
            <Field
              label="Mobile"
              placeholder="e.g. 0400 000 000"
              value={mMobile}
              onChangeText={setMMobile}
              keyboardType="phone-pad"
              testID="manager-mobile-input"
            />
            <View style={{ flexDirection: "row", gap: spacing.md, marginTop: spacing.sm }}>
              <View style={{ flex: 1 }}>
                <AppButton
                  label="Cancel"
                  variant="secondary"
                  testID="cancel-manager-button"
                  onPress={() => setModal(false)}
                />
              </View>
              <View style={{ flex: 1 }}>
                <AppButton
                  label="Save"
                  testID="save-manager-button"
                  onPress={saveManager}
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>

      <Toast message={toast} visible={!!toast} />
    </View>
  );
}

function Field(props: any) {
  const { label, testID, ...rest } = props;
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        {...rest}
        testID={testID}
        placeholderTextColor={colors.onSurfaceSecondary}
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  logoBox: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  shareBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  brandTitle: { color: colors.onSurface, fontSize: font.xl, fontWeight: "900", letterSpacing: 0.5 },
  brandSub: { color: colors.brand, fontSize: font.sm, fontWeight: "700", marginTop: 2 },
  sectionLabel: {
    color: colors.onSurfaceSecondary,
    fontSize: font.sm,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.md,
  },
  addLink: { flexDirection: "row", alignItems: "center", gap: 4 },
  addLinkText: { color: colors.brand, fontWeight: "800", fontSize: font.base },
  editBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceTertiary,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.sm,
  },
  field: { marginBottom: spacing.md },
  fieldLabel: {
    color: colors.onSurfaceSecondary,
    fontSize: font.sm,
    fontWeight: "600",
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    height: 54,
    color: colors.onSurface,
    fontSize: font.lg,
  },
  emptyManagers: {
    color: colors.onSurfaceSecondary,
    fontSize: font.base,
    paddingVertical: spacing.lg,
  },
  managerCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  managerCardActive: { borderColor: colors.brand, backgroundColor: colors.surfaceTertiary },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  radioActive: { borderColor: colors.brand },
  radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.brand },
  managerName: { color: colors.onSurface, fontSize: font.lg, fontWeight: "700" },
  managerMobile: { color: colors.onSurfaceSecondary, fontSize: font.base, marginTop: 2 },
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    padding: spacing.xl,
  },
  modalCard: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalTitle: {
    color: colors.onSurface,
    fontSize: font.xl,
    fontWeight: "800",
    marginBottom: spacing.lg,
  },
});
