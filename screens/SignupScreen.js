// screens/SignupScreen.js
import React, { useState } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, 
  StyleSheet, Alert, ScrollView 
} from 'react-native';
import { auth, database } from '../firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { useNavigation } from '@react-navigation/native';
import { ref, set } from 'firebase/database';

// Simple phone number validation (adjust regex as needed)
const isValidPhoneNumber = (phone) => {
  const phoneRegex = /^\+?[1-9]\d{1,14}$/; // E.164 format
  return phoneRegex.test(phone);
};

const SignupScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // New fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');

  const navigation = useNavigation();

  const handleSignup = () => {
    // Basic validation
    if (!email || !password || !firstName || !lastName || !phoneNumber) {
      Alert.alert('Error', 'Please fill in all fields.');
      return;
    }

    if (!isValidPhoneNumber(phoneNumber)) {
      Alert.alert('Error', 'Please enter a valid phone number.');
      return;
    }

    createUserWithEmailAndPassword(auth, email, password)
      .then((userCredential) => {
        // Signed up successfully
        const user = userCredential.user;

        // Store additional user info in Realtime Database
        set(ref(database, 'users/' + user.uid), {
          firstName,
          lastName,
          phoneNumber,
          email
        })
        .then(() => {
          Alert.alert('Success', 'Account created successfully!');
          // Navigation will be handled by onAuthStateChanged in App.js
        })
        .catch((error) => {
          Alert.alert('Error', 'Failed to save user data: ' + error.message);
        });
      })
      .catch((error) => {
        Alert.alert('Error', error.message);
      });
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Sign Up</Text>
      
      <TextInput
        style={styles.input}
        placeholder="First Name"
        placeholderTextColor="#888"
        autoCapitalize="words"
        onChangeText={setFirstName}
        value={firstName}
      />
      
      <TextInput
        style={styles.input}
        placeholder="Last Name"
        placeholderTextColor="#888"
        autoCapitalize="words"
        onChangeText={setLastName}
        value={lastName}
      />
      
      <TextInput
        style={styles.input}
        placeholder="Phone Number (e.g., +1234567890)"
        placeholderTextColor="#888"
        keyboardType="phone-pad"
        autoCapitalize="none"
        onChangeText={setPhoneNumber}
        value={phoneNumber}
      />
      
      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#888"
        keyboardType="email-address"
        autoCapitalize="none"
        onChangeText={setEmail}
        value={email}
      />
      
      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor="#888"
        secureTextEntry
        onChangeText={setPassword}
        value={password}
      />
      
      <TouchableOpacity style={styles.button} onPress={handleSignup}>
        <Text style={styles.buttonText}>Create Account</Text>
      </TouchableOpacity>
      
      <TouchableOpacity onPress={() => navigation.navigate('Login')}>
        <Text style={styles.linkText}>Already have an account? Log In</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
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
  input: {
    height: 50,
    width: '100%',
    borderColor: '#fff',
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 10,
    color: '#fff',
    marginBottom: 15,
  },
  button: {
    backgroundColor: '#fff', // White button
    paddingVertical: 15,
    paddingHorizontal: 50,
    borderRadius: 5,
    marginTop: 10,
    marginBottom: 10,
  },
  buttonText: {
    color: '#000', // Black text
    fontSize: 16,
  },
  linkText: {
    color: '#1E90FF', // DodgerBlue
    fontSize: 14,
    marginTop: 10,
  },
});

export default SignupScreen;
