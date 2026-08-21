import React, { useState, useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
<<<<<<< HEAD
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "../config/firebaseConfig";
=======
import { User } from "firebase/auth";
>>>>>>> d32863d1a7e26270f5cb7d6f723fd1ad60900cb2

// 画面のインポート
import LoginScreen from "../screens/LoginScreen";
<<<<<<< HEAD
import HomeScreen from "../screens/HomeScreen"; // 💡 追加
import CommunityScreen from "../screens/CommunityScreen";
=======
import RegisterScreen from "../screens/RegisterScreen";
import HomeScreen from "../screens/HomeScreen";
import ScoringScreen from "../screens/ScoringScreen";
import CommunitySscreen from "../screens/CommunityScreen";
import RequestScreen from "../screens/RequestScreen";
>>>>>>> d32863d1a7e26270f5cb7d6f723fd1ad60900cb2
import MypageScreen from "../screens/MypageScreen";
import ScoringScreen from "../screens/ScoringScreen";

export type RootStackParamList = {
  Login: undefined;
<<<<<<< HEAD
  Home: undefined; // 💡 ホームを追加
=======
  Register: undefined;
  Home: undefined;
  Scoring: undefined;
>>>>>>> d32863d1a7e26270f5cb7d6f723fd1ad60900cb2
  Community: undefined;
  Mypage: undefined;
<<<<<<< HEAD
  Scoring: undefined;
=======
  Camera: {
    danceType: "male" | "female";
    scorePart: "feet" | "hands" | "whole";
  };
  Result: undefined;
  Setting: undefined;
>>>>>>> d32863d1a7e26270f5cb7d6f723fd1ad60900cb2
  VideoList: undefined;
  ContactInfo: undefined;
  Setting: undefined;
  Group: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

<<<<<<< HEAD
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
=======
export default function AppNavigator({
  user,
}: {
  user: User | null;
}) {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      {user === null ? (
        <>
          <Stack.Screen
            name="Login"
            component={LoginScreen}
          />

          <Stack.Screen
            name="Register"
            component={RegisterScreen}
          />
        </>
      ) : (
        <>
          <Stack.Screen
            name="Home"
            component={HomeScreen}
          />

          <Stack.Screen
            name="Scoring"
            component={ScoringScreen}
          />

          <Stack.Screen
            name="Community"
            component={CommunitySscreen}
          />

          <Stack.Screen
            name="Request"
            component={RequestScreen}
          />

          <Stack.Screen
            name="Mypage"
            component={MypageScreen}
          />

      <Stack.Screen
        name="Camera"
        component={CameraScreen}
      />

      <Stack.Screen
        name="Result"
        component={ResultScreen}
      />

      <Stack.Screen
        name="Setting"
        component={SettingScreen}
      />

      <Stack.Screen
        name="VideoList"
        component={VideoListScreen}
      />

      <Stack.Screen
        name="ContactInfo"
        component={ConatctInfoScreen}
      />

      <Stack.Screen
        name="Group"
        component={GroupScreen}
      />
>>>>>>> d32863d1a7e26270f5cb7d6f723fd1ad60900cb2
    </Stack.Navigator>
  );
}