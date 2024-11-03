// screens\Chat.js
import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { View, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import { Ionicons } from '@expo/vector-icons'
import { GiftedChat, Bubble, Send, InputToolbar } from 'react-native-gifted-chat'
import { auth, database } from '../config/firebase';
import { doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { colors } from '../config/constants';
import * as ImagePicker from 'expo-image-picker';
import uuid from 'react-native-uuid';

function Chat({ route }) {
    const [messages, setMessages] = useState([]);
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        const unsubscribe = onSnapshot(doc(database, 'chats', route.params.id), (doc) => {
            setMessages(doc.data().messages.map((message) => ({
                ...message,
                createdAt: message.createdAt.toDate(),
                image: message.image ?? '',
            })));
        });

        return () => unsubscribe();
    }, [route.params.id]);

    const onSend = useCallback( async (m = []) => {
        const userDocRef = doc(database, 'users', auth?.currentUser?.email);
        const userDoc = await getDoc(userDocRef);
        const currentUserAvatar = userDoc.data().avatar?.link || null;
    
        m[0].user.avatar = currentUserAvatar;
        
       const chatDocRef = doc(database, "chats", route.params.id);
       const chatDocSnap = await getDoc(chatDocRef);

       const chatData = chatDocSnap.data();
       const data = chatData.messages.map((message) => ({
         ...message,
         createdAt: message.createdAt.toDate(),
         image: message.image ?? "",
       }));

       const messagesWillSend = [{ ...m[0], sent: true, received: false }];
       let chatMessages = GiftedChat.append(data, messagesWillSend);

       setDoc(doc(database, 'chats', route.params.id), {
             messages: chatMessages,
             lastUpdated: Date.now()
         }, { merge: true });
    }, [route.params.id, messages]);

    const pickImage = async () => {
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 1,
        });

        if (!result.canceled) {
            await uploadImageAsync(result.assets[0].uri);
        }
    };

    const uploadImageAsync = async (uri) => {
      setUploading(true);
      const blob = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.onload = () => resolve(xhr.response);
        xhr.onerror = () => reject(new TypeError("Network request failed"));
        xhr.responseType = "blob";
        xhr.open("GET", uri, true);
        xhr.send(null);
      });
      const randomString = uuid.v4();
      const fileRef = ref(getStorage(), randomString);

      const uploadTask = uploadBytesResumable(fileRef, blob);

      uploadTask.on(
        "state_changed",
        (snapshot) => {
          const progress =
            (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          console.log("Upload percent:", progress);
        },
        (error) => {
          console.log(error);
          reject(error);
        },
        async () => {
          const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
          setUploading(false);
          onSend([
            {
              _id: randomString,
              createdAt: new Date(),
              text: "",
              image: downloadUrl,
              user: {
                _id: auth?.currentUser?.email,
                name: auth?.currentUser?.displayName,
                avatar: "https://i.pravatar.cc/300",
              },
            },
          ]);
        }
      );
    };

    const renderBubble = useMemo(() => (props) => (
        <Bubble
            {...props}
            wrapperStyle={{
                right: { backgroundColor: colors.primary },
                left: { backgroundColor: '#333' }
            }}
            textStyle={{
                right: { color: '#fff' },
                left: { color: '#fff' },
            }}
        />
    ), []);

    const renderSend = useMemo(() => (props) => (
        <>
            <TouchableOpacity style={styles.addImageIcon} onPress={pickImage}>
                <View>
                    <Ionicons
                        name='attach-outline'
                        size={32}
                        color={colors.teal} />
                </View>
            </TouchableOpacity>
            <Send {...props}>
                <View style={{ justifyContent: 'center', height: '100%', marginLeft: 8, marginRight: 4, marginTop: 12 }}>
                    <Ionicons
                        name='send'
                        size={24}
                        color={colors.teal} />
                </View>
            </Send>
        </>
    ), []);

    const renderInputToolbar = useMemo(() => (props) => (
        <InputToolbar {...props}
            containerStyle={styles.inputToolbar}
        />
    ), []);

    const renderLoading = useMemo(() => () => (
        <View style={styles.loadingContainer}>
            <ActivityIndicator size='large' color={colors.teal} />
        </View>
    ), []);

    const renderLoadingUpload = useMemo(() => () => (
        <View style={styles.loadingContainerUpload}>
            <ActivityIndicator size='large' color={colors.teal} />
        </View>
    ), []);

    return (
        <>
            {uploading && renderLoadingUpload()}
            <GiftedChat
                messages={messages}
                showAvatarForEveryMessage={false}
                showUserAvatar={false}
                onSend={messages => onSend(messages)}
                imageStyle={{ height: 212, width: 212 }}
                messagesContainerStyle={{ backgroundColor: '#000' }}
                textInputStyle={{ backgroundColor: '#333', color: '#fff', borderRadius: 20 }}
                user={{
                    _id: auth?.currentUser?.email,
                    name: auth?.currentUser?.displayName,
                    avatar: 'https://i.pravatar.cc/300'
                }}
                renderBubble={renderBubble}
                renderSend={renderSend}
                renderUsernameOnMessage={true}
                renderAvatarOnTop={true}
                renderInputToolbar={renderInputToolbar}
                minInputToolbarHeight={56}
                scrollToBottom={true}
                scrollToBottomStyle={styles.scrollToBottomStyle}
                renderLoading={renderLoading}
            />
        </>
    );
}

const styles = StyleSheet.create({
    inputToolbar: {
        bottom: 6,
        marginLeft: 8,
        marginRight: 8,
        borderRadius: 16,
        backgroundColor: '#000',
        borderTopColor: '#333',
    },
    addImageIcon: {
        bottom: 8,
        width: 32,
        height: 32,
        borderRadius: 16,
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingContainerUpload: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: "rgba(0, 0, 0, 0.5)", 
      zIndex: 999, 
    }
});

export default Chat;
