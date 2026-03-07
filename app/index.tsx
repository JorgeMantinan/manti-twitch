import React, { useState, useEffect } from 'react';
import {
  ImageBackground,
  ScrollView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Linking,
  Platform,
  SafeAreaView,
  StatusBar,
  Dimensions
} from 'react-native';
import { useRouter, RelativePathString } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { jwtDecode } from "jwt-decode";

export default function App() {

  const router = useRouter();
  const [authUrl] = useState<string>(
    "https://manti-twitch-backend.onrender.com/auth/twitch"
  );

  const [isLogged, setIsLogged] = useState(false);
  const [scopes, setScopes] = useState<string[]>([]);

  const getToken = async () => {
    if (Platform.OS === "web") {
      return localStorage.getItem("userToken");
    } else {
      return await SecureStore.getItemAsync("userToken");
    }
  };

  /* ========================== */
  const saveToken = async (token: string) => {
    if (Platform.OS === "web") {
      localStorage.setItem("userToken", token);
    } else {
      await SecureStore.setItemAsync("userToken", token);
    }

    setIsLogged(true);
  };

  const resetToken = async () => {
    if (Platform.OS === "web") {
      localStorage.removeItem("userToken");
    } else {
      await SecureStore.deleteItemAsync("userToken");
    }

    setIsLogged(false);

    if (Platform.OS === "web") {
      window.location.reload();
    }
  };

  const validateToken = async (token: string) => {
    try {
      const decoded: any = jwtDecode(token);

      if (decoded?.scopes) {
        setScopes(decoded.scopes);
      }

    } catch (err) {
      console.error("Error decoding token", err);
    }
  };

  /* ========================== */
  useEffect(() => {
    const handleLogin = async () => {

      if (Platform.OS === "web") {

        const params = new URLSearchParams(window.location.search);
        const token = params.get("token");

        if (token) {

          await saveToken(token);
          await validateToken(token);

          window.history.replaceState({}, '', window.location.pathname);
        }
      }

    };

    handleLogin();
  }, []);

  /* ========================== */
  useEffect(() => {
    const loadStoredToken = async () => {
      let storedToken;

      if (Platform.OS === "web") {
        storedToken = localStorage.getItem("userToken");
      } else {
        storedToken = await SecureStore.getItemAsync("userToken");
      }

      if (storedToken) {
        setIsLogged(true);
        await validateToken(storedToken);
      }
    };

    loadStoredToken();
  }, []);

  /* ========================== */
  const conectarTwitch = () => {
    if (Platform.OS === 'web') {
      window.location.assign(authUrl);
    } else {
      Linking.openURL(authUrl);
    }
  };


  const { width, height } = Dimensions.get('window');
  const isWeb = Platform.OS === 'web';

  const moderatorButton = () => {
    if (!isLogged) {
      alert("Debes iniciar sesión con Twitch.");
      return;
    }
    if (!scopes.includes("moderator:read:followers")) {
      alert("No tienes permisos de moderador.");
      return;
    }
    router.push("/ToolsMods" as RelativePathString);
  };

  const streamerButton = () => {
    if (!isLogged) {
      alert("Debes iniciar sesión con Twitch.");
      return;
    }
    if (!scopes.includes("channel:read:subscriptions")) {
      alert("No tienes permisos de streamer.");
      return;
    }
    router.push("/ToolsStreamer" as RelativePathString);
  };

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <StatusBar barStyle="dark-content" />

      <ImageBackground
        source={require('../assets/backgrounds/zen-bg-4k.png')}
        style={styles.background}
        resizeMode="cover"
      >
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* HERO */}
          <View style={styles.hero}>
            <View style={styles.overlay}>
              <Text style={styles.title}>
                Twitch Interaction Suite
              </Text>

              <Text style={styles.subtitle}>
                Plataforma dedicada a ofrecer aplicaciones para interactuar con Twitch,
                facilitar sorteos y dinámicas con el chat.
              </Text>

              <View style={styles.buttonRow}>
                {!isLogged && (
                  <TouchableOpacity
                    style={styles.primaryButton}
                    onPress={conectarTwitch}
                  >
                    <Text style={styles.primaryButtonText}>
                      Loguear con Twitch
                    </Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={styles.resetButton}
                  onPress={resetToken}
                >
                  <Text style={styles.resetButtonText}>
                    Reset login
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* ROLES */}
          <View style={styles.rolesContent}>
            <Text style={styles.sectionTitle}>
              Selecciona tu perfil
            </Text>

            <View style={styles.rolesContainer}>
              <RoleButton label="Usuario" />
              <RoleButton label="Moderador" onPress={moderatorButton}/>
              <RoleButton label="Streamer" onPress={streamerButton}/>
            </View>
          </View>

          {/* ABOUT */}
          <View style={styles.aboutCard}>
            <Text style={styles.sectionTitle}>
              ¿Tienes alguna sugerencia?
            </Text>

            <Text style={styles.sectionText}>
              Contactame por twitch - Manti_tiri_ri_ti
            </Text>
          </View>

        </ScrollView>
      </ImageBackground>
    </SafeAreaView>
  );
}

/* ========================== */
function RoleButton({ label, onPress }: { label: string, onPress?: () => void }) {
  return (
    <TouchableOpacity style={styles.outlineButton} onPress={onPress}>
      <Text style={styles.outlineButtonText}>{label}</Text>
    </TouchableOpacity>
  );
}

/* ========================== */
const styles = StyleSheet.create({
  scrollContainer: {
    paddingHorizontal: 20,
    paddingBottom: 140,
  },

  /* HERO */
  hero: {
    paddingTop: 80,
    alignItems: 'center',
  },

  overlay: {
    backgroundColor: 'rgba(255,255,255,0.78)',
    paddingVertical: 40,
    paddingHorizontal: 35,
    borderRadius: 28,
    alignItems: 'center',
    maxWidth: 850,
    width: '100%',
  },

  title: {
    fontSize: 30,
    fontWeight: "600",
    color: "#2A2A2A",
    textAlign: "center",
    letterSpacing: 0.5,
  },

  subtitle: {
    marginTop: 18,
    fontSize: 16,
    textAlign: "center",
    color: "#2A2A2A",
    opacity: 0.8,
    lineHeight: 24,
  },

  primaryButton: {
    marginTop: 30,
    backgroundColor: "#C5A582",
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 50,
  },

  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "500",
  },

  /* ABOUT */
  aboutCard: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingVertical: 45,
    paddingHorizontal: 40,
    borderRadius: 28,
    alignSelf: 'center',
    maxWidth: 900,
    width: '100%',
    marginTop: 80,
  },

  /* ROLES */
  rolesContent: {
    backgroundColor: 'rgba(255,255,255,0.85)',
    paddingVertical: 45,
    paddingHorizontal: 40,
    borderRadius: 28,
    alignItems: 'center',
    alignSelf: 'center',
    maxWidth: 700,
    width: '100%',
    marginTop: 80,
  },

  rolesContainer: {
    marginTop: 35,
    width: "100%",
  },

  outlineButton: {
    borderWidth: 2,
    borderColor: "#C5A582",
    paddingVertical: 14,
    borderRadius: 50,
    alignItems: "center",
    marginBottom: 18,
  },

  outlineButtonText: {
    color: "#C5A582",
    fontSize: 16,
    fontWeight: "500",
  },

  sectionTitle: {
    fontSize: 22,
    fontWeight: "600",
    color: "#2A2A2A",
    marginBottom: 16,
    textAlign: "center",
  },

  sectionText: {
    fontSize: 16,
    color: "#2A2A2A",
    opacity: 0.75,
    textAlign: "center",
    lineHeight: 26,
  },

  background: {
    flex: 1,
    width: '100%',
  },

  buttonRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 30,
  },

  resetButton: {
    marginTop: 30,
    backgroundColor: "#E57373",
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 50,
  },

  resetButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "500",
  },
});