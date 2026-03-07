import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Dimensions, Alert, Platform } from 'react-native';
import { useRouter, useLocalSearchParams, RelativePathString } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Buffer } from "buffer";

const { width } = Dimensions.get('window');

type DecodedToken = {
  twitchToken: string;
  refreshToken: string;
  twitchId: string;
  scopes: string[];
};

function decodeJWT(token: string): DecodedToken | null {
  try {
    const payload = token.split(".")[1];
    const decoded = JSON.parse(atob(payload));
    const parsed = JSON.parse(decoded);

    let scopes: string[] = [];

    if (Array.isArray(parsed.scopes)) {
      scopes = parsed.scopes;
    } else if (typeof parsed.scopes === "string") {
      scopes = parsed.scopes.split(" ");
    }

    return {
      ...parsed,
      scopes
    };

  } catch {
    return null;
  }
}

const STREAMER_TOOLS = [
    { id: '1', title: 'Ruleta de Sorteos', route: '/Streamer/Roulette', icon: 'clover' },
    { id: '2', title: 'Guerra de Barcos', route: '/Streamer/ShipWar', icon: 'ship-wheel' },
    { id: '3', title: 'Hundir la Flota', route: '/Streamer/Battleship', icon: 'target' },
    { id: '4', title: 'Listado Usuarios', route: '/Streamer/UserList', icon: 'account-details' },
    { id: '5', title: 'Ganadores Sorteos', route: '/Streamer/Winners', icon: 'trophy-outline' },
    { id: '6', title: 'Historial Subs', route: '/Streamer/SubsHistory', icon: 'history' },
    { id: '7', title: 'Suscriptores actuales', route: '/MySubs', icon: 'account-star' },
];

export default function ToolsStreamer() {

  const router = useRouter();
  const { token } = useLocalSearchParams();

  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {

    if (!token) return;

    const decoded = decodeJWT(token as string);
    const scopes = decoded?.scopes || [];
    const hasStreamerPrivileges = scopes.some(scope =>
      scope.trim() === 'channel:read:subscriptions'
    );

    if (!hasStreamerPrivileges) {
      const msg = "Esta sección requiere permisos de canal que no has concedido.";
      if (Platform.OS === 'web') {
        alert(msg);
      } else {
        Alert.alert("Acceso Restringido", msg);
      }
      router.replace("/");
    } else {
      setIsAuthorized(true);
    }
  }, [token]);

  const handlePress = (route: string) => {
    if (isAuthorized) {
      router.push({
        pathname: route as RelativePathString,
        params: { token }
      });
    }
  };

  if (!isAuthorized) return null;

  return (
    <View style={styles.mainContainer}>
      <ScrollView contentContainerStyle={styles.scrollContent}>

        <View style={styles.header}>
          <Text style={styles.title}>Panel del Streamer</Text>
          <View style={styles.underline} />
        </View>

        <View style={styles.menuGrid}>
          {STREAMER_TOOLS.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.menuButton}
              onPress={() => handlePress(item.route)}
            >
              <View style={styles.iconContainer}>
                <MaterialCommunityIcons
                  name={item.icon as any}
                  size={38}
                  color="#C5A582"
                />
              </View>
              <Text style={styles.buttonText}>
                {item.title}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: '#FAF7F2',
  },

  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 50,
  },

  header: {
    alignItems: 'center',
    marginBottom: 40,
  },

  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#2A2A2A',
    letterSpacing: 1,
  },

  underline: {
    width: 50,
    height: 3,
    backgroundColor: '#C5A582',
    marginTop: 8,
    borderRadius: 2,
  },

  menuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    maxWidth: 950,
    alignSelf: 'center',
  },

  menuButton: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    width: width > 800 ? 200 : (width / 2) - 30,
    height: 180,
    margin: 15,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(197, 165, 130, 0.15)',
    shadowColor: '#C5A582',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },

  iconContainer: {
    width: 65,
    height: 65,
    backgroundColor: '#FAF7F2',
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },

  buttonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2A2A2A',
    textAlign: 'center',
    paddingHorizontal: 15,
    lineHeight: 20,
  },
});