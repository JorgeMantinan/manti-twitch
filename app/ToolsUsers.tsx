import React from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  ScrollView, 
  Dimensions 
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons'; 

const { width } = Dimensions.get('window');

const ROLE = "viewer";

const USER_TOOLS = [
  { 
    id: '1', 
    title: 'Ruleta', 
    route: '/SmartRoulette', 
    icon: 'ship-wheel' 
  },
  { 
    id: '2', 
    title: 'Juego de Barcos', 
    route: '/Ships',
    icon: 'ferris-wheel' 
  },
  { 
    id: '3', 
    title: 'BINGO', 
    route: '/Bingo',
    icon: 'harmony-o-s' 
  },
];

export default function ToolsUsers() {
  const router = useRouter();
  const { token } = useLocalSearchParams();

  const handlePress = (route: string) => {
    router.push({
      pathname: route as any,
      params: { token, role: ROLE }
    });
  };

  return (
    <View style={styles.mainContainer}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        <View style={styles.header}>
          <Text style={styles.title}>Panel de Usuario</Text>
          <View style={styles.underline} />
          <Text style={styles.subtitle}>¡Disfruta de los juegos!</Text>
        </View>

        <View style={styles.menuGrid}>
          {USER_TOOLS.map((item) => (
            <TouchableOpacity 
              key={item.id} 
              style={styles.menuButton}
              onPress={() => handlePress(item.route)}
              activeOpacity={0.7}
            >
              <View style={styles.iconContainer}>
                <MaterialCommunityIcons name={item.icon as any} size={40} color="#C5A582" />
              </View>
              <Text style={styles.buttonText}>{item.title}</Text>
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
  subtitle: {
    fontSize: 14,
    color: '#2A2A2A',
    opacity: 0.5,
    marginTop: 10,
  },
  underline: {
    width: 40,
    height: 3,
    backgroundColor: '#C5A582', // Acento Arena
    marginTop: 8,
    borderRadius: 2,
  },
  menuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    maxWidth: 800,
    alignSelf: 'center',
  },
  menuButton: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    width: width > 800 ? 220 : (width / 2) - 30,
    height: 200,
    margin: 15,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(197, 165, 130, 0.15)',
    shadowColor: '#C5A582',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 4,
  },
  iconContainer: {
    width: 75,
    height: 75,
    backgroundColor: '#FAF7F2',
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2A2A2A',
    textAlign: 'center',
    paddingHorizontal: 10,
  },
});