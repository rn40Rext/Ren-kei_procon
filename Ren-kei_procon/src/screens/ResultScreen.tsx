/**
 * U-03 解析結果。仕様書 5章 U-03 / 7.7、docs/design/ai-basic-motion.md 10章。
 *
 * FN-01 がサーバで確定した analysisResults を表示する。
 * Analysis Score(0〜100・履歴用)と Game Score(練習中の LIVE SCORE・参考値)を
 * 混同させない表示にする(D-04)。
 */
import React, { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../navigation/AppNavigator";
import { AnalysisResult, subscribeAnalysisResult } from "../repositories/analysis";
import { colors } from "../theme/colors";

type ResultRoute = RouteProp<RootStackParamList, "Result">;
type ResultNav = NativeStackNavigationProp<RootStackParamList, "Result">;

const ITEMS: { key: keyof AnalysisResult; label: string; note?: string }[] = [
  { key: "handHeightScore", label: "手の高さ" },
  { key: "hipHeightScore", label: "腰の低さ" },
  { key: "stopScore", label: "手を止める" },
  { key: "rhythmScore", label: "リズム" },
  { key: "handPositionScore", label: "手の位置", note: "参考(総合に含まず)" },
  { key: "basePostureScore", label: "基本姿勢", note: "参考(総合に含まず)" },
];

function scoreColor(v: number): string {
  if (v >= 80) return colors.gold;
  if (v >= 60) return "#3B82F6";
  return colors.vermilion;
}

export default function ResultScreen() {
  const route = useRoute<ResultRoute>();
  const navigation = useNavigation<ResultNav>();
  const { analysisId, videoId } = route.params;
  const [result, setResult] = useState<AnalysisResult | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return subscribeAnalysisResult(analysisId, setResult, (e) => setError(e.message));
  }, [analysisId]);

  if (result === undefined && !error) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.indigo} />
        <Text style={styles.muted}>結果を読み込んでいます…</Text>
      </View>
    );
  }
  if (error || result === null) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error ?? "解析結果が見つかりませんでした"}</Text>
        <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.navigate("Home")}>
          <Text style={styles.secondaryButtonText}>ホームに戻る</Text>
        </TouchableOpacity>
      </View>
    );
  }
  const r = result as AnalysisResult;
  const items = ITEMS.filter((it) => typeof r[it.key] === "number");

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>解析結果</Text>
      <Text style={styles.lead}>基本動作トレーニング(AI 解析①)。判定ルールの根拠から算出した 0〜100 の評価です。</Text>

      <View style={styles.totalCard}>
        <Text style={styles.totalLabel}>Analysis Score</Text>
        <Text style={[styles.totalValue, { color: scoreColor(r.totalScore) }]}>{Math.round(r.totalScore)}</Text>
        <Text style={styles.totalUnit}>/ 100</Text>
        <Text style={styles.version}>判定ルール {r.analysisVersion}</Text>
      </View>

      <Text style={styles.sectionTitle}>項目別</Text>
      {items.length === 0 && <Text style={styles.muted}>評価できた項目がありません(全身が映る位置でもう一度お試しください)</Text>}
      {items.map((it) => {
        const v = r[it.key] as number;
        return (
          <View key={it.key} style={styles.itemRow}>
            <View style={styles.itemHeader}>
              <Text style={styles.itemLabel}>
                {it.label}
                {it.note ? <Text style={styles.itemNote}>  {it.note}</Text> : null}
              </Text>
              <Text style={[styles.itemValue, { color: scoreColor(v) }]}>{Math.round(v)}</Text>
            </View>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: `${Math.max(2, Math.min(100, v))}%`, backgroundColor: scoreColor(v) }]} />
            </View>
          </View>
        );
      })}

      <Text style={styles.sectionTitle}>AI コメント</Text>
      {r.feedback?.length ? (
        r.feedback.map((f, i) => (
          <View key={`${f.ruleId}-${i}`} style={[styles.feedback, f.type === "improve" ? styles.feedbackImprove : styles.feedbackGood]}>
            <Text style={styles.feedbackTag}>{f.type === "improve" ? "改善点" : "できている"}</Text>
            <Text style={styles.feedbackText}>{f.message}</Text>
          </View>
        ))
      ) : (
        <Text style={styles.muted}>コメントはありません</Text>
      )}

      <View style={styles.gameCard}>
        <Text style={styles.gameLabel}>練習中の LIVE SCORE(参考値)</Text>
        <Text style={styles.gameValue}>{r.gameScore}</Text>
        <Text style={styles.gameCounts}>
          GREAT {r.greatCount} / GOOD {r.goodCount} / MISS {r.missCount}
          {typeof r.maxCombo === "number" ? ` / 最大 ${r.maxCombo} COMBO` : ""}
        </Text>
        <Text style={styles.gameNote}>ゲーム感覚で練習するための累積点で、上の評価とは別物です。</Text>
      </View>

      <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.navigate("StyleResult", { videoId })}>
        <Text style={styles.primaryButtonText}>動きの類似度(どの連の踊り方に近いか)を見る</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.primaryButtonAlt} onPress={() => navigation.navigate("Community", { shareVideoId: videoId })}>
        <Text style={styles.primaryButtonText}>コミュニティへ投稿</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.navigate("Home")}>
        <Text style={styles.secondaryButtonText}>ホームに戻る</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 48 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: colors.background },
  title: { fontSize: 26, fontWeight: "bold", color: colors.indigo, marginBottom: 6 },
  lead: { fontSize: 13, color: colors.textSecondary, marginBottom: 16 },
  totalCard: { backgroundColor: colors.indigo, borderRadius: 16, padding: 20, alignItems: "center", marginBottom: 20 },
  totalLabel: { color: colors.gold, fontWeight: "bold", letterSpacing: 2, fontSize: 12 },
  totalValue: { fontSize: 72, fontWeight: "900", lineHeight: 80 },
  totalUnit: { color: "rgba(255,255,255,0.7)", marginTop: -6 },
  version: { color: "rgba(255,255,255,0.6)", fontSize: 11, marginTop: 8 },
  sectionTitle: { fontSize: 16, fontWeight: "bold", color: colors.textPrimary, marginTop: 8, marginBottom: 10 },
  itemRow: { marginBottom: 12 },
  itemHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  itemLabel: { color: colors.textPrimary, fontWeight: "600" },
  itemNote: { color: colors.textSecondary, fontSize: 11, fontWeight: "normal" },
  itemValue: { fontWeight: "bold" },
  barTrack: { height: 10, backgroundColor: colors.border, borderRadius: 5, overflow: "hidden" },
  barFill: { height: 10, borderRadius: 5 },
  feedback: { borderRadius: 10, padding: 12, marginBottom: 8 },
  feedbackImprove: { backgroundColor: colors.noticeBackground },
  feedbackGood: { backgroundColor: "#ECFDF5" },
  feedbackTag: { fontSize: 11, fontWeight: "bold", color: colors.textSecondary, marginBottom: 2 },
  feedbackText: { color: colors.textPrimary, fontSize: 14 },
  gameCard: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, marginTop: 12, marginBottom: 20, backgroundColor: colors.surface },
  gameLabel: { fontSize: 12, color: colors.textSecondary, fontWeight: "bold" },
  gameValue: { fontSize: 28, fontWeight: "900", color: colors.indigoLight },
  gameCounts: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  gameNote: { fontSize: 11, color: colors.textSecondary, marginTop: 6 },
  primaryButton: { backgroundColor: colors.indigo, paddingVertical: 14, borderRadius: 12, alignItems: "center", marginBottom: 10 },
  primaryButtonAlt: { backgroundColor: colors.vermilion, paddingVertical: 14, borderRadius: 12, alignItems: "center", marginBottom: 10 },
  primaryButtonText: { color: "#fff", fontWeight: "bold", fontSize: 15 },
  secondaryButton: { borderWidth: 1, borderColor: colors.border, paddingVertical: 12, borderRadius: 12, alignItems: "center", backgroundColor: colors.surface },
  secondaryButtonText: { color: colors.textPrimary, fontWeight: "600" },
  muted: { color: colors.textSecondary, fontSize: 13, marginTop: 8 },
  errorText: { color: colors.errorText, marginBottom: 16, textAlign: "center" },
});
