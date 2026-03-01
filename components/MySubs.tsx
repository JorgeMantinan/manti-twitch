import React, { useState, useEffect } from 'react';
import { Platform, View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Alert } from 'react-native';

// Saved the token react native mobile
import * as SecureStore from 'expo-secure-store';

interface Subscriber {
  user_name: string;
  tier: string;
  created_at: string;
}

const MySubs = () => {
  const [dates, setDates] = useState({ start: '', end: '' });
  const [subs, setSubs] = useState<Subscriber[]>([]); 
  const [loading, setLoading] = useState(false);

  const getMySubs = async () => {
  setLoading(true);
  try {
    // 1. OBTENCIÓN DEL TOKEN SEGÚN LA PLATAFORMA
    const token = Platform.OS === 'web' 
      ? localStorage.getItem('userToken') 
      : await SecureStore.getItemAsync('userToken');

    // 2. VERIFICACIÓN DEL TOKEN
    if (!token) {
      const msg = "Por favor, vuelve a iniciar sesión.";
      if (Platform.OS === 'web') {
        console.warn("Sesión expirada:", msg);
        alert(msg);
      } else {
        Alert.alert("Sesión expirada", msg);
      }
      setLoading(false);
      return;
    }

    // 3. LLAMADA AL BACKEND
    const url = `https://manti-twitch-backend.onrender.com/api/subs?startDate=${dates.start}&endDate=${dates.end}`;
    
    console.log("Intentando conectar con el servidor: ", url);

    const response = await fetch(url, {
      method: 'GET',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    setSubs(data.subscribers || []);

  } catch (err) {
    console.error("Error completo:", err);
    const errorMsg = "Error al conectar con el servidor.";
    
    if (Platform.OS === 'web') {
      alert(errorMsg);
    } else {
      Alert.alert("Error", errorMsg);
    }
  } finally {
    setLoading(false);
  }
};

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Mis Suscriptores de Pago</Text>
      
      <View style={styles.inputGroup}>
        <TextInput 
          placeholder="Inicio (YYYY-MM-DD)" 
          style={styles.input} 
          onChangeText={(val) => setDates({...dates, start: val})}
        />
        <TextInput 
          placeholder="Fin (YYYY-MM-DD)" 
          style={styles.input} 
          onChangeText={(val) => setDates({...dates, end: val})}
        />
      </View>

      <TouchableOpacity style={styles.button} onPress={getMySubs}>
        <Text style={styles.buttonText}>{loading ? 'Cargando...' : 'Filtrar Subs'}</Text>
      </TouchableOpacity>

      <FlatList
        data={subs}
        keyExtractor={(item, index) => index.toString()}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.userName}>{item.user_name}</Text>
            <Text>Tier: {item.tier === '1000' ? '1' : item.tier === '2000' ? '2' : '3'}</Text>
            <Text style={styles.date}>Suscrito: {new Date(item.created_at).toLocaleDateString()}</Text>
          </View>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { padding: 20, flex: 1 },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 20, color: '#6441a5' },
  inputGroup: { marginBottom: 15 },
  input: { borderBottomWidth: 1, marginBottom: 10, padding: 8 },
  button: { backgroundColor: '#6441a5', padding: 15, borderRadius: 8, alignItems: 'center' },
  buttonText: { color: 'white', fontWeight: 'bold' },
  card: { padding: 15, borderBottomWidth: 1, borderColor: '#eee' },
  userName: { fontSize: 16, fontWeight: 'bold' },
  date: { fontSize: 12, color: '#666' }
});

export default MySubs;