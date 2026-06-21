import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as Haptics from "expo-haptics";

import { colors, spacing, radius, font } from "@/src/lib/theme";
import { AppButton, Toast } from "@/src/components/ui";
import { getShift, saveShift, syncShift, uid } from "@/src/lib/store";
import { createVoiceController } from "@/src/lib/voice";

function timeLabel(d: Date): string {
  return d.toLocaleTimeString("en-AU", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

// Resize to max 1024px wide + JPEG compress, returning a small base64 data URI.
async function shrinkToBase64(uri: string): Promise<string | null> {
  try {
    const ctx = ImageManipulator.manipulate(uri);
    ctx.resize({ width: 1024 });
    const ref = await ctx.renderAsync();
    const out = await ref.saveAsync({
      compress: 0.4,
      format: SaveFormat.JPEG,
      base64: true,
    });
    return out.base64 ? `data:image/jpeg;base64,${out.base64}` : null;
  } catch {
    return null;
  }
}

export default function LogEntry() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [location, setLocation] = useState("");
  const [action, setAction] = useState("");
  const [lockedTime, setLockedTime] = useState<Date | null>(null);
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");

  const voiceRef = useRef<ReturnType<typeof createVoiceController> | null>(null);
  const baseTextRef = useRef("");

  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(""), 2400);
  };

  // Lock the timestamp the moment the guard starts recording the action.
  const onActionChange = (t: string) => {
    if (!lockedTime && t.length > 0) setLockedTime(new Date());
    setAction(t);
  };

  const captureGps = async () => {
    setGpsLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        flash("Location permission denied.");
        setGpsLoading(false);
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch {
      flash("Could not get GPS. Retry.");
    }
    setGpsLoading(false);
  };

  const attachPhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      // fall back to library if camera denied
      const lib = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (lib.status !== "granted") {
        flash("Camera permission denied.");
        return;
      }
      const r = await ImagePicker.launchImageLibraryAsync({
        quality: 1,
        mediaTypes: ["images"],
      });
      if (!r.canceled && r.assets[0]?.uri) await handlePicked(r.assets[0].uri);
      return;
    }
    const r = await ImagePicker.launchCameraAsync({ quality: 1 });
    if (!r.canceled && r.assets[0]?.uri) await handlePicked(r.assets[0].uri);
  };

  // Resize + compress before storing so a photo is small enough to save
  // reliably on-device (Android storage caps ~2MB per item; web localStorage ~5MB).
  const handlePicked = async (uri: string) => {
    const data = await shrinkToBase64(uri);
    if (!data) {
      flash("Couldn't process that photo. Please try again.");
      return;
    }
    setPhoto(data);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  const toggleVoice = () => {
    if (listening) {
      voiceRef.current?.stop();
      setListening(false);
      return;
    }
    baseTextRef.current = action ? action + " " : "";
    if (!lockedTime) setLockedTime(new Date());
    const controller = createVoiceController({
      onResult: (text) => setAction(baseTextRef.current + text),
      onError: (msg) => {
        flash(msg);
        setListening(false);
      },
      onEnd: () => setListening(false),
    });
    voiceRef.current = controller;
    controller.start();
    setListening(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  };

  useEffect(() => {
    return () => voiceRef.current?.stop();
  }, []);

  const save = async () => {
    if (!location.trim() || !action.trim()) {
      flash("Enter both location and action taken.");
      return;
    }
    setSaving(true);
    const shift = await getShift();
    if (!shift) {
      router.replace("/");
      return;
    }
    const t = lockedTime || new Date();
    const entry = {
      id: uid(),
      location: location.trim(),
      action: action.trim(),
      timestamp: t.toISOString(),
      time_label: timeLabel(t),
      latitude: gps?.lat ?? null,
      longitude: gps?.lng ?? null,
      photo,
    };
    const updated = { ...shift, entries: [...shift.entries, entry], synced: false };
    const ok = await saveShift(updated);
    if (!ok) {
      setSaving(false);
      flash("Couldn't save — phone storage is full. Submit the report, then start a fresh shift.");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    syncShift(updated);
    router.back();
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="back-button" onPress={() => router.back()} hitSlop={8} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>Log Patrol Entry</Text>
        <View style={{ width: 44 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 140 }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.timeCard}>
            <Ionicons name="time" size={18} color={colors.brand} />
            <Text style={styles.timeLabel}>TIMESTAMP</Text>
            <Text style={styles.timeValue} testID="timestamp-value">
              {lockedTime ? timeLabel(lockedTime) : "Locks on action entry"}
            </Text>
          </View>

          <Text style={styles.label}>LOCATION</Text>
          <TextInput
            testID="location-input"
            value={location}
            onChangeText={setLocation}
            placeholder="e.g. Villa 8, Safari Tent 3, Pool Area"
            placeholderTextColor={colors.onSurfaceSecondary}
            style={styles.input}
          />

          <Text style={styles.label}>ACTION TAKEN</Text>
          <View style={styles.actionWrap}>
            <TextInput
              testID="action-input"
              value={action}
              onChangeText={onActionChange}
              placeholder="e.g. Noise complaint resolved, security check completed"
              placeholderTextColor={colors.onSurfaceSecondary}
              style={styles.textarea}
              multiline
            />
            <Pressable
              testID="voice-button"
              onPress={toggleVoice}
              style={[styles.micBtn, listening && styles.micBtnActive]}
            >
              <Ionicons
                name={listening ? "stop" : "mic"}
                size={20}
                color={listening ? colors.onError : colors.onBrand}
              />
            </Pressable>
          </View>
          {listening && <Text style={styles.listeningText}>Listening… speak your report</Text>}

          <View style={styles.actionGrid}>
            <Pressable
              testID="gps-button"
              onPress={captureGps}
              style={[styles.gridBtn, gps && styles.gridBtnDone]}
            >
              <Ionicons
                name={gps ? "checkmark-circle" : "location"}
                size={22}
                color={gps ? colors.success : colors.brand}
              />
              <Text style={styles.gridBtnText}>
                {gpsLoading ? "Locating…" : gps ? "GPS Locked" : "Capture GPS"}
              </Text>
              {gps && (
                <Text style={styles.gpsCoords}>
                  {gps.lat.toFixed(4)}, {gps.lng.toFixed(4)}
                </Text>
              )}
            </Pressable>

            <Pressable
              testID="photo-button"
              onPress={attachPhoto}
              style={[styles.gridBtn, photo && styles.gridBtnDone]}
            >
              {photo ? (
                <Image source={{ uri: photo }} style={styles.photoThumb} contentFit="cover" />
              ) : (
                <>
                  <Ionicons name="camera" size={22} color={colors.brand} />
                  <Text style={styles.gridBtnText}>Attach Photo</Text>
                </>
              )}
            </Pressable>
          </View>
        </ScrollView>

        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + spacing.md }]}>
          <AppButton
            label="SAVE ENTRY"
            testID="save-entry-button"
            loading={saving}
            onPress={save}
            icon={<Ionicons name="save" size={18} color={colors.onBrand} />}
          />
        </View>
      </KeyboardAvoidingView>

      <Toast message={toast} visible={!!toast} />
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
  timeCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.brandTertiary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  timeLabel: { color: colors.brand, fontSize: font.sm, fontWeight: "800", letterSpacing: 1 },
  timeValue: { color: colors.onSurface, fontSize: font.lg, fontWeight: "800", marginLeft: "auto" },
  label: {
    color: colors.onSurfaceSecondary,
    fontSize: font.sm,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
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
  actionWrap: { position: "relative" },
  textarea: {
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.lg,
    paddingRight: 64,
    minHeight: 120,
    color: colors.onSurface,
    fontSize: font.lg,
    textAlignVertical: "top",
  },
  micBtn: {
    position: "absolute",
    right: spacing.md,
    bottom: spacing.md,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  micBtnActive: { backgroundColor: colors.error },
  listeningText: { color: colors.brand, fontSize: font.sm, marginTop: spacing.sm, fontWeight: "600" },
  actionGrid: { flexDirection: "row", gap: spacing.md, marginTop: spacing.xl },
  gridBtn: {
    flex: 1,
    minHeight: 96,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.md,
    gap: 6,
    overflow: "hidden",
  },
  gridBtnDone: { borderColor: colors.success },
  gridBtnText: { color: colors.onSurface, fontSize: font.base, fontWeight: "700" },
  gpsCoords: { color: colors.onSurfaceSecondary, fontSize: font.sm },
  photoThumb: { width: "100%", height: 96, borderRadius: radius.md },
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
