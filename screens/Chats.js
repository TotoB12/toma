// screens\Chats.js
import React, { useState, useEffect, useCallback } from "react";
import { SafeAreaView, StyleSheet, View, TouchableOpacity, Text, ScrollView, Pressable, Alert, ActivityIndicator } from "react-native";
import ContactRow from '../components/ContactRow';
import { useNavigation } from '@react-navigation/native';
import { auth, database } from '../config/firebase';
import { collection, doc, where, query, onSnapshot, orderBy, setDoc, deleteDoc } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';

const Chats = () => {
    const navigation = useNavigation();
    const [chats, setChats] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedItems, setSelectedItems] = useState([]);
    const [usersAvatars, setUsersAvatars] = useState({});

    useEffect(() => {
        navigation.setOptions({
            headerShown: true,
            headerLeft: () => (
                <TouchableOpacity onPress={() => navigation.navigate('Settings')} style={{ marginLeft: 10 }}>
                    <Ionicons name="settings-outline" size={24} color="#fff" />
                </TouchableOpacity>
            ),
            headerRight: () => (
                <TouchableOpacity onPress={handleFabPress} style={{ marginRight: 10 }}>
                    <Ionicons name="chatbox-ellipses" size={24} color="#fff" />
                </TouchableOpacity>
            ),
            headerStyle: {
                backgroundColor: '#000',
            },
            headerTintColor: '#fff',
        });
    }, [navigation]);

    useEffect(() => {
        const collectionRef = collection(database, 'chats');
        const q = query(collectionRef, where('users', "array-contains", { email: auth?.currentUser?.email, name: auth?.currentUser?.displayName, deletedFromChat: false }), orderBy("lastUpdated", "desc"));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            setChats(snapshot.docs);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const handleChatName = (chat) => {
        const users = chat.data().users;
        const currentUser = auth?.currentUser;

        if (chat.data().groupName) {
            return chat.data().groupName;
        }

        if (currentUser?.displayName) {
            if (currentUser.displayName === users[0].name) {
                if (currentUser.displayName === users[1].name) {
                    return `${currentUser.displayName} *(You)`;
                }
                return users[1].name;
            } else {
                return users[0].name;
            }
        }

        if (currentUser?.email) {
            if (currentUser.email === users[0].email) {
                if (currentUser.email === users[1].email) {
                    return `${currentUser.email} *(You)`;
                }
                return users[1].email;
            } else {
                return users[0].email;
            }
        }

        return '~ No Name or Email ~';
    };

    const handleOnPress = (chat) => {
        if (selectedItems.length) {
            return selectItems(chat);
        }
        navigation.navigate('Chat', { id: chat.id, chatName: handleChatName(chat) });
    };

    const handleLongPress = (chat) => {
        selectItems(chat);
    };

    const selectItems = (chat) => {
        if (selectedItems.includes(chat.id)) {
            setSelectedItems(selectedItems.filter(item => item !== chat.id));
        } else {
            setSelectedItems([...selectedItems, chat.id]);
        }
    };

    const getSelected = (chat) => {
        return selectedItems.includes(chat.id);
    };

    const deSelectItems = () => {
        setSelectedItems([]);
    };

    const handleFabPress = () => {
        navigation.navigate('Users');
    };

    const handleDeleteChat = () => {
        Alert.alert(
            selectedItems.length > 1 ? "Delete selected chats?" : "Delete this chat?",
            "Messages will be removed from this device.",
            [
                {
                    text: "Delete chat",
                    onPress: () => {
                        selectedItems.forEach(chatId => {
                            const chat = chats.find(chat => chat.id === chatId);
                            const updatedUsers = chat.data().users.map(user =>
                                user.email === auth?.currentUser?.email
                                    ? { ...user, deletedFromChat: true }
                                    : user
                            );

                            setDoc(doc(database, 'chats', chatId), { users: updatedUsers }, { merge: true });

                            const deletedUsers = updatedUsers.filter(user => user.deletedFromChat).length;
                            if (deletedUsers === updatedUsers.length) {
                                deleteDoc(doc(database, 'chats', chatId));
                            }
                        });
                        deSelectItems();
                    },
                },
                { text: "Cancel" },
            ],
            { cancelable: true }
        );
    };

    const handleSubtitle = (chat) => {
        const message = chat.data().messages[0];
        if (!message) return "No messages yet";

        const isCurrentUser = auth?.currentUser?.email === message.user._id;
        const userName = isCurrentUser ? 'You' : message.user.name.split(' ')[0];
        const messageText = message.image ? 'sent an image' : message.text.length > 20 ? `${message.text.substring(0, 20)}...` : message.text;

        return `${userName}: ${messageText}`;
    };

    const handleSubtitle2 = (chat) => {
        const options = { year: '2-digit', month: 'numeric', day: 'numeric' };
        return new Date(chat.data().lastUpdated).toLocaleDateString(undefined, options);
    };

    useEffect(() => {
        const collectionUserRef = collection(database, 'users');
        const unsubscribeUsers = onSnapshot(collectionUserRef, (snapshot) => {
            const avatars = {};
            snapshot.forEach(doc => {
                const userData = doc.data();
                avatars[userData.email] = userData.avatar?.link;
            });
            setUsersAvatars(avatars);
        });

        return () => unsubscribeUsers();
    }, []);

    const getOtherUserData = (chat) => {
        const users = chat.data().users;
        const currentUserEmail = auth?.currentUser?.email;
        const otherUsers = users.filter(user => user.email !== currentUserEmail);
        return otherUsers;
    };

    return (
        <Pressable style={styles.container} onPress={deSelectItems}>
            {loading ? (
                <ActivityIndicator size='large' style={styles.loadingContainer} />
            ) : (
                <ScrollView>
                    {chats.length === 0 ? (
                        <View style={styles.blankContainer}>
                            <Text style={styles.textContainer}>You sure seem lonely. Create a new chat in the top right.</Text>
                        </View>
                    ) : (
                        chats.map(chat => {
                            const otherUsers = getOtherUserData(chat);
                            let avatar = null;

                            if (otherUsers.length === 1) {
                                const otherUserEmail = otherUsers[0].email;
                                avatar = usersAvatars[otherUserEmail];
                            } else if (chat.data().groupName) {
                                // Optionally set a group avatar here
                                avatar = null; // Or a default group icon
                            }

                            return (
                                <React.Fragment key={chat.id}>
                                    <ContactRow
                                        style={getSelected(chat) ? styles.selectedContactRow : ""}
                                        name={handleChatName(chat)}
                                        subtitle={handleSubtitle(chat)}
                                        subtitle2={handleSubtitle2(chat)}
                                        onPress={() => handleOnPress(chat)}
                                        onLongPress={() => handleLongPress(chat)}
                                        selected={getSelected(chat)}
                                        showForwardIcon={false}
                                        avatar={avatar}
                                    />
                                </React.Fragment>
                            )
                        })
                    )}
                </ScrollView>
            )}
        </Pressable>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    blankContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    textContainer: {
        fontSize: 16,
        color: '#fff',
        padding: 20,
        textAlign: 'center',
    },
    selectedContactRow: {
        backgroundColor: '#333'
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    }
});

export default Chats;
