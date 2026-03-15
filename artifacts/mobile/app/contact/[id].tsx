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
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import Layout from "@/constants/layout";
import { api } from "@/lib/api";

const PRIORITY_COLORS: Record<string, string> = { high: Colors.priorityHigh, medium: Colors.priorityMedium, low: Colors.priorityLow };
const REL_COLORS: Record<string, string> = { investor: "#6366F1", partner: "#3B82F6", advisor: "#10B981", vendor: "#F59E0B", press: "#EF4444", other: "#6B7280" };
const REL_TYPES = ["investor", "partner", "advisor", "vendor", "press", "other"];
const PRIORITIES = ["high", "medium", "low"];

const ACTION_LABELS: Record<string, string> = { create: "Created", update: "Updated", delete: "Deleted", rollback: "Rolled back" };
const ACTION_COLORS: Record<string, string> = { create: Colors.success, update: Colors.info, delete: Colors.error, rollback: Colors.warning };

export default function ContactDetailScreen() {
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

  const { data: contact, isLoading } = useQuery({
    queryKey: ["contact", id],
    queryFn: () => api.getContact(Number(id)),
  });
  const { data: activities = [] } = useQuery({
    queryKey: ["activities", "contact", id],
    queryFn: () => api.getActivities({ contactId: Number(id) }),
  });
  const { data: calendarEvents = [] } = useQuery({
    queryKey: ["calendarEvents", "contact", id],
    queryFn: () => api.getCalendarEvents({ contactId: Number(id) }),
  });
  const { data: sequences = [] } = useQuery({ queryKey: ["sequences"], queryFn: api.getSequences });
  const { data: history = [], refetch: refetchHistory } = useQuery({
    queryKey: ["history", "contact", id],
    queryFn: () => api.getHistory("contact", Number(id)),
    enabled: historyVisible,
  });
  const { data: contactFiles = [] } = useQuery({
    queryKey: ["contactFiles", id],
    queryFn: () => api.getContactFiles(Number(id)),
  });

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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["activities", "contact", id] }); setShowLinkedInModal(false); setLiSubject(""); setLiMessage(""); },
  });
  const uploadFileMut = useMutation({
    mutationFn: async () => {
      const result = await DocumentPicker.getDocumentAsync({ type: "*/*", copyToCacheDirectory: true });
      if (result.canceled) throw new Error("CANCELLED");
      const asset = result.assets[0];
      return api.uploadContactFile(Number(id), asset.uri, asset.name, asset.mimeType || "application/octet-stream");
    },
    onSuccess: () => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); qc.invalidateQueries({ queryKey: ["contactFiles", id] }); },
    onError: (err: any) => { if (err.message !== "CANCELLED") Alert.alert("Upload failed", err.message); },
  });
  const rollbackMut = useMutation({
    mutationFn: (revisionId: number) => api.rollback("contact", Number(id), revisionId),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      qc.invalidateQueries({ queryKey: ["contact", id] });
      qc.invalidateQueries({ queryKey: ["contacts"] });
      refetchHistory();
      setSelectedRevision(null);
    },
    onError: (err: Error) => Alert.alert("Rollback failed", err.message),
  });

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  if (isLoading || !contact) {
    return <View style={[styles.center, { paddingTop: topPad }]}><ActivityIndicator size="large" color={Colors.primary} /></View>;
  }

  const relColor = REL_COLORS[contact.relationshipType] || Colors.primary;

  const saveNotes = () => {
    const oldNotes = contact.notes || "";
    updateMut.mutate({ notes: editNotes });
    if (editNotes && editNotes !== oldNotes) {
      api.createActivity({
        contactId: Number(id),
        type: "note",
        note: editNotes,
      }).then(() => qc.invalidateQueries({ queryKey: ["activities", "contact", id] }));
    }
    setEditing(false);
  };

  const saveFields = () => {
    const updates: Record<string, any> = {};
    const fields = ["name", "email", "company", "phone", "title", "linkedinUrl", "relationshipType", "priority"];
    for (const f of fields) {
      const current = (contact as any)[f] || "";
      if ((editFields[f] || "") !== current) updates[f] = editFields[f] || null;
    }
    if (Object.keys(updates).length > 0) updateMut.mutate(updates);
    setEditingFields(false);
  };

  const startEditFields = () => {
    setEditFields({
      name: contact.name || "",
      email: contact.email || "",
      company: contact.company || "",
      phone: contact.phone || "",
      title: contact.title || "",
      linkedinUrl: contact.linkedinUrl || "",
      relationshipType: contact.relationshipType || "",
      priority: contact.priority || "",
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

  const hasProfilePic = !!contact.profilePictureUrl;

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
        <Pressable style={styles.deleteBtn} onPress={() => Alert.alert("Delete this contact?", "This can't be undone.", [{ text: "Keep", style: "cancel" }, { text: "Delete", style: "destructive", onPress: () => deleteMut.mutate() }])}>
          <Feather name="trash-2" size={20} color={Colors.error} />
        </Pressable>
      </View>

      <View style={styles.profileSection}>
        <Pressable onPress={() => setShowPicModal(true)}>
          {hasProfilePic ? (
            <Image source={{ uri: contact.profilePictureUrl }} style={styles.avatarImage} />
          ) : (
            <View style={[styles.avatar, { backgroundColor: relColor }]}>
              <Text style={styles.avatarText}>{contact.name?.charAt(0)?.toUpperCase()}</Text>
            </View>
          )}
          <View style={styles.cameraIcon}>
            <Feather name="camera" size={12} color="#fff" />
          </View>
        </Pressable>
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
              { label: "Company", key: "company" },
              { label: "Phone", key: "phone" },
              { label: "Title", key: "title" },
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
            <View style={styles.editFieldRow}>
              <Text style={styles.editFieldLabel}>Type</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                {REL_TYPES.map((r) => (
                  <Pressable
                    key={r}
                    style={[styles.chipSmall, editFields.relationshipType === r && { backgroundColor: REL_COLORS[r], borderColor: REL_COLORS[r] }]}
                    onPress={() => setEditFields({ ...editFields, relationshipType: r })}
                  >
                    <Text style={[styles.chipSmallText, editFields.relationshipType === r && { color: "#fff" }]}>{r}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
            <View style={styles.editFieldRow}>
              <Text style={styles.editFieldLabel}>Priority</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                {PRIORITIES.map((p) => (
                  <Pressable
                    key={p}
                    style={[styles.chipSmall, editFields.priority === p && { backgroundColor: PRIORITY_COLORS[p], borderColor: PRIORITY_COLORS[p] }]}
                    onPress={() => setEditFields({ ...editFields, priority: p })}
                  >
                    <Text style={[styles.chipSmallText, editFields.priority === p && { color: "#fff" }]}>{p}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          </View>
        ) : (
          <View style={styles.infoSection}>
            {contact.email && <View style={styles.infoRow}><Feather name="mail" size={16} color={Colors.textTertiary} /><Text style={styles.infoText}>{contact.email}</Text></View>}
            {contact.phone && <View style={styles.infoRow}><Feather name="phone" size={16} color={Colors.textTertiary} /><Text style={styles.infoText}>{contact.phone}</Text></View>}
            {contact.company && <View style={styles.infoRow}><Feather name="briefcase" size={16} color={Colors.textTertiary} /><Text style={styles.infoText}>{contact.title ? `${contact.title} at ` : ""}{contact.company}</Text></View>}
            {contact.linkedinUrl && (
              <Pressable style={styles.infoRow} onPress={() => Linking.openURL(contact.linkedinUrl!)}>
                <Feather name="linkedin" size={16} color="#0A66C2" />
                <Text style={[styles.infoText, { color: "#0A66C2" }]} numberOfLines={1}>{contact.linkedinUrl}</Text>
              </Pressable>
            )}
            {contact.lastContactedAt && <View style={styles.infoRow}><Feather name="clock" size={16} color={Colors.textTertiary} /><Text style={styles.infoText}>Last contacted: {new Date(contact.lastContactedAt).toLocaleDateString()}</Text></View>}
            {contact.nextFollowUpAt && <View style={styles.infoRow}><Feather name="calendar" size={16} color={Colors.warning} /><Text style={[styles.infoText, { color: Colors.warning }]}>Follow-up: {new Date(contact.nextFollowUpAt).toLocaleDateString()}</Text></View>}
          </View>
        )}
      </View>

      <View style={styles.quickActions}>
        <Pressable style={styles.quickBtn} onPress={() => setShowLinkedInModal(true)}>
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
          <Text style={styles.sectionTitle}>Files</Text>
          <Pressable onPress={() => uploadFileMut.mutate()}>
            <Text style={styles.editBtn}>{uploadFileMut.isPending ? "Uploading..." : "Add File"}</Text>
          </Pressable>
        </View>
        {contactFiles.length === 0 ? (
          <Text style={styles.emptyActivity}>No files attached.</Text>
        ) : (
          contactFiles.map((f: any) => (
            <View key={f.id} style={styles.fileItem}>
              <Feather name="file" size={16} color={Colors.info} />
              <Text style={styles.fileName} numberOfLines={1}>{f.name}</Text>
              <Pressable onPress={() => api.removeContactFile(Number(id), f.id).then(() => qc.invalidateQueries({ queryKey: ["contactFiles", id] }))}>
                <Feather name="x" size={16} color={Colors.textTertiary} />
              </Pressable>
            </View>
          ))
        )}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Notes</Text>
          <Pressable onPress={() => { if (editing) saveNotes(); else { setEditNotes(contact.notes || ""); setEditing(true); } }}>
            <Text style={styles.editBtn}>{editing ? "Save" : "Edit"}</Text>
          </Pressable>
        </View>
        {editing ? (
          <TextInput style={styles.notesInput} value={editNotes} onChangeText={setEditNotes} multiline placeholder="Add notes..." placeholderTextColor={Colors.textTertiary} />
        ) : (
          <Text style={styles.notesText}>{contact.notes || "No notes yet. Add context that matters."}</Text>
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
                              "The contact will be reverted to the state before this change.",
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
                  contactId: Number(id),
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
  subtitle: { fontSize: 14, fontFamily: "SpaceGrotesk_400Regular", color: Colors.textSecondary, marginTop: 2 },
  badgeRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12 },
  relBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: Layout.badgeRadius },
  relText: { fontSize: 12, fontFamily: "LeagueSpartan_600SemiBold", textTransform: "capitalize" },
  priorityBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: Layout.badgeRadius },
  priorityDot: { width: 6, height: 6, borderRadius: 3 },
  priorityText: { fontSize: 12, fontFamily: "LeagueSpartan_600SemiBold", textTransform: "capitalize" },
  actionRow: { flexDirection: "row", gap: 8, marginBottom: Layout.sectionSpacing, flexWrap: "wrap" },
  actionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: Colors.surface, borderRadius: Layout.cardRadius, paddingVertical: 14, minWidth: 80 },
  actionText: { fontSize: 12, fontFamily: "SpaceGrotesk_500Medium", color: Colors.text },
  infoSection: { backgroundColor: Colors.surface, borderRadius: Layout.cardRadius, padding: Layout.cardPadding, marginBottom: Layout.sectionSpacing, gap: 12 },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  infoText: { fontSize: 14, fontFamily: "SpaceGrotesk_400Regular", color: Colors.textSecondary, flex: 1 },
  quickActions: { marginBottom: Layout.sectionSpacing },
  quickBtn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.surface, borderRadius: Layout.cardRadius, padding: Layout.cardPadding },
  quickText: { fontSize: 14, fontFamily: "SpaceGrotesk_500Medium", color: Colors.text },
  section: { marginBottom: Layout.sectionSpacing },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionTitle: { fontSize: 16, fontFamily: "LeagueSpartan_600SemiBold", color: Colors.text, marginBottom: 10 },
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
  editFieldsContainer: { backgroundColor: Colors.surface, borderRadius: 14, padding: 14, gap: 8 },
  editFieldRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  editFieldLabel: { width: 70, fontSize: 13, fontFamily: "SpaceGrotesk_500Medium", color: Colors.textSecondary },
  editFieldInput: { flex: 1, fontSize: 14, fontFamily: "SpaceGrotesk_400Regular", color: Colors.text, borderBottomWidth: 1, borderBottomColor: Colors.borderLight, paddingVertical: 6 },
  chipSmall: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.background },
  chipSmallText: { fontSize: 12, fontFamily: "SpaceGrotesk_500Medium", color: Colors.text, textTransform: "capitalize" },
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
