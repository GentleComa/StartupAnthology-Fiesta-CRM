import { Feather } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import { api } from "@/lib/api";

const SEGMENTS = [
  { type: "lead_status", values: ["new", "contacted", "interested", "engaged", "converted"], label: "Lead Status" },
  { type: "contact_type", values: ["investor", "partner", "advisor", "vendor", "press", "other"], label: "Contact Type" },
];

export default function BroadcastNewScreen() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [segmentType, setSegmentType] = useState("");
  const [segmentValue, setSegmentValue] = useState("");
  const [templateId, setTemplateId] = useState<number | null>(null);

  const { data: templates = [] } = useQuery({
    queryKey: ["templates"],
    queryFn: () => api.getTemplates(),
  });
  const { data: preview, isLoading: previewLoading } = useQuery({
    queryKey: ["broadcastPreview", segmentType, segmentValue],
    queryFn: () => api.previewBroadcastRecipients(segmentType, segmentValue),
    enabled: !!segmentType && !!segmentValue && step >= 2,
  });

  const sendMut = useMutation({
    mutationFn: () => {
      const tmpl = templates.find((t: any) => t.id === templateId);
      return api.createBroadcast({
        subject: tmpl?.subject || "Broadcast",
        segmentType,
        segmentValue,
        templateId,
      });
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      qc.invalidateQueries({ queryKey: ["broadcasts"] });
      Alert.alert("Sent", "Broadcast sent successfully", [{ text: "OK", onPress: () => router.back() }]);
    },
    onError: (err: any) => Alert.alert("Error", err.message || "Failed to send"),
  });

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const selectedTemplate = templates.find((t: any) => t.id === templateId);

  return (
    <ScrollView style={[styles.container, { paddingTop: topPad }]} contentContainerStyle={styles.content}>
      <View style={styles.topBar}>
        <Pressable onPress={() => (step > 0 ? setStep(step - 1) : router.back())}>
          <Text style={styles.backText}>{step > 0 ? "Back" : "Cancel"}</Text>
        </Pressable>
        <Text style={styles.title}>Broadcast</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.stepIndicator}>
        {[0, 1, 2, 3].map((s) => (
          <View key={s} style={[styles.dot, step >= s && styles.dotActive]} />
        ))}
      </View>

      {step === 0 && (
        <View>
          <Text style={styles.stepTitle}>Choose Segment</Text>
          {SEGMENTS.map((seg) => (
            <View key={seg.type}>
              <Text style={styles.segLabel}>{seg.label}</Text>
              <View style={styles.chipRow}>
                {seg.values.map((v) => (
                  <Pressable
                    key={v}
                    style={[styles.chip, segmentType === seg.type && segmentValue === v && styles.chipActive]}
                    onPress={() => { setSegmentType(seg.type); setSegmentValue(v); }}
                  >
                    <Text style={[styles.chipText, segmentType === seg.type && segmentValue === v && styles.chipTextActive]}>{v.replace("_", " ")}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ))}
          <Pressable
            style={[styles.nextBtn, (!segmentType || !segmentValue) && { opacity: 0.4 }]}
            onPress={() => segmentType && segmentValue && setStep(1)}
            disabled={!segmentType || !segmentValue}
          >
            <Text style={styles.nextBtnText}>Next</Text>
          </Pressable>
        </View>
      )}

      {step === 1 && (
        <View>
          <Text style={styles.stepTitle}>Choose Template</Text>
          {templates.map((t: any) => (
            <Pressable key={t.id} style={[styles.templateCard, templateId === t.id && styles.templateCardActive]} onPress={() => setTemplateId(t.id)}>
              <Text style={[styles.templateName, templateId === t.id && { color: "#fff" }]}>{t.name}</Text>
              <Text style={[styles.templateSubject, templateId === t.id && { color: "rgba(255,255,255,0.8)" }]}>{t.subject}</Text>
            </Pressable>
          ))}
          {templates.length === 0 && <Text style={styles.noTemplates}>Create a template first</Text>}
          <Pressable
            style={[styles.nextBtn, !templateId && { opacity: 0.4 }]}
            onPress={() => templateId && setStep(2)}
            disabled={!templateId}
          >
            <Text style={styles.nextBtnText}>Next</Text>
          </Pressable>
        </View>
      )}

      {step === 2 && (
        <View>
          <Text style={styles.stepTitle}>Preview Recipients</Text>
          <View style={styles.previewInfo}>
            <Text style={styles.previewLabel}>Segment: {segmentType.replace("_", " ")} = {segmentValue}</Text>
            <Text style={styles.previewLabel}>Template: {selectedTemplate?.name}</Text>
          </View>
          {previewLoading ? (
            <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 20 }} />
          ) : (
            <>
              <Text style={styles.recipientCount}>{preview?.count || 0} recipients</Text>
              {(preview?.recipients || []).map((r: any, i: number) => (
                <View key={i} style={styles.recipientRow}>
                  <Feather name="user" size={14} color={Colors.textSecondary} />
                  <Text style={styles.recipientName}>{r.name}</Text>
                  <Text style={styles.recipientEmail}>{r.email}</Text>
                </View>
              ))}
              <Pressable style={styles.nextBtn} onPress={() => setStep(3)}>
                <Text style={styles.nextBtnText}>Next</Text>
              </Pressable>
            </>
          )}
        </View>
      )}

      {step === 3 && (
        <View>
          <Text style={styles.stepTitle}>Confirm & Send</Text>
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Segment</Text>
              <Text style={styles.summaryValue}>{segmentValue}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Template</Text>
              <Text style={styles.summaryValue}>{selectedTemplate?.name}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Recipients</Text>
              <Text style={styles.summaryValue}>{preview?.count || 0}</Text>
            </View>
          </View>
          <Pressable
            style={[styles.sendBtn, sendMut.isPending && { opacity: 0.6 }]}
            onPress={() => sendMut.mutate()}
            disabled={sendMut.isPending}
          >
            {sendMut.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Feather name="send" size={18} color="#fff" />
                <Text style={styles.sendBtnText}>Send Broadcast</Text>
              </>
            )}
          </Pressable>
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20 },
  topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  backText: { fontSize: 16, fontFamily: "SpaceGrotesk_400Regular", color: Colors.info },
  title: { fontSize: 17, fontFamily: "LeagueSpartan_600SemiBold", color: Colors.text },
  stepIndicator: { flexDirection: "row", justifyContent: "center", gap: 8, marginBottom: 24 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.border },
  dotActive: { backgroundColor: Colors.primary, width: 20 },
  stepTitle: { fontSize: 20, fontFamily: "Lato_700Bold", color: Colors.text, marginBottom: 16 },
  segLabel: { fontSize: 13, fontFamily: "LeagueSpartan_600SemiBold", color: Colors.textSecondary, marginBottom: 8, marginTop: 12, textTransform: "uppercase" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 13, fontFamily: "SpaceGrotesk_500Medium", color: Colors.text, textTransform: "capitalize" },
  chipTextActive: { color: "#fff" },
  nextBtn: { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 24 },
  nextBtnText: { fontSize: 16, fontFamily: "LeagueSpartan_600SemiBold", color: "#fff" },
  templateCard: { backgroundColor: Colors.surface, borderRadius: 12, padding: 14, marginBottom: 8 },
  templateCardActive: { backgroundColor: Colors.primary },
  templateName: { fontSize: 15, fontFamily: "LeagueSpartan_600SemiBold", color: Colors.text },
  templateSubject: { fontSize: 13, fontFamily: "SpaceGrotesk_400Regular", color: Colors.textSecondary, marginTop: 2 },
  noTemplates: { fontSize: 14, fontFamily: "SpaceGrotesk_400Regular", color: Colors.textTertiary, textAlign: "center", paddingVertical: 20 },
  previewInfo: { backgroundColor: Colors.surfaceSecondary, borderRadius: 12, padding: 14, marginBottom: 12, gap: 4 },
  previewLabel: { fontSize: 13, fontFamily: "SpaceGrotesk_500Medium", color: Colors.textSecondary, textTransform: "capitalize" },
  recipientCount: { fontSize: 16, fontFamily: "Lato_700Bold", color: Colors.text, marginBottom: 12 },
  recipientRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  recipientName: { flex: 1, fontSize: 14, fontFamily: "SpaceGrotesk_500Medium", color: Colors.text },
  recipientEmail: { fontSize: 13, fontFamily: "SpaceGrotesk_400Regular", color: Colors.textSecondary },
  summaryCard: { backgroundColor: Colors.surface, borderRadius: 14, padding: 16, marginBottom: 24, gap: 12 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between" },
  summaryLabel: { fontSize: 14, fontFamily: "SpaceGrotesk_500Medium", color: Colors.textSecondary },
  summaryValue: { fontSize: 14, fontFamily: "LeagueSpartan_600SemiBold", color: Colors.text, textTransform: "capitalize" },
  sendBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: Colors.success, borderRadius: 12, paddingVertical: 16 },
  sendBtnText: { fontSize: 16, fontFamily: "LeagueSpartan_600SemiBold", color: "#fff" },
});
