// screens\Profile.js
import React, { useState, useEffect } from "react";
import { SafeAreaView, Text, TouchableOpacity, View, StyleSheet, Image, Alert, ActivityIndicator } from "react-native";
import { Ionicons } from '@expo/vector-icons'
import { colors } from "../config/constants";
import { auth, database } from '../config/firebase';
import Cell from "../components/Cell";
import { useNavigation } from "@react-navigation/native";
import * as ImagePicker from 'expo-image-picker';
import { doc, getDoc, updateDoc } from "firebase/firestore";

const Profile = () => {
    const navigation = useNavigation();
    const [avatar, setAvatar] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchUserAvatar = async () => {
            const userDoc = await getDoc(doc(database, 'users', auth.currentUser.email));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                if (userData.avatar) {
                    setAvatar(userData.avatar);
                }
            }
        };
        fetchUserAvatar();
    }, []);

    const changeName = () => {
        alert('Change Name');
    };

    const displayEmail = () => {
        alert('Display Email');
    };

    const changePP = async () => {
        let permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

        if (permissionResult.granted === false) {
            Alert.alert('Permission required', 'Permission to access media library is required!');
            return;
        }

        let pickerResult = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.5,
        });

        if (!pickerResult.canceled) {
            const selectedImage = pickerResult.assets[0].uri;
            setLoading(true);
            await uploadImage(selectedImage);
            setLoading(false);
        }
    };

    const uploadImage = async (uri) => {
        try {
            const formData = new FormData();

            const uriParts = uri.split('.');
            const fileType = uriParts[uriParts.length - 1];

            formData.append('image', {
                uri: uri,
                name: `avatar.${fileType}`,
                type: `image/${fileType}`,
            });

            const clientId = '094005370d443cb'; // Replace with your Imgur client ID
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

                if (avatar && avatar !== 'none') {
                    const oldDeleteHash = avatar.deletehash;
                    if (oldDeleteHash) {
                        try {
                            const deleteResponse = await fetch(`https://api.imgur.com/3/image/${oldDeleteHash}`, {
                                method: 'DELETE',
                                headers: {
                                    Authorization: authHeader,
                                    Accept: 'application/json',
                                },
                            });
                            const deleteResult = await deleteResponse.json();
                            if (deleteResult.success) {
                                console.log('Old avatar deleted successfully from Imgur');
                            } else {
                                console.error('Failed to delete old avatar from Imgur:', deleteResult);
                            }
                        } catch (deleteError) {
                            console.error('Error deleting old avatar:', deleteError);
                        }
                    }
                }

                const userDocRef = doc(database, 'users', auth.currentUser.email);
                await updateDoc(userDocRef, { avatar: imageData });

                setAvatar(imageData);

                Alert.alert('Success', 'Avatar updated successfully.');
            } else {
                console.error('Imgur upload failed:', result);
                Alert.alert('Upload failed', 'Failed to upload image to Imgur.');
            }

        } catch (error) {
            console.error('Error uploading image:', error);
            Alert.alert('Error', 'An error occurred while uploading the image.');
        }
    };

    const showPP = () => {
        alert('Show PP');
    };

    return (
        <SafeAreaView style={styles.container}>
            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size='large' color={colors.teal} />
                </View>
            ) : (
                <>
                    <TouchableOpacity style={styles.avatar} onPress={showPP}>
                        <View>
                            {avatar ? (
                                <Image source={{ uri: avatar.link }} style={styles.avatarImage} />
                            ) : (
                                <Text style={styles.avatarLabel}>
                                    {
                                        auth?.currentUser?.displayName != ''
                                            ?
                                            auth?.currentUser?.displayName.split(' ').reduce((prev, current) => `${prev}${current[0]}`, '')
                                            :
                                            auth?.currentUser?.email.split(' ').reduce((prev, current) => `${prev}${current[0]}`, '')
                                    }
                                </Text>
                            )}
                        </View>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.iconContainer} onPress={changePP}>
                        <Ionicons name="camera-outline" size={30} color='white' />
                    </TouchableOpacity>

                    <Cell
                        title='Name'
                        icon='person-outline'
                        iconColor="black"
                        subtitle={auth?.currentUser?.displayName}
                        secondIcon='pencil-outline'
                        onPress={() => changeName()}
                        style={{ marginBottom: 5 }}
                    />

                    <Cell
                        title='Email'
                        subtitle={auth?.currentUser?.email}
                        icon='mail-outline'
                        iconColor="black"
                        secondIcon='pencil-outline'
                        style={{ marginBottom: 5 }}
                        onPress={() => displayEmail()}
                    />

                    <Cell
                        title='About'
                        subtitle={'Available'}
                        icon='information-outline'
                        iconColor="black"
                        secondIcon='pencil-outline'
                        style={{ marginBottom: 5 }}
                        onPress={() => navigation.navigate('About')}
                    />
                </>
            )}
        </SafeAreaView>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
        alignItems: 'center',
    },
    avatar: {
        marginTop: 12,
        width: 168,
        height: 168,
        borderRadius: 84,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.primary,
        overflow: 'hidden',
    },
    avatarLabel: {
        fontSize: 20,
        color: 'white'
    },
    avatarImage: {
        width: 168,
        height: 168,
        borderRadius: 84,
    },
    iconContainer: {
        width: 56,
        height: 56,
        borderRadius: 28,
        alignContent: 'center',
        justifyContent: 'center',
        backgroundColor: colors.teal,
        position: 'absolute',
        right: 10,
        top: 150,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
    }
})
export default Profile;
