// screens\Chat.js
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { Ionicons } from '@expo/vector-icons';
import { GiftedChat, Bubble, Send, InputToolbar } from 'react-native-gifted-chat';
import { auth, database } from '../config/firebase';
import { collection, doc, onSnapshot, setDoc, getDoc, query, where } from 'firebase/firestore';
import { colors } from '../config/constants';
import * as ImagePicker from 'expo-image-picker';

function Chat({ route }) {
    const [messages, setMessages] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [rawMessages, setRawMessages] = useState([]);
    const [usersAvatars, setUsersAvatars] = useState({});
    const [userEmails, setUserEmails] = useState([]);

    useEffect(() => {
        const unsubscribe = onSnapshot(doc(database, 'chats', route.params.id), (doc) => {
            const chatData = doc.data();
            const messagesWithDate = chatData.messages.map((message) => ({
                ...message,
                createdAt: message.createdAt.toDate(),
            }));
            setRawMessages(messagesWithDate);

            // Get users' emails
            const usersInChat = chatData.users;
            const userEmails = usersInChat.map(user => user.email);
            setUserEmails(userEmails);
        });

        return () => unsubscribe();
    }, [route.params.id]);

    useEffect(() => {
        if (userEmails.length > 0) {
            const usersCollection = collection(database, 'users');
            const q = query(usersCollection, where('email', 'in', userEmails));
            const unsubscribeUsers = onSnapshot(q, (querySnapshot) => {
                const avatars = {};
                querySnapshot.forEach((userDoc) => {
                    const userData = userDoc.data();
                    avatars[userData.email] = userData.avatar?.link;
                });
                setUsersAvatars(avatars);
            });
            return () => unsubscribeUsers();
        }
    }, [userEmails]);

    useEffect(() => {
        if (rawMessages.length > 0) {
            const updatedMessages = rawMessages.map((message) => ({
                ...message,
                user: {
                    ...message.user,
                    avatar: usersAvatars[message.user._id] ?? message.user.avatar,
                }
            }));
            setMessages(updatedMessages);
        } else {
            setMessages(rawMessages);
        }
    }, [rawMessages, usersAvatars]);

    const onSend = useCallback(async (m = []) => {
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
        }));

        const messagesWillSend = [{ ...m[0], sent: true, received: false }];
        let chatMessages = GiftedChat.append(data, messagesWillSend);

        await setDoc(doc(database, 'chats', route.params.id), {
            messages: chatMessages,
            lastUpdated: Date.now()
        }, { merge: true });
    }, [route.params.id]);

    const pickImage = async () => {
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.All, // includes videos
            allowsEditing: true,
            aspect: [4, 3],
            quality: 1,
        });

        console.log(result);

        if (!result.canceled) {
            await uploadImage(result.assets[0].uri);
        }
    };

    const uploadImage = async (uri) => {
        try {
            setUploading(true);
            const formData = new FormData();

            const uriParts = uri.split('.');
            const fileType = uriParts[uriParts.length - 1];

            formData.append('image', {
                uri: uri,
                name: `chatimage.${fileType}`,
                type: `image/${fileType}`,
            });

            const clientId = '094005370d443cb';
            const authHeader = 'Client-ID ' + clientId;

            const response = await fetch('https://api.imgur.com/3/image', {
                method: 'POST',
                headers: {
                    Authorization: authHeader,
                    Accept: 'application/json',
                },
                body: formData,
            });

            const result = await response.json();

            if (result.success) {
                const imageData = result.data;

                // Now, create a message with the image data
                onSend([
                    {
                        _id: imageData.id, // Use image ID or generate a new one
                        createdAt: new Date(),
                        text: "",
                        image: imageData.link, // The image URL from Imgur
                        user: {
                            _id: auth?.currentUser?.email,
                            name: auth?.currentUser?.displayName,
                            avatar: usersAvatars[auth?.currentUser?.email],
                        },
                        imageData: imageData, // Save the full image data
                    },
                ]);
            } else {
                console.error('Imgur upload failed:', result);
                Alert.alert('Upload failed', 'Failed to upload image to Imgur.');
            }
        } catch (error) {
            console.error('Error uploading image:', error);
            Alert.alert('Error', 'An error occurred while uploading the image.');
        } finally {
            setUploading(false);
        }
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
                    avatar: usersAvatars[auth?.currentUser?.email]
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
