import React from "react";
import { Platform } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import AppNavigator from "./src/navigation/AppNavigator";
import { linking } from "./src/navigation/linking";

/**
 * アプリの入口。画面遷移の仕組み(NavigationContainer)で全体を包み、
 * どの画面をどの順に出すかは AppNavigator に任せる。
 * Web版だけ、ブラウザの履歴と連動させて「戻る」ボタンで前の画面に戻れるようにする。
 */
export default function App() {
  return (
    <NavigationContainer linking={Platform.OS === "web" ? linking : undefined}>
      <AppNavigator />
    </NavigationContainer>
  );
}
