import React, { useState } from "react";
import {
  StyleSheet, Text, TextInput, TouchableOpacity, View,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Dimensions,
} from "react-native";
import { useNavigation } from "@react-navigation/native";

import { auth } from "../config/firebaseConfig";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { createUserDocument } from "../repositories/users";
import { ChochinGarland } from "../components/motifs";
import { RenKeiWordmark } from "../components/Brand";
import { colors, spacing, radius, typography } from "../theme";

const SCREEN_W = Dimensions.get("window").width;

export default function LoginScreen() {
  const navigation = useNavigation();

  // 「ログイン」か「新規登録」かを切り替えるためのステート
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // 実行ボタン（ログイン/登録）を押した時の処理
  const handleSubmit = async () => {
    if (!email || !password) return Alert.alert("エラー", "メールとパスを入力してください");
    if (isRegisterMode && password.length < 6) {
      return Alert.alert("制限", "パスワードは6文字以上にしてください");
    }

    setLoading(true);

    try {
      if (isRegisterMode) {
        // --- 新規登録を実行 ---
        const result = await createUserWithEmailAndPassword(auth, email, password);

        // #39: usersドキュメントをrole: 'user'で作成する
        // (roleはクライアントから変更不可。firestore.rulesで保護)
        await createUserDocument(result.user.uid, result.user.email);

        Alert.alert(
          "登録完了",
          `${result.user.email} でアカウントを作成しました！`,
          [{ text: "OK" }]
        );
      } else {
        // --- ログインを実行 ---
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (error: any) {
      console.error("エラー:", error.code);
      let message = isRegisterMode ? "登録に失敗しました。" : "ログインに失敗しました。";

      if (error.code === 'auth/email-already-in-use') message = "このメールは既に登録されています。";
      if (error.code === 'auth/invalid-email') message = "メールの形式が正しくありません。";
      if (error.code === 'auth/weak-password') message = "パスワードが簡単すぎます。";
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') message = "メールアドレスまたはパスワードが正しくありません。";

      Alert.alert("エラー", message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <ChochinGarland width={SCREEN_W} count={7} height={40} style={styles.garland} />
      <ScrollView contentContainerStyle={styles.inner}>
        <View style={styles.logoContainer}>
          <View style={styles.logoBox}><Text style={styles.logoText}>連</Text></View>
          <RenKeiWordmark size={28} style={{ marginTop: spacing.md }} />
          <Text style={styles.title}>{isRegisterMode ? "新規アカウント作成" : "ログイン"}</Text>
          <Text style={styles.subtitle}>阿波踊り 練習支援プラットフォーム</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>メールアドレス</Text>
          <TextInput
            style={styles.input}
            placeholder="example@mail.com"
            placeholderTextColor={colors.textMuted}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <Text style={styles.label}>パスワード</Text>
          <TextInput
            style={styles.input}
            placeholder="6文字以上"
            placeholderTextColor={colors.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity style={[styles.submitBtn, loading && styles.submitBtnDisabled]} onPress={handleSubmit} disabled={loading} activeOpacity={0.85}>
            {loading ? (
              <ActivityIndicator color={colors.textOnGold} />
            ) : (
              <Text style={styles.submitBtnText}>
                {isRegisterMode ? "この内容で登録する" : "ログイン"}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setIsRegisterMode(!isRegisterMode)} style={styles.switchBtn}>
            <Text style={styles.switchText}>
              {isRegisterMode ? "すでにアカウントをお持ちの方はこちら" : "まだアカウントをお持ちでない方はこちら"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.indigoDeep },
  garland: { position: "absolute", top: 0, left: 0, right: 0 },
  inner: { flexGrow: 1, justifyContent: "center", padding: spacing.xxl - spacing.xs },
  logoContainer: { alignItems: "center", marginBottom: spacing.xxl + spacing.md },
  logoBox: { width: 60, height: 60, backgroundColor: colors.indigo, borderWidth: 1, borderColor: colors.gold, borderRadius: radius.md, justifyContent: "center", alignItems: "center", marginBottom: spacing.md },
  logoText: { color: colors.gold, fontSize: 28, fontWeight: "900" },
  title: { ...typography.titleSerif, color: colors.textPrimary, marginTop: spacing.md },
  subtitle: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
  form: { width: "100%" },
  label: { ...typography.sectionLabel, color: colors.gold, marginBottom: spacing.sm },
  input: {
    height: 52,
    backgroundColor: colors.indigoRaised,
    borderWidth: 1,
    borderColor: colors.indigoLine,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
    color: colors.textPrimary,
    ...typography.body,
  },
  submitBtn: { height: 52, backgroundColor: colors.gold, borderRadius: radius.sm, justifyContent: "center", alignItems: "center" },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: colors.textOnGold, fontSize: 16, fontWeight: "700" },
  switchBtn: { marginTop: spacing.xl, alignItems: "center" },
  switchText: { color: colors.gold, fontWeight: "700", fontSize: 13 },
});
