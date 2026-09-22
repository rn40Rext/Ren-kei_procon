import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, useWindowDimensions } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "../config/firebaseConfig";
import { colors, spacing, typography } from "../theme";
import { NarutoLoader, ChochinGarland } from "../components/motifs";
import { RenKeiWordmark } from "../components/Brand";

// 画面のインポート
import LoginScreen from "../screens/LoginScreen";
import HomeScreen from "../screens/HomeScreen";
import VideoDetailScreen from "../screens/VideoDetailScreen";
import ChallengeDetailScreen from "../screens/ChallengeDetailScreen";
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
import RenSearchScreen from "../screens/RenSearchScreen";
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
import NotificationsScreen from "../screens/NotificationsScreen";

export type RootStackParamList = {
  Login: undefined;
  Home: undefined;
  // 交流広場と統合したHomeの投稿詳細（旧演舞詳細）。id: サンプル演舞 / postId: 実データ投稿
  VideoDetail: { id?: string; postId?: string };
  // 先輩からのチャレンジの詳細
  Challenge: { id?: string };
  // shareVideoId: U-03 から「コミュニティへ投稿」で来たとき、その練習動画を投稿フォームに入れる
  // openPostId: 通知(type:'comment')タップ時、該当投稿の詳細を直接開く(#44)
  Community: { shareVideoId?: string; openPostId?: string } | undefined;
  Mypage: undefined;
  Scoring: undefined;
  VideoList: undefined;
  ContactInfo: undefined;
  Setting: undefined;
  // renId: 通知(type:'join_result')タップ時、承認された連を選択した状態で開く(#44)
  Group: { renId?: string } | undefined;
  RenSearch: undefined;
  // 通知一覧(#44)。仕様書 U-01/R-01 の「通知への導線」の遷移先
  Notifications: undefined;
  // U-02 本体。baseBpm はリズム判定の基準テンポ(TBD-04 の暫定: ユーザー選択)
  Camera: { danceType: "male" | "female"; scorePart: "feet" | "hands" | "whole"; baseBpm?: number };
  // U-03 解析結果。FN-01 が確定した analysisResults を表示する
  Result: { analysisId: string; videoId: string };
  Request: { inviteName?: string; inviteMeta?: string } | undefined;
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
  const { width: screenW } = useWindowDimensions();
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
      <View style={bootStyles.wrap}>
        <ChochinGarland width={screenW} count={7} height={44} style={bootStyles.garland} />
        <View style={bootStyles.center}>
          <RenKeiWordmark size={34} />
          <Text style={bootStyles.sub}>稽古と交流の広場</Text>
          <NarutoLoader size={30} color={colors.gold} style={bootStyles.loader} />
        </View>
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {user ? (
        // 💡 ログイン後に最初に表示されるのは「Home」になります
        <>
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="VideoDetail" component={VideoDetailScreen} />
          <Stack.Screen name="Challenge" component={ChallengeDetailScreen} />
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
          <Stack.Screen name="RenSearch" component={RenSearchScreen} />
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
          <Stack.Screen name="Notifications" component={NotificationsScreen} />
        </>
      ) : (
        <Stack.Screen name="Login" component={LoginScreen} />
      )}
    </Stack.Navigator>
  );
}

const bootStyles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.indigoDeep },
  garland: { position: "absolute", top: 0, left: 0, right: 0 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  sub: { ...typography.caption, color: colors.textMuted, fontSize: 10, marginTop: 4 },
  loader: { marginTop: spacing.xl },
});