import { Feather } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as DocumentPicker from "expo-document-picker";
import * as Haptics from "expo-haptics";
import React from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import { api } from "@/lib/api";

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(mimeType: string): string {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.includes("pdf")) return "file-text";
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) return "grid";
  if (mimeType.includes("presentation") || mimeType.includes("powerpoint")) return "monitor";
  if (mimeType.includes("word") || mimeType.includes("document")) return "file-text";
  return "file";
}

export default function FilesScreen() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const { data: files = [], isLoading } = useQuery({
    queryKey: ["files"],
    queryFn: () => api.getFiles(),
  });

  const uploadMut = useMutation({
    mutationFn: async () => {
      const result = await DocumentPicker.getDocumentAsync({ type: "*/*", copyToCacheDirectory: true });
      if (result.canceled) throw new Error("CANCELLED");
      const asset = result.assets[0];
      return api.uploadFile(asset.uri, asset.name, asset.mimeType || "application/octet-stream");
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      qc.invalidateQueries({ queryKey: ["files"] });
    },
    onError: (err: any) => {
      if (err.message === "CANCELLED") return;
      Alert.alert("Upload failed", err.message);
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => api.deleteFile(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["files"] }),
  });

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.fileCard}>
      <View style={styles.fileIconWrap}>
        <Feather name={getFileIcon(item.mimeType) as any} size={20} color={Colors.info} />
      </View>
      <View style={styles.fileInfo}>
        <Text style={styles.fileName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.fileMeta}>{formatSize(item.size)} · {new Date(item.createdAt).toLocaleDateString()}</Text>
      </View>
      <Pressable
        onPress={() => Alert.alert("Delete file?", item.name, [
          { text: "Cancel", style: "cancel" },
          { text: "Delete", style: "destructive", onPress: () => deleteMut.mutate(item.id) },
        ])}
        hitSlop={8}
      >
        <Feather name="trash-2" size={18} color={Colors.error} />
      </Pressable>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <Text style={styles.title}>File Library</Text>
        <Pressable style={styles.uploadBtn} onPress={() => uploadMut.mutate()} disabled={uploadMut.isPending}>
          {uploadMut.isPending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Feather name="upload" size={16} color="#fff" />
              <Text style={styles.uploadText}>Upload</Text>
            </>
          )}
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>
      ) : files.length === 0 ? (
        <View style={styles.center}>
          <Feather name="folder" size={48} color={Colors.textTertiary} />
          <Text style={styles.emptyText}>No files yet</Text>
          <Text style={styles.emptySubtext}>Upload pitch decks, one-pagers, and more</Text>
        </View>
      ) : (
        <FlatList
          data={files}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  title: { fontSize: 22, fontFamily: "LeagueSpartan_700Bold", color: Colors.text },
  uploadBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  uploadText: { fontSize: 14, fontFamily: "SpaceGrotesk_600SemiBold", color: "#fff" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 8 },
  emptyText: { fontSize: 16, fontFamily: "LeagueSpartan_600SemiBold", color: Colors.textSecondary },
  emptySubtext: { fontSize: 14, fontFamily: "SpaceGrotesk_400Regular", color: Colors.textTertiary },
  list: { padding: 16 },
  fileCard: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.surface, borderRadius: 12, padding: 14, marginBottom: 8, gap: 12 },
  fileIconWrap: { width: 40, height: 40, borderRadius: 10, backgroundColor: Colors.info + "15", justifyContent: "center", alignItems: "center" },
  fileInfo: { flex: 1 },
  fileName: { fontSize: 14, fontFamily: "SpaceGrotesk_500Medium", color: Colors.text },
  fileMeta: { fontSize: 12, fontFamily: "SpaceGrotesk_400Regular", color: Colors.textTertiary, marginTop: 2 },
});
