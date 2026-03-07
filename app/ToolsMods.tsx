import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  ScrollView, 
  Dimensions,
  Alert,
  Platform
} from 'react-native';

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
    const decoded = Buffer.from(payload, "base64").toString("utf-8");
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

const MOD_TOOLS = [
  {id: '1',title: 'Seguidores',route: '/Mods/FollowersList',icon: 'account-group'},
//   {id: '2',title: 'Sorteo Seguidores',route: '/Mods/GiveawayWheel',icon: 'ferris-wheel'},
//   {id: '3', title: 'Puntos de Seguidores', route: '/Mods/PointsManager', icon: 'database-marker'},
];

export default function ToolsMods() {

  const router = useRouter();
  const { token } = useLocalSearchParams();

  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    if (!token) return;

    const decoded = decodeJWT(token as string);
    const scopes = decoded?.scopes || [];
    const hasModPrivileges = scopes.some(scope =>
      scope.trim() === 'moderator:read:followers'
    );

    if (!hasModPrivileges) {
      const msg = "Esta sección requiere permisos de moderador que no has concedido.";

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
          <Text style={styles.title}>Panel de Moderadores</Text>
          <View style={styles.underline} />
        </View>
        <View style={styles.menuGrid}>
          {MOD_TOOLS.map((item) => (
            <TouchableOpacity 
              key={item.id} 
              style={styles.menuButton}
              onPress={() => handlePress(item.route)}
              activeOpacity={0.7}
            >
              <View style={styles.iconContainer}>
                <MaterialCommunityIcons 
                  name={item.icon as any} 
                  size={40} 
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
    paddingVertical: 40,
  },

  header: {
    alignItems: 'center',
    marginBottom: 50,
  },

  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#2A2A2A',
    letterSpacing: 1,
  },

  underline: {
    width: 60,
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
    maxWidth: 900,
    alignSelf: 'center',
  },

  menuButton: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    width: width > 800 ? 180 : (width / 2) - 30,
    height: 180,
    margin: 12,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(197, 165, 130, 0.2)',
    shadowColor: '#C5A582',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 5,
  },

  iconContainer: {
    width: 70,
    height: 70,
    backgroundColor: '#FAF7F2',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },

  buttonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2A2A2A',
    textAlign: 'center',
    paddingHorizontal: 10,
  },

});