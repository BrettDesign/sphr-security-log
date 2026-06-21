import React from "react";
import {
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  View,
  Animated,
} from "react-native";
import * as Haptics from "expo-haptics";
import { colors, spacing, radius, font } from "@/src/lib/theme";

type BtnProps = {
  label: string;
  onPress: () => void;
  testID?: string;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  variant?: "primary" | "secondary";
};

export function AppButton({
  label,
  onPress,
  testID,
  loading,
  disabled,
  icon,
  variant = "primary",
}: BtnProps) {
  const isPrimary = variant === "primary";
  const handle = () => {
    if (disabled || loading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onPress();
  };
  return (
    <Pressable
      testID={testID}
      onPress={handle}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        isPrimary ? styles.btnPrimary : styles.btnSecondary,
        (disabled || loading) && styles.btnDisabled,
        pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? colors.onBrand : colors.brand} />
      ) : (
        <View style={styles.btnInner}>
          {icon}
          <Text
            style={[
              styles.btnText,
              { color: isPrimary ? colors.onBrand : colors.brand },
            ]}
          >
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

export function Toast({
  message,
  visible,
}: {
  message: string;
  visible: boolean;
}) {
  const opacity = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    Animated.timing(opacity, {
      toValue: visible ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [visible, opacity]);
  if (!message) return null;
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.toast, { opacity }]}
      testID="app-toast"
    >
      <Text style={styles.toastText}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  btn: {
    height: 56,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  btnPrimary: { backgroundColor: colors.brand },
  btnSecondary: {
    backgroundColor: colors.surfaceTertiary,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  btnDisabled: { opacity: 0.45 },
  btnInner: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  btnText: { fontSize: font.lg, fontWeight: "800", letterSpacing: 0.3 },
  toast: {
    position: "absolute",
    bottom: 96,
    left: spacing.lg,
    right: spacing.lg,
    backgroundColor: colors.surfaceInverse,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    alignItems: "center",
  },
  toastText: { color: colors.onSurfaceInverse, fontWeight: "700", fontSize: font.base },
});
