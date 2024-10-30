// screens/ChatScreen.js
import React, { useEffect, useState, useLayoutEffect, useCallback } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    SafeAreaView,
    Image,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { AntDesign, FontAwesome } from '@expo/vector-icons';
import { database, auth } from '../firebase';
import {
    ref,
    onValue,
    push,
    get,
    set,
    serverTimestamp,
    off,
} from 'firebase/database';
import { StatusBar } from 'expo-status-bar';
import { useHeaderHeight } from '@react-navigation/elements';
import { GiftedChat } from 'react-native-gifted-chat';

const ChatScreen = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { userIds } = route.params;
    const [chatUsers, setChatUsers] = useState([]);
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [chatId, setChatId] = useState(null);
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
                if (
                    JSON.stringify(chatParticipants) === JSON.stringify(participants)
                ) {
                    return cid;
                }
            }
        }
        return null;
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
                    const unsubscribe = onValue(messagesRef, async (snapshot) => {
                        const messagesData = snapshot.val();
                        if (messagesData) {
                            const messagesList = await Promise.all(
                                Object.entries(messagesData).map(async ([id, data]) => {
                                    // Fetch sender info
                                    let sender = {
                                        _id: data.senderId,
                                        name: '',
                                        avatar: null,
                                    };

                                    if (data.senderId !== currentUser.uid) {
                                        const userRef = ref(database, `users/${data.senderId}`);
                                        const userSnapshot = await get(userRef);
                                        if (userSnapshot.exists()) {
                                            const userData = userSnapshot.val();
                                            sender.name = `${userData.firstName} ${userData.lastName}`;
                                            sender.avatar =
                                                userData.avatar && userData.avatar !== 'none'
                                                    ? userData.avatar.link
                                                    : null;
                                        }
                                    } else {
                                        sender.name = 'You';
                                        sender.avatar = currentUser.photoURL || null;
                                    }

                                    return {
                                        _id: id,
                                        text: data.content,
                                        createdAt: new Date(data.timestamp),
                                        user: sender,
                                    };
                                })
                            );
                            setMessages(
                                messagesList
                            );
                        }
                        setLoading(false);
                    });

                    return () => off(messagesRef, 'value', unsubscribe);
                } else {
                    setLoading(false);
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
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={{ marginLeft: 15 }}
                >
                    <AntDesign name="arrowleft" size={24} color="#fff" />
                </TouchableOpacity>
            ),
            headerTitle: () => {
                if (chatUsers.length === 1) {
                    const chatUser = chatUsers[0];
                    return (
                        <View style={styles.headerTitleContainer}>
                            {chatUser.avatar && chatUser.avatar !== 'none' ? (
                                <Image
                                    source={{ uri: chatUser.avatar.link }}
                                    style={styles.headerAvatar}
                                />
                            ) : (
                                <FontAwesome
                                    name="user-circle-o"
                                    size={40}
                                    color="#fff"
                                    style={styles.headerAvatarIcon}
                                />
                            )}
                            <Text style={styles.headerTitleText}>
                                {chatUser.firstName} {chatUser.lastName}
                            </Text>
                        </View>
                    );
                } else {
                    return (
                        <View style={styles.headerTitleContainer}>
                            <FontAwesome
                                name="users"
                                size={40}
                                color="#fff"
                                style={styles.headerAvatarIcon}
                            />
                            <Text style={styles.headerTitleText}>
                                {chatUsers.map((u) => u.firstName).join(', ')}
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

    const onSend = useCallback(
        async (messages = []) => {
            const message = messages[0];
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
                            senderId: currentUser.uid,
                        },
                    });

                    // Add chat reference to all users
                    for (const uid of chatParticipants) {
                        await set(ref(database, `user-chats/${uid}/${cid}`), true);
                    }

                    setChatId(cid);
                }

                const messageData = {
                    content: message.text,
                    timestamp: serverTimestamp(),
                    senderId: currentUser.uid,
                    seen: false,
                };

                // Add message to messages collection
                await push(ref(database, `messages/${cid}`), messageData);

                // Update last message in chat
                await set(ref(database, `chats/${cid}/lastMessage`), messageData);
            } catch (error) {
                console.error('Error sending message:', error);
            }
        },
        [chatId]
    );

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#1E90FF" />
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar style="light" />
            <GiftedChat
                messages={messages}
                onSend={(messages) => onSend(messages)}
                user={{
                    _id: currentUser.uid,
                    name: currentUser.displayName || 'You',
                    avatar: currentUser.photoURL || null,
                }}
                inverted={false}
                placeholder="Type a message..."
                showUserAvatar={true}
                renderAvatarOnTop={true}
                renderUsernameOnMessage={chatUsers.length > 1}
            />
        </SafeAreaView>
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
});

export default ChatScreen;
