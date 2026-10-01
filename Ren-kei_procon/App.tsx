import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import AppNavigator from "./src/navigation/AppNavigator";

/**
 * アプリの入口。画面遷移の仕組み(NavigationContainer)で全体を包み、
 * どの画面をどの順に出すかは AppNavigator に任せる。
 */
export default function App() {
  return (
    <NavigationContainer>
      <AppNavigator />
    </NavigationContainer>
  );
}
