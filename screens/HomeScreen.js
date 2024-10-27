// screens/HomeScreen.js
import React, { useEffect, useState, useLayoutEffect } from 'react';
import { 
  View, Text, TouchableOpacity, 
  StyleSheet, Alert, ActivityIndicator, Modal, TextInput, FlatList
} from 'react-native';
import { auth, database } from '../firebase';
import { signOut } from 'firebase/auth';
import { useNavigation } from '@react-navigation/native';
import { ref, onValue } from 'firebase/database';
import { AntDesign } from '@expo/vector-icons';

const HomeScreen = () => {
  const navigation = useNavigation();
  const [userInfo, setUserInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  // State variables for modal and search functionality
  const [modalVisible, setModalVisible] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);

  const handleSignOut = () => {
    signOut(auth)
      .then(() => {
        // onAuthStateChanged observer in App.js will handle navigation
      })
      .catch((error) => {
        Alert.alert('Error', error.message);
      });
  };

  // Set up the header with the plus icon using useLayoutEffect
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

  // Fetch all users when the modal is visible
  useEffect(() => {
    if (modalVisible) {
      const usersRef = ref(database, 'users');
      const unsubscribe = onValue(usersRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          const usersArray = Object.keys(data).map(uid => ({ uid, ...data[uid] }));
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
      </View>
    );
  }

  if (!userInfo) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>No user information available.</Text>
        <TouchableOpacity style={styles.button} onPress={handleSignOut}>
          <Text style={styles.buttonText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { firstName, lastName, phoneNumber, email } = userInfo;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome, {firstName} {lastName}!</Text>
      <Text style={styles.infoText}>Email: {email}</Text>
      <Text style={styles.infoText}>Phone: {phoneNumber}</Text>
      
      <TouchableOpacity style={styles.button} onPress={handleSignOut}>
        <Text style={styles.buttonText}>Sign Out</Text>
      </TouchableOpacity>

      {/* Modal for searching users */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={modalVisible}
        onRequestClose={() => {
          setModalVisible(!modalVisible);
        }}
      >
        <View style={styles.modalContainer}>
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
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => {
                  setModalVisible(false);
                  navigation.navigate('Chat', { userId: item.uid });
                }}
              >
                <Text style={styles.resultText}>{item.firstName} {item.lastName}</Text>
              </TouchableOpacity>
            )}
          />
          <TouchableOpacity
            onPress={() => setModalVisible(!modalVisible)}
            style={styles.closeButton}
          >
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>

    </View>
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
    padding: 20,
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
  resultText: {
    color: '#fff',
    fontSize: 18,
    paddingVertical: 10,
    borderBottomColor: '#444',
    borderBottomWidth: 1,
  },
  closeButton: {
    marginTop: 20,
    alignSelf: 'center',
  },
  closeButtonText: {
    color: '#1E90FF',
    fontSize: 18,
  },
});

export default HomeScreen;
