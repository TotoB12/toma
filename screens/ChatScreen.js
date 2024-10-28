// screens/ChatScreen.js
import React, { useEffect, useState, useLayoutEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity,
  StyleSheet, TextInput, SafeAreaView, Image, KeyboardAvoidingView,
  Platform, TouchableWithoutFeedback, Keyboard, FlatList,
  ActivityIndicator
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { AntDesign, FontAwesome } from '@expo/vector-icons';
import { database, auth } from '../firebase';
import { ref, onValue, push, get, set, serverTimestamp, off } from 'firebase/database';
import { StatusBar } from 'expo-status-bar';
import { useHeaderHeight } from '@react-navigation/elements';

const ChatScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { userIds } = route.params; // Changed to userIds
  const [chatUsers, setChatUsers] = useState([]);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [chatId, setChatId] = useState(null);
  const flatListRef = useRef(null);
  const currentUser = auth.currentUser;
  const headerHeight = useHeaderHeight();

  // Function to get existing chat ID
  const getChatId = async () => {
    const participants = [...userIds, currentUser.uid].sort();
    const participantsKey = participants.join('_');

    const chatsRef = ref(database, 'chats');
    const snapshot = await get(chatsRef);

    if (snapshot.exists()) {
      const chatsData = snapshot.val();
      for (const cid in chatsData) {
        const chat = chatsData[cid];
        const chatParticipants = chat.participants.sort();
        if (JSON.stringify(chatParticipants) === JSON.stringify(participants)) {
          return cid;
        }
      }
    }
    return null; // Chat does not exist
  };

  // Initialize chat
  useEffect(() => {
    const initializeChat = async () => {
      try {
        const cid = await getChatId();
        if (cid) {
          setChatId(cid);

          // Subscribe to messages
          const messagesRef = ref(database, `messages/${cid}`);
          const unsubscribe = onValue(messagesRef, (snapshot) => {
            const messagesData = snapshot.val();
            if (messagesData) {
              const messagesList = Object.entries(messagesData).map(([id, data]) => ({
                id,
                ...data
              })).sort((a, b) => a.timestamp - b.timestamp);
              setMessages(messagesList);
            }
            setLoading(false);
          });

          return () => off(messagesRef, 'value', unsubscribe);
        } else {
          setLoading(false); // No existing chat
        }
      } catch (error) {
        console.error('Error initializing chat:', error);
        setLoading(false);
      }
    };

    if (currentUser && userIds) {
      initializeChat();
    }
  }, [currentUser, userIds]);

  // Fetch chat users info
  useEffect(() => {
    const fetchChatUsers = async () => {
      const usersData = [];
      for (const uid of userIds) {
        const userRef = ref(database, `users/${uid}`);
        const snapshot = await get(userRef);
        if (snapshot.exists()) {
          usersData.push({ uid, ...snapshot.val() });
        }
      }
      setChatUsers(usersData);
    };

    fetchChatUsers();
  }, [userIds]);

  // Set up header
  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: true,
      headerLeft: () => (
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginLeft: 15 }}>
          <AntDesign name="arrowleft" size={24} color="#fff" />
        </TouchableOpacity>
      ),
      headerTitle: () => {
        if (chatUsers.length === 1) {
          const chatUser = chatUsers[0];
          return (
            <View style={styles.headerTitleContainer}>
              {chatUser.avatar && chatUser.avatar !== 'none' ? (
                <Image source={{ uri: chatUser.avatar }} style={styles.headerAvatar} />
              ) : (
                <FontAwesome name="user-circle-o" size={40} color="#fff" style={styles.headerAvatarIcon} />
              )}
              <Text style={styles.headerTitleText}>{chatUser.firstName} {chatUser.lastName}</Text>
            </View>
          );
        } else {
          return (
            <View style={styles.headerTitleContainer}>
              <FontAwesome name="users" size={40} color="#fff" style={styles.headerAvatarIcon} />
              <Text style={styles.headerTitleText}>
                {chatUsers.map(u => u.firstName).join(', ')}
              </Text>
            </View>
          );
        }
      },
      headerStyle: {
        backgroundColor: '#000',
        height: headerHeight,
      },
      headerTintColor: '#fff',
    });
  }, [navigation, chatUsers, headerHeight]);

  const handleSend = async () => {
    if (!message.trim()) return;

    try {
      let cid = chatId;

      if (!cid) {
        // Create new chat
        const newChatRef = push(ref(database, 'chats'));
        cid = newChatRef.key;

        const chatParticipants = [...userIds, currentUser.uid].sort();

        // Set up chat data
        await set(ref(database, `chats/${cid}`), {
          participants: chatParticipants,
          createdAt: serverTimestamp(),
          lastMessage: {
            content: '',
            timestamp: serverTimestamp(),
            senderId: currentUser.uid
          }
        });

        // Add chat reference to all users
        for (const uid of chatParticipants) {
          await set(ref(database, `user-chats/${uid}/${cid}`), true);
        }

        setChatId(cid);

        // Subscribe to messages
        const messagesRef = ref(database, `messages/${cid}`);
        const unsubscribe = onValue(messagesRef, (snapshot) => {
          const messagesData = snapshot.val();
          if (messagesData) {
            const messagesList = Object.entries(messagesData).map(([id, data]) => ({
              id,
              ...data
            })).sort((a, b) => a.timestamp - b.timestamp);
            setMessages(messagesList);
          }
          setLoading(false);
        });
      }

      const messageData = {
        content: message.trim(),
        timestamp: serverTimestamp(),
        senderId: currentUser.uid,
        seen: false
      };

      // Add message to messages collection
      await push(ref(database, `messages/${cid}`), messageData);

      // Update last message in chat
      await set(ref(database, `chats/${cid}/lastMessage`), messageData);

      setMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const renderMessage = ({ item }) => {
    const isCurrentUser = item.senderId === currentUser.uid;
    const sender = chatUsers.find(u => u.uid === item.senderId);
    const senderName = sender ? `${sender.firstName} ${sender.lastName}` : 'Unknown';

    return (
      <View style={[
        styles.messageContainer,
        isCurrentUser ? styles.currentUserMessage : styles.otherUserMessage
      ]}>
        {!isCurrentUser && chatUsers.length > 1 && (
          <Text style={styles.senderName}>{senderName}</Text>
        )}
        <Text style={styles.messageText}>{item.content}</Text>
        <Text style={styles.messageTime}>
          {new Date(item.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
          })}
        </Text>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1E90FF" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={headerHeight + (Platform.OS === 'ios' ? 20 : 0)}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <SafeAreaView style={styles.container}>
          <StatusBar style="light" />
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={item => item.id}
            style={styles.messagesContainer}
            contentContainerStyle={styles.messagesList}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
            onLayout={() => flatListRef.current?.scrollToEnd()}
          />
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.textInput}
              placeholder="Type a message"
              placeholderTextColor="#888"
              value={message}
              onChangeText={setMessage}
              multiline
            />
            <TouchableOpacity
              style={[
                styles.sendButton,
                !message.trim() && styles.sendButtonDisabled
              ]}
              onPress={handleSend}
              disabled={!message.trim()}
            >
              <AntDesign name="arrowright" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flex: 1,
    backgroundColor: '#000',
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
    flex: 1,
    paddingHorizontal: 10,
  },
  messagesList: {
    paddingVertical: 20,
  },
  messageContainer: {
    maxWidth: '80%',
    padding: 10,
    borderRadius: 15,
    marginVertical: 5,
  },
  currentUserMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#1E90FF',
    borderTopRightRadius: 5,
  },
  otherUserMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#333',
    borderTopLeftRadius: 5,
  },
  messageText: {
    color: '#fff',
    fontSize: 16,
  },
  senderName: {
    color: '#1E90FF',
    fontSize: 12,
    marginBottom: 5,
  },
  messageTime: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    alignSelf: 'flex-end',
    marginTop: 5,
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
    backgroundColor: '#1E90FF',
    borderRadius: 20,
    padding: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#555',
  },
});

export default ChatScreen;
