// screens/ChatScreen.js
import React, { useEffect, useState, useLayoutEffect } from 'react';
import { 
  View, Text, TouchableOpacity, 
  StyleSheet, TextInput, SafeAreaView, Image, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard, ScrollView 
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { AntDesign, FontAwesome } from '@expo/vector-icons';
import { database, auth } from '../firebase'; // Ensure auth is imported
import { ref, onValue, push } from 'firebase/database'; // Added push for sending messages
import { StatusBar } from 'expo-status-bar';
import { Alert } from 'react-native';
import { useHeaderHeight } from '@react-navigation/elements'; // Import useHeaderHeight

const ChatScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { userId } = route.params; // Get the userId from navigation params
  const [chatUser, setChatUser] = useState(null);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);

  const headerHeight = useHeaderHeight(); // Get the header height

  useLayoutEffect(() => {
    // Customize the header
    navigation.setOptions({
      headerShown: true,
      headerLeft: () => (
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginLeft: 15 }}>
          <AntDesign name="arrowleft" size={24} color="#fff" />
        </TouchableOpacity>
      ),
      headerTitle: () => (
        chatUser && (
          <View style={styles.headerTitleContainer}>
            {chatUser.avatar && chatUser.avatar !== 'none' ? (
              <Image source={{ uri: chatUser.avatar }} style={styles.headerAvatar} />
            ) : (
              <FontAwesome name="user-circle-o" size={40} color="#fff" style={styles.headerAvatarIcon} />
            )}
            <Text style={styles.headerTitleText}>{chatUser.firstName} {chatUser.lastName}</Text>
          </View>
        )
      ),
      headerStyle: {
        backgroundColor: '#000',
        height: headerHeight, // Set header height dynamically
      },
      headerTintColor: '#fff',
    });
  }, [navigation, chatUser, headerHeight]);

  useEffect(() => {
    // Fetch the chat user's information
    const userRef = ref(database, 'users/' + userId);
    const unsubscribe = onValue(userRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setChatUser(data);
      } else {
        Alert.alert('Error', 'User not found.');
        navigation.goBack();
      }
    }, (error) => {
      Alert.alert('Error', 'Failed to fetch user data: ' + error.message);
      navigation.goBack();
    });

    return () => unsubscribe();
  }, [userId]);

  const handleSend = () => {
    if (message.trim() === '') return;
    // Placeholder for send functionality
    Alert.alert('Message Sent', message);
      setMessage('');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={headerHeight + (Platform.OS === 'ios' ? 20 : 0)} // Dynamic offset
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <SafeAreaView style={styles.container}>
          <StatusBar style="light" />
      {/* Placeholder for messages */}
      <View style={styles.messagesContainer}>
        <Text style={styles.placeholderText}>Chat functionality coming soon!</Text>
              </View>
          {/* Input Bar */}
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.textInput}
              placeholder="Type a message"
              placeholderTextColor="#888"
              value={message}
              onChangeText={setMessage}
              multiline
            />
            <TouchableOpacity style={styles.sendButton} onPress={handleSend}>
              <AntDesign name="arrowright" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000', // Black background
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  headerAvatarIcon: {
    marginRight: 10,
  },
  headerTitleText: {
    color: '#fff',
    fontSize: 18,
  },
  messagesContainer: {
    flexGrow: 1,
    padding: 20,
    justifyContent: 'flex-end',
  },
  placeholderText: {
    color: '#888',
    fontSize: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 10,
    borderTopColor: '#444',
    borderTopWidth: 1,
    backgroundColor: '#000',
    alignItems: 'flex-end',
  },
  textInput: {
    flex: 1,
    maxHeight: 100,
    backgroundColor: '#222',
    color: '#fff',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginRight: 10,
  },
  sendButton: {
    backgroundColor: '#1E90FF', // DodgerBlue
    borderRadius: 20,
    padding: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default ChatScreen;
