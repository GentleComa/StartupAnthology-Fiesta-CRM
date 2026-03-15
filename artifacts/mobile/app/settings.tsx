import { Feather } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState, useEffect } from "react";
import {
  Alert,
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
import { useAuth } from "@/lib/auth";

const STATUSES = ["new", "contacted", "interested", "engaged", "converted"];
const ACTION_TYPES = ["enroll_sequence", "schedule_followup"];

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { user, logout } = useAuth();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const { data: settings = {} } = useQuery({ queryKey: ["settings"], queryFn: api.getSettings });
  const { data: triggers = [], refetch: refetchTriggers } = useQuery({ queryKey: ["triggers"], queryFn: api.getTriggerRules });
  const { data: sequences = [] } = useQuery({ queryKey: ["sequences"], queryFn: api.getSequences });

  const [betaTotal, setBetaTotal] = useState("");
  const [founderName, setFounderName] = useState("");
  const [appName, setAppName] = useState("");
  const [notionLeadsDb, setNotionLeadsDb] = useState("");
  const [notionContactsDb, setNotionContactsDb] = useState("");
  const [notionActivitiesDb, setNotionActivitiesDb] = useState("");
  const [newTriggerStatus, setNewTriggerStatus] = useState("");
  const [newTriggerAction, setNewTriggerAction] = useState("");
  const [newTriggerSeqId, setNewTriggerSeqId] = useState<number | null>(null);
  const [newTriggerDays, setNewTriggerDays] = useState("3");

  useEffect(() => {
    if (settings) {
      setBetaTotal(settings.beta_slots_total || "100");
      setFounderName(settings.founder_name || "");
      setAppName(settings.app_name || "Anthology CRM");
      setNotionLeadsDb(settings.notion_leads_db || "");
      setNotionContactsDb(settings.notion_contacts_db || "");
      setNotionActivitiesDb(settings.notion_activities_db || "");
    }
  }, [settings]);

  const updateSettingsMut = useMutation({
    mutationFn: (data: Record<string, string>) => api.updateSettings(data),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      qc.invalidateQueries({ queryKey: ["settings"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
  const createTriggerMut = useMutation({
    mutationFn: () => api.createTriggerRule({
      triggerStatus: newTriggerStatus,
      actionType: newTriggerAction,
      sequenceId: newTriggerAction === "enroll_sequence" ? newTriggerSeqId : undefined,
      followUpDays: newTriggerAction === "schedule_followup" ? parseInt(newTriggerDays, 10) : undefined,
    }),
    onSuccess: () => {
      refetchTriggers();
      setNewTriggerStatus("");
      setNewTriggerAction("");
    },
  });
  const deleteTriggerMut = useMutation({
    mutationFn: (id: number) => api.deleteTriggerRule(id),
    onSuccess: () => refetchTriggers(),
  });

  return (
    <ScrollView style={[styles.container, { paddingTop: topPad }]} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={Colors.text} />
        </Pressable>
        <Text style={styles.title}>Settings</Text>
        <View style={{ width: 22 }} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>General</Text>
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>App Name</Text>
          <TextInput
            style={styles.settingInput}
            value={appName}
            onChangeText={setAppName}
            onBlur={() => updateSettingsMut.mutate({ app_name: appName })}
          />
        </View>
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Founder Name</Text>
          <TextInput
            style={styles.settingInput}
            value={founderName}
            onChangeText={setFounderName}
            placeholder="Your name"
            placeholderTextColor={Colors.textTertiary}
            onBlur={() => updateSettingsMut.mutate({ founder_name: founderName })}
          />
        </View>
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Beta Slot Total</Text>
          <TextInput
            style={[styles.settingInput, { width: 80, textAlign: "right" }]}
            value={betaTotal}
            onChangeText={setBetaTotal}
            keyboardType="numeric"
            onBlur={() => updateSettingsMut.mutate({ beta_slots_total: betaTotal })}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Integrations</Text>
        <View style={styles.integrationRow}>
          <View style={styles.integrationIcon}>
            <Feather name="mail" size={18} color={Colors.success} />
          </View>
          <View style={styles.integrationInfo}>
            <Text style={styles.integrationName}>Gmail</Text>
            <Text style={styles.integrationStatus}>Connected</Text>
          </View>
          <View style={styles.connectedDot} />
        </View>
        <View style={styles.integrationRow}>
          <View style={styles.integrationIcon}>
            <Feather name="book" size={18} color={Colors.primary} />
          </View>
          <View style={styles.integrationInfo}>
            <Text style={styles.integrationName}>Notion</Text>
            <Text style={styles.integrationStatus}>Connected</Text>
          </View>
          <View style={styles.connectedDot} />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notion Sync</Text>
        <Text style={styles.sectionSubtitle}>Paste your Notion database IDs to sync data automatically.</Text>
        <View style={styles.notionDbRow}>
          <Text style={styles.notionDbLabel}>Leads DB</Text>
          <TextInput
            style={styles.notionDbInput}
            value={notionLeadsDb}
            onChangeText={setNotionLeadsDb}
            placeholder="Notion database ID"
            placeholderTextColor={Colors.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
            onBlur={() => updateSettingsMut.mutate({ notion_leads_db: notionLeadsDb })}
          />
        </View>
        <View style={styles.notionDbRow}>
          <Text style={styles.notionDbLabel}>Contacts DB</Text>
          <TextInput
            style={styles.notionDbInput}
            value={notionContactsDb}
            onChangeText={setNotionContactsDb}
            placeholder="Notion database ID"
            placeholderTextColor={Colors.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
            onBlur={() => updateSettingsMut.mutate({ notion_contacts_db: notionContactsDb })}
          />
        </View>
        <View style={styles.notionDbRow}>
          <Text style={styles.notionDbLabel}>Activities DB</Text>
          <TextInput
            style={styles.notionDbInput}
            value={notionActivitiesDb}
            onChangeText={setNotionActivitiesDb}
            placeholder="Notion database ID"
            placeholderTextColor={Colors.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
            onBlur={() => updateSettingsMut.mutate({ notion_activities_db: notionActivitiesDb })}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Trigger Rules</Text>
        <Text style={styles.sectionSubtitle}>Things that happen automatically so you don't have to.</Text>
        {triggers.map((t: any) => (
          <View key={t.id} style={styles.triggerCard}>
            <View style={styles.triggerInfo}>
              <Text style={styles.triggerText}>
                When lead → <Text style={{ fontFamily: "LeagueSpartan_600SemiBold" }}>{t.triggerStatus}</Text>
              </Text>
              <Text style={styles.triggerAction}>
                {t.actionType === "enroll_sequence" ? `Start sequence #${t.sequenceId}` : `Follow up in ${t.followUpDays} days`}
              </Text>
            </View>
            <Pressable onPress={() => deleteTriggerMut.mutate(t.id)}>
              <Feather name="x" size={18} color={Colors.error} />
            </Pressable>
          </View>
        ))}

        <View style={styles.addTrigger}>
          <Text style={styles.addTriggerTitle}>Add Rule</Text>
          <View style={styles.formGroup}>
            <Text style={styles.label}>When status becomes</Text>
            <View style={styles.chipRow}>
              {STATUSES.map((s) => (
                <Pressable key={s} style={[styles.chip, newTriggerStatus === s && styles.chipActive]} onPress={() => setNewTriggerStatus(s)}>
                  <Text style={[styles.chipText, newTriggerStatus === s && styles.chipTextActive]}>{s}</Text>
                </Pressable>
              ))}
            </View>
          </View>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Action</Text>
            <View style={styles.chipRow}>
              {ACTION_TYPES.map((a) => (
                <Pressable key={a} style={[styles.chip, newTriggerAction === a && styles.chipActive]} onPress={() => setNewTriggerAction(a)}>
                  <Text style={[styles.chipText, newTriggerAction === a && styles.chipTextActive]}>{a.replace("_", " ")}</Text>
                </Pressable>
              ))}
            </View>
          </View>
          {newTriggerAction === "enroll_sequence" && sequences.length > 0 && (
            <View style={styles.formGroup}>
              <Text style={styles.label}>Sequence</Text>
              {sequences.map((s: any) => (
                <Pressable key={s.id} style={[styles.seqOption, newTriggerSeqId === s.id && { backgroundColor: Colors.primary }]} onPress={() => setNewTriggerSeqId(s.id)}>
                  <Text style={[styles.seqOptionText, newTriggerSeqId === s.id && { color: "#fff" }]}>{s.name}</Text>
                </Pressable>
              ))}
            </View>
          )}
          {newTriggerAction === "schedule_followup" && (
            <View style={styles.formGroup}>
              <Text style={styles.label}>Days until follow-up</Text>
              <TextInput style={styles.settingInput} value={newTriggerDays} onChangeText={setNewTriggerDays} keyboardType="numeric" />
            </View>
          )}
          <Pressable
            style={[styles.addBtn, (!newTriggerStatus || !newTriggerAction) && { opacity: 0.4 }]}
            onPress={() => newTriggerStatus && newTriggerAction && createTriggerMut.mutate()}
            disabled={!newTriggerStatus || !newTriggerAction}
          >
            <Text style={styles.addBtnText}>Add Rule</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Merge Tags</Text>
        <View style={styles.mergeTagCard}>
          <View style={styles.mergeRow}><Text style={styles.mergeTag}>{"{{first_name}}"}</Text><Text style={styles.mergeDesc}>Their first name</Text></View>
          <View style={styles.mergeRow}><Text style={styles.mergeTag}>{"{{company_name}}"}</Text><Text style={styles.mergeDesc}>Their company</Text></View>
          <View style={styles.mergeRow}><Text style={styles.mergeTag}>{"{{founder_name}}"}</Text><Text style={styles.mergeDesc}>Your name</Text></View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        {user && (
          <View style={styles.integrationRow}>
            <View style={[styles.integrationIcon, { backgroundColor: Colors.primary }]}>
              <Text style={{ color: Colors.accent, fontFamily: "Lato_700Bold", fontSize: 16 }}>
                {(user.firstName?.[0] || user.email?.[0] || "?").toUpperCase()}
              </Text>
            </View>
            <View style={styles.integrationInfo}>
              <Text style={styles.integrationName}>
                {[user.firstName, user.lastName].filter(Boolean).join(" ") || "User"}
              </Text>
              {user.email && (
                <Text style={styles.integrationStatus}>{user.email}</Text>
              )}
            </View>
          </View>
        )}
        <Pressable
          style={[styles.addBtn, { backgroundColor: Colors.error, marginTop: 12 }]}
          onPress={() => {
            Alert.alert("Log out?", "You'll need to sign in again.", [
              { text: "Stay", style: "cancel" },
              { text: "Log Out", style: "destructive", onPress: () => logout() },
            ]);
          }}
        >
          <Text style={styles.addBtnText}>Log Out</Text>
        </Pressable>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20 },
  topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  title: { fontSize: 20, fontFamily: "Lato_700Bold", color: Colors.text },
  section: { marginBottom: 28 },
  sectionTitle: { fontSize: 16, fontFamily: "LeagueSpartan_600SemiBold", color: Colors.text, marginBottom: 4 },
  sectionSubtitle: { fontSize: 13, fontFamily: "Montserrat_400Regular", color: Colors.textTertiary, marginBottom: 12 },
  settingRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: Colors.surface, borderRadius: 12, padding: 14, marginTop: 8 },
  settingLabel: { fontSize: 14, fontFamily: "SpaceGrotesk_500Medium", color: Colors.text },
  settingInput: { fontSize: 14, fontFamily: "SpaceGrotesk_400Regular", color: Colors.text, backgroundColor: Colors.surfaceSecondary, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, minWidth: 120 },
  integrationRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: Colors.surface, borderRadius: 12, padding: 14, marginTop: 8 },
  integrationIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.surfaceSecondary, justifyContent: "center", alignItems: "center" },
  integrationInfo: { flex: 1 },
  integrationName: { fontSize: 14, fontFamily: "LeagueSpartan_600SemiBold", color: Colors.text },
  integrationStatus: { fontSize: 12, fontFamily: "SpaceGrotesk_400Regular", color: Colors.success },
  connectedDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.success },
  triggerCard: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.surface, borderRadius: 12, padding: 14, marginTop: 8 },
  triggerInfo: { flex: 1 },
  triggerText: { fontSize: 14, fontFamily: "SpaceGrotesk_400Regular", color: Colors.text },
  triggerAction: { fontSize: 12, fontFamily: "SpaceGrotesk_400Regular", color: Colors.textSecondary, marginTop: 2 },
  addTrigger: { backgroundColor: Colors.surfaceSecondary, borderRadius: 14, padding: 16, marginTop: 12 },
  addTriggerTitle: { fontSize: 15, fontFamily: "LeagueSpartan_600SemiBold", color: Colors.text, marginBottom: 12 },
  formGroup: { marginBottom: 14 },
  label: { fontSize: 12, fontFamily: "Montserrat_600SemiBold", color: Colors.textSecondary, marginBottom: 6, textTransform: "uppercase" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 12, fontFamily: "SpaceGrotesk_500Medium", color: Colors.text, textTransform: "capitalize" },
  chipTextActive: { color: "#fff" },
  seqOption: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, backgroundColor: Colors.surface, marginBottom: 6 },
  seqOptionText: { fontSize: 14, fontFamily: "SpaceGrotesk_500Medium", color: Colors.text },
  addBtn: { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  addBtnText: { fontSize: 14, fontFamily: "LeagueSpartan_600SemiBold", color: "#fff" },
  mergeTagCard: { backgroundColor: Colors.surface, borderRadius: 12, padding: 14, marginTop: 8, gap: 8 },
  mergeRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  mergeTag: { fontSize: 13, fontFamily: "LeagueSpartan_600SemiBold", color: Colors.info, backgroundColor: Colors.info + "10", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: "hidden" },
  mergeDesc: { fontSize: 13, fontFamily: "SpaceGrotesk_400Regular", color: Colors.textSecondary },
  notionDbRow: { backgroundColor: Colors.surface, borderRadius: 12, padding: 14, marginTop: 8 },
  notionDbLabel: { fontSize: 12, fontFamily: "Montserrat_600SemiBold", color: Colors.textSecondary, marginBottom: 6, textTransform: "uppercase" },
  notionDbInput: { fontSize: 13, fontFamily: "SpaceGrotesk_400Regular", color: Colors.text, backgroundColor: Colors.surfaceSecondary, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
});
