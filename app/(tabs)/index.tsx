import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Linking } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

// Saved the token react native mobile
import * as SecureStore from 'expo-secure-store';

export default function App() {
  const { token } = useLocalSearchParams();
  const [authUrl, setAuthUrl] = useState("https://manti-twitch-backend.onrender.com/auth/twitch");

  useEffect(() => {
  if (token) {
    saveToken(token as string);
    window.history.replaceState({}, '', window.location.pathname);
    }
  }, [token]);

  const conectarTwitch = () => {
    // Esto abrirá el navegador para el login
    Linking.openURL(authUrl);
  };

  const saveToken = async (token: string) => {
  await SecureStore.setItemAsync('userToken', token);
  console.log("Token guardado con éxito");
};

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>🎡 Ruleta Twitch</Text>
        <Text style={styles.subtitle}>¡Conecta tu cuenta para empezar el sorteo!</Text>
        
        <TouchableOpacity style={styles.button} onPress={conectarTwitch}>
          <Text style={styles.buttonText}>CONECTAR CON TWITCH</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#0e0e10', 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  card: {
    backgroundColor: '#1f1f23',
    padding: 40,
    borderRadius: 15,
    alignItems: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  title: { 
    color: '#bf94ff', 
    fontSize: 32, 
    fontWeight: 'bold',
    marginBottom: 10 
  },
  subtitle: {
    color: '#adadb8',
    fontSize: 16,
    marginBottom: 30,
    textAlign: 'center'
  },
  button: { 
    backgroundColor: '#9146FF', 
    paddingVertical: 15, 
    paddingHorizontal: 30, 
    borderRadius: 5 
  },
  buttonText: { 
    color: 'white', 
    fontWeight: 'bold',
    fontSize: 16
  }
});