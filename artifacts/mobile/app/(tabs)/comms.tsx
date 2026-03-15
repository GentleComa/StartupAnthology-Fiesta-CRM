import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import { api } from "@/lib/api";

type TabKey = "templates" | "sequences" | "broadcasts";

export default function CommsScreen() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<TabKey>("templates");
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const { data: templates = [], isLoading: tLoading, refetch: tRefetch } = useQuery({
    queryKey: ["templates"],
    queryFn: () => api.getTemplates(),
  });
  const { data: sequences = [], isLoading: sLoading, refetch: sRefetch } = useQuery({
    queryKey: ["sequences"],
    queryFn: api.getSequences,
  });
  const { data: broadcasts = [], isLoading: bLoading, refetch: bRefetch } = useQuery({
    queryKey: ["broadcasts"],
    queryFn: api.getBroadcasts,
  });

  const isLoading = tab === "templates" ? tLoading : tab === "sequences" ? sLoading : bLoading;
  const onRefresh = tab === "templates" ? tRefetch : tab === "sequences" ? sRefetch : bRefetch;

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Comms</Text>
        <Pressable style={styles.settingsBtn} onPress={() => router.push("/settings")} hitSlop={8}>
          <Feather name="settings" size={20} color={Colors.textSecondary} />
        </Pressable>
      </View>

      <View style={styles.tabs}>
        {(["templates", "sequences", "broadcasts"] as TabKey[]).map((t) => (
          <Pressable key={t} style={[styles.tab, tab === t && styles.tabActive]} onPress={() => setTab(t)}>
            <Feather
              name={t === "templates" ? "file-text" : t === "sequences" ? "repeat" : "send" as any}
              size={14}
              color={tab === t ? "#FFFFFF" : Colors.textSecondary}
            />
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <>
          {tab === "templates" && (
            <FlatList
              data={templates}
              keyExtractor={(item) => String(item.id)}
              contentContainerStyle={styles.listContent}
              refreshControl={<RefreshControl refreshing={false} onRefresh={onRefresh} tintColor={Colors.primary} />}
              renderItem={({ item }) => (
                <Pressable
                  style={({ pressed }) => [styles.card, pressed && styles.pressed]}
                  onPress={() => router.push({ pathname: "/template/[id]", params: { id: String(item.id) } })}
                >
                  <View style={styles.cardIcon}>
                    <Feather name="file-text" size={18} color={Colors.primary} />
                  </View>
                  <View style={styles.cardContent}>
                    <Text style={styles.cardTitle}>{item.name}</Text>
                    <Text style={styles.cardSubtitle} numberOfLines={1}>{item.subject}</Text>
                    <View style={styles.audienceBadge}>
                      <Text style={styles.audienceText}>{item.audience}</Text>
                    </View>
                  </View>
                  <Feather name="chevron-right" size={18} color={Colors.textTertiary} />
                </Pressable>
              )}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Feather name="file-text" size={48} color={Colors.textTertiary} />
                  <Text style={styles.emptyTitle}>No templates yet</Text>
                  <Text style={styles.emptySubtitle}>Write it once, send it whenever.</Text>
                  <Pressable style={styles.emptyBtn} onPress={() => router.push("/template/new")}>
                    <Feather name="plus" size={16} color="#fff" />
                    <Text style={styles.emptyBtnText}>Create Template</Text>
                  </Pressable>
                </View>
              }
            />
          )}

          {tab === "sequences" && (
            <FlatList
              data={sequences}
              keyExtractor={(item) => String(item.id)}
              contentContainerStyle={styles.listContent}
              refreshControl={<RefreshControl refreshing={false} onRefresh={onRefresh} tintColor={Colors.primary} />}
              renderItem={({ item }) => (
                <Pressable
                  style={({ pressed }) => [styles.card, pressed && styles.pressed]}
                  onPress={() => router.push({ pathname: "/sequence/[id]", params: { id: String(item.id) } })}
                >
                  <View style={[styles.cardIcon, { backgroundColor: Colors.info + "15" }]}>
                    <Feather name="repeat" size={18} color={Colors.info} />
                  </View>
                  <View style={styles.cardContent}>
                    <Text style={styles.cardTitle}>{item.name}</Text>
                    <View style={styles.audienceBadge}>
                      <Text style={styles.audienceText}>{item.targetAudience}</Text>
                    </View>
                  </View>
                  <Feather name="chevron-right" size={18} color={Colors.textTertiary} />
                </Pressable>
              )}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Feather name="repeat" size={48} color={Colors.textTertiary} />
                  <Text style={styles.emptyTitle}>No sequences yet</Text>
                  <Text style={styles.emptySubtitle}>Set up a drip. Let it run.</Text>
                  <Pressable style={styles.emptyBtn} onPress={() => router.push("/sequence/new")}>
                    <Feather name="plus" size={16} color="#fff" />
                    <Text style={styles.emptyBtnText}>Create Sequence</Text>
                  </Pressable>
                </View>
              }
            />
          )}

          {tab === "broadcasts" && (
            <FlatList
              data={broadcasts}
              keyExtractor={(item) => String(item.id)}
              contentContainerStyle={styles.listContent}
              refreshControl={<RefreshControl refreshing={false} onRefresh={onRefresh} tintColor={Colors.primary} />}
              renderItem={({ item }) => (
                <Pressable style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
                  <View style={[styles.cardIcon, { backgroundColor: Colors.success + "15" }]}>
                    <Feather name="send" size={18} color={Colors.success} />
                  </View>
                  <View style={styles.cardContent}>
                    <Text style={styles.cardTitle}>{item.subject}</Text>
                    <Text style={styles.cardSubtitle}>
                      {item.recipientCount} recipients · {item.status}
                    </Text>
                    <Text style={styles.cardDate}>
                      {item.sentAt ? new Date(item.sentAt).toLocaleDateString() : "Draft"}
                    </Text>
                  </View>
                </Pressable>
              )}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Feather name="send" size={48} color={Colors.textTertiary} />
                  <Text style={styles.emptyTitle}>No broadcasts yet</Text>
                  <Text style={styles.emptySubtitle}>One message, many inboxes.</Text>
                  <Pressable style={styles.emptyBtn} onPress={() => router.push("/broadcast/new")}>
                    <Feather name="plus" size={16} color="#fff" />
                    <Text style={styles.emptyBtnText}>New Broadcast</Text>
                  </Pressable>
                </View>
              }
            />
          )}
        </>
      )}

      <Pressable
        style={({ pressed }) => [styles.fab, pressed && { transform: [{ scale: 0.95 }] }]}
        onPress={() => {
          if (tab === "templates") router.push("/template/new");
          else if (tab === "sequences") router.push("/sequence/new");
          else router.push("/broadcast/new");
        }}
      >
        <Feather name="plus" size={24} color="#fff" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 },
  title: { fontSize: 24, fontFamily: "Lato_700Bold", color: Colors.text },
  settingsBtn: { padding: 8, borderRadius: 8, backgroundColor: Colors.surfaceSecondary },
  tabs: { flexDirection: "row", paddingHorizontal: 20, gap: 8, marginTop: 8, marginBottom: 8 },
  tab: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.surfaceSecondary },
  tabActive: { backgroundColor: Colors.primary },
  tabText: { fontSize: 13, fontFamily: "SpaceGrotesk_500Medium", color: Colors.textSecondary },
  tabTextActive: { color: "#FFFFFF" },
  listContent: { padding: 16, paddingBottom: 100 },
  card: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.surface, borderRadius: 14, padding: 14, marginBottom: 8 },
  pressed: { opacity: 0.7 },
  cardIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.primary + "15", justifyContent: "center", alignItems: "center", marginRight: 12 },
  cardContent: { flex: 1 },
  cardTitle: { fontSize: 15, fontFamily: "LeagueSpartan_600SemiBold", color: Colors.text },
  cardSubtitle: { fontSize: 13, fontFamily: "SpaceGrotesk_400Regular", color: Colors.textSecondary, marginTop: 2 },
  cardDate: { fontSize: 12, fontFamily: "SpaceGrotesk_400Regular", color: Colors.textTertiary, marginTop: 2 },
  audienceBadge: { backgroundColor: Colors.surfaceSecondary, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, alignSelf: "flex-start", marginTop: 4 },
  audienceText: { fontSize: 11, fontFamily: "SpaceGrotesk_500Medium", color: Colors.textSecondary, textTransform: "capitalize" },
  emptyState: { alignItems: "center", paddingTop: 80, gap: 8 },
  emptyTitle: { fontSize: 18, fontFamily: "LeagueSpartan_600SemiBold", color: Colors.textSecondary },
  emptySubtitle: { fontSize: 14, fontFamily: "SpaceGrotesk_400Regular", color: Colors.textTertiary },
  fab: { position: "absolute", bottom: 100, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.primary, justifyContent: "center", alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 5 },
  emptyBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 20, marginTop: 16 },
  emptyBtnText: { fontSize: 14, fontFamily: "LeagueSpartan_600SemiBold", color: "#fff" },
});
