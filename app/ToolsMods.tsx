import React from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  ScrollView, 
  Dimensions 
} from 'react-native';
import { useRouter } from 'expo-router';
// Importamos iconos para darle un toque más profesional
import { MaterialCommunityIcons } from '@expo/vector-icons'; 

const { width } = Dimensions.get('window');

const MOD_TOOLS = [
  { 
    id: '1', 
    title: 'Seguidores', 
    route: '/Mods/FollowersList', 
    icon: 'account-group' 
  },
  { 
    id: '2', 
    title: 'Sorteo Seguidores', 
    route: '/Mods/GiveawayWheel', 
    icon: 'ferris-wheel' 
  },
  { 
    id: '3', 
    title: 'Puntos de Seguidores', 
    route: '/Mods/PointsManager', 
    icon: 'database-marker' 
  },
  // Puedes añadir más aquí y se alinearán solos
];

export default function ListUtilitiesMods() {
  const router = useRouter();

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
              onPress={() => router.push(item.route as any)}
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
    backgroundColor: '#FAF7F2', // Fondo Crema Zen
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
    color: '#2A2A2A', // Negro Carbón
    letterSpacing: 1,
  },
  underline: {
    width: 60,
    height: 3,
    backgroundColor: '#C5A582', // Arena/Dorado
    marginTop: 8,
    borderRadius: 2,
  },
  menuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center', // Alinea al centro si hay pocos botones
    alignItems: 'center',
    width: '100%',
    maxWidth: 900, // Ajuste para que quepan 4 en línea en web/tablet
    alignSelf: 'center',
  },
  menuButton: {
    backgroundColor: 'rgba(255,255,255,0.9)', // Blanco Hueso translúcido
    width: width > 800 ? 180 : (width / 2) - 30, // Responsive: Fijo en web, 2 por fila en móvil
    height: 180,
    margin: 12,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(197, 165, 130, 0.2)', 
    // Sombra elegante
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