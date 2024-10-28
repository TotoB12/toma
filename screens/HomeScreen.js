// screens/HomeScreen.js
import React, { useEffect, useState, useLayoutEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, Modal, TextInput, FlatList, SafeAreaView,
  KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard
} from 'react-native';
import { auth, database } from '../firebase';
import { signOut } from 'firebase/auth';
import { useNavigation } from '@react-navigation/native';
import { ref, onValue, get, off } from 'firebase/database';
import { AntDesign, FontAwesome } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';

const HomeScreen = () => {
  const navigation = useNavigation();
  const [userInfo, setUserInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [chats, setChats] = useState([]);
  const [chatsLoading, setChatsLoading] = useState(true);

  // Ref to store chat listeners
  const chatListeners = useRef({});

  const handleSignOut = () => {
    signOut(auth)
      .then(() => {
        // onAuthStateChanged observer in App.js will handle navigation
      })
      .catch((error) => {
        Alert.alert('Error', error.message);
      });
  };

  // Set up the header with the plus icon and sign out button
  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: true,
      headerRight: () => (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={() => setModalVisible(true)}>
            <AntDesign name="pluscircle" size={24} color="#fff" style={{ marginRight: 15 }} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleSignOut}>
            <AntDesign name="logout" size={24} color="#fff" style={{ marginRight: 15 }} />
          </TouchableOpacity>
        </View>
      ),
      headerStyle: {
        backgroundColor: '#000',
      },
      headerTintColor: '#fff',
    });
  }, [navigation]);

  // Fetch current user information
  useEffect(() => {
    const user = auth.currentUser;
    if (user) {
      const userRef = ref(database, 'users/' + user.uid);
      const unsubscribe = onValue(userRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          setUserInfo(data);
        } else {
          Alert.alert('Error', 'No user data found!');
        }
        setLoading(false);
      });

      return () => unsubscribe();
    } else {
      setLoading(false);
    }
  }, []);

  // Format timestamp to relative time
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';

    const now = new Date();
    const messageDate = new Date(timestamp);
    const diffInHours = (now - messageDate) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return messageDate.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
      });
    } else if (diffInHours < 48) {
      return 'Yesterday';
    } else {
      return messageDate.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  // Fetch and listen to user's chats
  useEffect(() => {
    const userChatsRef = ref(database, `user-chats/${auth.currentUser.uid}`);

    const onUserChatsValueChange = snapshot => {
      const userChatsData = snapshot.val();
      if (userChatsData) {
        const chatIds = Object.keys(userChatsData);

        // Determine added and removed chatIds
        const currentChatIds = Object.keys(chatListeners.current);
        const addedChatIds = chatIds.filter(cid => !currentChatIds.includes(cid));
        const removedChatIds = currentChatIds.filter(cid => !chatIds.includes(cid));

        // Set up listeners for added chats
        addedChatIds.forEach(chatId => {
          const chatRef = ref(database, `chats/${chatId}`);
          const listener = onValue(chatRef, async (chatSnapshot) => {
            const chatData = chatSnapshot.val();
            if (chatData) {
              const otherUserId = chatData.participants.find(uid => uid !== auth.currentUser.uid);
              const otherUserRef = ref(database, `users/${otherUserId}`);
              const otherUserSnapshot = await get(otherUserRef);
              const otherUserData = otherUserSnapshot.val();

              setChats(prevChats => {
                // Remove existing chat if any
                const filteredChats = prevChats.filter(chat => chat.chatId !== chatId);

                // Add updated chat
                return [
                  ...filteredChats,
                  {
                    chatId,
                    otherUser: {
                      uid: otherUserId,
                      ...otherUserData
                    },
                    lastMessage: chatData.lastMessage
                  }
                ].sort((a, b) => {
                  const timeA = a.lastMessage?.timestamp || 0;
                  const timeB = b.lastMessage?.timestamp || 0;
                  return timeB - timeA;
                });
              });
            }
          });

          // Store the listener so it can be removed later
          chatListeners.current[chatId] = listener;
        });

        // Remove listeners for removed chats
        removedChatIds.forEach(chatId => {
          const chatRef = ref(database, `chats/${chatId}`);
          off(chatRef, 'value', chatListeners.current[chatId]);
          delete chatListeners.current[chatId];
          setChats(prevChats => prevChats.filter(chat => chat.chatId !== chatId));
        });

        setChatsLoading(false);
      } else {
        // No chats
        // Remove all existing listeners
        Object.keys(chatListeners.current).forEach(chatId => {
          const chatRef = ref(database, `chats/${chatId}`);
          off(chatRef, 'value', chatListeners.current[chatId]);
          delete chatListeners.current[chatId];
        });
        setChats([]);
        setChatsLoading(false);
      }
    };

    onValue(userChatsRef, onUserChatsValueChange);

    return () => {
      off(userChatsRef, 'value', onUserChatsValueChange);
      // Remove all chat listeners
      Object.keys(chatListeners.current).forEach(chatId => {
        const chatRef = ref(database, `chats/${chatId}`);
        off(chatRef, 'value', chatListeners.current[chatId]);
        delete chatListeners.current[chatId];
      });
    };
  }, []);

  // Fetch all users when modal is opened
  useEffect(() => {
    if (modalVisible) {
      const usersRef = ref(database, 'users');
      const unsubscribe = onValue(usersRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          const usersArray = Object.keys(data)
            .filter(uid => uid !== auth.currentUser.uid)
            .map(uid => ({ uid, ...data[uid] }));
          setAllUsers(usersArray);
        }
      });

      return () => unsubscribe();
    }
  }, [modalVisible]);

  const handleSearch = (text) => {
    setSearchQuery(text);

    if (text.trim() === '') {
      setSearchResults([]);
      return;
    }

    const filteredUsers = allUsers.filter(user => {
      const fullName = `${user.firstName} ${user.lastName}`.toLowerCase();
      const email = user.email.toLowerCase();
      const phoneNumber = user.phoneNumber;

      return (
        fullName.includes(text.toLowerCase()) ||
        email.includes(text.toLowerCase()) ||
        phoneNumber.includes(text)
      );
    });

    setSearchResults(filteredUsers);
  };

  const renderChatItem = ({ item }) => {
    const { otherUser, lastMessage } = item;

    return (
      <View>
        <TouchableOpacity
          style={styles.listItem}
          onPress={() => navigation.navigate('Chat', { userId: otherUser.uid })}
        >
          {otherUser.avatar && otherUser.avatar !== 'none' ? (
            <Image source={{ uri: otherUser.avatar }} style={styles.avatar} />
          ) : (
            <FontAwesome name="user-circle-o" size={50} color="#1E90FF" style={styles.avatarIcon} />
          )}
          <View style={styles.itemContent}>
            <View style={styles.itemHeader}>
              <Text style={styles.primaryText}>
                {otherUser.firstName} {otherUser.lastName}
              </Text>
              {lastMessage && lastMessage.timestamp && (
                <Text style={styles.timestampText}>
                  {formatTimestamp(lastMessage.timestamp)}
                </Text>
              )}
            </View>
            <Text style={styles.secondaryText} numberOfLines={1}>
              {lastMessage && lastMessage.content ? lastMessage.content : 'No messages yet'}
            </Text>
          </View>
        </TouchableOpacity>
        <View style={styles.divider} />
      </View>
    );
  };

  const renderUserItem = ({ item }) => (
    <View>
      <TouchableOpacity
        style={styles.listItem}
        onPress={() => {
          setModalVisible(false);
          navigation.navigate('Chat', { userId: item.uid });
        }}
      >
        {item.avatar && item.avatar !== 'none' ? (
          <Image source={{ uri: item.avatar }} style={styles.avatar} />
        ) : (
          <FontAwesome name="user-circle-o" size={50} color="#1E90FF" style={styles.avatarIcon} />
        )}
        <View style={styles.itemContent}>
          <Text style={styles.primaryText}>{item.firstName} {item.lastName}</Text>
          <Text style={styles.secondaryText}>{item.email}</Text>
          <Text style={styles.secondaryText}>{item.phoneNumber}</Text>
        </View>
      </TouchableOpacity>
      <View style={styles.divider} />
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1E90FF" />
        <StatusBar style="light" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.container}>
          <StatusBar style="light" />
          {chatsLoading ? (
            <ActivityIndicator size="large" color="#1E90FF" />
          ) : chats.length === 0 ? (
            <Text style={styles.noChatsText}>You sure seem lonely. Create a new chat in the top right.</Text>
          ) : (
            <FlatList
              data={chats}
              keyExtractor={item => item.chatId}
              renderItem={renderChatItem}
              style={styles.list}
            />
          )}

          <Modal
            animationType="slide"
            transparent={false}
            visible={modalVisible}
            onRequestClose={() => setModalVisible(false)}
          >
            <KeyboardAvoidingView
              style={styles.modalContainer}
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
            >
              <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <SafeAreaView style={styles.modalInnerContainer}>
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>New Chat</Text>
                    <TouchableOpacity onPress={() => setModalVisible(false)}>
                      <AntDesign name="close" size={24} color="#fff" />
                    </TouchableOpacity>
                  </View>

                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search by name, email, or phone number"
                    placeholderTextColor="#888"
                    value={searchQuery}
                    onChangeText={handleSearch}
                  />

                  <FlatList
                    data={searchResults}
                    keyExtractor={item => item.uid}
                    renderItem={renderUserItem}
                    style={styles.list}
                    ListEmptyComponent={
                      searchQuery.trim() !== '' ? (
                        <Text style={styles.noResultsText}>No users found.</Text>
                      ) : null
                    }
                  />
                </SafeAreaView>
              </TouchableWithoutFeedback>
            </KeyboardAvoidingView>
          </Modal>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  list: {
    flex: 1,
    width: '100%',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 15,
  },
  avatarIcon: {
    marginRight: 15,
  },
  itemContent: {
    flex: 1,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  primaryText: {
    fontSize: 18,
    color: '#fff',
    flex: 1,
  },
  secondaryText: {
    fontSize: 14,
    color: '#888',
  },
  timestampText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 10,
  },
  divider: {
    height: 1,
    backgroundColor: '#333',
    marginLeft: 80, // Aligned with the end of the avatar
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  modalInnerContainer: {
    flex: 1,
    backgroundColor: '#000',
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  modalTitle: {
    fontSize: 24,
    color: '#fff',
    textAlign: 'center',
    flex: 1,
  },
  searchInput: {
    height: 50,
    width: '100%',
    borderColor: '#333',
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 15,
    color: '#fff',
    backgroundColor: '#111',
    marginBottom: 15,
  },
  noResultsText: {
    color: '#fff',
    textAlign: 'center',
    marginTop: 20,
    fontSize: 16,
  },
  noChatsText: {
    color: '#fff',
    textAlign: 'center',
    marginTop: 20,
    fontSize: 16,
    paddingHorizontal: 20,
  },
});

export default HomeScreen;
