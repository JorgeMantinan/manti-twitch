

import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, FlatList } from 'react-native';

export default function App() {
  const [usuarios, setUsuarios] = useState([]);

  const conectarTwitch = () => {
    // Redirigimos al BACKEND, no a Twitch directamente
    window.location.href = "https://tu-backend-en-render.com/auth/twitch";
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🎡 Ruleta de Sorteos</Text>
      <TouchableOpacity style={styles.button} onPress={conectarTwitch}>
        <Text style={styles.buttonText}>Conectar con Twitch</Text>
      </TouchableOpacity>
      {/* Aquí iría tu componente de Ruleta con la lista de usuarios */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#18181b', alignItems: 'center', justifyContent: 'center' },
  title: { color: 'white', fontSize: 30, marginBottom: 20 },
  button: { backgroundColor: '#9146FF', padding: 15, borderRadius: 8 },
  buttonText: { color: 'white', fontWeight: 'bold' }
});
