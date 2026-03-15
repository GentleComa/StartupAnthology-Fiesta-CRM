import { Feather } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as DocumentPicker from "expo-document-picker";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
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
import Layout from "@/constants/layout";
import { api } from "@/lib/api";

const STATUSES = ["new", "contacted", "interested", "engaged", "converted"];
const STATUS_LABELS: Record<string, string> = { new: "New", contacted: "Contacted", interested: "Interested", engaged: "Engaged", converted: "Converted" };
const STATUS_COLORS: Record<string, string> = { new: Colors.statusNew, contacted: Colors.statusContacted, interested: Colors.statusInterested, engaged: Colors.statusEngaged, converted: Colors.statusConverted };

const ACTION_LABELS: Record<string, string> = { create: "Created", update: "Updated", delete: "Deleted", rollback: "Rolled back" };
const ACTION_COLORS: Record<string, string> = { create: Colors.success, update: Colors.info, delete: Colors.error, rollback: Colors.warning };

export default function LeadDetailScreen() {
  const { id } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [editNotes, setEditNotes] = useState("");
  const [historyVisible, setHistoryVisible] = useState(false);
  const [selectedRevision, setSelectedRevision] = useState<any>(null);
  const [editingFields, setEditingFields] = useState(false);
  const [editFields, setEditFields] = useState<Record<string, string>>({});
  const [showLinkedInModal, setShowLinkedInModal] = useState(false);
  const [liSubject, setLiSubject] = useState("");
  const [liMessage, setLiMessage] = useState("");
  const [showPicModal, setShowPicModal] = useState(false);
  const [picUrl, setPicUrl] = useState("");

  const { data: lead, isLoading } = useQuery({
    queryKey: ["lead", id],
    queryFn: () => api.getLead(Number(id)),
  });
  const { data: activities = [] } = useQuery({
    queryKey: ["activities", "lead", id],
    queryFn: () => api.getActivities({ leadId: Number(id) }),
  });
  const { data: calendarEvents = [] } = useQuery({
    queryKey: ["calendarEvents", "lead", id],
    queryFn: () => api.getCalendarEvents({ leadId: Number(id) }),
  });
  const { data: sequences = [] } = useQuery({ queryKey: ["sequences"], queryFn: api.getSequences });
  const { data: history = [], refetch: refetchHistory } = useQuery({
    queryKey: ["history", "lead", id],
    queryFn: () => api.getHistory("lead", Number(id)),
    enabled: historyVisible,
  });
  const { data: leadFiles = [] } = useQuery({
    queryKey: ["leadFiles", id],
    queryFn: () => api.getLeadFiles(Number(id)),
  });

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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["activities", "lead", id] }); setShowLinkedInModal(false); setLiSubject(""); setLiMessage(""); },
  });
  const uploadFileMut = useMutation({
    mutationFn: async () => {
      const result = await DocumentPicker.getDocumentAsync({ type: "*/*", copyToCacheDirectory: true });
      if (result.canceled) throw new Error("CANCELLED");
      const asset = result.assets[0];
      return api.uploadLeadFile(Number(id), asset.uri, asset.name, asset.mimeType || "application/octet-stream");
    },
    onSuccess: () => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); qc.invalidateQueries({ queryKey: ["leadFiles", id] }); },
    onError: (err: any) => { if (err.message !== "CANCELLED") Alert.alert("Upload failed", err.message); },
  });
  const rollbackMut = useMutation({
    mutationFn: (revisionId: number) => api.rollback("lead", Number(id), revisionId),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      qc.invalidateQueries({ queryKey: ["lead", id] });
      qc.invalidateQueries({ queryKey: ["leads"] });
      refetchHistory();
      setSelectedRevision(null);
    },
    onError: (err: Error) => Alert.alert("Rollback failed", err.message),
  });

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  if (isLoading || !lead) {
    return <View style={[styles.center, { paddingTop: topPad }]}><ActivityIndicator size="large" color={Colors.primary} /></View>;
  }

  const saveNotes = () => {
    const oldNotes = lead.notes || "";
    updateMut.mutate({ notes: editNotes });
    if (editNotes && editNotes !== oldNotes) {
      api.createActivity({
        leadId: Number(id),
        type: "note",
        note: editNotes,
      }).then(() => qc.invalidateQueries({ queryKey: ["activities", "lead", id] }));
    }
    setEditing(false);
  };

  const saveFields = () => {
    const updates: Record<string, any> = {};
    if (editFields.name !== lead.name) updates.name = editFields.name;
    if (editFields.email !== lead.email) updates.email = editFields.email;
    if ((editFields.source || "") !== (lead.source || "")) updates.source = editFields.source;
    if ((editFields.linkedinUrl || "") !== (lead.linkedinUrl || "")) updates.linkedinUrl = editFields.linkedinUrl;
    if (Object.keys(updates).length > 0) updateMut.mutate(updates);
    setEditingFields(false);
  };

  const startEditFields = () => {
    setEditFields({
      name: lead.name || "",
      email: lead.email || "",
      source: lead.source || "",
      linkedinUrl: lead.linkedinUrl || "",
    });
    setEditingFields(true);
  };

  const handleProfilePicUpload = async () => {
    setShowPicModal(false);
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
    if (result.canceled) return;
    const asset = result.assets[0];
    try {
      const uploaded = await api.uploadFile(asset.uri, "profile.jpg", asset.mimeType || "image/jpeg");
      updateMut.mutate({ profilePictureUrl: uploaded.storageKey });
    } catch (err: any) {
      Alert.alert("Upload failed", err.message);
    }
  };

  const handleProfilePicUrl = () => {
    setShowPicModal(false);
    if (picUrl.trim()) {
      updateMut.mutate({ profilePictureUrl: picUrl.trim() });
      setPicUrl("");
    }
  };

  const hasProfilePic = !!lead.profilePictureUrl;

  return (
    <ScrollView style={[styles.container, { paddingTop: topPad }]} contentContainerStyle={styles.content}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={Colors.text} />
        </Pressable>
        <View style={{ flex: 1 }} />
        <Pressable style={styles.historyBtn} onPress={() => setHistoryVisible(true)}>
          <Feather name="clock" size={20} color={Colors.info} />
        </Pressable>
        <Pressable style={styles.deleteBtn} onPress={() => { Alert.alert("Delete this lead?", "This can't be undone.", [{ text: "Keep", style: "cancel" }, { text: "Delete", style: "destructive", onPress: () => deleteMut.mutate() }]); }}>
          <Feather name="trash-2" size={20} color={Colors.error} />
        </Pressable>
      </View>

      <View style={styles.profileSection}>
        <Pressable onPress={() => setShowPicModal(true)}>
          {hasProfilePic ? (
            <Image source={{ uri: lead.profilePictureUrl }} style={styles.avatarImage} />
          ) : (
            <View style={[styles.avatar, { backgroundColor: STATUS_COLORS[lead.status] }]}>
              <Text style={styles.avatarText}>{lead.name?.charAt(0)?.toUpperCase()}</Text>
            </View>
          )}
          <View style={styles.cameraIcon}>
            <Feather name="camera" size={12} color="#fff" />
          </View>
        </Pressable>
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
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Details</Text>
          <Pressable onPress={() => editingFields ? saveFields() : startEditFields()}>
            <Text style={styles.editBtn}>{editingFields ? "Save" : "Edit"}</Text>
          </Pressable>
        </View>
        {editingFields ? (
          <View style={styles.editFieldsContainer}>
            {[
              { label: "Name", key: "name" },
              { label: "Email", key: "email" },
              { label: "Source", key: "source" },
              { label: "LinkedIn", key: "linkedinUrl" },
            ].map((f) => (
              <View key={f.key} style={styles.editFieldRow}>
                <Text style={styles.editFieldLabel}>{f.label}</Text>
                <TextInput
                  style={styles.editFieldInput}
                  value={editFields[f.key] || ""}
                  onChangeText={(v) => setEditFields({ ...editFields, [f.key]: v })}
                  placeholder={f.label}
                  placeholderTextColor={Colors.textTertiary}
                />
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.infoSection}>
            <View style={styles.infoRow}><Feather name="mail" size={16} color={Colors.textTertiary} /><Text style={styles.infoText}>{lead.email}</Text></View>
            {lead.source && <View style={styles.infoRow}><Feather name="compass" size={16} color={Colors.textTertiary} /><Text style={styles.infoText}>Source: {lead.source}</Text></View>}
            {lead.linkedinUrl && (
              <Pressable style={styles.infoRow} onPress={() => Linking.openURL(lead.linkedinUrl!)}>
                <Feather name="linkedin" size={16} color="#0A66C2" />
                <Text style={[styles.infoText, { color: "#0A66C2" }]} numberOfLines={1}>{lead.linkedinUrl}</Text>
              </Pressable>
            )}
          </View>
        )}
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
        <Pressable style={styles.actionBtn} onPress={() => setShowLinkedInModal(true)}>
          <Feather name="linkedin" size={18} color="#0A66C2" />
          <Text style={styles.actionText}>Log LI</Text>
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
          <Text style={styles.sectionTitle}>Files</Text>
          <Pressable onPress={() => uploadFileMut.mutate()}>
            <Text style={styles.editBtn}>{uploadFileMut.isPending ? "Uploading..." : "Add File"}</Text>
          </Pressable>
        </View>
        {leadFiles.length === 0 ? (
          <Text style={styles.emptyActivity}>No files attached.</Text>
        ) : (
          leadFiles.map((f: any) => (
            <View key={f.id} style={styles.fileItem}>
              <Feather name="file" size={16} color={Colors.info} />
              <Text style={styles.fileName} numberOfLines={1}>{f.name}</Text>
              <Pressable onPress={() => api.removeLeadFile(Number(id), f.id).then(() => qc.invalidateQueries({ queryKey: ["leadFiles", id] }))}>
                <Feather name="x" size={16} color={Colors.textTertiary} />
              </Pressable>
            </View>
          ))
        )}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Notes</Text>
          <Pressable onPress={() => { if (editing) saveNotes(); else { setEditNotes(lead.notes || ""); setEditing(true); } }}>
            <Text style={styles.editBtn}>{editing ? "Save" : "Edit"}</Text>
          </Pressable>
        </View>
        {editing ? (
          <TextInput style={styles.notesInput} value={editNotes} onChangeText={setEditNotes} multiline placeholder="Add notes..." placeholderTextColor={Colors.textTertiary} />
        ) : (
          <Text style={styles.notesText}>{lead.notes || "No notes yet. Add context that matters."}</Text>
        )}
      </View>

      {calendarEvents.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Scheduled Events</Text>
          {calendarEvents.map((ev: any) => (
            <View key={ev.id} style={styles.activityItem}>
              <View style={[styles.activityDot, { backgroundColor: Colors.accent }]} />
              <View style={styles.activityContent}>
                <Text style={styles.activityType}>{ev.title}</Text>
                <Text style={styles.activityNote}>{ev.eventType} · {new Date(ev.startTime).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Activity</Text>
        {activities.length === 0 ? (
          <Text style={styles.emptyActivity}>No activity yet. Every touchpoint counts.</Text>
        ) : (
          activities.map((a: any) => (
            <Pressable key={a.id} style={styles.activityItem} onPress={() => a.gmailLink && Linking.openURL(a.gmailLink)}>
              <View style={[styles.activityDot, { backgroundColor: a.type === "email" ? Colors.info : a.type === "linkedin" ? "#0A66C2" : a.type === "note" ? Colors.accent : Colors.textTertiary }]} />
              <View style={styles.activityContent}>
                <Text style={styles.activityType}>{a.type}{a.direction ? ` (${a.direction})` : ""}</Text>
                <Text style={styles.activityNote} numberOfLines={2}>{a.subject || a.note || ""}</Text>
                <Text style={styles.activityDate}>{new Date(a.createdAt).toLocaleDateString()}</Text>
                {a.gmailLink && <Text style={styles.gmailLink}>Open in Gmail →</Text>}
              </View>
            </Pressable>
          ))
        )}
      </View>

      <View style={{ height: 40 }} />

      <Modal visible={historyVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.modalContainer, { paddingTop: insets.top + 10 }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.historyModalTitle}>Change History</Text>
            <Pressable onPress={() => { setHistoryVisible(false); setSelectedRevision(null); }}>
              <Feather name="x" size={24} color={Colors.text} />
            </Pressable>
          </View>
          <ScrollView style={styles.modalScroll} contentContainerStyle={{ paddingBottom: 40 }}>
            {history.length === 0 ? (
              <Text style={styles.emptyActivity}>No changes recorded yet.</Text>
            ) : (
              history.map((entry: any) => (
                <Pressable
                  key={entry.id}
                  style={[styles.historyEntry, selectedRevision?.id === entry.id && styles.historyEntrySelected]}
                  onPress={() => setSelectedRevision(selectedRevision?.id === entry.id ? null : entry)}
                >
                  <View style={styles.historyEntryHeader}>
                    <View style={[styles.actionBadge, { backgroundColor: (ACTION_COLORS[entry.action] || Colors.textTertiary) + "20" }]}>
                      <Text style={[styles.actionBadgeText, { color: ACTION_COLORS[entry.action] || Colors.textTertiary }]}>
                        {ACTION_LABELS[entry.action] || entry.action}
                      </Text>
                    </View>
                    <Text style={styles.historyMeta}>
                      {entry.userName || "Unknown"} · {new Date(entry.createdAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                    </Text>
                  </View>
                  {selectedRevision?.id === entry.id && (
                    <View style={styles.snapshotContainer}>
                      {entry.beforeSnapshot && (
                        <View style={styles.snapshotBox}>
                          <Text style={styles.snapshotLabel}>Before</Text>
                          <Text style={styles.snapshotText}>{JSON.stringify(entry.beforeSnapshot, null, 2)}</Text>
                        </View>
                      )}
                      {entry.afterSnapshot && (
                        <View style={styles.snapshotBox}>
                          <Text style={styles.snapshotLabel}>After</Text>
                          <Text style={styles.snapshotText}>{JSON.stringify(entry.afterSnapshot, null, 2)}</Text>
                        </View>
                      )}
                      {((entry.action === "update" || entry.action === "delete" || entry.action === "rollback") && entry.beforeSnapshot || (entry.action === "create" && entry.afterSnapshot)) && (
                        <Pressable
                          style={styles.rollbackBtn}
                          onPress={() => {
                            Alert.alert(
                              "Restore this version?",
                              "The lead will be reverted to the state before this change.",
                              [
                                { text: "Cancel", style: "cancel" },
                                { text: "Restore", onPress: () => rollbackMut.mutate(entry.id) },
                              ]
                            );
                          }}
                        >
                          <Feather name="rotate-ccw" size={16} color="#fff" />
                          <Text style={styles.rollbackBtnText}>
                            {rollbackMut.isPending ? "Restoring..." : "Restore this version"}
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  )}
                </Pressable>
              ))
            )}
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={showLinkedInModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Log LinkedIn Message</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Subject / Context"
              placeholderTextColor={Colors.textTertiary}
              value={liSubject}
              onChangeText={setLiSubject}
            />
            <TextInput
              style={[styles.modalInput, { minHeight: 80, textAlignVertical: "top" }]}
              placeholder="Message content"
              placeholderTextColor={Colors.textTertiary}
              value={liMessage}
              onChangeText={setLiMessage}
              multiline
            />
            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancelBtn} onPress={() => { setShowLinkedInModal(false); setLiSubject(""); setLiMessage(""); }}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalSaveBtn, (!liSubject && !liMessage) && { opacity: 0.4 }]}
                disabled={!liSubject && !liMessage}
                onPress={() => logLinkedInMut.mutate({
                  leadId: Number(id),
                  type: "linkedin",
                  direction: "sent",
                  subject: liSubject || undefined,
                  note: liMessage || "LinkedIn message sent",
                })}
              >
                {logLinkedInMut.isPending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalSaveText}>Save</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showPicModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Set Profile Photo</Text>
            <Pressable style={styles.picOption} onPress={handleProfilePicUpload}>
              <Feather name="upload" size={18} color={Colors.info} />
              <Text style={styles.picOptionText}>Upload Image</Text>
            </Pressable>
            <View style={styles.picUrlRow}>
              <TextInput
                style={[styles.modalInput, { flex: 1 }]}
                placeholder="Paste image URL"
                placeholderTextColor={Colors.textTertiary}
                value={picUrl}
                onChangeText={setPicUrl}
                autoCapitalize="none"
              />
              <Pressable style={styles.picUrlBtn} onPress={handleProfilePicUrl}>
                <Text style={styles.picUrlBtnText}>Set</Text>
              </Pressable>
            </View>
            <Pressable style={styles.modalCancelBtn} onPress={() => { setShowPicModal(false); setPicUrl(""); }}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Layout.screenPadding },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: Colors.background },
  topBar: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
  backBtn: { padding: 10, marginLeft: -10 },
  historyBtn: { padding: 10 },
  deleteBtn: { padding: 10, marginRight: -10 },
  profileSection: { alignItems: "center", marginBottom: Layout.sectionSpacing },
  avatar: { width: 64, height: 64, borderRadius: 32, justifyContent: "center", alignItems: "center", marginBottom: 14 },
  avatarImage: { width: 64, height: 64, borderRadius: 32, marginBottom: 14 },
  avatarText: { fontSize: 26, fontFamily: "Lato_700Bold", color: "#fff" },
  cameraIcon: { position: "absolute", bottom: 10, right: -4, backgroundColor: Colors.info, borderRadius: 10, width: 20, height: 20, justifyContent: "center", alignItems: "center" },
  name: { fontSize: 22, fontFamily: "Lato_700Bold", color: Colors.text },
  email: { fontSize: 14, fontFamily: "SpaceGrotesk_400Regular", color: Colors.textSecondary, marginTop: 2 },
  badgeRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: Layout.badgeRadius },
  statusText: { fontSize: 12, fontFamily: "LeagueSpartan_600SemiBold", textTransform: "uppercase" },
  betaBadge: { backgroundColor: Colors.accent + "20", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  betaText: { fontSize: 11, fontFamily: "Lato_700Bold", color: Colors.accent },
  sourceLabel: { fontSize: 13, fontFamily: "SpaceGrotesk_400Regular", color: Colors.textTertiary, textTransform: "capitalize" },
  section: { marginBottom: Layout.sectionSpacing },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionTitle: { fontSize: 16, fontFamily: "LeagueSpartan_600SemiBold", color: Colors.text, marginBottom: 10 },
  statusRow: { gap: 8 },
  statusChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: Layout.chipRadius, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  statusChipText: { fontSize: 13, fontFamily: "SpaceGrotesk_500Medium", color: Colors.text },
  actionRow: { flexDirection: "row", gap: 12, marginBottom: Layout.sectionSpacing },
  actionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: Colors.surface, borderRadius: Layout.cardRadius, paddingVertical: 14 },
  actionText: { fontSize: 13, fontFamily: "SpaceGrotesk_500Medium", color: Colors.text },
  seqCard: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: Colors.surface, borderRadius: Layout.cardRadius, padding: Layout.cardPadding, marginBottom: 8 },
  seqName: { flex: 1, fontSize: 14, fontFamily: "SpaceGrotesk_500Medium", color: Colors.text },
  editBtn: { fontSize: 14, fontFamily: "LeagueSpartan_600SemiBold", color: Colors.info },
  notesInput: { backgroundColor: Colors.surface, borderRadius: Layout.inputRadius, padding: Layout.cardPadding, fontSize: 15, fontFamily: "SpaceGrotesk_400Regular", color: Colors.text, minHeight: 80, textAlignVertical: "top" },
  notesText: { fontSize: 14, fontFamily: "SpaceGrotesk_400Regular", color: Colors.textSecondary, lineHeight: 22 },
  emptyActivity: { fontSize: 14, fontFamily: "SpaceGrotesk_400Regular", color: Colors.textTertiary },
  activityItem: { flexDirection: "row", gap: 10, marginBottom: 14 },
  activityDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  activityContent: { flex: 1 },
  activityType: { fontSize: 13, fontFamily: "LeagueSpartan_600SemiBold", color: Colors.text, textTransform: "capitalize" },
  activityNote: { fontSize: 13, fontFamily: "SpaceGrotesk_400Regular", color: Colors.textSecondary, marginTop: 2 },
  activityDate: { fontSize: 12, fontFamily: "SpaceGrotesk_400Regular", color: Colors.textTertiary, marginTop: 2 },
  gmailLink: { fontSize: 12, fontFamily: "SpaceGrotesk_500Medium", color: Colors.info, marginTop: 2 },
  infoSection: { backgroundColor: Colors.surface, borderRadius: 14, padding: 14, gap: 10 },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  infoText: { fontSize: 14, fontFamily: "SpaceGrotesk_400Regular", color: Colors.textSecondary, flex: 1 },
  editFieldsContainer: { backgroundColor: Colors.surface, borderRadius: 14, padding: 14, gap: 8 },
  editFieldRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  editFieldLabel: { width: 70, fontSize: 13, fontFamily: "SpaceGrotesk_500Medium", color: Colors.textSecondary },
  editFieldInput: { flex: 1, fontSize: 14, fontFamily: "SpaceGrotesk_400Regular", color: Colors.text, borderBottomWidth: 1, borderBottomColor: Colors.borderLight, paddingVertical: 6 },
  fileItem: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: Colors.surface, borderRadius: 10, padding: 10, marginBottom: 6 },
  fileName: { flex: 1, fontSize: 13, fontFamily: "SpaceGrotesk_400Regular", color: Colors.text },
  modalContainer: { flex: 1, backgroundColor: Colors.background, padding: 20 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  historyModalTitle: { fontSize: 20, fontFamily: "Lato_700Bold", color: Colors.text },
  modalScroll: { flex: 1 },
  historyEntry: { backgroundColor: Colors.surface, borderRadius: 12, padding: 14, marginBottom: 10 },
  historyEntrySelected: { borderWidth: 1, borderColor: Colors.info },
  historyEntryHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  actionBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  actionBadgeText: { fontSize: 11, fontFamily: "LeagueSpartan_600SemiBold", textTransform: "uppercase" },
  historyMeta: { flex: 1, fontSize: 12, fontFamily: "SpaceGrotesk_400Regular", color: Colors.textTertiary },
  snapshotContainer: { marginTop: 12, gap: 10 },
  snapshotBox: { backgroundColor: Colors.background, borderRadius: 8, padding: 10 },
  snapshotLabel: { fontSize: 11, fontFamily: "LeagueSpartan_600SemiBold", color: Colors.textTertiary, marginBottom: 4, textTransform: "uppercase" },
  snapshotText: { fontSize: 11, fontFamily: "SpaceGrotesk_400Regular", color: Colors.textSecondary },
  rollbackBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: Colors.warning, borderRadius: 10, paddingVertical: 10, marginTop: 4 },
  rollbackBtnText: { fontSize: 14, fontFamily: "LeagueSpartan_600SemiBold", color: "#fff" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: 20 },
  modalContent: { backgroundColor: Colors.background, borderRadius: 16, padding: 20, width: "100%", maxWidth: 400 },
  modalTitle: { fontSize: 18, fontFamily: "LeagueSpartan_700Bold", color: Colors.text, marginBottom: 16 },
  modalInput: { backgroundColor: Colors.surface, borderRadius: 10, padding: 12, fontSize: 14, fontFamily: "SpaceGrotesk_400Regular", color: Colors.text, marginBottom: 12 },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 4 },
  modalCancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, alignItems: "center" },
  modalCancelText: { fontSize: 14, fontFamily: "SpaceGrotesk_500Medium", color: Colors.textSecondary },
  modalSaveBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: Colors.info, alignItems: "center" },
  modalSaveText: { fontSize: 14, fontFamily: "SpaceGrotesk_600SemiBold", color: "#fff" },
  picOption: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, backgroundColor: Colors.surface, borderRadius: 12, marginBottom: 12 },
  picOptionText: { fontSize: 14, fontFamily: "SpaceGrotesk_500Medium", color: Colors.text },
  picUrlRow: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  picUrlBtn: { paddingVertical: 12, paddingHorizontal: 16, backgroundColor: Colors.info, borderRadius: 10 },
  picUrlBtnText: { fontSize: 14, fontFamily: "SpaceGrotesk_600SemiBold", color: "#fff" },
});
