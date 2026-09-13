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
import GroupScreen from "../screens/GroupScreen";
import VideoListScreen from "../screens/VideoListScreen";
import ConatctInfoScreen from '../screens/ContactInfoScreen';
import SettingScreen from "../screens/SettingScreen";
import CameraScreen from "../screens/CameraScreen";
import ResultScreen from "../screens/ResultScreen";
import RequestScreen from "../screens/RequestScreen";
import UserProfileScreen from "../screens/UserProfileScreen";
import ChatScreen from "../screens/ChatScreen";
import AdminHomeScreen from "../screens/AdminHomeScreen";
import ManageJoinRequestsScreen from "../screens/ManageJoinRequestsScreen";
import MemberManagementScreen from "../screens/MemberManagementScreen";
import ManageAnnouncementsScreen from "../screens/ManageAnnouncementsScreen";
import ManageActivitiesScreen from "../screens/ManageActivitiesScreen";
import ManagePostsScreen from "../screens/ManagePostsScreen";
import AdviceComposeScreen from "../screens/AdviceComposeScreen";
import StyleResultScreen from "../screens/StyleResultScreen";

export type RootStackParamList = {
  Login: undefined;
  Home: undefined; // 💡 ホームを追加
  // shareVideoId: U-03 から「コミュニティへ投稿」で来たとき、その練習動画を投稿フォームに入れる
  Community: { shareVideoId?: string } | undefined;
  Mypage: undefined;
  Scoring: undefined;
  VideoList: undefined;
  ContactInfo: undefined;
  Setting: undefined;
  Group: undefined;
  // U-02 本体。baseBpm はリズム判定の基準テンポ(TBD-04 の暫定: ユーザー選択)
  Camera: { danceType: "male" | "female"; scorePart: "feet" | "hands" | "whole"; baseBpm?: number };
  // U-03 解析結果。FN-01 が確定した analysisResults を表示する
  Result: { analysisId: string; videoId: string };
  Request: undefined;
  UserProfile: { userId: string; userName: string }; // 💡 追加
  // 連スタイル類似度の結果（AI機能②）。表示可否は
  // src/features/style/featureFlags.ts で制御する
  StyleResult: { videoId: string };
  Chat: { chatId: string; recipientName: string };   // 💡 追加
  AdminHome: undefined;
  ManageJoinRequests: { renId: string };
  MemberManagement: { renId: string };
  ManageAnnouncements: { renId: string };
  ManageActivities: { renId: string };
  ManagePosts: { renId: string };
  AdviceCompose: { postId: string; renId: string; postTitle: string; authorName: string; videoUrl: string };
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

          <Stack.Screen name="VideoList" component={VideoListScreen} />
          <Stack.Screen name="Group" component={GroupScreen} />
          <Stack.Screen name="ContactInfo" component={ConatctInfoScreen} />
          <Stack.Screen name="Setting" component={SettingScreen} />
          <Stack.Screen name="Camera" component={CameraScreen} />
          <Stack.Screen name="Result" component={ResultScreen} />
          <Stack.Screen name="Request" component={RequestScreen} />
          <Stack.Screen name="UserProfile" component={UserProfileScreen} />
          <Stack.Screen name="Chat" component={ChatScreen} />
          <Stack.Screen name="AdminHome" component={AdminHomeScreen} />
          <Stack.Screen name="ManageJoinRequests" component={ManageJoinRequestsScreen} />
          <Stack.Screen name="MemberManagement" component={MemberManagementScreen} />
          <Stack.Screen name="ManageAnnouncements" component={ManageAnnouncementsScreen} />
          <Stack.Screen name="ManageActivities" component={ManageActivitiesScreen} />
          <Stack.Screen name="ManagePosts" component={ManagePostsScreen} />
          <Stack.Screen name="AdviceCompose" component={AdviceComposeScreen} />
          <Stack.Screen name="StyleResult" component={StyleResultScreen} />
        </>
      ) : (
        <Stack.Screen name="Login" component={LoginScreen} />
      )}
    </Stack.Navigator>
  );
}