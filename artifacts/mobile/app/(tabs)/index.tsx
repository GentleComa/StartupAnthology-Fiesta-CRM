import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import Layout from "@/constants/layout";
import { api } from "@/lib/api";

const saIconWhite = require("@/assets/images/sa-icon-white.png");

function StatCard({ label, value, icon, color }: { label: string; value: string | number; icon: string; color: string }) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: color + "15" }]}>
        <Feather name={icon as any} size={18} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["dashboard"],
    queryFn: api.getDashboard,
  });

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  if (isLoading) {
    return (
      <View style={[styles.center, { paddingTop: topPad }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const d = data || {};
  const betaPercent = d.betaSlotsTotal ? Math.round((d.betaSlotsFilled / d.betaSlotsTotal) * 100) : 0;

  return (
    <ScrollView
      style={[styles.container, { paddingTop: topPad }]}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} tintColor={Colors.primary} />}
    >
      <View style={styles.headerRow}>
        <View style={styles.headerLogo}>
          <Image source={saIconWhite} style={styles.headerLogoImage} resizeMode="contain" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>Startup Anthology</Text>
          <Text style={styles.subtitle}>Your week at a glance.</Text>
        </View>
        <Pressable onPress={() => router.push("/settings")} hitSlop={10}>
          <Feather name="settings" size={22} color={Colors.text} />
        </Pressable>
      </View>

      <View style={styles.betaCard}>
        <View style={styles.betaHeader}>
          <Feather name="zap" size={16} color={Colors.accent} />
          <Text style={styles.betaTitle}>Beta Slots</Text>
          <Text style={styles.betaCount}>
            {d.betaSlotsFilled || 0}/{d.betaSlotsTotal || 100}
          </Text>
        </View>
        <View style={styles.progressBg}>
          <View style={[styles.progressFill, { width: `${Math.min(betaPercent, 100)}%` }]} />
        </View>
      </View>

      <View style={styles.statsGrid}>
        <StatCard label="Leads" value={d.totalLeads || 0} icon="target" color={Colors.statusNew} />
        <StatCard label="New this week" value={d.leadsThisWeek || 0} icon="trending-up" color={Colors.info} />
        <StatCard label="Contacts" value={d.totalContacts || 0} icon="users" color={Colors.primary} />
        <StatCard label="Emails sent" value={d.emailsSentThisWeek || 0} icon="send" color={Colors.success} />
        <StatCard label="Follow-ups" value={d.followUpsDueToday || 0} icon="clock" color={Colors.warning} />
        <StatCard label="Beta filled" value={d.betaSlotsFilled || 0} icon="star" color={Colors.accent} />
      </View>

      {(d.followUps?.length ?? 0) > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Follow up today</Text>
          {d.followUps.map((contact: any) => (
            <Pressable
              key={contact.id}
              style={({ pressed }) => [styles.followUpCard, pressed && styles.pressed]}
              onPress={() => router.push({ pathname: "/contact/[id]", params: { id: String(contact.id) } })}
            >
              <View style={styles.followUpAvatar}>
                <Text style={styles.avatarText}>{contact.name?.charAt(0)?.toUpperCase()}</Text>
              </View>
              <View style={styles.followUpInfo}>
                <Text style={styles.followUpName}>{contact.name}</Text>
                <Text style={styles.followUpCompany}>{contact.company || contact.relationshipType}</Text>
              </View>
              <View style={[styles.priorityDot, { backgroundColor: contact.priority === "high" ? Colors.priorityHigh : contact.priority === "medium" ? Colors.priorityMedium : Colors.priorityLow }]} />
            </Pressable>
          ))}
        </View>
      )}

      {(d.followUps?.length ?? 0) === 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Follow up today</Text>
          <Text style={styles.allClear}>All caught up. Keep the momentum going.</Text>
        </View>
      )}

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Layout.screenPadding },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: Colors.background },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: Layout.sectionSpacing },
  headerLogo: { width: 44, height: 44, borderRadius: Layout.cardRadius, backgroundColor: Colors.primary, justifyContent: "center", alignItems: "center" },
  headerLogoImage: { width: 28, height: 28 },
  greeting: { fontSize: 24, fontFamily: "Lato_700Bold", color: Colors.text },
  subtitle: { fontSize: 14, fontFamily: "Montserrat_500Medium", color: Colors.textSecondary, marginTop: 2 },
  betaCard: { backgroundColor: Colors.primary, borderRadius: Layout.cardRadius, padding: Layout.cardPadding, marginBottom: Layout.sectionSpacing },
  betaHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  betaTitle: { fontSize: 14, fontFamily: "LeagueSpartan_600SemiBold", color: "#fff", flex: 1 },
  betaCount: { fontSize: 16, fontFamily: "Lato_700Bold", color: Colors.accent },
  progressBg: { height: 6, backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 3 },
  progressFill: { height: 6, backgroundColor: Colors.accent, borderRadius: 3 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 14, marginBottom: Layout.sectionSpacing },
  statCard: {
    width: "47%" as any,
    flexGrow: 1,
    backgroundColor: Colors.surface,
    borderRadius: Layout.cardRadius,
    padding: Layout.cardPadding,
    minWidth: 140,
  },
  statIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: "center", alignItems: "center", marginBottom: 10 },
  statValue: { fontSize: 24, fontFamily: "Lato_700Bold", color: Colors.text },
  statLabel: { fontSize: 12, fontFamily: "Montserrat_400Regular", color: Colors.textSecondary, marginTop: 2 },
  section: { marginBottom: Layout.sectionSpacing },
  sectionTitle: { fontSize: 18, fontFamily: "LeagueSpartan_600SemiBold", color: Colors.text, marginBottom: 14 },
  followUpCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: Layout.cardRadius,
    padding: Layout.cardPadding,
    marginBottom: Layout.cardGap,
  },
  pressed: { opacity: 0.7 },
  followUpAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  avatarText: { fontSize: 16, fontFamily: "LeagueSpartan_600SemiBold", color: "#fff" },
  followUpInfo: { flex: 1 },
  followUpName: { fontSize: 15, fontFamily: "LeagueSpartan_600SemiBold", color: Colors.text },
  followUpCompany: { fontSize: 13, fontFamily: "SpaceGrotesk_400Regular", color: Colors.textSecondary },
  priorityDot: { width: 10, height: 10, borderRadius: 5 },
  allClear: { fontSize: 14, fontFamily: "SpaceGrotesk_400Regular", color: Colors.textSecondary, paddingVertical: 12 },
});
