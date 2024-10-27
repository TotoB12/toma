// screens/HomeScreen.js
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import { useNavigation } from '@react-navigation/native';

const HomeScreen = () => {
  const navigation = useNavigation();

  const handleSignOut = () => {
    signOut(auth)
      .then(() => {
        // onAuthStateChanged observer in App.js will handle navigation
      })
      .catch((error) => {
        Alert.alert('Error', error.message);
      });
  };

  const user = auth.currentUser;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome!</Text>
      <Text style={styles.subtitle}>Phone: {user?.phoneNumber}</Text>
      <TouchableOpacity style={styles.button} onPress={handleSignOut}>
        <Text style={styles.buttonText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000', // Black background
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 32,
    color: '#fff', // White text
    marginBottom: 20,
  },
  subtitle: {
    fontSize: 18,
    color: '#fff',
    marginBottom: 40,
  },
  button: {
    backgroundColor: '#fff', // White button
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 5,
    opacity: 1,
  },
  buttonText: {
    color: '#000', // Black text
    fontSize: 16,
  },
});

export default HomeScreen;
