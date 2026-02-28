import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Alert } from 'react-native';

const MySubs = () => {
  const [dates, setDates] = useState({ start: '', end: '' });
  const [subs, setSubs] = useState([]);
  const [loading, setLoading] = useState(false);

  const getMySubs = async () => {
    // Nota: Aquí deberás recuperar el token que guardes al loguearte
    const token = "TU_JWT_TOKEN_AQUI"; 

    setLoading(true);
    try {
      const url = `https://manti-twitch-backend.onrender.com/api/subs?startDate=${dates.start}&endDate=${dates.end}`;
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setSubs(data.subscribers || []);
    } catch (err) {
      Alert.alert("Error", "No se pudo conectar con el servidor");
    }
    setLoading(false);
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