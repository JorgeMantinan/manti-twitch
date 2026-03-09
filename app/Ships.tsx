import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, StyleSheet, Dimensions, ImageBackground, 
  Modal, TouchableOpacity, TextInput, ScrollView, Platform 
} from 'react-native';
// Intentamos importar AsyncStorage, pero prepararemos un fallback para Web
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get('window');
const STORAGE_KEY = 'participantes_barcos';

// ... (Constantes de velocidad y balanceo se mantienen igual)
const TICK_RATE = 50; 
const BULLET_SPEED = 24; 
const SHIP_SPEED_MULT = 8; 
const BULLET_SIZE = 10;
const FONDO_OCEANO = require('../assets/images/sea-waves.jpg');

export default function Ships() {
  const [gameState, setGameState] = useState<'setup' | 'playing'>('setup');
  const [participants, setParticipants] = useState<any[]>([]);
  const [inputName, setInputName] = useState('');
  const [isSubInput, setIsSubInput] = useState(false);
  
  const [ships, setShips] = useState<any[]>([]);
  const [bullets, setBullets] = useState<any[]>([]);
  const [winner, setWinner] = useState<any>(null);
  const [finalRank, setFinalRank] = useState<any[]>([]);

  const shipsRef = useRef<any[]>([]);
  const bulletsRef = useRef<any[]>([]);

  // --- SOLUCIÓN A LA RECARGA (PERSISTENCIA) ---

  // 1. Cargar datos al iniciar
  useEffect(() => {
    const loadData = async () => {
      try {
        let savedData = null;
        if (Platform.OS === 'web') {
          // Si es web, usamos localStorage directo para máxima compatibilidad al recargar
          savedData = localStorage.getItem(STORAGE_KEY);
        } else {
          // Si es móvil, usamos AsyncStorage
          savedData = await AsyncStorage.getItem(STORAGE_KEY);
        }

        if (savedData) {
          const parsed = JSON.parse(savedData);
          if (Array.isArray(parsed)) setParticipants(parsed);
        }
      } catch (e) {
        console.error("Error cargando datos:", e);
      }
    };
    loadData();
  }, []);

  // 2. Guardar datos cuando cambie la lista
  useEffect(() => {
    const saveData = async () => {
      if (participants.length === 0 && gameState === 'playing') return; // No borrar si estamos jugando
      
      const dataStr = JSON.stringify(participants);
      try {
        if (Platform.OS === 'web') {
          localStorage.setItem(STORAGE_KEY, dataStr);
        } else {
          await AsyncStorage.setItem(STORAGE_KEY, dataStr);
        }
      } catch (e) {
        console.error("Error guardando datos:", e);
      }
    };
    saveData();
  }, [participants]);

  // --- LÓGICA DE INTERFAZ ---

  const addParticipant = () => {
    if (!inputName.trim()) return;
    const newMember = { name: inputName.trim(), isSub: isSubInput };
    setParticipants(prev => [...prev, newMember]);
    setInputName('');
  };

  const clearAll = async () => {
    setParticipants([]);
    if (Platform.OS === 'web') {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      await AsyncStorage.removeItem(STORAGE_KEY);
    }
  };

  // ... (Resto de la lógica de startBattle y el motor de juego es la misma que la anterior)
  // Asegúrate de copiar el motor de juego (el setInterval) de la respuesta anterior
  
  // (Aquí iría el startBattle y el useEffect del loop de juego...)
  const startBattle = () => {
    if (participants.length < 2) return;
    const initialShips = participants.map((p, i) => ({
      id: `ship-${i}-${Date.now()}`,
      name: p.name,
      isSub: p.isSub,
      hp: p.isSub ? 160 : 120,
      maxHp: p.isSub ? 160 : 120,
      x: Math.random() * (width - 100) + 50,
      y: Math.random() * (height - 200) + 100,
      vx: (Math.random() - 0.5) * SHIP_SPEED_MULT, 
      vy: (Math.random() - 0.5) * SHIP_SPEED_MULT, 
      kills: 0,
      color: p.isSub ? '#FFD700' : '#FFF'
    }));
    setShips(initialShips);
    shipsRef.current = initialShips;
    setBullets([]);
    bulletsRef.current = [];
    setWinner(null);
    setGameState('playing');
  };

  useEffect(() => {
    if (gameState !== 'playing' || winner) return;
    const interval = setInterval(() => {
      let allShips = [...shipsRef.current];
      let activeBullets = [...bulletsRef.current];
      activeBullets = activeBullets.map(b => ({
        ...b,
        x: b.x + Math.cos(b.angle) * BULLET_SPEED,
        y: b.y + Math.sin(b.angle) * BULLET_SPEED,
      })).filter(b => b.x > 0 && b.x < width && b.y > 0 && b.y < height);
      const nextBullets: any[] = [];
      activeBullets.forEach(bullet => {
        let hit = false;
        allShips.forEach(ship => {
          if (!hit && ship.hp > 0 && ship.id !== bullet.ownerId) {
            const dist = Math.hypot(ship.x - bullet.x, ship.y - bullet.y);
            if (dist < 35) {
              hit = true;
              ship.hp -= bullet.isSub ? 18 : 15;
              if (ship.hp <= 0) {
                const owner = allShips.find(k => k.id === bullet.ownerId);
                if (owner) owner.kills += 1;
              }
            }
          }
        });
        if (!hit) nextBullets.push(bullet);
      });
      const aliveShips = allShips.filter(s => s.hp > 0);
      aliveShips.forEach(s => {
        s.x += s.vx; s.y += s.vy;
        if (s.x <= 0 || s.x >= width - 40) s.vx *= -1;
        if (s.y <= 50 || s.y >= height - 100) s.vy *= -1;
        if (Math.random() > 0.92) {
          const targets = aliveShips.filter(e => e.id !== s.id);
          if (targets.length > 0) {
            const target = targets[Math.floor(Math.random() * targets.length)];
            const angle = Math.atan2(target.y - s.y, target.x - s.x);
            nextBullets.push({ x: s.x, y: s.y, angle, isSub: s.isSub, ownerId: s.id });
          }
        }
      });
      if (aliveShips.length === 1 && allShips.length > 1) {
        setWinner(aliveShips[0]);
        setFinalRank([...allShips].sort((a, b) => b.kills - a.kills).slice(0, 5));
      }
      shipsRef.current = allShips;
      bulletsRef.current = nextBullets;
      setShips([...aliveShips]);
      setBullets(nextBullets);
    }, TICK_RATE);
    return () => clearInterval(interval);
  }, [gameState, winner]);

  // --- RENDER (PANTALLA SETUP) ---
  if (gameState === 'setup') {
    return (
      <View style={styles.setupContainer}>
        <Text style={styles.setupTitle}>Batalla Naval</Text>
        <View style={styles.inputBox}>
          <TextInput 
            style={styles.textInput} 
            placeholder="Escribe un nombre..." 
            value={inputName} 
            onChangeText={setInputName}
          />
          <TouchableOpacity 
            style={[styles.typeToggle, isSubInput && { backgroundColor: '#FFD700' }]} 
            onPress={() => setIsSubInput(!isSubInput)}
          >
            <Text style={{ fontWeight: 'bold', color: isSubInput ? '#000' : '#FFF' }}>
              {isSubInput ? '👑 SUB' : '🚤 NORMAL'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.addBtn} onPress={addParticipant}>
            <Text style={styles.addBtnText}>+</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.participantList}>
          {participants.map((p, i) => (
            <View key={i} style={styles.participantItem}>
              <Text style={{ color: p.isSub ? '#FFD700' : '#FFF', fontSize: 18 }}>
                {p.isSub ? '👑 ' : '🚤 '} {p.name}
              </Text>
              <TouchableOpacity onPress={() => setParticipants(participants.filter((_, idx) => idx !== i))}>
                <Text style={{ color: '#ff4444', fontWeight: 'bold' }}>Quitar</Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>

        <TouchableOpacity style={styles.startBtn} onPress={startBattle}>
          <Text style={styles.startBtnText}>INICIAR PELEA</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.clearBtn} onPress={clearAll}>
          <Text style={styles.clearBtnText}>BORRAR TODO EL REGISTRO</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ... (Aquí el render del juego con el Modal Top 5 igual que antes)
  return (
    <ImageBackground source={FONDO_OCEANO} style={styles.ocean}>
      <View style={styles.scoreboard}>
        <Text style={styles.scoreTitle}>⚓ EN VIVO</Text>
        {ships.sort((a,b) => b.kills - a.kills).slice(0, 3).map((s, i) => (
          <Text key={i} style={[styles.scoreText, { color: s.color }]}>{s.name}: {s.kills}</Text>
        ))}
      </View>
      {ships.map((ship) => (
        <View key={ship.id} style={[styles.shipContainer, { left: ship.x, top: ship.y }]}>
          <Text style={[styles.shipName, { color: ship.color }]}>{ship.name}</Text>
          <View style={styles.hpBG}><View style={[styles.hpFill, { width: `${(ship.hp/ship.maxHp)*100}%`, backgroundColor: ship.isSub ? '#FFD700' : '#4caf50' }]} /></View>
          <Text style={{ fontSize: ship.isSub ? 45 : 30 }}>{ship.isSub ? '🚢' : '🚤'}</Text>
        </View>
      ))}
      {bullets.map((b, i) => <View key={i} style={[styles.bullet, { left: b.x, top: b.y, backgroundColor: b.isSub ? '#FFD700' : '#FFF' }]} />)}
      <Modal visible={winner !== null} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.winEmoji}>👑</Text>
            <Text style={styles.winTitle}>¡VICTORIA!</Text>
            <Text style={[styles.winName, { color: winner?.color }]}>{winner?.name}</Text>
            <View style={styles.divider} />
            <Text style={styles.rankTitle}>🏆 TOP 5 ASESINOS</Text>
            <View style={styles.rankList}>
              {finalRank.map((s, i) => (
                <View key={i} style={styles.rankItem}>
                  <Text style={styles.rankPos}>{i + 1}.</Text>
                  <Text style={[styles.rankName, { color: s.color }]}>{s.name}</Text>
                  <Text style={styles.rankKills}>{s.kills} kills</Text>
                </View>
              ))}
            </View>
            <TouchableOpacity style={styles.restartBtn} onPress={() => setGameState('setup')}>
              <Text style={styles.restartText}>VOLVER AL PANEL</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  // (Usa los mismos estilos que te pasé anteriormente)
  setupContainer: { flex: 1, backgroundColor: '#121212', padding: 20, paddingTop: 60 },
  setupTitle: { color: '#C5A582', fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
  inputBox: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  textInput: { flex: 1, backgroundColor: '#FFF', borderRadius: 10, padding: 10, color: '#000' },
  typeToggle: { backgroundColor: '#444', padding: 10, borderRadius: 10, justifyContent: 'center' },
  addBtn: { backgroundColor: '#C5A582', width: 45, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  addBtnText: { color: '#FFF', fontSize: 24 },
  participantList: { flex: 1 },
  participantItem: { flexDirection: 'row', justifyContent: 'space-between', padding: 15, backgroundColor: '#1E1E1E', borderRadius: 10, marginBottom: 8 },
  startBtn: { backgroundColor: '#4caf50', padding: 18, borderRadius: 15, alignItems: 'center' },
  startBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
  clearBtn: { padding: 15, alignItems: 'center' },
  clearBtnText: { color: '#AAA' },
  ocean: { flex: 1 },
  scoreboard: { position: 'absolute', top: 50, right: 20, backgroundColor: 'rgba(0,0,0,0.8)', padding: 10, borderRadius: 10, minWidth: 110, borderWidth: 1, borderColor: '#FFD700', zIndex: 10 },
  scoreTitle: { color: '#FFD700', fontSize: 10, fontWeight: 'bold', marginBottom: 5 },
  scoreText: { fontSize: 13, fontWeight: 'bold', marginBottom: 2 },
  shipContainer: { position: 'absolute', alignItems: 'center' },
  shipName: { fontSize: 14, fontWeight: 'bold', textShadowColor: '#000', textShadowRadius: 2 },
  hpBG: { height: 4, width: 35, backgroundColor: '#333' },
  hpFill: { height: '100%' },
  bullet: { position: 'absolute', width: BULLET_SIZE, height: BULLET_SIZE, borderRadius: BULLET_SIZE/2 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#1A1A1A', width: '85%', padding: 25, borderRadius: 30, alignItems: 'center', borderWidth: 2, borderColor: '#C5A582' },
  winEmoji: { fontSize: 60, marginBottom: -10 },
  winTitle: { color: '#AAA', fontSize: 14, letterSpacing: 2 },
  winName: { fontSize: 32, fontWeight: 'bold', marginVertical: 5, textAlign: 'center' },
  divider: { width: '100%', height: 1, backgroundColor: '#333', marginVertical: 20 },
  rankTitle: { color: '#C5A582', fontWeight: 'bold', marginBottom: 15, fontSize: 16 },
  rankList: { width: '100%', marginBottom: 25 },
  rankItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#222' },
  rankPos: { color: '#666', fontWeight: 'bold', width: 25 },
  rankName: { flex: 1, fontWeight: '600', fontSize: 16 },
  rankKills: { color: '#FFF', fontWeight: 'bold' },
  restartBtn: { backgroundColor: '#C5A582', paddingVertical: 15, paddingHorizontal: 30, borderRadius: 30 },
  restartText: { color: '#FFF', fontWeight: 'bold' }
});