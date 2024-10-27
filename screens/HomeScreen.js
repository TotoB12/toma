// screens/HomeScreen.js
import React, { useEffect, useState } from 'react';
import { 
  View, Text, TouchableOpacity, 
  StyleSheet, Alert, ActivityIndicator 
} from 'react-native';
import { auth, database } from '../firebase';
import { signOut } from 'firebase/auth';
import { useNavigation } from '@react-navigation/native';
import { ref, onValue } from 'firebase/database';

const HomeScreen = () => {
  const navigation = useNavigation();
  const [userInfo, setUserInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  const handleSignOut = () => {
    signOut(auth)
      .then(() => {
        // onAuthStateChanged observer in App.js will handle navigation
      })
      .catch((error) => {
        Alert.alert('Error', error.message);
      });
  };

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
});

export default HomeScreen;
