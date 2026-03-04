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
      const token = Platform.OS === 'web' 
        ? localStorage.getItem('userToken') 
        : await SecureStore.getItemAsync('userToken');

      if (!token) {
        const msg = "Por favor, vuelve a iniciar sesión.";
        Platform.OS === 'web' ? alert(msg) : Alert.alert("Sesión expirada", msg);
        setLoading(false);
        return;
      }

      const url = `https://manti-twitch-backend.onrender.com/api/subs?startDate=${dates.start}&endDate=${dates.end}`;
      
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await response.json();
      setSubs(data.subscribers || []);

    } catch (err) {
      console.error(err);
      const errorMsg = "Error al conectar con el servidor.";
      Platform.OS === 'web' ? alert(errorMsg) : Alert.alert("Error", errorMsg);
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
    color: '#2A2A2A', 
    textAlign: 'center',
    letterSpacing: 0.5 
  },

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

  button: { 
    backgroundColor: '#C5A582',
    padding: 15, 
    borderRadius: 50, 
    alignItems: 'center',
    marginTop: 10
  },

  buttonText: { 
    color: 'white', 
    fontWeight: '500',
    fontSize: 16 
  },

  card: { 
    padding: 20, 
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(197, 165, 130, 0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2
  },

  userName: { 
    fontSize: 17, 
    fontWeight: '600', 
    color: '#2A2A2A' 
  },

  date: { 
    fontSize: 13, 
    color: '#2A2A2A', 
    opacity: 0.6
  }
});

export default MySubs;