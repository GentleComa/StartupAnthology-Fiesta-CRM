import { Feather } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState, useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  PanResponder,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import { LEAD_STATUSES, STATUS_LABELS, STATUS_COLORS, LEAD_SOURCES } from "@/constants/crm";
import Layout from "@/constants/layout";
import { api } from "@/lib/api";

function LeadCard({ lead, onSwipeLeft, onSwipeRight }: { lead: any; onSwipeLeft: () => void; onSwipeRight: () => void }) {
  const pan = useRef(new Animated.Value(0)).current;
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 10 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderMove: Animated.event([null, { dx: pan }], { useNativeDriver: false }),
      onPanResponderRelease: (_, g) => {
        if (g.dx > 80) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          onSwipeRight();
        } else if (g.dx < -80) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          onSwipeLeft();
        }
        Animated.spring(pan, { toValue: 0, useNativeDriver: false }).start();
      },
    })
  ).current;

  const statusColor = STATUS_COLORS[lead.status] || Colors.textSecondary;

  return (
    <Animated.View style={[styles.leadCard, { transform: [{ translateX: pan }] }]} {...panResponder.panHandlers}>
      <Pressable
        onPress={() => router.push({ pathname: "/lead/[id]", params: { id: String(lead.id) } })}
        style={({ pressed }) => pressed && styles.pressed}
      >
        <View style={styles.leadCardHeader}>
          <Text style={styles.leadName} numberOfLines={1}>{lead.name}</Text>
          {lead.isBeta && (
            <View style={styles.betaBadge}>
              <Text style={styles.betaBadgeText}>BETA</Text>
            </View>
          )}
        </View>
        <Text style={styles.leadEmail} numberOfLines={1}>{lead.email}</Text>
        <View style={styles.leadMeta}>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + "20" }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>{STATUS_LABELS[lead.status]}</Text>
          </View>
          <Text style={styles.sourceText}>{lead.source}</Text>
        </View>
        <View style={styles.swipeHint}>
          <Feather name="chevrons-left" size={10} color={Colors.textTertiary} />
          <Text style={styles.swipeHintText}>swipe to move</Text>
          <Feather name="chevrons-right" size={10} color={Colors.textTertiary} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

export default function FunnelScreen() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newSource, setNewSource] = useState("other");

  const { data: leads = [], isLoading, refetch } = useQuery({
    queryKey: ["leads"],
    queryFn: () => api.getLeads(),
  });
  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: api.getSettings,
  });

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => api.updateLeadStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["leads"] }),
  });
  const createMut = useMutation({
    mutationFn: api.createLead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setShowAdd(false);
      setNewName("");
      setNewEmail("");
      setNewSource("other");
    },
  });

  const advanceStatus = (lead: any) => {
    const idx = LEAD_STATUSES.indexOf(lead.status);
    if (idx < LEAD_STATUSES.length - 1) {
      statusMut.mutate({ id: lead.id, status: LEAD_STATUSES[idx + 1] });
    }
  };
  const retreatStatus = (lead: any) => {
    const idx = LEAD_STATUSES.indexOf(lead.status);
    if (idx > 0) {
      statusMut.mutate({ id: lead.id, status: LEAD_STATUSES[idx - 1] });
    }
  };

  const betaCount = leads.filter((l: any) => l.isBeta).length;
  const betaTotal = parseInt(settings?.beta_slots_total || "100", 10);
  const topPad = Platform.OS === "web" ? 67 : insets.top;

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
        <Text style={styles.title}>Your Funnel</Text>
        <View style={styles.headerRight}>
          <View style={styles.betaCounter}>
            <Feather name="zap" size={14} color={Colors.accent} />
            <Text style={styles.betaCountText}>{betaCount}/{betaTotal}</Text>
          </View>
          <Pressable
            onPress={() => setViewMode(viewMode === "kanban" ? "list" : "kanban")}
            style={styles.viewToggle}
            hitSlop={8}
          >
            <Feather name={viewMode === "kanban" ? "list" : "columns"} size={20} color={Colors.primary} />
          </Pressable>
        </View>
      </View>

      {viewMode === "kanban" ? (
        leads.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="target" size={48} color={Colors.textTertiary} />
            <Text style={styles.emptyTitle}>No leads yet</Text>
            <Text style={styles.emptySubtitle}>You know who your first one is. Add them.</Text>
            <Pressable
              style={styles.emptyBtn}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setShowAdd(true);
              }}
            >
              <Feather name="plus" size={16} color="#fff" />
              <Text style={styles.emptyBtnText}>Add Lead</Text>
            </Pressable>
          </View>
        ) : (
        <ScrollView
          horizontal
          pagingEnabled={false}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.kanbanContainer}
        >
          {LEAD_STATUSES.map((status) => {
            const col = leads.filter((l: any) => l.status === status);
            return (
              <View key={status} style={styles.kanbanColumn}>
                <View style={styles.columnHeader}>
                  <View style={[styles.columnDot, { backgroundColor: STATUS_COLORS[status] }]} />
                  <Text style={styles.columnTitle}>{STATUS_LABELS[status]}</Text>
                  <Text style={styles.columnCount}>{col.length}</Text>
                </View>
                <FlatList
                  data={col}
                  keyExtractor={(item) => String(item.id)}
                  renderItem={({ item }) => (
                    <LeadCard
                      lead={item}
                      onSwipeRight={() => advanceStatus(item)}
                      onSwipeLeft={() => retreatStatus(item)}
                    />
                  )}
                  showsVerticalScrollIndicator={false}
                  scrollEnabled={col.length > 0}
                  ListEmptyComponent={
                    <View style={styles.emptyCol}>
                      <Text style={styles.emptyText}>None yet</Text>
                    </View>
                  }
                />
              </View>
            );
          })}
        </ScrollView>
        )
      ) : (
        <FlatList
          data={leads}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} tintColor={Colors.primary} />}
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [styles.listCard, pressed && styles.pressed]}
              onPress={() => router.push({ pathname: "/lead/[id]", params: { id: String(item.id) } })}
            >
              <View style={styles.listCardLeft}>
                <Text style={styles.leadName}>{item.name}</Text>
                <Text style={styles.leadEmail}>{item.email}</Text>
              </View>
              <View style={styles.listCardRight}>
                <View style={[styles.statusBadge, { backgroundColor: (STATUS_COLORS[item.status] || Colors.textSecondary) + "20" }]}>
                  <Text style={[styles.statusText, { color: STATUS_COLORS[item.status] }]}>
                    {STATUS_LABELS[item.status]}
                  </Text>
                </View>
                {item.isBeta && (
                  <View style={styles.betaBadge}>
                    <Text style={styles.betaBadgeText}>BETA</Text>
                  </View>
                )}
              </View>
            </Pressable>
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Feather name="target" size={48} color={Colors.textTertiary} />
              <Text style={styles.emptyTitle}>No leads yet</Text>
              <Text style={styles.emptySubtitle}>You know who your first one is. Add them.</Text>
              <Pressable
                style={styles.emptyBtn}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  setShowAdd(true);
                }}
              >
                <Feather name="plus" size={16} color="#fff" />
                <Text style={styles.emptyBtnText}>Add Lead</Text>
              </Pressable>
            </View>
          }
        />
      )}

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
        <View style={[styles.modalContent, { paddingTop: Platform.OS === "web" ? 67 : insets.top + 16 }]}>
          <View style={styles.modalHeader}>
            <Pressable onPress={() => setShowAdd(false)}>
              <Text style={styles.cancelBtn}>Cancel</Text>
            </Pressable>
            <Text style={styles.modalTitle}>New Lead</Text>
            <Pressable
              onPress={() => {
                if (newName && newEmail) createMut.mutate({ name: newName, email: newEmail, source: newSource });
              }}
              disabled={!newName || !newEmail}
            >
              <Text style={[styles.saveBtn, (!newName || !newEmail) && styles.saveBtnDisabled]}>Save</Text>
            </Pressable>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Name</Text>
            <TextInput
              style={styles.input}
              value={newName}
              onChangeText={setNewName}
              placeholder="Lead name"
              placeholderTextColor={Colors.textTertiary}
              autoFocus
            />
          </View>
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Email</Text>
            <TextInput
              style={styles.input}
              value={newEmail}
              onChangeText={setNewEmail}
              placeholder="email@example.com"
              placeholderTextColor={Colors.textTertiary}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Source</Text>
            <View style={styles.sourcePicker}>
              {LEAD_SOURCES.map((s) => (
                <Pressable
                  key={s}
                  style={[styles.sourceChip, newSource === s && styles.sourceChipActive]}
                  onPress={() => setNewSource(s)}
                >
                  <Text style={[styles.sourceChipText, newSource === s && styles.sourceChipTextActive]}>
                    {s.replace("_", " ")}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const COLUMN_WIDTH = Dimensions.get("window").width * 0.75;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: Colors.background },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: Layout.screenPadding, paddingVertical: 14 },
  title: { fontSize: 24, fontFamily: "Lato_700Bold", color: Colors.text },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 12 },
  betaCounter: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: Colors.primary + "10", paddingHorizontal: 10, paddingVertical: 4, borderRadius: Layout.inputRadius },
  betaCountText: { fontSize: 13, fontFamily: "LeagueSpartan_600SemiBold", color: Colors.primary },
  viewToggle: { padding: 6, borderRadius: Layout.badgeRadius, backgroundColor: Colors.surfaceSecondary },
  kanbanContainer: { paddingHorizontal: 14, gap: 14, paddingBottom: 100 },
  kanbanColumn: { width: COLUMN_WIDTH, backgroundColor: Colors.surfaceSecondary, borderRadius: Layout.cardRadius, padding: Layout.cardPadding },
  columnHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
  columnDot: { width: 8, height: 8, borderRadius: 4 },
  columnTitle: { fontSize: 14, fontFamily: "LeagueSpartan_600SemiBold", color: Colors.text, flex: 1 },
  columnCount: { fontSize: 13, fontFamily: "SpaceGrotesk_500Medium", color: Colors.textSecondary, backgroundColor: Colors.surface, paddingHorizontal: 8, paddingVertical: 2, borderRadius: Layout.badgeRadius },
  leadCard: { backgroundColor: Colors.surface, borderRadius: Layout.cardRadius, padding: Layout.cardPadding, marginBottom: Layout.cardGap },
  leadCardHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  leadName: { fontSize: 15, fontFamily: "LeagueSpartan_600SemiBold", color: Colors.text, flex: 1 },
  leadEmail: { fontSize: 13, fontFamily: "SpaceGrotesk_400Regular", color: Colors.textSecondary, marginTop: 2 },
  leadMeta: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusText: { fontSize: 11, fontFamily: "LeagueSpartan_600SemiBold", textTransform: "uppercase" },
  betaBadge: { backgroundColor: Colors.accent + "20", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  betaBadgeText: { fontSize: 10, fontFamily: "Lato_700Bold", color: Colors.accent },
  sourceText: { fontSize: 12, fontFamily: "SpaceGrotesk_400Regular", color: Colors.textTertiary },
  emptyCol: { padding: Layout.screenPadding, alignItems: "center" },
  emptyText: { fontSize: 13, fontFamily: "SpaceGrotesk_400Regular", color: Colors.textTertiary },
  listContent: { padding: Layout.screenPadding, paddingBottom: 100 },
  listCard: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: Colors.surface, borderRadius: Layout.cardRadius, padding: Layout.cardPadding, marginBottom: Layout.cardGap },
  pressed: { opacity: 0.7 },
  listCardLeft: { flex: 1, marginRight: 12 },
  listCardRight: { alignItems: "flex-end", gap: 4 },
  emptyState: { alignItems: "center", paddingTop: 80, gap: 12 },
  emptyTitle: { fontSize: 18, fontFamily: "LeagueSpartan_600SemiBold", color: Colors.textSecondary },
  emptySubtitle: { fontSize: 14, fontFamily: "SpaceGrotesk_400Regular", color: Colors.textTertiary, textAlign: "center", paddingHorizontal: 32 },
  fab: {
    position: "absolute",
    bottom: 100,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: Layout.fabElevation,
  },
  modalContent: { flex: 1, backgroundColor: Colors.background, padding: Layout.screenPadding },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Layout.sectionSpacing },
  modalTitle: { fontSize: 17, fontFamily: "LeagueSpartan_600SemiBold", color: Colors.text },
  cancelBtn: { fontSize: 16, fontFamily: "SpaceGrotesk_400Regular", color: Colors.info },
  saveBtn: { fontSize: 16, fontFamily: "LeagueSpartan_600SemiBold", color: Colors.info },
  saveBtnDisabled: { opacity: 0.4 },
  formGroup: { marginBottom: 22 },
  formLabel: { fontSize: 13, fontFamily: "LeagueSpartan_600SemiBold", color: Colors.textSecondary, marginBottom: 8, textTransform: "uppercase" },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: Layout.inputRadius,
    padding: Layout.cardPadding,
    fontSize: 16,
    fontFamily: "SpaceGrotesk_400Regular",
    color: Colors.text,
  },
  sourcePicker: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  sourceChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: Layout.chipRadius, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  sourceChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  sourceChipText: { fontSize: 13, fontFamily: "SpaceGrotesk_500Medium", color: Colors.text, textTransform: "capitalize" },
  sourceChipTextActive: { color: "#fff" },
  swipeHint: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, marginTop: 10, opacity: 0.5 },
  swipeHintText: { fontSize: 10, fontFamily: "SpaceGrotesk_400Regular", color: Colors.textTertiary },
  emptyBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.primary, borderRadius: Layout.inputRadius, paddingVertical: 12, paddingHorizontal: 20, marginTop: 16 },
  emptyBtnText: { fontSize: 14, fontFamily: "LeagueSpartan_600SemiBold", color: "#fff" },
});
