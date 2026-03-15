import { Feather } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState, useMemo } from "react";
import {
  ActivityIndicator,
  Alert,
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
import EventDetailModal from "@/components/EventDetailModal";
import FriendlyDateTimePicker from "@/components/FriendlyDateTimePicker";
import Colors from "@/constants/colors";
import Layout from "@/constants/layout";
import { api } from "@/lib/api";

const EVENT_TYPE_COLORS: Record<string, string> = {
  demo: Colors.statusNew,
  "follow-up": Colors.warning,
  meeting: Colors.info,
  email: Colors.success,
  other: Colors.textTertiary,
};

const EVENT_TYPES = ["demo", "follow-up", "meeting", "other"];

function getWeekRange(date: Date) {
  const start = new Date(date);
  start.setDate(start.getDate() - start.getDay());
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return { start, end };
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatDateShort(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function CalendarScreen() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);

  const baseDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + weekOffset * 7);
    return d;
  }, [weekOffset]);

  const { start: weekStart, end: weekEnd } = useMemo(() => getWeekRange(baseDate), [baseDate]);

  const updateEventMut = useMutation({
    mutationFn: ({ evId, data }: { evId: number; data: any }) => api.updateCalendarEvent(evId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["calendarEvents"] });
      setSelectedEvent(null);
    },
    onError: (err: Error) => Alert.alert("Update failed", err.message),
  });

  const { data: events = [], isLoading, refetch } = useQuery({
    queryKey: ["calendarEvents", weekStart.toISOString(), weekEnd.toISOString()],
    queryFn: () => api.getCalendarEvents({
      startDate: weekStart.toISOString(),
      endDate: weekEnd.toISOString(),
    }),
  });

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const dayGroups = useMemo(() => {
    const days: { date: Date; label: string; events: any[] }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      const dayEvents = events.filter((e: any) => isSameDay(new Date(e.startTime), d));
      days.push({
        date: d,
        label: d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" }),
        events: dayEvents,
      });
    }
    return days;
  }, [events, weekStart]);

  const weekLabel = `${weekStart.toLocaleDateString([], { month: "short", day: "numeric" })} – ${new Date(weekEnd.getTime() - 1).toLocaleDateString([], { month: "short", day: "numeric" })}`;

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Calendar</Text>
        <Pressable onPress={() => router.push("/settings")} hitSlop={10}>
          <Feather name="settings" size={22} color={Colors.text} />
        </Pressable>
      </View>

      <View style={styles.weekNav}>
        <Pressable onPress={() => setWeekOffset((p) => p - 1)} hitSlop={10}>
          <Feather name="chevron-left" size={24} color={Colors.text} />
        </Pressable>
        <Pressable onPress={() => setWeekOffset(0)}>
          <Text style={styles.weekLabel}>{weekLabel}</Text>
        </Pressable>
        <Pressable onPress={() => setWeekOffset((p) => p + 1)} hitSlop={10}>
          <Feather name="chevron-right" size={24} color={Colors.text} />
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} tintColor={Colors.primary} />}
        >
          {dayGroups.map((day) => {
            const isToday = isSameDay(day.date, new Date());
            return (
              <View key={day.label} style={styles.dayGroup}>
                <View style={styles.dayHeader}>
                  <View style={[styles.dayDot, isToday && styles.dayDotToday]} />
                  <Text style={[styles.dayLabel, isToday && styles.dayLabelToday]}>{day.label}</Text>
                  {isToday && <Text style={styles.todayBadge}>Today</Text>}
                </View>
                {day.events.length === 0 ? (
                  <Text style={styles.noEvents}>Nothing scheduled</Text>
                ) : (
                  day.events.map((ev: any) => (
                    <Pressable key={ev.id} style={styles.eventCard} onPress={() => setSelectedEvent(ev)}>
                      <View style={[styles.eventStripe, { backgroundColor: EVENT_TYPE_COLORS[ev.eventType] || Colors.textTertiary }]} />
                      <View style={styles.eventBody}>
                        <View style={styles.eventTop}>
                          <Text style={styles.eventTitle} numberOfLines={1}>{ev.title}</Text>
                          <Text style={styles.eventTime}>{formatTime(ev.startTime)}</Text>
                        </View>
                        {ev.description ? <Text style={styles.eventDesc} numberOfLines={1}>{ev.description}</Text> : null}
                        <View style={styles.eventMeta}>
                          <View style={[styles.typeBadge, { backgroundColor: (EVENT_TYPE_COLORS[ev.eventType] || Colors.textTertiary) + "15" }]}>
                            <Text style={[styles.typeText, { color: EVENT_TYPE_COLORS[ev.eventType] || Colors.textTertiary }]}>{ev.eventType}</Text>
                          </View>
                          {ev.leadId && (
                            <Pressable onPress={() => router.push({ pathname: "/lead/[id]", params: { id: String(ev.leadId) } })} style={styles.linkBadge}>
                              <Feather name="target" size={12} color={Colors.info} />
                              <Text style={styles.linkText}>{ev.leadName || `Lead #${ev.leadId}`}</Text>
                            </Pressable>
                          )}
                          {ev.contactId && (
                            <Pressable onPress={() => router.push({ pathname: "/contact/[id]", params: { id: String(ev.contactId) } })} style={styles.linkBadge}>
                              <Feather name="user" size={12} color={Colors.info} />
                              <Text style={styles.linkText}>{ev.contactName || `Contact #${ev.contactId}`}</Text>
                            </Pressable>
                          )}
                        </View>
                      </View>
                    </Pressable>
                  ))
                )}
              </View>
            );
          })}
          <View style={{ height: 100 }} />
        </ScrollView>
      )}

      <Pressable style={styles.fab} onPress={() => setShowCreate(true)}>
        <Feather name="plus" size={24} color="#fff" />
      </Pressable>

      <CreateEventModal
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => {
          setShowCreate(false);
          qc.invalidateQueries({ queryKey: ["calendarEvents"] });
        }}
      />

      <EventDetailModal
        visible={!!selectedEvent}
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
        onSave={(evId, data) => updateEventMut.mutate({ evId, data })}
        isSaving={updateEventMut.isPending}
      />
    </View>
  );
}

function CreateEventModal({ visible, onClose, onCreated }: { visible: boolean; onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventType, setEventType] = useState("other");
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setMinutes(0, 0, 0);
    return d;
  });
  const [duration, setDuration] = useState("30");
  const [linkType, setLinkType] = useState<"none" | "lead" | "contact">("none");
  const [linkId, setLinkId] = useState("");

  const { data: leads = [] } = useQuery({ queryKey: ["leads"], queryFn: () => api.getLeads() });
  const { data: contacts = [] } = useQuery({ queryKey: ["contacts"], queryFn: () => api.getContacts() });

  const createMut = useMutation({
    mutationFn: (data: any) => api.createCalendarEvent(data),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTitle("");
      setDescription("");
      setEventType("other");
      setLinkType("none");
      setLinkId("");
      onCreated();
    },
  });

  const handleCreate = () => {
    if (!title.trim()) return;
    const startTime = startDate.toISOString();
    const endTime = new Date(startDate.getTime() + Number(duration) * 60000).toISOString();
    createMut.mutate({
      title: title.trim(),
      description: description.trim() || undefined,
      startTime,
      endTime,
      eventType,
      leadId: linkType === "lead" && linkId ? Number(linkId) : undefined,
      contactId: linkType === "contact" && linkId ? Number(linkId) : undefined,
    });
  };

  const linkedItems = linkType === "lead" ? leads : linkType === "contact" ? contacts : [];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={modalStyles.container}>
        <View style={modalStyles.header}>
          <Pressable onPress={onClose}>
            <Text style={modalStyles.cancelText}>Cancel</Text>
          </Pressable>
          <Text style={modalStyles.headerTitle}>New Event</Text>
          <Pressable onPress={handleCreate} disabled={!title.trim() || createMut.isPending}>
            <Text style={[modalStyles.saveText, (!title.trim() || createMut.isPending) && { opacity: 0.4 }]}>
              {createMut.isPending ? "Saving..." : "Save"}
            </Text>
          </Pressable>
        </View>

        <ScrollView style={modalStyles.form} contentContainerStyle={modalStyles.formContent}>
          <Text style={modalStyles.label}>Title</Text>
          <TextInput style={modalStyles.input} value={title} onChangeText={setTitle} placeholder="Event title" placeholderTextColor={Colors.textTertiary} />

          <Text style={modalStyles.label}>Type</Text>
          <View style={modalStyles.typeRow}>
            {EVENT_TYPES.map((t) => (
              <Pressable
                key={t}
                style={[modalStyles.typeChip, eventType === t && { backgroundColor: EVENT_TYPE_COLORS[t], borderColor: EVENT_TYPE_COLORS[t] }]}
                onPress={() => setEventType(t)}
              >
                <Text style={[modalStyles.typeChipText, eventType === t && { color: "#fff" }]}>{t}</Text>
              </Pressable>
            ))}
          </View>

          <FriendlyDateTimePicker label="Date & Time" value={startDate} onChange={setStartDate} />

          <Text style={modalStyles.label}>Duration (minutes)</Text>
          <View style={modalStyles.typeRow}>
            {["15", "30", "60", "90"].map((d) => (
              <Pressable
                key={d}
                style={[modalStyles.typeChip, duration === d && { backgroundColor: Colors.primary, borderColor: Colors.primary }]}
                onPress={() => setDuration(d)}
              >
                <Text style={[modalStyles.typeChipText, duration === d && { color: "#fff" }]}>{d}m</Text>
              </Pressable>
            ))}
          </View>

          <Text style={modalStyles.label}>Notes</Text>
          <TextInput style={[modalStyles.input, { minHeight: 60 }]} value={description} onChangeText={setDescription} placeholder="Optional notes" placeholderTextColor={Colors.textTertiary} multiline />

          <Text style={modalStyles.label}>Link to</Text>
          <View style={modalStyles.typeRow}>
            {(["none", "lead", "contact"] as const).map((t) => (
              <Pressable
                key={t}
                style={[modalStyles.typeChip, linkType === t && { backgroundColor: Colors.primary, borderColor: Colors.primary }]}
                onPress={() => { setLinkType(t); setLinkId(""); }}
              >
                <Text style={[modalStyles.typeChipText, linkType === t && { color: "#fff" }]}>{t === "none" ? "None" : t === "lead" ? "Lead" : "Contact"}</Text>
              </Pressable>
            ))}
          </View>

          {linkType !== "none" && linkedItems.length > 0 && (
            <ScrollView style={modalStyles.pickerList} nestedScrollEnabled>
              {linkedItems.map((item: any) => (
                <Pressable
                  key={item.id}
                  style={[modalStyles.pickerItem, linkId === String(item.id) && modalStyles.pickerItemSelected]}
                  onPress={() => setLinkId(String(item.id))}
                >
                  <Text style={[modalStyles.pickerName, linkId === String(item.id) && { color: Colors.primary }]}>{item.name}</Text>
                  {item.email && <Text style={modalStyles.pickerSub}>{item.email}</Text>}
                </Pressable>
              ))}
            </ScrollView>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: Layout.screenPadding, paddingVertical: 16 },
  title: { fontSize: 28, fontFamily: "Lato_700Bold", color: Colors.text },
  weekNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: Layout.screenPadding, paddingBottom: 16 },
  weekLabel: { fontSize: 15, fontFamily: "LeagueSpartan_600SemiBold", color: Colors.text },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  scrollArea: { flex: 1 },
  scrollContent: { paddingHorizontal: Layout.screenPadding },
  dayGroup: { marginBottom: Layout.sectionSpacing },
  dayHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  dayDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.border },
  dayDotToday: { backgroundColor: Colors.primary },
  dayLabel: { fontSize: 14, fontFamily: "LeagueSpartan_600SemiBold", color: Colors.textSecondary },
  dayLabelToday: { color: Colors.text },
  todayBadge: { fontSize: 11, fontFamily: "Lato_700Bold", color: "#fff", backgroundColor: Colors.primary, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  noEvents: { fontSize: 13, fontFamily: "SpaceGrotesk_400Regular", color: Colors.textTertiary, paddingLeft: 16 },
  eventCard: { flexDirection: "row", backgroundColor: Colors.surface, borderRadius: Layout.cardRadius, marginBottom: Layout.cardGap, overflow: "hidden" },
  eventStripe: { width: 4 },
  eventBody: { flex: 1, padding: Layout.cardPadding },
  eventTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  eventTitle: { fontSize: 15, fontFamily: "LeagueSpartan_600SemiBold", color: Colors.text, flex: 1, marginRight: 8 },
  eventTime: { fontSize: 13, fontFamily: "SpaceGrotesk_500Medium", color: Colors.textSecondary },
  eventDesc: { fontSize: 13, fontFamily: "SpaceGrotesk_400Regular", color: Colors.textSecondary, marginTop: 4 },
  eventMeta: { flexDirection: "row", gap: 8, marginTop: 8, flexWrap: "wrap" },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  typeText: { fontSize: 11, fontFamily: "LeagueSpartan_600SemiBold", textTransform: "capitalize" },
  linkBadge: { flexDirection: "row", alignItems: "center", gap: 4 },
  linkText: { fontSize: 12, fontFamily: "SpaceGrotesk_500Medium", color: Colors.info },
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
});

const modalStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: Layout.cardPadding, borderBottomWidth: 1, borderBottomColor: Colors.border },
  cancelText: { fontSize: 16, fontFamily: "SpaceGrotesk_500Medium", color: Colors.textSecondary },
  headerTitle: { fontSize: 17, fontFamily: "LeagueSpartan_600SemiBold", color: Colors.text },
  saveText: { fontSize: 16, fontFamily: "LeagueSpartan_600SemiBold", color: Colors.primary },
  form: { flex: 1 },
  formContent: { padding: Layout.screenPadding, gap: 4 },
  label: { fontSize: 13, fontFamily: "LeagueSpartan_600SemiBold", color: Colors.textSecondary, marginTop: 14, marginBottom: 8 },
  input: { backgroundColor: Colors.surface, borderRadius: Layout.inputRadius, padding: Layout.cardPadding, fontSize: 15, fontFamily: "SpaceGrotesk_400Regular", color: Colors.text },
  typeRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  typeChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: Layout.chipRadius, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  typeChipText: { fontSize: 13, fontFamily: "SpaceGrotesk_500Medium", color: Colors.text, textTransform: "capitalize" },
  pickerList: { maxHeight: 200, backgroundColor: Colors.surface, borderRadius: Layout.inputRadius, marginTop: 8 },
  pickerItem: { padding: Layout.cardPadding, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  pickerItemSelected: { backgroundColor: Colors.primary + "10" },
  pickerName: { fontSize: 14, fontFamily: "SpaceGrotesk_500Medium", color: Colors.text },
  pickerSub: { fontSize: 12, fontFamily: "SpaceGrotesk_400Regular", color: Colors.textSecondary, marginTop: 2 },
});
