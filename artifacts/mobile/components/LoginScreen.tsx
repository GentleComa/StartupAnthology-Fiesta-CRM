import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/lib/auth";
import colors from "@/constants/colors";

export function LoginScreen() {
  const { login, isLoading } = useAuth();
  const [isLoggingIn, setIsLoggingIn] = React.useState(false);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      await login();
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoText}>A</Text>
          </View>
          <Text style={styles.title}>Anthology CRM</Text>
          <Text style={styles.subtitle}>
            Your startup relationships, organized.
          </Text>
        </View>

        <View style={styles.features}>
          <FeatureItem icon="📊" text="Track leads through your funnel" />
          <FeatureItem icon="👥" text="Manage business connections" />
          <FeatureItem icon="📧" text="Send emails & drip sequences" />
          <FeatureItem icon="🎯" text="Monitor beta slot progress" />
        </View>

        <TouchableOpacity
          style={styles.loginButton}
          onPress={handleLogin}
          disabled={isLoggingIn || isLoading}
          activeOpacity={0.8}
        >
          {isLoggingIn ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Text style={styles.loginButtonText}>Log In</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.footerText}>
          Sign in to get started
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
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  logoText: {
    fontSize: 36,
    fontWeight: "700",
    color: colors.accent,
    fontFamily: "Inter_700Bold",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.primary,
    fontFamily: "Inter_700Bold",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  features: {
    width: "100%",
    marginBottom: 48,
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
    fontFamily: "Inter_500Medium",
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
    color: colors.primary,
    fontFamily: "Inter_600SemiBold",
  },
  footerText: {
    marginTop: 16,
    fontSize: 13,
    color: colors.textTertiary,
    fontFamily: "Inter_400Regular",
  },
});
