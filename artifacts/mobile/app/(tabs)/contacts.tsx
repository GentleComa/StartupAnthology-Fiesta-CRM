import { Feather } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import { api } from "@/lib/api";

const REL_TYPES = ["investor", "partner", "advisor", "vendor", "press", "other"];
const PRIORITIES = ["high", "medium", "low"];
const PRIORITY_COLORS: Record<string, string> = { high: Colors.priorityHigh, medium: Colors.priorityMedium, low: Colors.priorityLow };
const REL_COLORS: Record<string, string> = { investor: "#6366F1", partner: "#3B82F6", advisor: "#10B981", vendor: "#F59E0B", press: "#EF4444", other: "#6B7280" };

export default function ContactsScreen() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"all" | "followups">("all");
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newCompany, setNewCompany] = useState("");
  const [newType, setNewType] = useState("other");
  const [newPriority, setNewPriority] = useState("medium");

  const { data: contacts = [], isLoading, refetch } = useQuery({
    queryKey: ["contacts"],
    queryFn: () => api.getContacts(),
  });
  const { data: followUps = [], refetch: refetchFU } = useQuery({
    queryKey: ["followUps"],
    queryFn: api.getFollowUps,
  });

  const createMut = useMutation({
    mutationFn: api.createContact,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contacts"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setShowAdd(false);
      setNewName(""); setNewEmail(""); setNewCompany(""); setNewType("other"); setNewPriority("medium");
    },
  });
  const markMut = useMutation({
    mutationFn: (id: number) => api.markContacted(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contacts"] });
      qc.invalidateQueries({ queryKey: ["followUps"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const listData = tab === "all" ? contacts : followUps;

  if (isLoading) {
    return (
      <View style={[styles.center, { paddingTop: topPad }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Contacts</Text>
      </View>

      <View style={styles.tabs}>
        <Pressable style={[styles.tab, tab === "all" && styles.tabActive]} onPress={() => setTab("all")}>
          <Text style={[styles.tabText, tab === "all" && styles.tabTextActive]}>All</Text>
        </Pressable>
        <Pressable style={[styles.tab, tab === "followups" && styles.tabActive]} onPress={() => setTab("followups")}>
          <Feather name="clock" size={14} color={tab === "followups" ? Colors.primary : Colors.textSecondary} />
          <Text style={[styles.tabText, tab === "followups" && styles.tabTextActive]}>Follow-ups</Text>
          {followUps.length > 0 && (
            <View style={styles.badge}><Text style={styles.badgeText}>{followUps.length}</Text></View>
          )}
        </Pressable>
      </View>

      <FlatList
        data={listData}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => { refetch(); refetchFU(); }} tintColor={Colors.primary} />}
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.contactCard, pressed && styles.pressed]}
            onPress={() => router.push({ pathname: "/contact/[id]", params: { id: String(item.id) } })}
          >
            <View style={[styles.avatar, { backgroundColor: REL_COLORS[item.relationshipType] || Colors.primary }]}>
              <Text style={styles.avatarText}>{item.name?.charAt(0)?.toUpperCase()}</Text>
            </View>
            <View style={styles.contactInfo}>
              <Text style={styles.contactName}>{item.name}</Text>
              <Text style={styles.contactCompany}>{item.company || item.title || ""}</Text>
              <View style={styles.contactMeta}>
                <View style={[styles.relBadge, { backgroundColor: (REL_COLORS[item.relationshipType] || Colors.primary) + "15" }]}>
                  <Text style={[styles.relText, { color: REL_COLORS[item.relationshipType] || Colors.primary }]}>
                    {item.relationshipType}
                  </Text>
                </View>
              </View>
            </View>
            <View style={styles.contactRight}>
              <View style={[styles.priorityIndicator, { backgroundColor: PRIORITY_COLORS[item.priority] }]} />
              {tab === "followups" && (
                <Pressable
                  style={styles.markBtn}
                  onPress={(e) => {
                    e.stopPropagation();
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    markMut.mutate(item.id);
                  }}
                >
                  <Feather name="check" size={16} color={Colors.success} />
                </Pressable>
              )}
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Feather name="users" size={48} color={Colors.textTertiary} />
            <Text style={styles.emptyTitle}>{tab === "all" ? "No contacts yet" : "No follow-ups due"}</Text>
            <Text style={styles.emptySubtitle}>{tab === "all" ? "Tap + to add your first contact" : "You're all caught up"}</Text>
          </View>
        }
      />

      <Pressable
        style={({ pressed }) => [styles.fab, pressed && { transform: [{ scale: 0.95 }] }]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          setShowAdd(true);
        }}
      >
        <Feather name="plus" size={24} color="#fff" />
      </Pressable>

      <Modal visible={showAdd} animationType="slide" presentationStyle="pageSheet">
        <ScrollView style={[styles.modalContent, { paddingTop: Platform.OS === "web" ? 67 : insets.top + 16 }]}>
          <View style={styles.modalHeader}>
            <Pressable onPress={() => setShowAdd(false)}>
              <Text style={styles.cancelBtn}>Cancel</Text>
            </Pressable>
            <Text style={styles.modalTitle}>New Contact</Text>
            <Pressable onPress={() => { if (newName) createMut.mutate({ name: newName, email: newEmail || undefined, company: newCompany || undefined, relationshipType: newType, priority: newPriority }); }} disabled={!newName}>
              <Text style={[styles.saveBtn, !newName && styles.saveBtnDisabled]}>Save</Text>
            </Pressable>
          </View>
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Name</Text>
            <TextInput style={styles.input} value={newName} onChangeText={setNewName} placeholder="Contact name" placeholderTextColor={Colors.textTertiary} autoFocus />
          </View>
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Email</Text>
            <TextInput style={styles.input} value={newEmail} onChangeText={setNewEmail} placeholder="email@example.com" placeholderTextColor={Colors.textTertiary} keyboardType="email-address" autoCapitalize="none" />
          </View>
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Company</Text>
            <TextInput style={styles.input} value={newCompany} onChangeText={setNewCompany} placeholder="Company name" placeholderTextColor={Colors.textTertiary} />
          </View>
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Relationship Type</Text>
            <View style={styles.chipRow}>
              {REL_TYPES.map((t) => (
                <Pressable key={t} style={[styles.chip, newType === t && styles.chipActive]} onPress={() => setNewType(t)}>
                  <Text style={[styles.chipText, newType === t && styles.chipTextActive]}>{t}</Text>
                </Pressable>
              ))}
            </View>
          </View>
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Priority</Text>
            <View style={styles.chipRow}>
              {PRIORITIES.map((p) => (
                <Pressable key={p} style={[styles.chip, newPriority === p && { backgroundColor: PRIORITY_COLORS[p], borderColor: PRIORITY_COLORS[p] }]} onPress={() => setNewPriority(p)}>
                  <Text style={[styles.chipText, newPriority === p && { color: "#fff" }]}>{p}</Text>
                </Pressable>
              ))}
            </View>
          </View>
          <View style={{ height: 40 }} />
        </ScrollView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: Colors.background },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 },
  title: { fontSize: 24, fontFamily: "Lato_700Bold", color: Colors.text },
  tabs: { flexDirection: "row", paddingHorizontal: 20, gap: 8, marginBottom: 8, marginTop: 8 },
  tab: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.surfaceSecondary },
  tabActive: { backgroundColor: Colors.primary + "10" },
  tabText: { fontSize: 14, fontFamily: "SpaceGrotesk_500Medium", color: Colors.textSecondary },
  tabTextActive: { color: Colors.primary },
  badge: { backgroundColor: Colors.error, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1, minWidth: 20, alignItems: "center" },
  badgeText: { fontSize: 11, fontFamily: "Lato_700Bold", color: "#fff" },
  listContent: { padding: 16, paddingBottom: 100 },
  contactCard: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.surface, borderRadius: 14, padding: 14, marginBottom: 8 },
  pressed: { opacity: 0.7 },
  avatar: { width: 44, height: 44, borderRadius: 22, justifyContent: "center", alignItems: "center", marginRight: 12 },
  avatarText: { fontSize: 18, fontFamily: "LeagueSpartan_600SemiBold", color: "#fff" },
  contactInfo: { flex: 1 },
  contactName: { fontSize: 16, fontFamily: "LeagueSpartan_600SemiBold", color: Colors.text },
  contactCompany: { fontSize: 13, fontFamily: "SpaceGrotesk_400Regular", color: Colors.textSecondary, marginTop: 1 },
  contactMeta: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
  relBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  relText: { fontSize: 11, fontFamily: "LeagueSpartan_600SemiBold", textTransform: "capitalize" },
  contactRight: { alignItems: "center", gap: 8 },
  priorityIndicator: { width: 8, height: 8, borderRadius: 4 },
  markBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.success + "15", justifyContent: "center", alignItems: "center" },
  emptyState: { alignItems: "center", paddingTop: 80, gap: 8 },
  emptyTitle: { fontSize: 18, fontFamily: "LeagueSpartan_600SemiBold", color: Colors.textSecondary },
  emptySubtitle: { fontSize: 14, fontFamily: "SpaceGrotesk_400Regular", color: Colors.textTertiary },
  fab: { position: "absolute", bottom: 100, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.primary, justifyContent: "center", alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 5 },
  modalContent: { flex: 1, backgroundColor: Colors.background, padding: 20 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 },
  modalTitle: { fontSize: 17, fontFamily: "LeagueSpartan_600SemiBold", color: Colors.text },
  cancelBtn: { fontSize: 16, fontFamily: "SpaceGrotesk_400Regular", color: Colors.info },
  saveBtn: { fontSize: 16, fontFamily: "LeagueSpartan_600SemiBold", color: Colors.info },
  saveBtnDisabled: { opacity: 0.4 },
  formGroup: { marginBottom: 20 },
  formLabel: { fontSize: 13, fontFamily: "LeagueSpartan_600SemiBold", color: Colors.textSecondary, marginBottom: 6, textTransform: "uppercase" },
  input: { backgroundColor: Colors.surface, borderRadius: 12, padding: 14, fontSize: 16, fontFamily: "SpaceGrotesk_400Regular", color: Colors.text },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 13, fontFamily: "SpaceGrotesk_500Medium", color: Colors.text, textTransform: "capitalize" },
  chipTextActive: { color: "#fff" },
});
