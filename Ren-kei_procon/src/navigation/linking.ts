/**
 * Web版で、ブラウザのURL・履歴と画面の積み重ね(Stack)をつなぐ設定。
 * これが無いと URL が変わらず、スマホやブラウザの「戻る」を押してもアプリ内の前の画面に戻れず、
 * アプリごと閉じて(前のページに)出てしまう。
 * 渡す値(id など)はクエリ(?id=...)に載せる。画面を再読み込みしても同じ画面が開く。
 * ネイティブ版は端末の戻るボタンが標準で効くので、この設定は使わない(App.tsx)。
 */
import type { LinkingOptions } from "@react-navigation/native";
import type { RootStackParamList } from "./AppNavigator";

export const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [],
  config: {
    screens: {
      Login: "login",
      Home: "",
      VideoDetail: "video",
      Challenge: "challenge",
      Mypage: "mypage",
      Scoring: "scoring",
      VideoList: "videos",
      GrowthChart: "growth",
      ContactInfo: "contact",
      Setting: "setting",
      Group: "group",
      RenSearch: "ren-search",
      Notifications: "notifications",
      Camera: {
        path: "camera",
        // baseBpm は数値。URLでは文字列になるので戻す
        parse: { baseBpm: Number },
      },
      Result: "result",
      Request: "request",
      UserProfile: "user",
      StyleResult: "style-result",
      Chat: "chat",
      AdminHome: "admin",
      ManageJoinRequests: "admin/join-requests",
      MemberManagement: "admin/members",
      ManageAnnouncements: "admin/announcements",
      ManageActivities: "admin/activities",
      ManagePosts: "admin/posts",
      AdviceCompose: "admin/advice",
    },
  },
};
