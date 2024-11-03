// App.js
import React, { useState, createContext, useContext, useEffect } from "react";
import { NavigationContainer, DarkTheme } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { View, ActivityIndicator } from 'react-native';
import Chats from './screens/Chats';
import Settings from "./screens/Settings";
import { colors } from "./config/constants";
import SignUp from "./screens/SignUp";
import Chat from "./screens/Chat";
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './config/firebase';
import Profile from "./screens/Profile";
import Login from "./screens/Login";
import Users from "./screens/Users";
import About from "./screens/About";
import Account from "./screens/Account";
import Help from "./screens/Help";
import Group from "./screens/Group";
import ChatInfo from "./screens/ChatInfo";
import ChatHeader from "./components/ChatHeader";
import ChatMenu from "./components/ChatMenu";
import { MenuProvider } from "react-native-popup-menu";

const Stack = createStackNavigator();
const AuthenticatedUserContext = createContext({});

const AuthenticatedUserProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  return (
    <AuthenticatedUserContext.Provider value={{ user, setUser }}>
      {children}
    </AuthenticatedUserContext.Provider>
  );
};

const MainStack = () => (
  <Stack.Navigator>
    <Stack.Screen
      name="Chats"
      component={Chats}
      options={{ headerShown: false }}
    />
    <Stack.Screen
      name="Chat"
      component={Chat}
      options={({ route }) => ({
        headerTitle: () =>
          <ChatHeader
            chatName={route.params.chatName}
            chatId={route.params.id}
          />,
        headerRight: () => (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <ChatMenu
              chatName={route.params.chatName}
              chatId={route.params.id}
            />
          </View>
        ),
      })}
    />
    <Stack.Screen name="Users" component={Users} options={{ title: 'Select User' }} />
    <Stack.Screen name="Profile" component={Profile} />
    <Stack.Screen name="About" component={About} />
    <Stack.Screen name="Help" component={Help} />
    <Stack.Screen name="Account" component={Account} />
    <Stack.Screen name="Group" component={Group} options={{ title: 'New Group' }} />
    <Stack.Screen name="ChatInfo" component={ChatInfo} options={{ title: 'Chat Information' }} />
    <Stack.Screen name="Settings" component={Settings} />
  </Stack.Navigator>
);

const AuthStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name='Login' component={Login} />
    <Stack.Screen name='SignUp' component={SignUp} />
  </Stack.Navigator>
);

const RootNavigator = () => {
  const { user, setUser } = useContext(AuthenticatedUserContext);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async authenticatedUser => {
      setUser(authenticatedUser || null);
      setIsLoading(false);
    });

    return unsubscribeAuth;
  }, []);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size='large' />
      </View>
    );
  }

  return (
    <NavigationContainer theme={DarkTheme}>
      {user ? <MainStack /> : <AuthStack />}
    </NavigationContainer>
  );
};

const App = () => {
  return (
    <MenuProvider>
      <AuthenticatedUserProvider>
        <RootNavigator />
      </AuthenticatedUserProvider>
    </MenuProvider>
  );
};

export default App;
