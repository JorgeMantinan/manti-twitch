import React, { useState } from 'react';
import { Platform, View, Text, TouchableOpacity, FlatList, StyleSheet, Alert } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { API_CONFIG } from '../constants/api';

interface Subscriber {
  user_name: string;
  tier: string;
  is_gift: boolean;
  gifter_name?: string;
}

interface DecodedToken {
  scopes: string[];
}

function decodeJWT(token: string): DecodedToken | null {
  try {
    const payload = token.split('.')[1];
    const decoded = JSON.parse(
      Platform.OS === 'web'
        ? atob(payload)
        : Buffer.from(payload, 'base64').toString()
    );

    let scopes: string[] = [];

    if (Array.isArray(decoded.scopes)) scopes = decoded.scopes;
    else if (typeof decoded.scopes === "string") scopes = decoded.scopes.split(" ");

    return { scopes };

  } catch (err) {
    console.error("JWT decode error:", err);
    return null;
  }
}

const MySubs = () => {

  const [subs, setSubs] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(false);

  const getToken = async () => {
    if (Platform.OS === 'web') return localStorage.getItem('userToken');
    return await SecureStore.getItemAsync('userToken');
  };

  const getMySubs = async () => {

    setLoading(true);

    try {

      const token = await getToken();

      if (!token) {
        Alert.alert("Sesión expirada", "Inicia sesión nuevamente.");
        return;
      }

      const decoded = decodeJWT(token);

      const hasPerms = decoded?.scopes.some(
        s => s === "channel:read:subscriptions"
      );

      if (!hasPerms) {
        Alert.alert("Permisos insuficientes", "No tienes el permiso 'channel:read:subscriptions'.");
        return;
      }

      const response = await fetch(
        API_CONFIG.ENDPOINTS.SUBS,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error obteniendo subs");
      }

      setSubs(data.subscribers || []);

    } catch (err: any) {

      console.error(err);

      Alert.alert(
        "Error",
        err.message || "Error al conectar con el servidor."
      );

    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>

      <Text style={styles.title}>Mis Suscriptores</Text>

      <TouchableOpacity style={styles.button} onPress={getMySubs}>
        <Text style={styles.buttonText}>
          {loading ? 'Cargando...' : 'Cargar Suscriptores'}
        </Text>
      </TouchableOpacity>

      <FlatList
        data={subs}
        keyExtractor={(item, index) => index.toString()}
        style={{ width: '100%', marginTop: 20 }}
        contentContainerStyle={{ paddingHorizontal: 20 }}

        ListEmptyComponent={
          !loading ? (
            <View style={{ marginTop: 50, alignItems: 'center' }}>
              <Text style={styles.sectionText}>
                No hay suscriptores actualmente.
              </Text>
            </View>
          ) : null
        }

        renderItem={({ item }) => (
          <View style={styles.card}>

            <Text style={styles.userName}>{item.user_name}</Text>

            {item.is_gift ? (
              <Text style={styles.date}>
                Regalada por: {item.gifter_name}
              </Text>
            ) : (
              <Text style={styles.date}>
                Comprada por el usuario
              </Text>
            )}

            <Text style={styles.date}>
              Tier: {Number(item.tier) / 1000}
            </Text>

          </View>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({

  container: {
    paddingTop: 80,
    alignItems: 'center',
    backgroundColor: '#F5F0E6',
    height: '100%'
  },

  title: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 20,
    color: '#2A2A2A'
  },

  button: {
    backgroundColor: '#C5A582',
    padding: 15,
    borderRadius: 50,
    alignItems: 'center'
  },

  buttonText: {
    color: 'white',
    fontWeight: '600'
  },

  card: {
    padding: 20,
    backgroundColor: 'white',
    borderRadius: 20,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(197,165,130,0.2)',
    width: 500,
    alignItems: 'center'
  },

  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2A2A2A'
  },

  date: {
    fontSize: 12,
    color: '#2A2A2A',
    opacity: 0.6
  },

  sectionText: {
    fontSize: 14,
    color: "#2A2A2A",
    opacity: 0.6
  }

});

export default MySubs;