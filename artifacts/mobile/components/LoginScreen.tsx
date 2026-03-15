import React from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/lib/auth";
import colors from "@/constants/colors";

const saIconWhite = require("@/assets/images/sa-icon-white.png");

export function LoginScreen() {
  const { login, register, isLoading } = useAuth();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [isRegistering, setIsRegistering] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const passwordRef = React.useRef<TextInput>(null);

  const handleSubmit = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      Alert.alert("Email required", "Please enter your email address.");
      return;
    }
    if (!password) {
      Alert.alert("Password required", "Please enter your password.");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Password too short", "Password must be at least 6 characters.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (isRegistering) {
        await register(trimmedEmail, password, firstName.trim() || undefined, lastName.trim() || undefined);
      } else {
        await login(trimmedEmail, password);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong.";
      Alert.alert(isRegistering ? "Registration failed" : "Login failed", message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.logoContainer}>
            <View style={styles.logoCircle}>
              <Image source={saIconWhite} style={styles.logoImage} resizeMode="contain" />
            </View>
            <Text style={styles.title}>Startup Anthology</Text>
            <Text style={styles.subtitle}>
              Your relationships. Your pipeline. One place.
            </Text>
          </View>

          {!isRegistering && (
            <View style={styles.features}>
              <FeatureItem icon="📊" text="See your full pipeline, clearly" />
              <FeatureItem icon="👥" text="Know who to follow up with and when" />
              <FeatureItem icon="📧" text="Reach out without the busywork" />
              <FeatureItem icon="🎯" text="Track what matters to your launch" />
            </View>
          )}

          {isRegistering && (
            <View style={styles.nameRow}>
              <TextInput
                style={[styles.input, styles.nameInput]}
                placeholder="First name"
                placeholderTextColor={colors.textTertiary}
                value={firstName}
                onChangeText={setFirstName}
                autoCapitalize="words"
                editable={!isSubmitting && !isLoading}
                returnKeyType="next"
              />
              <TextInput
                style={[styles.input, styles.nameInput]}
                placeholder="Last name"
                placeholderTextColor={colors.textTertiary}
                value={lastName}
                onChangeText={setLastName}
                autoCapitalize="words"
                editable={!isSubmitting && !isLoading}
                returnKeyType="next"
              />
            </View>
          )}

          <TextInput
            style={styles.input}
            placeholder="you@example.com"
            placeholderTextColor={colors.textTertiary}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            editable={!isSubmitting && !isLoading}
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
          />

          <TextInput
            ref={passwordRef}
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={colors.textTertiary}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete={isRegistering ? "new-password" : "current-password"}
            editable={!isSubmitting && !isLoading}
            returnKeyType="go"
            onSubmitEditing={handleSubmit}
          />

          <TouchableOpacity
            style={styles.submitButton}
            onPress={handleSubmit}
            disabled={isSubmitting || isLoading}
            activeOpacity={0.8}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitButtonText}>
                {isRegistering ? "Create Account" : "Log In"}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setIsRegistering(!isRegistering)}
            disabled={isSubmitting}
            activeOpacity={0.7}
          >
            <Text style={styles.toggleText}>
              {isRegistering
                ? "Already have an account? Log in"
                : "Don't have an account? Sign up"}
            </Text>
          </TouchableOpacity>

          <Text style={styles.footerText}>
            Built for founders doing the work.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function FeatureItem({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={styles.featureItem}>
      <Text style={styles.featureIcon}>{icon}</Text>
      <Text style={styles.featureText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
    paddingVertical: 24,
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 32,
  },
  logoCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  logoImage: {
    width: 64,
    height: 64,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.primary,
    fontFamily: "Lato_700Bold",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    fontFamily: "Montserrat_500Medium",
    textAlign: "center",
  },
  features: {
    width: "100%",
    marginBottom: 24,
    gap: 16,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  featureIcon: {
    fontSize: 20,
  },
  featureText: {
    fontSize: 15,
    color: colors.text,
    fontFamily: "SpaceGrotesk_500Medium",
  },
  nameRow: {
    flexDirection: "row",
    width: "100%",
    gap: 10,
    marginBottom: 0,
  },
  nameInput: {
    flex: 1,
    marginBottom: 12,
  },
  input: {
    width: "100%",
    height: 56,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: colors.text,
    fontFamily: "SpaceGrotesk_400Regular",
    backgroundColor: colors.surface,
    marginBottom: 12,
  },
  submitButton: {
    width: "100%",
    backgroundColor: colors.accent,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    height: 56,
    marginBottom: 12,
  },
  submitButtonText: {
    fontSize: 17,
    fontWeight: "600",
    color: "#FFFFFF",
    fontFamily: "LeagueSpartan_600SemiBold",
  },
  toggleText: {
    fontSize: 14,
    color: colors.accent,
    fontFamily: "SpaceGrotesk_500Medium",
    textAlign: "center",
  },
  footerText: {
    marginTop: 16,
    fontSize: 13,
    color: colors.textTertiary,
    fontFamily: "Montserrat_400Regular",
  },
});
