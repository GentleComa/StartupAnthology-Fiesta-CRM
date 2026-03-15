import { Feather } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";

interface CalendarEvent {
  id: number;
  title: string;
  description?: string;
  eventType: string;
  startTime: string;
  endTime: string;
  leadName?: string;
  contactName?: string;
  createdAt: string;
}

interface EventDetailModalProps {
  visible: boolean;
  event: CalendarEvent | null;
  onClose: () => void;
  onSave: (id: number, data: { title: string; description?: string; eventType: string; startTime: string; endTime: string }) => void;
  isSaving: boolean;
}

const EVENT_TYPES = ["meeting", "call", "follow-up", "demo", "other"];

const EVENT_COLORS: Record<string, string> = {
  meeting: "#AF52DE",
  call: "#34C759",
  "follow-up": Colors.accent,
  demo: Colors.info,
  other: Colors.textTertiary,
};

function toLocalInputStr(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInputStr(str: string): Date | null {
  const m = str.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
  return isNaN(d.getTime()) ? null : d;
}

export default function EventDetailModal({
  visible,
  event,
  onClose,
  onSave,
  isSaving,
}: EventDetailModalProps) {
  const insets = useSafeAreaInsets();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventType, setEventType] = useState("other");
  const [startStr, setStartStr] = useState("");
  const [endStr, setEndStr] = useState("");

  useEffect(() => {
    if (event) {
      setTitle(event.title || "");
      setDescription(event.description || "");
      setEventType(event.eventType || "other");
      setStartStr(toLocalInputStr(event.startTime));
      setEndStr(toLocalInputStr(event.endTime));
      setEditing(false);
    }
  }, [event]);

  const handleSave = () => {
    if (!event) return;
    const s = fromLocalInputStr(startStr);
    const e = fromLocalInputStr(endStr);
    if (!s || !e) return;
    onSave(event.id, {
      title,
      description: description || undefined,
      eventType,
      startTime: s.toISOString(),
      endTime: e.toISOString(),
    });
  };

  const handleClose = () => {
    setEditing(false);
    onClose();
  };

  const resetForm = () => {
    if (!event) return;
    setTitle(event.title || "");
    setDescription(event.description || "");
    setEventType(event.eventType || "other");
    setStartStr(toLocalInputStr(event.startTime));
    setEndStr(toLocalInputStr(event.endTime));
    setEditing(false);
  };

  if (!event) return null;

  const typeColor = EVENT_COLORS[event.eventType] || Colors.textTertiary;
  const startValid = fromLocalInputStr(startStr) !== null;
  const endValid = fromLocalInputStr(endStr) !== null;
  const canSave = title.trim() && startValid && endValid && !isSaving;

  const formatDateTime = (dateStr: string) =>
    new Date(dateStr).toLocaleString([], {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

  const duration = () => {
    const ms = new Date(event.endTime).getTime() - new Date(event.startTime).getTime();
    const mins = Math.round(ms / 60000);
    if (mins < 60) return `${mins} min`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={[styles.container, { paddingTop: insets.top + 10 }]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Event Detail</Text>
          <View style={styles.headerActions}>
            {!editing && (
              <Pressable onPress={() => setEditing(true)} hitSlop={10}>
                <Feather name="edit-2" size={20} color={Colors.text} />
              </Pressable>
            )}
            <Pressable onPress={handleClose} hitSlop={10}>
              <Feather name="x" size={24} color={Colors.text} />
            </Pressable>
          </View>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          {editing ? (
            <View style={styles.form}>
              <Text style={styles.label}>Title</Text>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder="Event title"
                placeholderTextColor={Colors.textTertiary}
              />

              <Text style={styles.label}>Type</Text>
              <View style={styles.typeRow}>
                {EVENT_TYPES.map((t) => (
                  <Pressable
                    key={t}
                    style={[styles.typeChip, eventType === t && styles.typeChipActive]}
                    onPress={() => setEventType(t)}
                  >
                    <Text style={[styles.typeChipText, eventType === t && styles.typeChipTextActive]}>{t}</Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.label}>Start Time</Text>
              <TextInput
                style={[styles.input, !startValid && startStr.length > 0 && styles.inputError]}
                value={startStr}
                onChangeText={setStartStr}
                placeholder="YYYY-MM-DD HH:MM"
                placeholderTextColor={Colors.textTertiary}
              />

              <Text style={styles.label}>End Time</Text>
              <TextInput
                style={[styles.input, !endValid && endStr.length > 0 && styles.inputError]}
                value={endStr}
                onChangeText={setEndStr}
                placeholder="YYYY-MM-DD HH:MM"
                placeholderTextColor={Colors.textTertiary}
              />

              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={description}
                onChangeText={setDescription}
                placeholder="Event description or agenda"
                placeholderTextColor={Colors.textTertiary}
                multiline
                textAlignVertical="top"
              />

              <View style={styles.formActions}>
                <Pressable style={styles.cancelBtn} onPress={resetForm}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[styles.saveBtn, !canSave && { opacity: 0.6 }]}
                  onPress={handleSave}
                  disabled={!canSave}
                >
                  <Feather name="check" size={16} color="#fff" />
                  <Text style={styles.saveBtnText}>{isSaving ? "Saving..." : "Save"}</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={styles.details}>
              <View style={styles.titleRow}>
                <View style={[styles.typeBadge, { backgroundColor: typeColor + "20" }]}>
                  <Text style={[styles.typeBadgeText, { color: typeColor }]}>{event.eventType}</Text>
                </View>
              </View>

              <Text style={styles.eventTitle}>{event.title}</Text>

              <View style={styles.timeCard}>
                <View style={styles.timeRow}>
                  <Feather name="clock" size={16} color={Colors.accent} />
                  <View>
                    <Text style={styles.timeLabel}>Start</Text>
                    <Text style={styles.timeValue}>{formatDateTime(event.startTime)}</Text>
                  </View>
                </View>
                <View style={styles.timeDivider} />
                <View style={styles.timeRow}>
                  <Feather name="clock" size={16} color={Colors.textTertiary} />
                  <View>
                    <Text style={styles.timeLabel}>End</Text>
                    <Text style={styles.timeValue}>{formatDateTime(event.endTime)}</Text>
                  </View>
                </View>
                <View style={styles.durationBadge}>
                  <Text style={styles.durationText}>{duration()}</Text>
                </View>
              </View>

              {(event.leadName || event.contactName) && (
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Linked To</Text>
                  {event.leadName && (
                    <View style={styles.linkRow}>
                      <Feather name="target" size={14} color={Colors.accent} />
                      <Text style={styles.linkText}>{event.leadName}</Text>
                    </View>
                  )}
                  {event.contactName && (
                    <View style={styles.linkRow}>
                      <Feather name="user" size={14} color={Colors.info} />
                      <Text style={styles.linkText}>{event.contactName}</Text>
                    </View>
                  )}
                </View>
              )}

              {event.description ? (
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Description</Text>
                  <Text style={styles.detailValue}>{event.description}</Text>
                </View>
              ) : null}
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: 20 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 16 },
  headerTitle: { fontSize: 20, fontFamily: "Lato_700Bold", color: Colors.text },
  scroll: { flex: 1 },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  typeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  typeBadgeText: { fontSize: 13, fontFamily: "LeagueSpartan_600SemiBold", textTransform: "capitalize" },
  eventTitle: { fontSize: 22, fontFamily: "Lato_700Bold", color: Colors.text, marginBottom: 20 },
  timeCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  timeRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  timeLabel: { fontSize: 11, fontFamily: "LeagueSpartan_600SemiBold", color: Colors.textTertiary, textTransform: "uppercase" },
  timeValue: { fontSize: 14, fontFamily: "SpaceGrotesk_400Regular", color: Colors.text },
  timeDivider: { height: 1, backgroundColor: Colors.border, marginVertical: 12 },
  durationBadge: {
    alignSelf: "flex-start",
    backgroundColor: Colors.accent + "20",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 10,
  },
  durationText: { fontSize: 12, fontFamily: "LeagueSpartan_600SemiBold", color: Colors.accent },
  details: { gap: 0 },
  detailSection: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 11,
    fontFamily: "LeagueSpartan_600SemiBold",
    color: Colors.textTertiary,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  detailValue: {
    fontSize: 14,
    fontFamily: "SpaceGrotesk_400Regular",
    color: Colors.text,
    lineHeight: 20,
  },
  linkRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  linkText: { fontSize: 14, fontFamily: "SpaceGrotesk_400Regular", color: Colors.text },
  form: { gap: 12 },
  label: {
    fontSize: 12,
    fontFamily: "LeagueSpartan_600SemiBold",
    color: Colors.textSecondary,
    textTransform: "uppercase",
    marginTop: 4,
  },
  typeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  typeChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Colors.surface,
  },
  typeChipActive: { backgroundColor: Colors.primary },
  typeChipText: { fontSize: 13, fontFamily: "SpaceGrotesk_400Regular", color: Colors.textSecondary, textTransform: "capitalize" },
  typeChipTextActive: { color: "#fff" },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    fontFamily: "SpaceGrotesk_400Regular",
    color: Colors.text,
  },
  inputError: { borderWidth: 1, borderColor: Colors.error },
  textArea: { minHeight: 100 },
  formActions: { flexDirection: "row", gap: 12, marginTop: 8 },
  cancelBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: Colors.surface,
  },
  cancelBtnText: { fontSize: 14, fontFamily: "LeagueSpartan_600SemiBold", color: Colors.textSecondary },
  saveBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: Colors.primary,
  },
  saveBtnText: { fontSize: 14, fontFamily: "LeagueSpartan_600SemiBold", color: "#fff" },
});
