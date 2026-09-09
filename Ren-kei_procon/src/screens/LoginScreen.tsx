import React, { useState } from "react";
import {
  StyleSheet, Text, TextInput, TouchableOpacity, View,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from "react-native";

import { auth, db } from "../config/firebaseConfig";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { RenKeiWordmark } from "../components/Brand";
import { ChochinGarland, SeigaihaBand } from "../components/motifs";
import { colors, spacing, radius, typography } from "../theme";
import { Dimensions } from "react-native";

const SCREEN_W = Dimensions.get("window").width;

export default function LoginScreen() {
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email || !password) return Alert.alert("エラー", "メールとパスワードを入力してください");
    if (isRegisterMode && password.length < 6) {
      return Alert.alert("制限", "パスワードは6文字以上にしてください");
    }

    setLoading(true);

    try {
      if (isRegisterMode) {
        const result = await createUserWithEmailAndPassword(auth, email, password);

        // #39: users ドキュメントを role: 'user' で作成する
        //（role はクライアントから変更不可。firestore.rules で保護）
        await setDoc(doc(db, "users", result.user.uid), {
          uid: result.user.uid,
          name: result.user.email?.split("@")[0] || "",
          nickname: "",
          mail: result.user.email || "",
          icon: "",
          profile: "",
          danceStyle: null,
          role: "user",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        Alert.alert("登録完了", `${result.user.email} でアカウントを作成しました！`, [{ text: "OK" }]);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (error: any) {
      let message = isRegisterMode ? "登録に失敗しました。" : "ログインに失敗しました。";
      if (error.code === "auth/email-already-in-use") message = "このメールは既に登録されています。";
      if (error.code === "auth/invalid-email") message = "メールの形式が正しくありません。";
      if (error.code === "auth/weak-password") message = "パスワードが簡単すぎます。";
      if (error.code === "auth/user-not-found" || error.code === "auth/wrong-password" || error.code === "auth/invalid-credential")
        message = "メールアドレスまたはパスワードが正しくありません。";
      Alert.alert("エラー", message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.container}
    >
      <ChochinGarland width={SCREEN_W} count={7} height={44} style={styles.garland} />
      <ScrollView contentContainerStyle={styles.inner} showsVerticalScrollIndicator={false}>
        <View style={styles.logoContainer}>
          <RenKeiWordmark size={40} style={{ marginBottom: 12 }} />
          <SeigaihaBand width={140} height={12} color={colors.gold} opacity={0.5} />
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

          <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={loading} activeOpacity={0.85}>
            {loading ? (
              <ActivityIndicator color={colors.textOnGold} />
            ) : (
              <Text style={styles.submitBtnText}>{isRegisterMode ? "この内容で登録する" : "ログイン"}</Text>
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
  inner: { flexGrow: 1, justifyContent: "center", padding: spacing.xl },
  logoContainer: { alignItems: "center", marginBottom: spacing.xxl },
  title: { ...typography.titleSerif, color: colors.textPrimary, marginTop: spacing.lg },
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
    fontSize: 15,
  },
  submitBtn: {
    height: 52,
    backgroundColor: colors.gold,
    borderRadius: radius.sm,
    justifyContent: "center",
    alignItems: "center",
  },
  submitBtnText: { ...typography.button, color: colors.textOnGold, fontSize: 16 },
  switchBtn: { marginTop: spacing.xl, alignItems: "center" },
  switchText: { ...typography.caption, color: colors.gold, fontWeight: "700" },
});
