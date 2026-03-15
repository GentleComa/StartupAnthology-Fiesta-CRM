import { Feather } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Linking,
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

interface Activity {
  id: number;
  type: string;
  direction?: string;
  subject?: string;
  body?: string;
  note?: string;
  createdAt: string;
  gmailLink?: string;
}

interface ActivityDetailModalProps {
  visible: boolean;
  activity: Activity | null;
  onClose: () => void;
  onSave: (id: number, data: { type: string; subject?: string; body?: string; note?: string }) => void;
  isSaving: boolean;
}

const TYPE_OPTIONS = ["email", "linkedin", "note", "call", "meeting", "other"];

const TYPE_COLORS: Record<string, string> = {
  email: Colors.info,
  linkedin: "#0A66C2",
  note: Colors.accent,
  call: "#34C759",
  meeting: "#AF52DE",
  other: Colors.textTertiary,
};

export default function ActivityDetailModal({
  visible,
  activity,
  onClose,
  onSave,
  isSaving,
}: ActivityDetailModalProps) {
  const insets = useSafeAreaInsets();
  const [editing, setEditing] = useState(false);
  const [type, setType] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (activity) {
      setType(activity.type || "");
      setSubject(activity.subject || "");
      setBody(activity.body || "");
      setNote(activity.note || "");
      setEditing(false);
    }
  }, [activity]);

  const handleSave = () => {
    if (!activity) return;
    onSave(activity.id, {
      type: type || activity.type,
      subject: subject || undefined,
      body: body || undefined,
      note: note || undefined,
    });
  };

  const handleClose = () => {
    setEditing(false);
    onClose();
  };

  if (!activity) return null;

  const typeColor = TYPE_COLORS[activity.type] || Colors.textTertiary;
  const formattedDate = new Date(activity.createdAt).toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={[styles.container, { paddingTop: insets.top + 10 }]}>
        <View style={styles.header}>
          <Text style={styles.title}>Activity Detail</Text>
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
          <View style={styles.metaRow}>
            <View style={[styles.typeBadge, { backgroundColor: typeColor + "20" }]}>
              <Text style={[styles.typeBadgeText, { color: typeColor }]}>
                {activity.type}
                {activity.direction ? ` · ${activity.direction}` : ""}
              </Text>
            </View>
            <Text style={styles.date}>{formattedDate}</Text>
          </View>

          {editing ? (
            <View style={styles.form}>
              <Text style={styles.label}>Type</Text>
              <View style={styles.typeRow}>
                {TYPE_OPTIONS.map((t) => (
                  <Pressable
                    key={t}
                    style={[styles.typeChip, type === t && styles.typeChipActive]}
                    onPress={() => setType(t)}
                  >
                    <Text style={[styles.typeChipText, type === t && styles.typeChipTextActive]}>{t}</Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.label}>Subject</Text>
              <TextInput
                style={styles.input}
                value={subject}
                onChangeText={setSubject}
                placeholder="Subject line or topic"
                placeholderTextColor={Colors.textTertiary}
              />

              <Text style={styles.label}>Body / Content</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={body}
                onChangeText={setBody}
                placeholder="Full content of the activity"
                placeholderTextColor={Colors.textTertiary}
                multiline
                textAlignVertical="top"
              />

              <Text style={styles.label}>Notes</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={note}
                onChangeText={setNote}
                placeholder="Internal notes about this activity"
                placeholderTextColor={Colors.textTertiary}
                multiline
                textAlignVertical="top"
              />

              <View style={styles.formActions}>
                <Pressable style={styles.cancelBtn} onPress={() => {
                  setType(activity.type || "");
                  setSubject(activity.subject || "");
                  setBody(activity.body || "");
                  setNote(activity.note || "");
                  setEditing(false);
                }}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </Pressable>
                <Pressable style={[styles.saveBtn, isSaving && { opacity: 0.6 }]} onPress={handleSave} disabled={isSaving}>
                  <Feather name="check" size={16} color="#fff" />
                  <Text style={styles.saveBtnText}>{isSaving ? "Saving..." : "Save"}</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={styles.details}>
              {(activity.subject || subject) ? (
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Subject</Text>
                  <Text style={styles.detailValue}>{activity.subject || subject}</Text>
                </View>
              ) : null}

              {(activity.body || body) ? (
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Content</Text>
                  <Text style={styles.detailValue}>{activity.body || body}</Text>
                </View>
              ) : null}

              {(activity.note || note) ? (
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Notes</Text>
                  <Text style={styles.detailValue}>{activity.note || note}</Text>
                </View>
              ) : null}

              {!activity.subject && !activity.body && !activity.note && (
                <Text style={styles.empty}>No details recorded for this activity.</Text>
              )}

              {activity.gmailLink && (
                <Pressable style={styles.gmailBtn} onPress={() => Linking.openURL(activity.gmailLink!)}>
                  <Feather name="mail" size={16} color={Colors.info} />
                  <Text style={styles.gmailBtnText}>Open in Gmail</Text>
                </Pressable>
              )}
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
  title: { fontSize: 20, fontFamily: "Lato_700Bold", color: Colors.text },
  scroll: { flex: 1 },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  typeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  typeBadgeText: { fontSize: 13, fontFamily: "LeagueSpartan_600SemiBold", textTransform: "capitalize" },
  date: { fontSize: 12, fontFamily: "SpaceGrotesk_400Regular", color: Colors.textTertiary },
  details: { gap: 16 },
  detailSection: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
  },
  detailLabel: {
    fontSize: 11,
    fontFamily: "LeagueSpartan_600SemiBold",
    color: Colors.textTertiary,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  detailValue: {
    fontSize: 14,
    fontFamily: "SpaceGrotesk_400Regular",
    color: Colors.text,
    lineHeight: 20,
  },
  empty: { fontSize: 14, fontFamily: "SpaceGrotesk_400Regular", color: Colors.textTertiary, marginTop: 10 },
  gmailBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.info + "15",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 4,
  },
  gmailBtnText: { fontSize: 14, fontFamily: "LeagueSpartan_600SemiBold", color: Colors.info },
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
