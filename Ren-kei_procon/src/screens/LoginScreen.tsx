import React, { useState } from "react";
import { 
  StyleSheet, Text, TextInput, TouchableOpacity, View, 
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView 
} from "react-native";
// パスは src/config/firebaseConfig に合わせる
import { auth } from "../config/firebaseConfig"; 
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";

const COLORS = {
  primary: '#2563EB',
  textMain: '#1E293B',
  border: '#E2E8F0',
};

export default function LoginScreen() {
  // 💡 「ログイン」か「新規登録」かを切り替えるためのステート
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // 実行ボタンを押した時の処理
  const handleSubmit = async () => {
    if (!email || !password) return Alert.alert("エラー", "メールとパスを入力してください");
    if (isRegisterMode && password.length < 6) {
      return Alert.alert("制限", "パスワードは6文字以上にしてください");
    }

    setLoading(true);

    try {
      if (isRegisterMode) {
        // --- 🔵 新規登録を実行 ---
        const result = await createUserWithEmailAndPassword(auth, email, password);
        console.log("新規登録成功:", result.user.email);
        
        // 💡 登録成功をユーザーに知らせる
        Alert.alert(
          "登録完了", 
          `${result.user.email} でアカウントを作成しました！\nこのまま広場へ移動します。`,
          [{ text: "OK" }]
        );
      } else {
        // --- 🟢 ログインを実行 ---
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (error: any) {
      console.error("エラーコード:", error.code);
      let message = isRegisterMode ? "登録に失敗しました。" : "ログインに失敗しました。";
      
      if (error.code === 'auth/email-already-in-use') message = "このメールは既に登録されています。";
      if (error.code === 'auth/invalid-email') message = "メールの形式が正しくありません。";
      if (error.code === 'auth/weak-password') message = "パスワードが簡単すぎます。";

      Alert.alert("エラー", message + `\n(${error.code})`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.container}>
      <ScrollView contentContainerStyle={styles.inner}>
        <View style={styles.logoContainer}>
          <View style={styles.logoBox}><Text style={styles.logoText}>連</Text></View>
          <Text style={styles.title}>{isRegisterMode ? "新規アカウント作成" : "Ren-Kei ログイン"}</Text>
          <Text style={styles.subtitle}>阿波踊り 練習支援プラットフォーム</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>メールアドレス</Text>
          <TextInput 
            style={styles.input} 
            placeholder="example@mail.com" 
            value={email} 
            onChangeText={setEmail} 
            autoCapitalize="none" 
            keyboardType="email-address"
          />
          
          <Text style={styles.label}>パスワード</Text>
          <TextInput 
            style={styles.input} 
            placeholder="6文字以上" 
            value={password} 
            onChangeText={setPassword} 
            secureTextEntry 
          />
          
          <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#fff" />
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
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  inner: { flexGrow: 1, justifyContent: "center", padding: 30 },
  logoContainer: { alignItems: "center", marginBottom: 40 },
  logoBox: { width: 60, height: 60, backgroundColor: COLORS.primary, borderRadius: 12, justifyContent: "center", alignItems: "center", marginBottom: 15 },
  logoText: { color: "#fff", fontSize: 32, fontWeight: "bold" },
  title: { fontSize: 24, fontWeight: "bold", color: COLORS.textMain },
  subtitle: { fontSize: 13, color: "#64748B", marginTop: 5 },
  form: { width: "100%" },
  label: { fontSize: 14, fontWeight: "bold", marginBottom: 8, color: COLORS.textMain },
  input: { height: 55, backgroundColor: "#fff", borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, paddingHorizontal: 15, marginBottom: 20 },
  submitBtn: { height: 55, backgroundColor: COLORS.primary, borderRadius: 12, justifyContent: "center", alignItems: "center", shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
  submitBtnText: { color: "white", fontSize: 18, fontWeight: "bold" },
  switchBtn: { marginTop: 25, alignItems: "center" },
  switchText: { color: COLORS.primary, fontWeight: "bold", fontSize: 14 },
});