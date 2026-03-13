import React,{useState} from "react"
import {
Modal,
View,
Text,
TextInput,
TouchableOpacity,
StyleSheet
} from "react-native"

type Participant = {
 name:string
}

type Props = {
 visible:boolean
 participants:Participant[]
 setParticipants:React.Dispatch<React.SetStateAction<Participant[]>>
 onStart:()=>void
}

export default function ParticipantsModal({
 visible,
 participants,
 setParticipants,
 onStart
}:Props){

 const [name,setName] = useState<string>("")

 function add(){

  if(!name.trim()) return

  setParticipants(p=>[
   ...p,
   {name}
  ])

  setName("")

 }

 return(

 <Modal visible={visible} transparent>

  <View style={styles.overlay}>

   <View style={styles.container}>

    <Text style={styles.title}>
     BINGO PLAYERS
    </Text>

    <TextInput
     style={styles.input}
     value={name}
     onChangeText={setName}
     placeholder="username"
    />

    <TouchableOpacity style={styles.button} onPress={add}>
     <Text style={styles.text}>Añadir</Text>
    </TouchableOpacity>

    <TouchableOpacity style={styles.button} onPress={onStart}>
     <Text style={styles.text}>Start</Text>
    </TouchableOpacity>

   </View>

  </View>

 </Modal>

 )

}

const styles = StyleSheet.create({

 overlay:{
  flex:1,
  backgroundColor:"rgba(0,0,0,0.5)",
  justifyContent:"center",
  alignItems:"center"
 },

 container:{
  backgroundColor:"#fff",
  padding:30,
  borderRadius:10,
  width:300
 },

 title:{
  fontSize:20,
  fontWeight:"bold",
  marginBottom:20,
  textAlign:"center"
 },

 input:{
  borderWidth:1,
  padding:10,
  marginBottom:10
 },

 button:{
  backgroundColor:"#C5A582",
  padding:12,
  marginTop:10,
  alignItems:"center"
 },

 text:{
  color:"#fff",
  fontWeight:"bold"
 }

})
