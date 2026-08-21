import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { User } from "firebase/auth";

import LoginScreen from "../screens/LoginScreen";
import RegisterScreen from "../screens/RegisterScreen";
import HomeScreen from "../screens/HomeScreen";
import ScoringScreen from "../screens/ScoringScreen";
import CommunitySscreen from "../screens/CommunityScreen";
import RequestScreen from "../screens/RequestScreen";
import MypageScreen from "../screens/MypageScreen";
import CameraScreen from "../screens/CameraScreen";
import ResultScreen from "../screens/ResultScreen";
import SettingScreen from "../screens/SettingScreen";
import VideoListScreen from "../screens/VideoListScreen";
import ConatctInfoScreen from "../screens/ContactInfoScreen";
import GroupScreen from "../screens/GroupScreen";

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Home: undefined;
  Scoring: undefined;
  Community: undefined;
  Request: undefined;
  Mypage: undefined;
  Camera: {
    danceType: "male" | "female";
    scorePart: "feet" | "hands" | "whole";
  };
  Result: undefined;
  Setting: undefined;
  VideoList: undefined;
  ContactInfo: undefined;
  Group: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

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
    </Stack.Navigator>

  );
}