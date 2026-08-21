import React, { useState, useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "../config/firebaseConfig";

// 画面のインポート
import LoginScreen from "../screens/LoginScreen";
import HomeScreen from "../screens/HomeScreen"; // 💡 追加
import CommunityScreen from "../screens/CommunityScreen";
import MypageScreen from "../screens/MypageScreen";
import ScoringScreen from "../screens/ScoringScreen";

export type RootStackParamList = {
  Login: undefined;
  Home: undefined; // 💡 ホームを追加
  Community: undefined;
  Mypage: undefined;
  Scoring: undefined;
  VideoList: undefined;
  ContactInfo: undefined;
  Setting: undefined;
  Group: undefined;
   UserProfile: { userId: string; userName: string }; // 💡 追加
  Chat: { chatId: string; recipientName: string };   // 💡 追加
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setInitializing(false);
    });
    return unsubscribe;
  }, []);

  if (initializing) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {user ? (
        // 💡 ログイン後に最初に表示されるのは「Home」になります
        <>
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="Community" component={CommunityScreen} />
          <Stack.Screen name="Scoring" component={ScoringScreen} />
          <Stack.Screen name="Mypage" component={MypageScreen} />
        </>
      ) : (
        <Stack.Screen name="Login" component={LoginScreen} />
      )}
    </Stack.Navigator>
  );
}