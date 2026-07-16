import { createNativeStackNavigator } from "@react-navigation/native-stack";

import LoginScreen from "../screens/LoginScreen";
import HomeScreen from "../screens/HomeScreen";
import ScoringScreen from "../screens/ScoringScreen";
import CommunitySscreen from "../screens/CommunityScreen";
import RequestScreen from "../screens/RequestScreen";
import MypageScreen from "../screens/MypageScreen";

export type RootStackParamList = {
  Login: undefined;
  Home: undefined;
  Scoring: undefined;
  Community: undefined;
  Request: undefined;
  Mypage: undefined;
};

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen
        name="Login"
        component={LoginScreen}
      />

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
    </Stack.Navigator>

      
  );
}