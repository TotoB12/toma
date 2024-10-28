// screens/HomeScreen.js
import React, { useEffect, useState, useLayoutEffect } from 'react';
import {
  View, Text, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, Modal, TextInput, FlatList, SafeAreaView, Image,
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

  // State variables for modal and search functionality
  const [modalVisible, setModalVisible] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);

  // State variables for chats
  const [chats, setChats] = useState([]);
  const [chatsLoading, setChatsLoading] = useState(true);

  const handleSignOut = () => {
    signOut(auth)
      .then(() => {
        // onAuthStateChanged observer in App.js will handle navigation
      })
      .catch((error) => {
        Alert.alert('Error', error.message);
      });
  };

  // Set up the header with the plus icon
  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: true,
      headerRight: () => (
        <TouchableOpacity onPress={() => setModalVisible(true)}>
          <AntDesign name="pluscircle" size={24} color="#fff" style={{ marginRight: 15 }} />
        </TouchableOpacity>
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
      }, (error) => {
        Alert.alert('Error', 'Failed to fetch user data: ' + error.message);
        setLoading(false);
      });

      // Clean up the listener on unmount
      return () => unsubscribe();
    } else {
      setLoading(false);
    }
  }, []);

  // Fetch user's chats
  useEffect(() => {
    const userChatsRef = ref(database, `user-chats/${auth.currentUser.uid}`);

    const onUserChatsValueChange = snapshot => {
      const userChatsData = snapshot.val();
      if (userChatsData) {
        const chatIds = Object.keys(userChatsData);

        // Fetch chat data for each chat ID
        Promise.all(chatIds.map(async (chatId) => {
          const chatRef = ref(database, `chats/${chatId}`);
          const chatSnapshot = await get(chatRef);
          const chatData = chatSnapshot.val();

          if (chatData) {
            // Get the other participant
            const otherUserId = chatData.participants.find(uid => uid !== auth.currentUser.uid);
            // Get other user's info
            const otherUserRef = ref(database, `users/${otherUserId}`);
            const otherUserSnapshot = await get(otherUserRef);
            const otherUserData = otherUserSnapshot.val();

            return {
              chatId,
              otherUser: {
                uid: otherUserId,
                ...otherUserData
              },
              lastMessage: chatData.lastMessage
            };
          } else {
            return null;
          }
        })).then(chatsData => {
          // Remove nulls (if any chats failed to load)
          setChats(chatsData.filter(chat => chat !== null));
          setChatsLoading(false);
        });
      } else {
        setChats([]);
        setChatsLoading(false);
      }
    };

    onValue(userChatsRef, onUserChatsValueChange);

    return () => {
      off(userChatsRef, 'value', onUserChatsValueChange);
    };
  }, []);

  // Fetch all users when the modal is visible
  useEffect(() => {
    if (modalVisible) {
      const usersRef = ref(database, 'users');
      const unsubscribe = onValue(usersRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          const usersArray = Object.keys(data)
            .filter(uid => uid !== auth.currentUser.uid) // Exclude current user
            .map(uid => ({ uid, ...data[uid] }));
          setAllUsers(usersArray);
        }
      });

      return () => unsubscribe();
    }
  }, [modalVisible]);

  // Handle the search functionality
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

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1E90FF" />
        <StatusBar style="light" />
      </View>
    );
  }

  if (!userInfo) {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.container}>
            <Text style={styles.errorText}>No user information available.</Text>
            <TouchableOpacity style={styles.button} onPress={handleSignOut}>
              <Text style={styles.buttonText}>Sign Out</Text>
            </TouchableOpacity>
            <StatusBar style="light" />
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    );
  }

  const renderChatItem = ({ item }) => {
    const { chatId, otherUser, lastMessage } = item;

    return (
      <View>
        <TouchableOpacity
          style={styles.chatItem}
          onPress={() => {
            navigation.navigate('Chat', { userId: otherUser.uid }); // Pass userId
          }}
        >
          {otherUser.avatar && otherUser.avatar !== 'none' ? (
            <Image source={{ uri: otherUser.avatar }} style={styles.avatar} />
          ) : (
            <FontAwesome name="user-circle-o" size={50} color="#1E90FF" style={styles.avatarIcon} />
          )}
          <View style={styles.chatInfo}>
            <Text style={styles.chatName}>{otherUser.firstName} {otherUser.lastName}</Text>
            <Text style={styles.chatLastMessage} numberOfLines={1}>
              {lastMessage && lastMessage.content ? lastMessage.content : 'No messages yet'}
            </Text>
          </View>
        </TouchableOpacity>
        <View style={styles.divider} />
      </View>
    );
  };

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
            />
          )}

          {/* Modal for searching users */}
          <Modal
            animationType="slide"
            transparent={false}
            visible={modalVisible}
            onRequestClose={() => {
              setModalVisible(!modalVisible);
            }}
          >
            <KeyboardAvoidingView
              style={styles.modalContainer}
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
            >
              <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <SafeAreaView style={styles.modalInnerContainer}>
                  {/* Header */}
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>New Chat</Text>
                    <TouchableOpacity onPress={() => setModalVisible(false)}>
                      <AntDesign name="close" size={24} color="#fff" />
                    </TouchableOpacity>
                  </View>

                  {/* Search Input */}
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search by name, email, or phone number"
                    placeholderTextColor="#888"
                    value={searchQuery}
                    onChangeText={handleSearch}
                  />

                  {/* Search Results */}
                  <FlatList
                    data={searchResults}
                    keyExtractor={item => item.uid}
                    renderItem={({ item }) => (
                      <View>
                        <TouchableOpacity
                          style={styles.userItem}
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
                          <View style={styles.userInfo}>
                            <Text style={styles.userName}>{item.firstName} {item.lastName}</Text>
                            <Text style={styles.userDetails}>{item.email}</Text>
                            <Text style={styles.userDetails}>{item.phoneNumber}</Text>
                          </View>
                        </TouchableOpacity>
                        <View style={styles.divider} />
                      </View>
                    )}
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
    backgroundColor: '#000', // Black background
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  innerContainer: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 28,
    color: '#fff', // White text
    marginBottom: 20,
    textAlign: 'center',
  },
  infoText: {
    fontSize: 18,
    color: '#fff',
    marginBottom: 10,
  },
  errorText: {
    fontSize: 18,
    color: 'red',
    marginBottom: 20,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#fff', // White button
    paddingVertical: 15,
    paddingHorizontal: 50,
    borderRadius: 5,
    marginTop: 30,
  },
  buttonText: {
    color: '#000', // Black text
    fontSize: 16,
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
    borderColor: '#fff',
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 10,
    color: '#fff',
    marginBottom: 15,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  avatarIcon: {
    marginRight: 10,
  },
  userInfo: {
    marginLeft: 15,
    flex: 1,
  },
  userName: {
    fontSize: 18,
    color: '#fff',
    marginBottom: 2,
  },
  userDetails: {
    fontSize: 14,
    color: '#888',
  },
  divider: {
    height: 1,
    backgroundColor: '#444',
    marginVertical: 5,
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
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  chatInfo: {
    marginLeft: 15,
    flex: 1,
  },
  chatName: {
    fontSize: 18,
    color: '#fff',
    marginBottom: 2,
  },
  chatLastMessage: {
    fontSize: 14,
    color: '#888',
  },
});

export default HomeScreen;
