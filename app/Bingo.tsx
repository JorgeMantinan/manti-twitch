import React,{useState,useEffect,useRef} from "react"
import {
View,
Text,
StyleSheet,
TouchableOpacity,
Animated,
ScrollView
} from "react-native"

import {io} from "socket.io-client"

import {generateSpanishCard} from "../utils/bingoCard"
import ParticipantsModal from "../components/BingoParticipantsModal"


const socket = io("https://manti-twitch-backend.onrender.com")

type Role = "viewer"|"mod"|"streamer"

type BingoCard = (number | null)[][]

type PlayerCard = {
 player:string
 card:BingoCard
}


export default function Bingo(){

const [participants,setParticipants]=useState<any[]>([])
const [cards,setCards]=useState<PlayerCard[]>([])

const [drawn,setDrawn]=useState<number[]>([])
const [current,setCurrent]=useState<number|null>(null)

const [modalVisible,setModalVisible]=useState(true)

const ballScale=useRef(new Animated.Value(0)).current

/*
========================
JOIN ROOM
========================
*/

useEffect(()=>{

socket.emit("bingo:join",{streamer:"default"})

socket.on("bingo:number",(n:number)=>{

setCurrent(n)

setDrawn(p=>[...p,n])

animateBall()

speakNumber(n)

})

socket.on("bingo:line",(player)=>{

alert(`LINEA ${player}`)

})

socket.on("bingo:bingo",(player)=>{

alert(`BINGO ${player}`)

})

},[])

/*
========================
ANIMATION
========================
*/

function animateBall(){

ballScale.setValue(0)

Animated.spring(ballScale,{
toValue:1,
friction:4,
useNativeDriver:true
}).start()

}

/*
========================
VOICE
========================
*/

function speakNumber(n:number){

if(typeof window==="undefined") return

const msg = new SpeechSynthesisUtterance(`Número ${n}`)

msg.lang="es-ES"

speechSynthesis.speak(msg)

}

/*
========================
START
========================
*/

function startGame(){

const cardsGenerated = participants.map(p=>({

player:p.name,
card:generateSpanishCard()

}))

setCards(cardsGenerated)

const backendCards:Record<string,BingoCard> = {}

cardsGenerated.forEach(c=>{
backendCards[c.player]=c.card
})

socket.emit("bingo:start",{
streamer:"default",
cards:backendCards
})

}

/*
========================
DRAW
========================
*/

function draw(){

socket.emit("bingo:draw",{streamer:"default"})

}

/*
========================
MARKED
========================
*/

function marked(n:number){

return drawn.includes(n)

}

return(

<View style={styles.container}>

<ParticipantsModal
visible={modalVisible}
participants={participants}
setParticipants={setParticipants}
onStart={()=>{
setModalVisible(false)
startGame()
}}
/>

<ScrollView horizontal style={styles.drawnRow}>

{drawn.map((n,i)=>(
<View key={i} style={styles.smallBall}>
<Text style={{color:"#fff"}}>{n}</Text>
</View>
))}

</ScrollView>

<Animated.View style={[
styles.bigBall,
{transform:[{scale:ballScale}]}
]}>

<Text style={styles.bigText}>{current}</Text>

</Animated.View>

<TouchableOpacity style={styles.drawButton} onPress={draw}>
<Text style={{color:"#fff"}}>SACAR</Text>
</TouchableOpacity>

<ScrollView contentContainerStyle={styles.cardsGrid}>

{cards.map((c,i)=>(

<View key={i} style={styles.card}>

<Text style={styles.player}>{c.player}</Text>

{c.card.map((row:any,r:number)=>(
<View key={r} style={styles.row}>

{row.map((n:any,col:number)=>{

const m=n && marked(n)

return(

<View key={col} style={[
styles.cell,
!n && styles.empty,
m && styles.mark
]}>

<Text style={styles.num}>{n||""}</Text>

</View>

)

})}

</View>
))}

</View>

))}

</ScrollView>

</View>

)

}

const styles=StyleSheet.create({

container:{
flex:1,
backgroundColor:"#ECE7E1",
paddingTop:40
},

drawnRow:{
maxHeight:50
},

smallBall:{
width:20,
height:20,
borderRadius:15,
backgroundColor:"#000",
alignItems:"center",
justifyContent:"center",
margin:4
},

bigBall:{
width:150,
height:150,
borderRadius:75,
borderWidth:5,
borderColor:"#C5A582",
backgroundColor:"#fff",
alignSelf:"center",
justifyContent:"center",
alignItems:"center",
margin:20
},

bigText:{
fontSize:50,
fontWeight:"bold"
},

drawButton:{
backgroundColor:"#C5A582",
padding:16,
alignItems:"center",
margin:10
},

cardsGrid:{
 flexDirection:"row",
 flexWrap:"wrap",
 justifyContent:"center"
},

card:{
 backgroundColor:"#fff",
 margin:6,
 padding:6,
 borderRadius:8,
 width:"15%",   // 6 por fila
 minWidth:140,
},

player:{
textAlign:"center",
fontWeight:"bold"
},

row:{
flexDirection:"row"
},

cell:{
 width:28,
 height:32,
 borderWidth:1,
 borderColor:"#DDD",
 alignItems:"center",
 justifyContent:"center"
},

empty:{
backgroundColor:"#C5A582"
},

mark:{
backgroundColor:"#C5A582"
},

num:{
fontWeight:"bold"
}


})
