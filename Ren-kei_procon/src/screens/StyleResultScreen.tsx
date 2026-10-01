import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Alert } from "../utils/alert";
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
  STYLE_SIMILARITY_VALIDATED,
} from "../features/style/featureFlags";

/** この画面で使う画面遷移と、前の画面から受け取る値(videoId)の型 */
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

/** 連スタイル類似度(AI機能②)の結果画面。FN-02を呼び、結果ドキュメントを購読して待つ */
export default function StyleResultScreen() {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<Route>();
  // 診断する動画のID(前の画面から受け取る)
  const { videoId } = route.params;
  const { uid, loading: authLoading } = useAuth();

  // 診断結果 / 失敗したときのエラーコード / 診断中か / 結果の購読を止めるための関数
  const [result, setResult] = useState<StyleAnalysisResult | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  /** スタイル診断をリクエストし、完了まで結果ドキュメントを購読する */
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

  // ログイン状態が分かったら診断を始める。画面を閉じたら結果の購読を止める
  useEffect(() => {
    if (authLoading) return;
    void start();
    return () => {
      unsubscribeRef.current?.();
      unsubscribeRef.current = null;
    };
  }, [authLoading, start]);

  /** 類似連の詳細へ。特定の連を開いた状態の遷移は未対応なので検索を案内する */
  const openRen = (item: StyleSimilarityItem) => {
    if (!REN_DETAIL_NAVIGATION_ENABLED) {
      Alert.alert(
        "準備中です",
        `${item.renName} の詳細・参加リクエスト画面は準備中です。`,
      );
      return;
    }
    // 連を探す(U-07)へ。特定の連を開いた状態にする引数は未対応なので、連名を案内する
    Alert.alert(
      "連を探す画面へ移動します",
      `「${item.renName}」を検索して詳細・参加リクエストへ進んでください。`,
      [
        { text: "キャンセル", style: "cancel" },
        { text: "移動する", onPress: () => navigation.navigate("Request") },
      ],
    );
  };

  // 機能を公開していない間は、「検証中のため非公開」の案内だけを出す
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

  // 似ている連の一覧(類似度の高い順)
  const items = result?.results ?? [];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      {/* 見出しと、「上手い・下手の評価ではない」という説明 */}
      <Text style={styles.title}>動きの類似度</Text>
      <Text style={styles.lead}>
        どの連の踊り方に近いかを示します。
        上手い・下手の評価ではありません。
      </Text>
      {/* 検証が済むまでは「参考値」である旨の注意書きを出す */}
      {!STYLE_SIMILARITY_VALIDATED && (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>
            検証中の機能です。実際の踊り手の映像による妥当性確認（同一人物の別テイクで
            同じ連が上位になるか等）がまだ済んでいないため、結果は参考値です。
          </Text>
        </View>
      )}

      {/* 診断中の表示 */}
      {running && (
        <View style={styles.centeredBlock}>
          <ActivityIndicator size="large" color={colors.gold} />
          <Text style={styles.muted}>解析しています…</Text>
        </View>
      )}

      {/* 失敗したときのエラー文と再試行ボタン */}
      {errorCode !== null && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{styleErrorMessage(errorCode)}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={start}>
            <Text style={styles.retryButtonText}>スタイル診断を再試行</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 結果: 見出し・僅差の注意・連ごとのカード・注意書き */}
      {!running && errorCode === null && items.length > 0 && (
        <View>
          <Text style={styles.headline}>{headlineFor(items)}</Text>
          {isCloseMatch(items) && (
            <Text style={styles.muted}>
              上位の連の差が小さいため、順位は目安です。
            </Text>
          )}

          {items.map((item, index) => (
            // 連1件分: 順位・連名・類似度(参照データが少なければ注記)と、連の詳細へのリンク
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

          {/* 類似度の読み方についての注意書き */}
          <View style={styles.notice}>
            <Text style={styles.noticeText}>
              類似度は確率ではありません。
              特定の連への参加可否を示すものでもありません。
            </Text>
          </View>
        </View>
      )}

      {/* 前の画面に戻る */}
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
  // 画面全体の背景と余白。非公開時は中身を画面中央に置く
  container: { flex: 1, backgroundColor: colors.indigoDeep },
  content: { padding: 20, paddingBottom: 48 },
  centered: {
    flex: 1,
    backgroundColor: colors.indigoDeep,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  centeredBlock: { alignItems: "center", paddingVertical: 32 },
  // 見出し・説明文・結果の見出し・補足の小さな文字
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: colors.textPrimaryOnIndigo,
    marginBottom: 8,
  },
  lead: { fontSize: 14, color: colors.textSecondaryOnIndigo, marginBottom: 20 },
  headline: {
    fontSize: 20,
    fontWeight: "bold",
    color: colors.textPrimaryOnIndigo,
    marginBottom: 12,
  },
  muted: { fontSize: 13, color: colors.textMuted, marginTop: 8 },
  // 似ている連1件分のカード。左に順位バッジ、右に連名・類似度を並べる
  card: {
    flexDirection: "row",
    backgroundColor: colors.indigo,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.indigoLine,
    padding: 16,
    marginBottom: 12,
  },
  // 順位の数字を表示する丸いバッジ
  rankBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.gold,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  rankText: { fontSize: 16, fontWeight: "bold", color: colors.textOnGold },
  cardBody: { flex: 1 },
  renName: {
    fontSize: 17,
    fontWeight: "bold",
    color: colors.textPrimaryOnIndigo,
  },
  score: { fontSize: 15, color: colors.goldBright, marginTop: 4 },
  sampleNote: { fontSize: 12, color: colors.gold, marginTop: 6 },
  // 連の詳細へのリンク(朱色の文字)
  linkButton: { marginTop: 10 },
  linkButtonText: {
    fontSize: 14,
    color: colors.aka,
    fontWeight: "600",
  },
  // 「検証中の機能です」等の注意書きを目立たせる帯
  notice: {
    backgroundColor: colors.goldSoft,
    borderWidth: 1,
    borderColor: colors.indigoLine,
    borderRadius: 10,
    padding: 14,
    marginTop: 8,
  },
  noticeText: { fontSize: 13, color: colors.gold, lineHeight: 20 },
  // 失敗時のエラー表示(朱色の枠)と再試行ボタン(金色)
  errorBox: {
    backgroundColor: colors.akaSoft,
    borderWidth: 1,
    borderColor: colors.aka,
    borderRadius: 10,
    padding: 16,
  },
  errorText: { fontSize: 14, color: colors.aka, marginBottom: 12 },
  retryButton: {
    backgroundColor: colors.gold,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  retryButtonText: { color: colors.textOnGold, fontWeight: "bold" },
  // 「戻る」ボタン(枠線のみの控えめなボタン)
  secondaryButton: {
    marginTop: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.indigoLine,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: colors.indigo,
  },
  secondaryButtonText: { color: colors.textPrimaryOnIndigo, fontWeight: "600" },
});
