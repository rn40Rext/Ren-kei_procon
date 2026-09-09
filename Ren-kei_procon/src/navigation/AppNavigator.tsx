import React, { useState, useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "../config/firebaseConfig";
import { colors } from "../theme";

// 画面のインポート
import LoginScreen from "../screens/LoginScreen";
import HomeScreen from "../screens/HomeScreen";
import VideoDetailScreen from "../screens/VideoDetailScreen"; // 稽古録・師匠の教え
import ChallengeDetailScreen from "../screens/ChallengeDetailScreen"; // 先輩からのチャレンジ
import MypageScreen from "../screens/MypageScreen";
import ScoringScreen from "../screens/ScoringScreen";
import GroupScreen from "../screens/GroupScreen";
import VideoListScreen from "../screens/VideoListScreen";
import ConatctInfoScreen from '../screens/ContactInfoScreen';
import SettingScreen from "../screens/SettingScreen";
import CameraScreen from "../screens/CameraScreen";
import ResultScreen from "../screens/ResultScreen";
import RequestScreen from "../screens/RequestScreen";
import UserProfileScreen from "../screens/UserProfileScreen";
import ChatScreen from "../screens/ChatScreen";

export type RootStackParamList = {
  Login: undefined;
  Home: undefined;
  VideoDetail: { id?: string };
  Challenge: { id?: string };
  Mypage: undefined;
  Scoring: undefined;
  VideoList: undefined;
  ContactInfo: undefined;
  Setting: undefined;
  Group: undefined;
  Camera: { danceType: "male" | "female"; scorePart: "feet" | "hands" | "whole" };
  Result: undefined;
  Request: undefined;
  UserProfile: { userId: string; userName: string };
  Chat: { chatId: string; recipientName: string };
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
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.indigoDeep }}>
        <ActivityIndicator size="large" color={colors.gold} />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {user ? (
        <>
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="VideoDetail" component={VideoDetailScreen} />
          <Stack.Screen name="Challenge" component={ChallengeDetailScreen} />
          <Stack.Screen name="Scoring" component={ScoringScreen} />
          <Stack.Screen name="Mypage" component={MypageScreen} />

          <Stack.Screen name="VideoList" component={VideoListScreen} />
          <Stack.Screen name="Group" component={GroupScreen} />
          <Stack.Screen name="ContactInfo" component={ConatctInfoScreen} />
          <Stack.Screen name="Setting" component={SettingScreen} />
          <Stack.Screen name="Camera" component={CameraScreen} />
          <Stack.Screen name="Result" component={ResultScreen} />
          <Stack.Screen name="Request" component={RequestScreen} />
          <Stack.Screen name="UserProfile" component={UserProfileScreen} />
          <Stack.Screen name="Chat" component={ChatScreen} />
        </>
      ) : (
        <Stack.Screen name="Login" component={LoginScreen} />
      )}
    </Stack.Navigator>
  );
}
