import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import {
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import Layout from "@/constants/layout";

const saIconWhite = require("@/assets/images/sa-icon-white.png");

const MENU_ITEMS = [
  { label: "Files", icon: "folder", route: "/(tabs)/files" },
  { label: "Communications", icon: "mail", route: "/(tabs)/comms" },
  { label: "Settings", icon: "settings", route: "/settings" },
] as const;

export default function MoreScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <ScrollView
      style={[styles.container, { paddingTop: topPad }]}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
    >
      <View style={styles.headerRow}>
        <View style={styles.headerLogo}>
          <Image source={saIconWhite} style={styles.headerLogoImage} resizeMode="contain" />
        </View>
        <View>
          <Text style={styles.title}>More</Text>
          <Text style={styles.subtitle}>Files, communications & settings.</Text>
        </View>
      </View>

      <View style={styles.menuCard}>
        {MENU_ITEMS.map((item, idx) => (
          <Pressable
            key={item.label}
            style={[styles.menuItem, idx < MENU_ITEMS.length - 1 && styles.menuItemBorder]}
            onPress={() => router.push(item.route as any)}
          >
            <View style={styles.menuIconWrap}>
              <Feather name={item.icon as any} size={20} color={Colors.accent} />
            </View>
            <Text style={styles.menuLabel}>{item.label}</Text>
            <Feather name="chevron-right" size={18} color={Colors.textTertiary} />
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Layout.screenPadding },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 24 },
  headerLogo: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.primary, justifyContent: "center", alignItems: "center" },
  headerLogoImage: { width: 20, height: 20 },
  title: { fontSize: 22, fontFamily: "LeagueSpartan_700Bold", color: Colors.text },
  subtitle: { fontSize: 13, fontFamily: "SpaceGrotesk_400Regular", color: Colors.textSecondary, marginTop: 2 },
  menuCard: { backgroundColor: Colors.surface, borderRadius: Layout.cardRadius, overflow: "hidden" },
  menuItem: { flexDirection: "row", alignItems: "center", padding: 16, gap: 14 },
  menuItemBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border },
  menuIconWrap: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.accent + "15", justifyContent: "center", alignItems: "center" },
  menuLabel: { flex: 1, fontSize: 16, fontFamily: "SpaceGrotesk_500Medium", color: Colors.text },
});
