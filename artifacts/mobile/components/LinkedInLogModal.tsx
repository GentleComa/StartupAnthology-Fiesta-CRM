import React, { useState, useCallback, useEffect } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Colors from "@/constants/colors";

interface LinkedInLogModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (subject: string, message: string) => void;
  isPending: boolean;
}

export default function LinkedInLogModal({
  visible,
  onClose,
  onSubmit,
  isPending,
}: LinkedInLogModalProps) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!visible) {
      setSubject("");
      setMessage("");
    }
  }, [visible]);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleSubmit = useCallback(() => {
    onSubmit(subject, message);
  }, [subject, message, onSubmit]);

  const isDisabled = !subject && !message;

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.content}>
          <Text style={styles.title}>Log LinkedIn Message</Text>
          <TextInput
            style={styles.input}
            placeholder="Subject / Context"
            placeholderTextColor={Colors.textTertiary}
            value={subject}
            onChangeText={setSubject}
          />
          <TextInput
            style={[styles.input, { minHeight: 80, textAlignVertical: "top" }]}
            placeholder="Message content"
            placeholderTextColor={Colors.textTertiary}
            value={message}
            onChangeText={setMessage}
            multiline
          />
          <View style={styles.actions}>
            <Pressable style={styles.cancelBtn} onPress={handleClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.saveBtn, isDisabled && { opacity: 0.4 }]}
              disabled={isDisabled}
              onPress={handleSubmit}
            >
              {isPending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.saveText}>Save</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  content: {
    backgroundColor: Colors.background,
    borderRadius: 16,
    padding: 20,
    width: "100%",
    maxWidth: 400,
  },
  title: {
    fontSize: 18,
    fontFamily: "LeagueSpartan_700Bold",
    color: Colors.text,
    marginBottom: 16,
  },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    fontFamily: "SpaceGrotesk_400Regular",
    color: Colors.text,
    marginBottom: 12,
  },
  actions: { flexDirection: "row", gap: 10, marginTop: 4 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
  },
  cancelText: {
    fontSize: 14,
    fontFamily: "SpaceGrotesk_500Medium",
    color: Colors.textSecondary,
  },
  saveBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: Colors.info,
    alignItems: "center",
  },
  saveText: { fontSize: 14, fontFamily: "SpaceGrotesk_600SemiBold", color: "#fff" },
});
