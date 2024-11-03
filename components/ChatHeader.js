import React, { useState, useEffect } from 'react';
import { TouchableOpacity, Text, View, Image, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { colors } from "../config/constants";
import { doc, getDoc } from 'firebase/firestore';
import { auth, database } from '../config/firebase';

const ChatHeader = ({ chatName, chatId }) => {
    const navigation = useNavigation();
    const [avatar, setAvatar] = useState(null); // Initialize state for avatar

    useEffect(() => {
        const fetchAvatar = async () => {
            const chatRef = doc(database, 'chats', chatId);
            const chatDoc = await getDoc(chatRef);

            if (chatDoc.exists()) {
                const chatData = chatDoc.data();
                const otherUsers = chatData.users.filter(user => user.email !== auth?.currentUser?.email);
                if (otherUsers.length === 1) {
                    const otherUserEmail = otherUsers[0].email;
                    const userDoc = await getDoc(doc(database, 'users', otherUserEmail));
                    if (userDoc.exists()) {
                        setAvatar(userDoc.data().avatar?.link);
                    }
                }
                // For group chats, you might set a default group avatar or handle accordingly
            }
        };

        fetchAvatar();
    }, [chatId]);

    return (
        <TouchableOpacity
            style={styles.container}
            onPress={() => navigation.navigate('ChatInfo', { chatId, chatName })}
        >
            {avatar ? (
                <Image source={{ uri: avatar }} style={styles.avatarImage} />
            ) : (
                <View style={styles.avatar}>
                    <Text style={styles.avatarLabel}>
                        {chatName.split(' ').reduce((prev, current) => `${prev}${current[0]}`, '')}
                    </Text>
                </View>
            )}

            <Text style={styles.chatName}>{chatName}</Text>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        marginRight: 10,
        marginLeft: -30,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.primary
    },
    avatarImage: {
        width: 40,
        height: 40,
        borderRadius: 20,
        marginRight: 10,
        marginLeft: -30,
    },
    avatarLabel: {
        fontSize: 20,
        color: 'white'
    },
    chatName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: 'black',
    },
});

export default ChatHeader;
