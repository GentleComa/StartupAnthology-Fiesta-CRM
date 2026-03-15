import React from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import Colors from "@/constants/colors";

interface Activity {
  id: number;
  type: string;
  direction?: string;
  subject?: string;
  note?: string;
  createdAt: string;
  gmailLink?: string;
}

interface ActivityListProps {
  activities: Activity[];
  emptyMessage?: string;
}

const TYPE_COLORS: Record<string, string> = {
  email: Colors.info,
  linkedin: "#0A66C2",
  note: Colors.accent,
};

export default function ActivityList({
  activities,
  emptyMessage = "No activity yet. Every touchpoint counts.",
}: ActivityListProps) {
  if (activities.length === 0) {
    return <Text style={styles.empty}>{emptyMessage}</Text>;
  }

  return (
    <>
      {activities.map((a) => (
        <Pressable
          key={a.id}
          style={styles.item}
          onPress={() => a.gmailLink && Linking.openURL(a.gmailLink)}
        >
          <View
            style={[
              styles.dot,
              { backgroundColor: TYPE_COLORS[a.type] || Colors.textTertiary },
            ]}
          />
          <View style={styles.content}>
            <Text style={styles.type}>
              {a.type}
              {a.direction ? ` (${a.direction})` : ""}
            </Text>
            <Text style={styles.note} numberOfLines={2}>
              {a.subject || a.note || ""}
            </Text>
            <Text style={styles.date}>{new Date(a.createdAt).toLocaleDateString()}</Text>
            {a.gmailLink && <Text style={styles.gmailLink}>Open in Gmail →</Text>}
          </View>
        </Pressable>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  empty: { fontSize: 14, fontFamily: "SpaceGrotesk_400Regular", color: Colors.textTertiary },
  item: { flexDirection: "row", gap: 10, marginBottom: 14 },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  content: { flex: 1 },
  type: {
    fontSize: 13,
    fontFamily: "LeagueSpartan_600SemiBold",
    color: Colors.text,
    textTransform: "capitalize",
  },
  note: {
    fontSize: 13,
    fontFamily: "SpaceGrotesk_400Regular",
    color: Colors.textSecondary,
    marginTop: 2,
  },
  date: {
    fontSize: 12,
    fontFamily: "SpaceGrotesk_400Regular",
    color: Colors.textTertiary,
    marginTop: 2,
  },
  gmailLink: {
    fontSize: 12,
    fontFamily: "SpaceGrotesk_500Medium",
    color: Colors.info,
    marginTop: 2,
  },
});
