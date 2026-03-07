import React, { useState, useEffect } from 'react';
import { 
  Platform, View, Text, TextInput, TouchableOpacity, 
  FlatList, StyleSheet, Alert, ScrollView 
} from 'react-native';
import * as SecureStore from 'expo-secure-store';

interface Follower {
  user_name: string;
  followed_at: string;
}

interface DecodedToken {
  scopes: string[];
}

// Utilidad para decodificar el token y verificar scopes
function decodeJWT(token: string): DecodedToken | null {
  try {
    const payload = token.split('.')[1];
    const decoded = JSON.parse(Platform.OS === 'web' ? atob(payload) : Buffer.from(payload, 'base64').toString());
    let scopes: string[] = [];
    if (Array.isArray(decoded.scopes)) scopes = decoded.scopes;
    else if (typeof decoded.scopes === "string") scopes = decoded.scopes.split(" ");
    return { scopes };
  } catch (err) {
    console.error("JWT decode error:", err);
    return null;
  }
}

const ListFollowers = () => {
  const [dates, setDates] = useState({ start: '', end: '' });
  const [followers, setFollowers] = useState<Follower[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Estados para la gestión de streamers
  const [streamers, setStreamers] = useState<string[]>([]);
  const [selectedStreamer, setSelectedStreamer] = useState('');
  const [newNick, setNewNick] = useState('');
  const [showAddInput, setShowAddInput] = useState(false);

  // Cargar streamers guardados al iniciar
  useEffect(() => {
    loadStreamers();
  }, []);

  const loadStreamers = async () => {
    const key = 'saved_streamers';
    const data = Platform.OS === 'web' 
      ? localStorage.getItem(key) 
      : await SecureStore.getItemAsync(key);
    
    if (data) setStreamers(JSON.parse(data));
  };

  const saveStreamers = async (newList: string[]) => {
    const key = 'saved_streamers';
    const value = JSON.stringify(newList);
    Platform.OS === 'web' 
      ? localStorage.setItem(key, value) 
      : await SecureStore.setItemAsync(key, value);
  };

  const addStreamer = () => {
    if (!newNick.trim()) return;
    if (streamers.includes(newNick.trim().toLowerCase())) {
      Alert.alert("Aviso", "Este streamer ya está en tu lista.");
      return;
    }
    const newList = [...streamers, newNick.trim().toLowerCase()];
    setStreamers(newList);
    saveStreamers(newList);
    setNewNick('');
    setShowAddInput(false);
  };

  const getFollowers = async () => {
    if (!selectedStreamer) {
      Alert.alert("Atención", "Selecciona un streamer de la lista de arriba.");
      return;
    }

    setLoading(true);
    try {
      const token = Platform.OS === 'web' 
        ? localStorage.getItem('userToken') 
        : await SecureStore.getItemAsync('userToken');

      if (!token) {
        Alert.alert("Sesión expirada", "Inicia sesión nuevamente.");
        return;
      }

      const decoded = decodeJWT(token);
      // Verificamos permiso de moderador o de canal propio
      const hasPerms = decoded?.scopes.some(s => 
        s === "moderator:read:followers" || s === "channel:read:subscriptions"
      );

      if (!hasPerms) {
        Alert.alert("Permisos insuficientes", "No tienes el permiso 'moderator:read:followers'.");
        return;
      }

      const response = await fetch("https://manti-twitch-backend.onrender.com/api/followers-between-dates", {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          streamerNick: selectedStreamer,
          startDate: dates.start || null,
          endDate: dates.end || null
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Error en la petición");
      
      setFollowers(data || []);

    } catch (err: any) {
      console.error(err);
      Alert.alert("Error", err.message || "Error al conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Buscador de Seguidores</Text>

      {/* Lista Horizontal de Streamers */}
      <View style={styles.streamerSelector}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ alignItems: 'center' }}>
          {streamers.map((nick) => (
            <TouchableOpacity 
              key={nick} 
              style={[styles.nickChip, selectedStreamer === nick && styles.nickChipActive]}
              onPress={() => setSelectedStreamer(nick)}
            >
              <Text style={[styles.nickText, selectedStreamer === nick && styles.nickTextActive]}>
                {nick}
              </Text>
            </TouchableOpacity>
          ))}
          
          <TouchableOpacity style={styles.addButton} onPress={() => setShowAddInput(!showAddInput)}>
            <Text style={styles.addButtonText}>{showAddInput ? '✕' : '+'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Input para añadir nuevo nick */}
      {showAddInput && (
        <View style={styles.addInputGroup}>
          <TextInput 
            style={styles.inputSmall} 
            placeholder="Escribe nick del streamer..." 
            value={newNick}
            onChangeText={setNewNick}
            autoCapitalize="none"
          />
          <TouchableOpacity style={styles.saveButton} onPress={addStreamer}>
            <Text style={styles.saveButtonText}>Guardar</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Inputs de Fechas */}
      <View style={styles.inputGroup}>
        <TextInput 
          placeholder="Inicio (YYYY-MM-DD)" 
          style={styles.input} 
          value={dates.start}
          onChangeText={(v) => setDates({...dates, start: v})}
        />
        <TextInput 
          placeholder="Fin (YYYY-MM-DD)" 
          style={styles.input} 
          value={dates.end}
          onChangeText={(v) => setDates({...dates, end: v})}
        />
      </View>

      <TouchableOpacity style={styles.searchButton} onPress={getFollowers} disabled={loading}>
        <Text style={styles.buttonText}>
          {loading ? 'Buscando...' : `Buscar seguidores de ${selectedStreamer || '...'}`}
        </Text>
      </TouchableOpacity>

      <FlatList
        data={followers}
        keyExtractor={(item, index) => index.toString()}
        style={{ width: '100%', marginTop: 20 }}
        contentContainerStyle={{ paddingHorizontal: 20 }}
        ListEmptyComponent={
          !loading ? (
            <View style={{ marginTop: 50, alignItems: 'center' }}>
              <Text style={styles.sectionText}>Selecciona un streamer y filtra por fechas.</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.userName}>{item.user_name}</Text>
            <Text style={styles.date}>Siguió el: {new Date(item.followed_at).toLocaleDateString()}</Text>
          </View>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 60, alignItems: 'center', backgroundColor: '#F5F0E6' },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 20, color: '#2A2A2A' },
  
  streamerSelector: { height: 60, marginBottom: 10, paddingLeft: 20 },
  nickChip: { 
    paddingHorizontal: 18, 
    paddingVertical: 8, 
    backgroundColor: 'white', 
    borderRadius: 25, 
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#C5A582'
  },
  nickChipActive: { backgroundColor: '#C5A582' },
  nickText: { color: '#C5A582', fontWeight: '600' },
  nickTextActive: { color: 'white' },
  
  addButton: { width: 35, height: 35, borderRadius: 20, backgroundColor: '#2A2A2A', justifyContent: 'center', alignItems: 'center' },
  addButtonText: { color: 'white', fontSize: 20, fontWeight: 'bold' },

  addInputGroup: { flexDirection: 'row', width: 400, marginBottom: 20, gap: 10 },
  inputSmall: { flex: 1, backgroundColor: 'white', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: '#C5A582' },

  saveButton: { backgroundColor: '#2A2A2A', padding: 10, borderRadius: 10, justifyContent: 'center' },
  saveButtonText: { color: 'white', fontWeight: '600' },

   inputGroup: { 
    marginBottom: 20,
    backgroundColor: 'rgba(255,255,255,0.8)',
    padding: 15,
    borderRadius: 20,
    width: 400
  },

  input: { 
    borderBottomWidth: 1, 
    borderBottomColor: '#C5A582',
    marginBottom: 10, 
    padding: 8,
    color: '#2A2A2A'
  },

  searchButton: { 
    backgroundColor: '#C5A582',
    padding: 15, 
    borderRadius: 50, 
    alignItems: 'center',
    marginTop: 10
  },
  buttonText: { color: 'white', fontWeight: '700', fontSize: 16 },

  card: { 
    padding: 15, backgroundColor: 'white', borderRadius: 15, marginBottom: 10,
    borderWidth: 1, borderColor: 'rgba(197, 165, 130, 0.2)'
  },
  userName: { fontSize: 16, fontWeight: '600', color: '#2A2A2A' },
  date: { fontSize: 12, color: '#2A2A2A', opacity: 0.5 },
  sectionText: { fontSize: 14, color: "#2A2A2A", opacity: 0.6, textAlign: 'center' }
});

export default ListFollowers;