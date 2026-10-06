import React, { useEffect } from "react";
import { Platform } from "react-native";
import { DefaultTheme, NavigationContainer } from "@react-navigation/native";
import AppNavigator from "./src/navigation/AppNavigator";
import { linking } from "./src/navigation/linking";
import { colors } from "./src/theme";

/** 画面のあいだ・裏に見える地を、アプリの紺にする(標準の明るい灰色だと、描画が遅れたときに白く見える) */
const navTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: colors.indigoDeep },
};

/**
 * アプリの入口。画面遷移の仕組み(NavigationContainer)で全体を包み、
 * どの画面をどの順に出すかは AppNavigator に任せる。
 * Web版だけ、ブラウザの履歴と連動させて「戻る」ボタンで前の画面に戻れるようにする。
 */
export default function App() {
  // Web: ページ全体の地も紺にする。素早いスクロールで描画が追いつかない部分や、端を引っ張ったときの余白が白く見えないようにする
  useEffect(() => {
    if (Platform.OS !== "web") return;
    document.documentElement.style.backgroundColor = colors.indigoDeep;
    document.body.style.backgroundColor = colors.indigoDeep;
  }, []);

  return (
    <NavigationContainer theme={navTheme} linking={Platform.OS === "web" ? linking : undefined}>
      <AppNavigator />
    </NavigationContainer>
  );
}
