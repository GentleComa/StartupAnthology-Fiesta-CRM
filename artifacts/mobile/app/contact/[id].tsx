import { Feather } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import { api } from "@/lib/api";

const PRIORITY_COLORS: Record<string, string> = { high: Colors.priorityHigh, medium: Colors.priorityMedium, low: Colors.priorityLow };
const REL_COLORS: Record<string, string> = { investor: "#6366F1", partner: "#3B82F6", advisor: "#10B981", vendor: "#F59E0B", press: "#EF4444", other: "#6B7280" };

export default function ContactDetailScreen() {
  const { id } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [editNotes, setEditNotes] = useState("");

  const { data: contact, isLoading } = useQuery({
    queryKey: ["contact", id],
    queryFn: () => api.getContact(Number(id)),
  });
  const { data: activities = [] } = useQuery({
    queryKey: ["activities", "contact", id],
    queryFn: () => api.getActivities({ contactId: Number(id) }),
  });
  const { data: sequences = [] } = useQuery({ queryKey: ["sequences"], queryFn: api.getSequences });

  const updateMut = useMutation({
    mutationFn: (data: any) => api.updateContact(Number(id), data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["contact", id] }); qc.invalidateQueries({ queryKey: ["contacts"] }); },
  });
  const markMut = useMutation({
    mutationFn: () => api.markContacted(Number(id)),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      qc.invalidateQueries({ queryKey: ["contact", id] });
      qc.invalidateQueries({ queryKey: ["contacts"] });
      qc.invalidateQueries({ queryKey: ["followUps"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
  const deleteMut = useMutation({
    mutationFn: () => api.deleteContact(Number(id)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["contacts"] }); router.back(); },
  });
  const enrollMut = useMutation({
    mutationFn: (seqId: number) => api.enrollInSequence(seqId, { contactId: Number(id) }),
    onSuccess: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  });
  const logLinkedInMut = useMutation({
    mutationFn: (data: any) => api.createActivity(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["activities", "contact", id] }),
  });

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  if (isLoading || !contact) {
    return <View style={[styles.center, { paddingTop: topPad }]}><ActivityIndicator size="large" color={Colors.primary} /></View>;
  }

  const relColor = REL_COLORS[contact.relationshipType] || Colors.primary;

  return (
    <ScrollView style={[styles.container, { paddingTop: topPad }]} contentContainerStyle={styles.content}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={Colors.text} />
        </Pressable>
        <View style={{ flex: 1 }} />
        <Pressable style={styles.deleteBtn} onPress={() => Alert.alert("Delete this contact?", "This can't be undone.", [{ text: "Keep", style: "cancel" }, { text: "Delete", style: "destructive", onPress: () => deleteMut.mutate() }])}>
          <Feather name="trash-2" size={20} color={Colors.error} />
        </Pressable>
      </View>

      <View style={styles.profileSection}>
        <View style={[styles.avatar, { backgroundColor: relColor }]}>
          <Text style={styles.avatarText}>{contact.name?.charAt(0)?.toUpperCase()}</Text>
        </View>
        <Text style={styles.name}>{contact.name}</Text>
        {contact.title && <Text style={styles.subtitle}>{contact.title}{contact.company ? ` at ${contact.company}` : ""}</Text>}
        <View style={styles.badgeRow}>
          <View style={[styles.relBadge, { backgroundColor: relColor + "15" }]}>
            <Text style={[styles.relText, { color: relColor }]}>{contact.relationshipType}</Text>
          </View>
          <View style={[styles.priorityBadge, { backgroundColor: PRIORITY_COLORS[contact.priority] + "15" }]}>
            <View style={[styles.priorityDot, { backgroundColor: PRIORITY_COLORS[contact.priority] }]} />
            <Text style={[styles.priorityText, { color: PRIORITY_COLORS[contact.priority] }]}>{contact.priority}</Text>
          </View>
        </View>
      </View>

      <View style={styles.actionRow}>
        {contact.phone && (
          <Pressable style={styles.actionBtn} onPress={() => Linking.openURL(`tel:${contact.phone}`)}>
            <Feather name="phone" size={18} color={Colors.success} />
            <Text style={styles.actionText}>Call</Text>
          </Pressable>
        )}
        {contact.email && (
          <Pressable style={styles.actionBtn} onPress={() => router.push({ pathname: "/compose-email", params: { to: contact.email, name: contact.name, contactId: String(contact.id) } })}>
            <Feather name="send" size={18} color={Colors.info} />
            <Text style={styles.actionText}>Email</Text>
          </Pressable>
        )}
        {contact.linkedinUrl && (
          <Pressable style={styles.actionBtn} onPress={() => Linking.openURL(contact.linkedinUrl!)}>
            <Feather name="linkedin" size={18} color="#0A66C2" />
            <Text style={styles.actionText}>LinkedIn</Text>
          </Pressable>
        )}
        <Pressable style={styles.actionBtn} onPress={() => markMut.mutate()}>
          <Feather name="check-circle" size={18} color={Colors.success} />
          <Text style={styles.actionText}>Contacted</Text>
        </Pressable>
      </View>

      <View style={styles.infoSection}>
        {contact.email && <View style={styles.infoRow}><Feather name="mail" size={16} color={Colors.textTertiary} /><Text style={styles.infoText}>{contact.email}</Text></View>}
        {contact.phone && <View style={styles.infoRow}><Feather name="phone" size={16} color={Colors.textTertiary} /><Text style={styles.infoText}>{contact.phone}</Text></View>}
        {contact.linkedinUrl && <View style={styles.infoRow}><Feather name="link" size={16} color={Colors.textTertiary} /><Text style={styles.infoText} numberOfLines={1}>{contact.linkedinUrl}</Text></View>}
        {contact.lastContactedAt && <View style={styles.infoRow}><Feather name="clock" size={16} color={Colors.textTertiary} /><Text style={styles.infoText}>Last contacted: {new Date(contact.lastContactedAt).toLocaleDateString()}</Text></View>}
        {contact.nextFollowUpAt && <View style={styles.infoRow}><Feather name="calendar" size={16} color={Colors.warning} /><Text style={[styles.infoText, { color: Colors.warning }]}>Follow-up: {new Date(contact.nextFollowUpAt).toLocaleDateString()}</Text></View>}
      </View>

      <View style={styles.quickActions}>
        <Pressable style={styles.quickBtn} onPress={() => {
          logLinkedInMut.mutate({ contactId: Number(id), type: "linkedin", direction: "sent", note: "LinkedIn message sent" });
        }}>
          <Feather name="message-circle" size={16} color="#0A66C2" />
          <Text style={styles.quickText}>Log LinkedIn Message</Text>
        </Pressable>
      </View>

      {sequences.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Add to Sequence</Text>
          {sequences.map((seq: any) => (
            <Pressable key={seq.id} style={styles.seqCard} onPress={() => enrollMut.mutate(seq.id)}>
              <Feather name="repeat" size={16} color={Colors.info} />
              <Text style={styles.seqName}>{seq.name}</Text>
              <Feather name="plus" size={16} color={Colors.textTertiary} />
            </Pressable>
          ))}
        </View>
      )}

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Notes</Text>
          <Pressable onPress={() => { setEditing(!editing); if (editing) updateMut.mutate({ notes: editNotes }); else setEditNotes(contact.notes || ""); }}>
            <Text style={styles.editBtn}>{editing ? "Save" : "Edit"}</Text>
          </Pressable>
        </View>
        {editing ? (
          <TextInput style={styles.notesInput} value={editNotes} onChangeText={setEditNotes} multiline placeholder="Add notes..." placeholderTextColor={Colors.textTertiary} />
        ) : (
          <Text style={styles.notesText}>{contact.notes || "Nothing here yet."}</Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Activity</Text>
        {activities.length === 0 ? (
          <Text style={styles.emptyActivity}>No activity logged yet.</Text>
        ) : (
          activities.map((a: any) => (
            <View key={a.id} style={styles.activityItem}>
              <View style={[styles.activityDot, { backgroundColor: a.type === "email" ? Colors.info : a.type === "linkedin" ? "#0A66C2" : Colors.textTertiary }]} />
              <View style={styles.activityContent}>
                <Text style={styles.activityType}>{a.type}{a.direction ? ` (${a.direction})` : ""}</Text>
                <Text style={styles.activityNote} numberOfLines={2}>{a.subject || a.note || ""}</Text>
                <Text style={styles.activityDate}>{new Date(a.createdAt).toLocaleDateString()}</Text>
              </View>
            </View>
          ))
        )}
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: Colors.background },
  topBar: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  backBtn: { padding: 10, marginLeft: -10 },
  deleteBtn: { padding: 10, marginRight: -10 },
  profileSection: { alignItems: "center", marginBottom: 20 },
  avatar: { width: 64, height: 64, borderRadius: 32, justifyContent: "center", alignItems: "center", marginBottom: 12 },
  avatarText: { fontSize: 26, fontFamily: "Lato_700Bold", color: "#fff" },
  name: { fontSize: 22, fontFamily: "Lato_700Bold", color: Colors.text },
  subtitle: { fontSize: 14, fontFamily: "SpaceGrotesk_400Regular", color: Colors.textSecondary, marginTop: 2 },
  badgeRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 },
  relBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  relText: { fontSize: 12, fontFamily: "LeagueSpartan_600SemiBold", textTransform: "capitalize" },
  priorityBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  priorityDot: { width: 6, height: 6, borderRadius: 3 },
  priorityText: { fontSize: 12, fontFamily: "LeagueSpartan_600SemiBold", textTransform: "capitalize" },
  actionRow: { flexDirection: "row", gap: 8, marginBottom: 20, flexWrap: "wrap" },
  actionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: Colors.surface, borderRadius: 12, paddingVertical: 12, minWidth: 80 },
  actionText: { fontSize: 12, fontFamily: "SpaceGrotesk_500Medium", color: Colors.text },
  infoSection: { backgroundColor: Colors.surface, borderRadius: 14, padding: 14, marginBottom: 20, gap: 10 },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  infoText: { fontSize: 14, fontFamily: "SpaceGrotesk_400Regular", color: Colors.textSecondary, flex: 1 },
  quickActions: { marginBottom: 20 },
  quickBtn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.surface, borderRadius: 12, padding: 14 },
  quickText: { fontSize: 14, fontFamily: "SpaceGrotesk_500Medium", color: Colors.text },
  section: { marginBottom: 24 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionTitle: { fontSize: 16, fontFamily: "LeagueSpartan_600SemiBold", color: Colors.text, marginBottom: 8 },
  seqCard: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: Colors.surface, borderRadius: 12, padding: 12, marginBottom: 6 },
  seqName: { flex: 1, fontSize: 14, fontFamily: "SpaceGrotesk_500Medium", color: Colors.text },
  editBtn: { fontSize: 14, fontFamily: "LeagueSpartan_600SemiBold", color: Colors.info },
  notesInput: { backgroundColor: Colors.surface, borderRadius: 12, padding: 14, fontSize: 15, fontFamily: "SpaceGrotesk_400Regular", color: Colors.text, minHeight: 80, textAlignVertical: "top" },
  notesText: { fontSize: 14, fontFamily: "SpaceGrotesk_400Regular", color: Colors.textSecondary, lineHeight: 22 },
  emptyActivity: { fontSize: 14, fontFamily: "SpaceGrotesk_400Regular", color: Colors.textTertiary },
  activityItem: { flexDirection: "row", gap: 10, marginBottom: 12 },
  activityDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  activityContent: { flex: 1 },
  activityType: { fontSize: 13, fontFamily: "LeagueSpartan_600SemiBold", color: Colors.text, textTransform: "capitalize" },
  activityNote: { fontSize: 13, fontFamily: "SpaceGrotesk_400Regular", color: Colors.textSecondary, marginTop: 2 },
  activityDate: { fontSize: 12, fontFamily: "SpaceGrotesk_400Regular", color: Colors.textTertiary, marginTop: 2 },
});
