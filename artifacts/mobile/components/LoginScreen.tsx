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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/lib/auth";
import colors from "@/constants/colors";

const saIconWhite = require("@/assets/images/sa-icon-white.png");

export function LoginScreen() {
  const { login, isLoading } = useAuth();
  const [email, setEmail] = React.useState("");
  const [isLoggingIn, setIsLoggingIn] = React.useState(false);

  const handleLogin = async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      Alert.alert("Email required", "Please enter your email address.");
      return;
    }
    setIsLoggingIn(true);
    try {
      await login(trimmed);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong.";
      Alert.alert("Login failed", message);
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <View style={styles.logoCircle}>
            <Image source={saIconWhite} style={styles.logoImage} resizeMode="contain" />
          </View>
          <Text style={styles.title}>Startup Anthology</Text>
          <Text style={styles.subtitle}>
            Your relationships. Your pipeline. One place.
          </Text>
        </View>

        <View style={styles.features}>
          <FeatureItem icon="📊" text="See your full pipeline, clearly" />
          <FeatureItem icon="👥" text="Know who to follow up with and when" />
          <FeatureItem icon="📧" text="Reach out without the busywork" />
          <FeatureItem icon="🎯" text="Track what matters to your launch" />
        </View>

        <TextInput
          style={styles.emailInput}
          placeholder="you@example.com"
          placeholderTextColor={colors.textTertiary}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          editable={!isLoggingIn && !isLoading}
          returnKeyType="go"
          onSubmitEditing={handleLogin}
        />

        <TouchableOpacity
          style={styles.loginButton}
          onPress={handleLogin}
          disabled={isLoggingIn || isLoading}
          activeOpacity={0.8}
        >
          {isLoggingIn ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.loginButtonText}>Log In</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.footerText}>
          Built for founders doing the work.
        </Text>
      </View>
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
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 48,
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
    marginBottom: 32,
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
  emailInput: {
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
  loginButton: {
    width: "100%",
    backgroundColor: colors.accent,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    height: 56,
  },
  loginButtonText: {
    fontSize: 17,
    fontWeight: "600",
    color: "#FFFFFF",
    fontFamily: "LeagueSpartan_600SemiBold",
  },
  footerText: {
    marginTop: 16,
    fontSize: 13,
    color: colors.textTertiary,
    fontFamily: "Montserrat_400Regular",
  },
});
