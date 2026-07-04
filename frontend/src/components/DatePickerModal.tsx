import React, { useMemo, useState } from "react";
import { View, Text, Pressable, Modal, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { colors, spacing, radius, font } from "@/src/lib/theme";
import { AppButton } from "@/src/components/ui";

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const p2 = (n: number) => String(n).padStart(2, "0");

export function toLabel(d: Date): string {
  return `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

// Parse "DD/MM/YYYY" -> Date (local midnight). Falls back to today when invalid.
export function fromLabel(label?: string | null): Date {
  const m = label ? /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(label.trim()) : null;
  if (m) {
    const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    if (!isNaN(d.getTime())) return d;
  }
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// Days to render for a month grid, Monday-first, padded with leading blanks.
function monthCells(year: number, month: number): (number | null)[] {
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7; // 0 = Monday
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

type Props = {
  visible: boolean;
  value?: string | null; // DD/MM/YYYY
  onCancel: () => void;
  onConfirm: (label: string) => void;
  maxDate?: Date; // optional upper bound (e.g. today)
};

export function DatePickerModal({ visible, value, onCancel, onConfirm, maxDate }: Props) {
  const initial = useMemo(() => fromLabel(value), [value]);
  const [selected, setSelected] = useState<Date>(initial);
  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth());

  // Re-sync when the modal is (re)opened for a new value.
  React.useEffect(() => {
    if (visible) {
      const d = fromLabel(value);
      setSelected(d);
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
    }
  }, [visible, value]);

  const today = useMemo(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), n.getDate());
  }, []);

  const cells = useMemo(() => monthCells(viewYear, viewMonth), [viewYear, viewMonth]);

  const goMonth = (delta: number) => {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setViewMonth(m);
    setViewYear(y);
    Haptics.selectionAsync().catch(() => {});
  };

  const pick = (day: number) => {
    const d = new Date(viewYear, viewMonth, day);
    if (maxDate && d.getTime() > maxDate.getTime()) return;
    setSelected(d);
    Haptics.selectionAsync().catch(() => {});
  };

  const isDisabled = (day: number) =>
    !!maxDate && new Date(viewYear, viewMonth, day).getTime() > maxDate.getTime();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Pressable onPress={() => goMonth(-1)} hitSlop={10} style={styles.navBtn} testID="cal-prev">
              <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
            </Pressable>
            <Text style={styles.headerText}>
              {MONTHS[viewMonth]} {viewYear}
            </Text>
            <Pressable onPress={() => goMonth(1)} hitSlop={10} style={styles.navBtn} testID="cal-next">
              <Ionicons name="chevron-forward" size={22} color={colors.onSurface} />
            </Pressable>
          </View>

          <View style={styles.weekRow}>
            {WEEKDAYS.map((w) => (
              <Text key={w} style={styles.weekday}>
                {w}
              </Text>
            ))}
          </View>

          <View style={styles.grid}>
            {cells.map((day, i) => {
              if (day === null) {
                return <View key={`b-${i}`} style={styles.cell} />;
              }
              const cellDate = new Date(viewYear, viewMonth, day);
              const active = sameDay(cellDate, selected);
              const isToday = sameDay(cellDate, today);
              const disabled = isDisabled(day);
              return (
                <Pressable
                  key={`d-${day}`}
                  testID={`cal-day-${day}`}
                  onPress={() => pick(day)}
                  disabled={disabled}
                  style={[styles.cell, active && styles.cellActive]}
                >
                  <Text
                    style={[
                      styles.cellText,
                      isToday && !active && styles.cellTextToday,
                      active && styles.cellTextActive,
                      disabled && styles.cellTextDisabled,
                    ]}
                  >
                    {day}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.footer}>
            <View style={{ flex: 1 }}>
              <AppButton label="Cancel" variant="secondary" testID="cal-cancel" onPress={onCancel} />
            </View>
            <View style={{ flex: 1 }}>
              <AppButton
                label="Select"
                testID="cal-confirm"
                onPress={() => {
                  onConfirm(toLabel(selected));
                  Haptics.selectionAsync().catch(() => {});
                }}
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    padding: spacing.xl,
  },
  card: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  headerText: { color: colors.onSurface, fontSize: font.lg, fontWeight: "800" },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  weekRow: { flexDirection: "row", marginBottom: spacing.xs },
  weekday: {
    flex: 1,
    textAlign: "center",
    color: colors.onSurfaceSecondary,
    fontSize: font.sm,
    fontWeight: "700",
  },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
  },
  cellActive: { backgroundColor: colors.brand },
  cellText: { color: colors.onSurface, fontSize: font.lg, fontWeight: "600" },
  cellTextToday: { color: colors.brand, fontWeight: "800" },
  cellTextActive: { color: colors.onBrand, fontWeight: "800" },
  cellTextDisabled: { color: colors.border },
  footer: { flexDirection: "row", gap: spacing.md, marginTop: spacing.lg },
});
