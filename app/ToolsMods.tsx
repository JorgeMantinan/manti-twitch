import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  ScrollView, 
  Dimensions 
} from 'react-native';
import { useRouter, useLocalSearchParams, RelativePathString } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons'; 

const { width } = Dimensions.get('window');

const MOD_TOOLS = [
  {id: '1',title: 'Seguidores',route: '/Mods/FollowersList',icon: 'account-group'},
//   {id: '2',title: 'Sorteo Seguidores',route: '/Mods/GiveawayWheel',icon: 'ferris-wheel'},
//   {id: '3', title: 'Puntos de Seguidores', route: '/Mods/PointsManager', icon: 'database-marker'},
];

export default function ToolsMods() {
    const router = useRouter();
    const { token, scopes } = useLocalSearchParams(); 
    const [isAuthorized, setIsAuthorized] = useState(false);
  
    // useEffect(() => {
    //   const hasStreamerPrivileges = scopes?.includes('moderator:read:followers');
  
    //   if (!hasStreamerPrivileges) {
    //     const msg = "Esta sección requiere permisos de canal que no has concedido.";
    //     Platform.OS === 'web' ? alert(msg) : Alert.alert("Acceso Restringido", msg);
    //     router.replace("/"); 
    //   } else {
    //     setIsAuthorized(true);
    //   }
    // }, [scopes]);
  
    const handlePress = (route: string) => {
      // if (isAuthorized) {
        router.push({ pathname: route as RelativePathString, params: { token } });
      // }
    };
  
    // if (!isAuthorized) return null;
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