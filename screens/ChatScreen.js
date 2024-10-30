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
    Alert,
    Keyboard,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { AntDesign, FontAwesome, Ionicons } from '@expo/vector-icons';
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
import * as ImagePicker from 'expo-image-picker';
import { Video } from 'expo-av';

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

    // New state for media
    const [media, setMedia] = useState(null); // { uri, type }
    const [showTools, setShowTools] = useState(false); // New state for tools area visibility

    // Function to pick media
    const pickMedia = async () => {
        let permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

        if (permissionResult.granted === false) {
            Alert.alert(
                'Permission required',
                'Permission to access media library is required!'
            );
            return;
        }

        let pickerResult = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.All,
            allowsEditing: false,
            quality: 1,
        });

        if (!pickerResult.canceled) {
            setMedia(pickerResult.assets[0]); // Store the selected media
        }
    };

    // Function to upload media to Imgur
    const uploadMediaToImgur = async (uri, type) => {
        try {
            const formData = new FormData();

            const uriParts = uri.split('.');
            const fileType = uriParts[uriParts.length - 1];

            let mediaType = '';

            if (type.startsWith('image')) {
                mediaType = `image/${fileType}`;
                formData.append('image', {
                    uri: uri,
                    name: `media.${fileType}`,
                    type: mediaType,
                });
            } else if (type.startsWith('video')) {
                mediaType = `video/${fileType}`;
                formData.append('video', {
                    uri: uri,
                    name: `media.${fileType}`,
                    type: mediaType,
                });
            } else {
                Alert.alert('Unsupported media', 'Only images and videos are supported.');
                return null;
            }

            const clientId = '094005370d443cb'; // Replace with your Imgur client ID
            const authHeader = 'Client-ID ' + clientId;

            const response = await fetch('https://api.imgur.com/3/upload', {
                method: 'POST',
                headers: {
                    Authorization: authHeader,
                    Accept: 'application/json',
                },
                body: formData,
            });

            const result = await response.json();

            if (result.success) {
                const mediaData = result.data;
                return mediaData;
            } else {
                console.error('Imgur upload failed:', result);
                Alert.alert('Upload failed', 'Failed to upload media to Imgur.');
                return null;
            }
        } catch (error) {
            console.error('Error uploading media:', error);
            Alert.alert('Error', 'An error occurred while uploading the media.');
            return null;
        }
    };

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
                                        image: data.image ? data.image.link : undefined, // Include image
                                        video: data.video ? data.video.link : undefined, // Include video
                                    };
                                })
                            );
                            setMessages(messagesList);
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

    // Function to handle sending messages
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

                let messageData = {
                    content: message.text || '',
                    timestamp: serverTimestamp(),
                    senderId: currentUser.uid,
                    seen: false,
                };

                if (media) {
                    // Upload media to Imgur
                    const mediaData = await uploadMediaToImgur(media.uri, media.type);
                    if (mediaData) {
                        if (media.type.startsWith('image')) {
                            messageData.image = mediaData;
                        } else if (media.type.startsWith('video')) {
                            messageData.video = mediaData;
                        }
                    }
                    // Reset media
                    setMedia(null);
                }

                // Add message to messages collection
                await push(ref(database, `messages/${cid}`), messageData);

                // Update last message in chat
                await set(ref(database, `chats/${cid}/lastMessage`), messageData);
            } catch (error) {
                console.error('Error sending message:', error);
            }
        },
        [chatId, media]
    );

    // Custom action button to toggle tools area
    const renderActions = (props) => (
        <TouchableOpacity
            style={styles.plusIconContainer}
            onPress={() => {
                setShowTools(!showTools);
                if (!showTools) {
                    Keyboard.dismiss(); // Hide keyboard when tools are opened
                }
            }}
        >
            <AntDesign name="pluscircle" size={28} color="#1E90FF" />
        </TouchableOpacity>
    );

    // Render tools area or media preview
    const renderAccessory = () => {
        if (showTools) {
            return (
                <View style={styles.toolsContainer}>
                    <TouchableOpacity
                        style={styles.toolButton}
                        onPress={() => {
                            pickMedia();
                            setShowTools(false);
                        }}
                    >
                        <View style={styles.toolIconContainer}>
                            <Ionicons name="image" size={30} color="#fff" />
                        </View>
                        <Text style={styles.toolText}>Photos</Text>
                    </TouchableOpacity>
                </View>
            );
        } else if (media) {
            return (
                <View style={styles.mediaPreviewContainer}>
                    {media.type.startsWith('image') ? (
                        <Image source={{ uri: media.uri }} style={styles.mediaPreview} />
                    ) : (
                        <Video
                            source={{ uri: media.uri }}
                            style={styles.mediaPreview}
                            useNativeControls
                            resizeMode="contain"
                        />
                    )}
                    <TouchableOpacity
                        style={styles.removeMediaButton}
                        onPress={() => setMedia(null)}
                    >
                        <AntDesign name="closecircle" size={24} color="#fff" />
                    </TouchableOpacity>
                </View>
            );
        }
        return null;
    };

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
                renderActions={renderActions}
                renderAccessory={renderAccessory}
                onInputTextChanged={() => {
                    setShowTools(false);
                }}
                textInputProps={{
                    onFocus: () => {
                        setShowTools(false);
                    },
                }}
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
    plusIconContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 5,
        marginBottom: 5,
    },
    toolsContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        backgroundColor: '#f0f0f0',
        paddingVertical: 10,
    },
    toolButton: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    toolIconContainer: {
        backgroundColor: '#1E90FF',
        borderRadius: 30,
        padding: 15,
        alignItems: 'center',
        justifyContent: 'center',
    },
    toolText: {
        marginTop: 5,
        color: '#000',
        fontSize: 16,
    },
    mediaPreviewContainer: {
        position: 'relative',
        margin: 10,
        alignItems: 'center',
    },
    mediaPreview: {
        width: 200,
        height: 200,
        borderRadius: 10,
    },
    removeMediaButton: {
        position: 'absolute',
        top: 5,
        right: 5,
        backgroundColor: 'rgba(0,0,0,0.5)',
        borderRadius: 12,
        padding: 2,
    },
});

export default ChatScreen;
