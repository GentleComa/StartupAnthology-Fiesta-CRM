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
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import { api } from "@/lib/api";

const STATUSES = ["new", "contacted", "interested", "engaged", "converted"];
const STATUS_LABELS: Record<string, string> = { new: "New", contacted: "Contacted", interested: "Interested", engaged: "Engaged", converted: "Converted" };
const STATUS_COLORS: Record<string, string> = { new: Colors.statusNew, contacted: Colors.statusContacted, interested: Colors.statusInterested, engaged: Colors.statusEngaged, converted: Colors.statusConverted };

export default function LeadDetailScreen() {
  const { id } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [editNotes, setEditNotes] = useState("");

  const { data: lead, isLoading } = useQuery({
    queryKey: ["lead", id],
    queryFn: () => api.getLead(Number(id)),
  });
  const { data: activities = [] } = useQuery({
    queryKey: ["activities", "lead", id],
    queryFn: () => api.getActivities({ leadId: Number(id) }),
  });
  const { data: sequences = [] } = useQuery({ queryKey: ["sequences"], queryFn: api.getSequences });

  const updateMut = useMutation({
    mutationFn: (data: any) => api.updateLead(Number(id), data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["lead", id] }); qc.invalidateQueries({ queryKey: ["leads"] }); },
  });
  const statusMut = useMutation({
    mutationFn: (status: string) => api.updateLeadStatus(Number(id), status),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["lead", id] }); qc.invalidateQueries({ queryKey: ["leads"] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); },
  });
  const deleteMut = useMutation({
    mutationFn: () => api.deleteLead(Number(id)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["leads"] }); router.back(); },
  });
  const enrollMut = useMutation({
    mutationFn: (seqId: number) => api.enrollInSequence(seqId, { leadId: Number(id) }),
    onSuccess: () => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); },
  });
  const logLinkedInMut = useMutation({
    mutationFn: (data: any) => api.createActivity(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["activities", "lead", id] }); },
  });

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  if (isLoading || !lead) {
    return <View style={[styles.center, { paddingTop: topPad }]}><ActivityIndicator size="large" color={Colors.primary} /></View>;
  }

  return (
    <ScrollView style={[styles.container, { paddingTop: topPad }]} contentContainerStyle={styles.content}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={Colors.text} />
        </Pressable>
        <View style={{ flex: 1 }} />
        <Pressable onPress={() => { Alert.alert("Delete Lead", "Are you sure?", [{ text: "Cancel" }, { text: "Delete", style: "destructive", onPress: () => deleteMut.mutate() }]); }}>
          <Feather name="trash-2" size={20} color={Colors.error} />
        </Pressable>
      </View>

      <View style={styles.profileSection}>
        <View style={[styles.avatar, { backgroundColor: STATUS_COLORS[lead.status] }]}>
          <Text style={styles.avatarText}>{lead.name?.charAt(0)?.toUpperCase()}</Text>
        </View>
        <Text style={styles.name}>{lead.name}</Text>
        <Text style={styles.email}>{lead.email}</Text>
        <View style={styles.badgeRow}>
          <View style={[styles.statusBadge, { backgroundColor: (STATUS_COLORS[lead.status] || Colors.textSecondary) + "20" }]}>
            <Text style={[styles.statusText, { color: STATUS_COLORS[lead.status] }]}>{STATUS_LABELS[lead.status]}</Text>
          </View>
          {lead.isBeta && <View style={styles.betaBadge}><Text style={styles.betaText}>BETA</Text></View>}
          <Text style={styles.sourceLabel}>{lead.source}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Status</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statusRow}>
          {STATUSES.map((s) => (
            <Pressable
              key={s}
              style={[styles.statusChip, lead.status === s && { backgroundColor: STATUS_COLORS[s], borderColor: STATUS_COLORS[s] }]}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); statusMut.mutate(s); }}
            >
              <Text style={[styles.statusChipText, lead.status === s && { color: "#fff" }]}>{STATUS_LABELS[s]}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Beta Tag</Text>
          <Switch
            value={lead.isBeta}
            onValueChange={(v) => updateMut.mutate({ isBeta: v })}
            trackColor={{ true: Colors.accent }}
          />
        </View>
      </View>

      <View style={styles.actionRow}>
        <Pressable style={styles.actionBtn} onPress={() => lead.email && Linking.openURL(`mailto:${lead.email}`)}>
          <Feather name="mail" size={18} color={Colors.primary} />
          <Text style={styles.actionText}>Email</Text>
        </Pressable>
        <Pressable style={styles.actionBtn} onPress={() => router.push({ pathname: "/compose-email", params: { to: lead.email, name: lead.name, leadId: String(lead.id) } })}>
          <Feather name="send" size={18} color={Colors.info} />
          <Text style={styles.actionText}>Compose</Text>
        </Pressable>
        <Pressable style={styles.actionBtn} onPress={() => {
          logLinkedInMut.mutate({ leadId: Number(id), type: "linkedin", direction: "sent", note: "LinkedIn message sent" });
        }}>
          <Feather name="linkedin" size={18} color="#0A66C2" />
          <Text style={styles.actionText}>Log LI</Text>
        </Pressable>
      </View>

      {sequences.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Enroll in Sequence</Text>
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
          <Pressable onPress={() => { setEditing(!editing); if (editing) updateMut.mutate({ notes: editNotes }); else setEditNotes(lead.notes || ""); }}>
            <Text style={styles.editBtn}>{editing ? "Save" : "Edit"}</Text>
          </Pressable>
        </View>
        {editing ? (
          <TextInput style={styles.notesInput} value={editNotes} onChangeText={setEditNotes} multiline placeholder="Add notes..." placeholderTextColor={Colors.textTertiary} />
        ) : (
          <Text style={styles.notesText}>{lead.notes || "No notes yet"}</Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Activity</Text>
        {activities.length === 0 ? (
          <Text style={styles.emptyActivity}>No activity yet</Text>
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
  backBtn: { padding: 4 },
  profileSection: { alignItems: "center", marginBottom: 24 },
  avatar: { width: 64, height: 64, borderRadius: 32, justifyContent: "center", alignItems: "center", marginBottom: 12 },
  avatarText: { fontSize: 26, fontFamily: "Inter_700Bold", color: "#fff" },
  name: { fontSize: 22, fontFamily: "Inter_700Bold", color: Colors.text },
  email: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.textSecondary, marginTop: 2 },
  badgeRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 12, fontFamily: "Inter_600SemiBold", textTransform: "uppercase" },
  betaBadge: { backgroundColor: Colors.accent + "20", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  betaText: { fontSize: 11, fontFamily: "Inter_700Bold", color: Colors.accent },
  sourceLabel: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textTertiary, textTransform: "capitalize" },
  section: { marginBottom: 24 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: Colors.text, marginBottom: 8 },
  statusRow: { gap: 8 },
  statusChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  statusChipText: { fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.text },
  actionRow: { flexDirection: "row", gap: 12, marginBottom: 24 },
  actionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: Colors.surface, borderRadius: 12, paddingVertical: 12 },
  actionText: { fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.text },
  seqCard: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: Colors.surface, borderRadius: 12, padding: 12, marginBottom: 6 },
  seqName: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium", color: Colors.text },
  editBtn: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.info },
  notesInput: { backgroundColor: Colors.surface, borderRadius: 12, padding: 14, fontSize: 15, fontFamily: "Inter_400Regular", color: Colors.text, minHeight: 80, textAlignVertical: "top" },
  notesText: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.textSecondary, lineHeight: 22 },
  emptyActivity: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.textTertiary },
  activityItem: { flexDirection: "row", gap: 10, marginBottom: 12 },
  activityDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  activityContent: { flex: 1 },
  activityType: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.text, textTransform: "capitalize" },
  activityNote: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textSecondary, marginTop: 2 },
  activityDate: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textTertiary, marginTop: 2 },
});
