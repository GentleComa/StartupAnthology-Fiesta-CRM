import { Feather } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
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

export default function ComposeEmailScreen() {
  const { to, name, leadId, contactId } = useLocalSearchParams<{ to?: string; name?: string; leadId?: string; contactId?: string }>();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [showTemplates, setShowTemplates] = useState(false);

  const { data: templates = [] } = useQuery({
    queryKey: ["templates"],
    queryFn: () => api.getTemplates(),
  });
  const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: api.getSettings });

  const sendMut = useMutation({
    mutationFn: () => api.sendEmail({
      to: to || "",
      subject,
      body,
      leadId: leadId ? Number(leadId) : undefined,
      contactId: contactId ? Number(contactId) : undefined,
    }),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      qc.invalidateQueries({ queryKey: ["activities"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      Alert.alert("Sent", "Email sent successfully", [{ text: "OK", onPress: () => router.back() }]);
    },
    onError: (err: any) => Alert.alert("Error", err.message || "Failed to send email"),
  });

  const applyTemplate = (template: any) => {
    let subj = template.subject;
    let bod = template.body;
    const firstName = name?.split(" ")[0] || "";
    const founderName = settings?.founder_name || "";
    subj = subj.replace(/\{\{first_name\}\}/g, firstName).replace(/\{\{founder_name\}\}/g, founderName);
    bod = bod.replace(/\{\{first_name\}\}/g, firstName).replace(/\{\{founder_name\}\}/g, founderName);
    setSubject(subj);
    setBody(bod);
    setShowTemplates(false);
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
        <Text style={styles.title}>Compose</Text>
        <Pressable
          onPress={() => {
            if (subject && body) sendMut.mutate();
          }}
          disabled={!subject || !body || sendMut.isPending}
        >
          {sendMut.isPending ? (
            <ActivityIndicator size="small" color={Colors.info} />
          ) : (
            <Text style={[styles.sendText, (!subject || !body) && { opacity: 0.4 }]}>Send</Text>
          )}
        </Pressable>
      </View>

      <ScrollView style={styles.form} keyboardShouldPersistTaps="handled">
        <View style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>To</Text>
          <Text style={styles.fieldValue}>{to || "No recipient"}</Text>
        </View>

        <Pressable style={styles.templateBtn} onPress={() => setShowTemplates(!showTemplates)}>
          <Feather name="file-text" size={16} color={Colors.info} />
          <Text style={styles.templateBtnText}>Use Template</Text>
        </Pressable>

        {showTemplates && (
          <View style={styles.templateList}>
            {templates.map((t: any) => (
              <Pressable key={t.id} style={styles.templateItem} onPress={() => applyTemplate(t)}>
                <Text style={styles.templateName}>{t.name}</Text>
                <Text style={styles.templateAudience}>{t.audience}</Text>
              </Pressable>
            ))}
            {templates.length === 0 && <Text style={styles.noTemplates}>No templates available</Text>}
          </View>
        )}

        <View style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>Subject</Text>
          <TextInput
            style={styles.subjectInput}
            value={subject}
            onChangeText={setSubject}
            placeholder="Email subject"
            placeholderTextColor={Colors.textTertiary}
          />
        </View>

        <TextInput
          style={styles.bodyInput}
          value={body}
          onChangeText={setBody}
          placeholder="Write your message..."
          placeholderTextColor={Colors.textTertiary}
          multiline
          textAlignVertical="top"
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  cancelText: { fontSize: 16, fontFamily: "Inter_400Regular", color: Colors.info },
  title: { fontSize: 17, fontFamily: "Inter_600SemiBold", color: Colors.text },
  sendText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: Colors.info },
  form: { flex: 1, padding: 20 },
  fieldRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  fieldLabel: { width: 60, fontSize: 14, fontFamily: "Inter_500Medium", color: Colors.textSecondary },
  fieldValue: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular", color: Colors.text },
  subjectInput: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular", color: Colors.text },
  templateBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  templateBtnText: { fontSize: 14, fontFamily: "Inter_500Medium", color: Colors.info },
  templateList: { backgroundColor: Colors.surface, borderRadius: 12, marginBottom: 12 },
  templateItem: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 12, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  templateName: { fontSize: 14, fontFamily: "Inter_500Medium", color: Colors.text },
  templateAudience: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textTertiary, textTransform: "capitalize" },
  noTemplates: { padding: 12, fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.textTertiary },
  bodyInput: { fontSize: 16, fontFamily: "Inter_400Regular", color: Colors.text, minHeight: 200, paddingTop: 16, lineHeight: 24 },
});
