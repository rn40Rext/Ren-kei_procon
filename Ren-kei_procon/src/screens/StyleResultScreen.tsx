import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../navigation/AppNavigator";
import { useAuth } from "../hooks/useAuth";
import { colors } from "../theme/colors";
import {
  requestStyleAnalysis,
  subscribeStyleAnalysisResult,
} from "../repositories/styleAnalysis";
import type { StyleAnalysisResult, StyleSimilarityItem } from "../types/style";
import {
  hasFewSamples,
  headlineFor,
  isCloseMatch,
  toDisplayScore,
} from "../features/style/display";
import { styleErrorMessage } from "../features/style/errorMessages";
import {
  REN_DETAIL_NAVIGATION_ENABLED,
  STYLE_SIMILARITY_UI_ENABLED,
} from "../features/style/featureFlags";

type Navigation = NativeStackNavigationProp<
  RootStackParamList,
  "StyleResult"
>;
type Route = RouteProp<RootStackParamList, "StyleResult">;

/** Firebase Functions のエラーから仕様書 13章のコードを取り出す */
function errorCodeOf(error: unknown): string {
  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return "ANALYSIS_FAILED";
}

export default function StyleResultScreen() {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<Route>();
  const { videoId } = route.params;
  const { uid, loading: authLoading } = useAuth();

  const [result, setResult] = useState<StyleAnalysisResult | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const start = useCallback(async () => {
    if (!STYLE_SIMILARITY_UI_ENABLED || !uid) return;
    setRunning(true);
    setErrorCode(null);
    setResult(null);
    try {
      const response = await requestStyleAnalysis(videoId);
      // 非同期完了もありうるので、結果ドキュメントを購読して待つ
      unsubscribeRef.current?.();
      unsubscribeRef.current = subscribeStyleAnalysisResult(
        response.styleAnalysisId,
        (next) => {
          setResult(next);
          if (next.status !== "processing") setRunning(false);
          if (next.status === "failed") setErrorCode(next.errorCode);
        },
        () => setRunning(false),
      );
    } catch (e) {
      setErrorCode(errorCodeOf(e));
      setRunning(false);
    }
  }, [uid, videoId]);

  useEffect(() => {
    if (authLoading) return;
    void start();
    return () => {
      unsubscribeRef.current?.();
      unsubscribeRef.current = null;
    };
  }, [authLoading, start]);

  const openRen = (item: StyleSimilarityItem) => {
    if (!REN_DETAIL_NAVIGATION_ENABLED) {
      // 遷移先（連詳細 #26 / 参加リクエスト #27）が未実装のため、
      // ここで navigate するとクラッシュする。
      Alert.alert(
        "準備中です",
        `${item.renName} の詳細・参加リクエスト画面は準備中です。`,
      );
      return;
    }
    Alert.alert("準備中です", item.renName);
  };

  if (!STYLE_SIMILARITY_UI_ENABLED) {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>動きの類似度</Text>
        <View style={styles.notice}>
          <Text style={styles.noticeText}>
            この機能は検証中のため、まだ公開していません。
            {"\n"}
            判定の妥当性を確認できるまで結果は表示しません。
          </Text>
        </View>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.secondaryButtonText}>戻る</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const items = result?.results ?? [];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      <Text style={styles.title}>動きの類似度</Text>
      <Text style={styles.lead}>
        どの連の踊り方に近いかを示します。
        上手い・下手の評価ではありません。
      </Text>

      {running && (
        <View style={styles.centeredBlock}>
          <ActivityIndicator size="large" color={colors.indigo} />
          <Text style={styles.muted}>解析しています…</Text>
        </View>
      )}

      {errorCode !== null && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{styleErrorMessage(errorCode)}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={start}>
            <Text style={styles.retryButtonText}>スタイル診断を再試行</Text>
          </TouchableOpacity>
        </View>
      )}

      {!running && errorCode === null && items.length > 0 && (
        <View>
          <Text style={styles.headline}>{headlineFor(items)}</Text>
          {isCloseMatch(items) && (
            <Text style={styles.muted}>
              上位の連の差が小さいため、順位は目安です。
            </Text>
          )}

          {items.map((item, index) => (
            <View key={item.renId} style={styles.card}>
              <View style={styles.rankBadge}>
                <Text style={styles.rankText}>{index + 1}</Text>
              </View>
              <View style={styles.cardBody}>
                <Text style={styles.renName}>{item.renName}</Text>
                <Text style={styles.score}>
                  動きの類似度 {toDisplayScore(item.similarity)}
                </Text>
                {hasFewSamples(item) && (
                  <Text style={styles.sampleNote}>
                    参照データが少ないため参考値です
                    （{item.sampleCount} 件）
                  </Text>
                )}
                <TouchableOpacity
                  style={styles.linkButton}
                  onPress={() => openRen(item)}
                >
                  <Text style={styles.linkButtonText}>
                    連の詳細・参加リクエストへ
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}

          <View style={styles.notice}>
            <Text style={styles.noticeText}>
              類似度は確率ではありません。
              特定の連への参加可否を示すものでもありません。
            </Text>
          </View>
        </View>
      )}

      <TouchableOpacity
        style={styles.secondaryButton}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.secondaryButtonText}>戻る</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 48 },
  centered: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  centeredBlock: { alignItems: "center", paddingVertical: 32 },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: colors.indigo,
    marginBottom: 8,
  },
  lead: { fontSize: 14, color: colors.textSecondary, marginBottom: 20 },
  headline: {
    fontSize: 20,
    fontWeight: "bold",
    color: colors.textPrimary,
    marginBottom: 12,
  },
  muted: { fontSize: 13, color: colors.textSecondary, marginTop: 8 },
  card: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 12,
  },
  rankBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.gold,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  rankText: { fontSize: 16, fontWeight: "bold", color: colors.indigo },
  cardBody: { flex: 1 },
  renName: {
    fontSize: 17,
    fontWeight: "bold",
    color: colors.textPrimary,
  },
  score: { fontSize: 15, color: colors.indigoLight, marginTop: 4 },
  sampleNote: { fontSize: 12, color: colors.noticeText, marginTop: 6 },
  linkButton: { marginTop: 10 },
  linkButtonText: {
    fontSize: 14,
    color: colors.vermilion,
    fontWeight: "600",
  },
  notice: {
    backgroundColor: colors.noticeBackground,
    borderRadius: 10,
    padding: 14,
    marginTop: 8,
  },
  noticeText: { fontSize: 13, color: colors.noticeText, lineHeight: 20 },
  errorBox: {
    backgroundColor: colors.errorBackground,
    borderRadius: 10,
    padding: 16,
  },
  errorText: { fontSize: 14, color: colors.errorText, marginBottom: 12 },
  retryButton: {
    backgroundColor: colors.indigo,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  retryButtonText: { color: colors.textOnDark, fontWeight: "bold" },
  secondaryButton: {
    marginTop: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: colors.surface,
  },
  secondaryButtonText: { color: colors.textPrimary, fontWeight: "600" },
});
