/**
 * U-02 踊り解析(本体)。仕様書 5.2 / 7.6、docs/design/ai-basic-motion.md 10章。
 *
 * ライブカメラ + 骨格表示、右側に LIVE SCORE・判定ゲージ・GREAT/GOOD/MISS 回数、
 * 映像上に GREAT 等と改善メッセージを重ねる。終了時に FN-01 でスコアを確定し U-03 へ。
 * LIVE SCORE(Game Score)は UX 用の参考値で、履歴に残る Analysis Score とは別物(D-04)。
 *
 * 判定ロジックは src/features/pose・src/features/rules・useLiveAnalysis にあり、
 * この画面はそれを呼び出して表示するだけ（判定ロジックをここに書かない）。
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../navigation/AppNavigator";
import PoseCameraView from "../components/PoseCameraView";
import { useAuth } from "../hooks/useAuth";
import { useLiveAnalysis } from "../features/analysis/useLiveAnalysis";
import { LiveVideoSource } from "../features/analysis/liveTypes";
import { RuleSnapshot } from "../features/rules/types";
import { colors, spacing, radius, typography } from "../theme";
import { NarutoLoader } from "../components/motifs";
import { USING_FIREBASE_EMULATOR } from "../config/firebaseConfig";

type CameraRoute = RouteProp<RootStackParamList, "Camera">;
type CameraNav = NativeStackNavigationProp<RootStackParamList, "Camera">;

const GAUGE_LABELS: Record<string, string> = {
  HAND_ABOVE_HEAD: "手の高さ",
  HAND_KEEP: "キープ",
  HIP_LOW: "腰の低さ",
  HAND_STOP: "止める",
  HAND_POSITION: "手の位置",
  BASE_POSTURE: "基本姿勢",
};

const GRADE_COLORS: Record<string, string> = {
  GREAT: colors.gold,
  GOOD: colors.goldBright,
  MISS: colors.aka,
};

const STATUS_LABEL: Record<string, string> = {
  idle: "カメラ待ち",
  loading: "モデル読み込み中…",
  ready: "READY",
  analyzing: "ANALYZING",
  finalizing: "保存・採点中…",
  done: "完了",
  error: "エラー",
};

/** 左右 2 つある評価器はゲージ上では 1 本にまとめる(進捗・近さの大きいほう)。 */
function mergeGauges(gauges: RuleSnapshot[]): { ruleId: string; label: string; value: number; holding: boolean }[] {
  const map = new Map<string, { ruleId: string; label: string; value: number; holding: boolean }>();
  for (const g of gauges) {
    const label = GAUGE_LABELS[g.ruleId];
    if (!label) continue;
    const v = g.state === "HOLDING" ? 0.5 + 0.5 * g.progress : g.state === "NOT_READY" ? 0 : 0.5 * g.closeness;
    const cur = map.get(g.ruleId);
    if (!cur || v > cur.value) map.set(g.ruleId, { ruleId: g.ruleId, label, value: v, holding: g.state === "HOLDING" });
  }
  return [...map.values()];
}

export default function CameraScreen() {
  const route = useRoute<CameraRoute>();
  const navigation = useNavigation<CameraNav>();
  const { danceType, scorePart, baseBpm } = route.params;
  const { uid } = useAuth();
  const [source, setSource] = useState<LiveVideoSource | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  const live = useLiveAnalysis({ uid, danceType, scorePart, baseBpm });
  const { snapshot, warningMessage, prepare, start, cancel, finish, retryFinalize, canRetryFinalize } = live;

  const onSource = useCallback((s: LiveVideoSource | null) => setSource(s), []);

  useEffect(() => {
    if (source) void prepare(source);
  }, [source, prepare]);

  const onFinish = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await finish();
      navigation.replace("Result", { analysisId: result.analysisId, videoId: result.videoId });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      Alert.alert("保存に失敗しました", msg);
    } finally {
      setBusy(false);
    }
  }, [busy, finish, navigation]);

  const onCancel = useCallback(async () => {
    await cancel();
  }, [cancel]);

  // 採点だけ失敗したとき(サーバに届かない等)。動画は保存済みなので採点のみやり直す
  const onRetry = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await retryFinalize();
      navigation.replace("Result", { analysisId: result.analysisId, videoId: result.videoId });
    } catch {
      // エラー文言は snapshot.errorMessage に出るので、ここでは何もしない
    } finally {
      setBusy(false);
    }
  }, [busy, retryFinalize, navigation]);

  const gauges = useMemo(() => mergeGauges(snapshot.gauges), [snapshot.gauges]);
  const analyzing = snapshot.status === "analyzing";
  const elapsedSec = Math.floor(snapshot.elapsedMs / 1000);

  return (
    <View style={styles.container}>
      <View style={styles.videoArea}>
        <PoseCameraView onSource={onSource} onEnded={analyzing ? onFinish : undefined} allowFile={!analyzing && !busy} />

        {/* 上: 状態・警告 */}
        <View style={styles.topBar}>
          <View style={[styles.statusChip, analyzing && styles.statusChipLive]}>
            <Text style={styles.statusText}>{STATUS_LABEL[snapshot.status]}</Text>
          </View>
          {analyzing && (
            <Text style={styles.metaText}>
              {String(Math.floor(elapsedSec / 60)).padStart(2, "0")}:{String(elapsedSec % 60).padStart(2, "0")}　{snapshot.fps.toFixed(0)}fps
            </Text>
          )}
          {warningMessage && analyzing && (
            <View style={styles.warningChip}>
              <Text style={styles.warningText}>{warningMessage}</Text>
            </View>
          )}
          {source === null && (
            <View style={styles.warningChip}>
              <Text style={styles.warningText}>この端末ではリアルタイム判定に未対応です</Text>
            </View>
          )}
        </View>

        {/* 中央: 判定フラッシュと改善メッセージ */}
        <View style={styles.centerOverlay}>
          {snapshot.lastEvent && (
            <Text style={[styles.gradeFlash, { color: GRADE_COLORS[snapshot.lastEvent.grade] }]}>{snapshot.lastEvent.grade}</Text>
          )}
          {snapshot.message && analyzing && <Text style={styles.adviceText}>{snapshot.message}</Text>}
        </View>

        {/* 右: LIVE SCORE と項目ゲージ */}
        {(analyzing || snapshot.status === "finalizing") && (
          <View style={styles.sidePanel}>
            <Text style={styles.liveLabel}>LIVE SCORE</Text>
            <Text style={styles.liveScore}>{snapshot.game.score}</Text>
            {snapshot.game.combo >= 2 && <Text style={styles.combo}>{snapshot.game.combo} COMBO</Text>}
            <View style={styles.countsRow}>
              <Text style={[styles.countText, { color: GRADE_COLORS.GREAT }]}>GREAT {snapshot.game.counts.GREAT}</Text>
              <Text style={[styles.countText, { color: GRADE_COLORS.GOOD }]}>GOOD {snapshot.game.counts.GOOD}</Text>
              <Text style={[styles.countText, { color: GRADE_COLORS.MISS }]}>MISS {snapshot.game.counts.MISS}</Text>
            </View>
            {gauges.map((g) => (
              <View key={g.ruleId} style={styles.gaugeRow}>
                <Text style={styles.gaugeLabel}>{g.label}</Text>
                <View style={styles.gaugeTrack}>
                  <View style={[styles.gaugeFill, { width: `${Math.round(g.value * 100)}%` }, g.holding && styles.gaugeFillHolding]} />
                </View>
              </View>
            ))}
            <View style={styles.gaugeRow}>
              <Text style={styles.gaugeLabel}>リズム</Text>
              <Text style={styles.rhythmText}>
                {snapshot.rhythm?.userBpm ? `${snapshot.rhythm.userBpm.toFixed(0)} BPM` : "計測中…"}
                {snapshot.rhythm ? ` / 基準 ${snapshot.rhythm.baseBpm}` : ""}
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* 下: 操作 */}
      <ScrollView style={styles.bottom} contentContainerStyle={styles.bottomContent}>
        <View style={styles.infoRow}>
          <View style={styles.infoTag}>
            <Text style={styles.infoText}>{danceType === "male" ? "男踊り" : "女踊り"}</Text>
          </View>
          <View style={styles.infoTag}>
            <Text style={styles.infoText}>{scorePart === "feet" ? "足だけ" : scorePart === "hands" ? "手だけ" : "全体"}</Text>
          </View>
          <View style={styles.infoTag}>
            <Text style={styles.infoText}>基準 {baseBpm ?? 112} BPM</Text>
          </View>
          {snapshot.ruleSource && (
            <Text style={styles.infoMuted}>
              ルール {snapshot.analysisVersion}（{snapshot.ruleSource === "remote" ? "サーバ設定" : "内蔵の既定値"}）
            </Text>
          )}
          {__DEV__ && (
            // 採点は Cloud Functions が必要。どちらに繋いでいるかを開発時だけ出す
            <Text style={styles.infoMuted}>接続先: {USING_FIREBASE_EMULATOR ? "エミュレータ" : "本番"}</Text>
          )}
        </View>
        {snapshot.errorMessage && <Text style={styles.errorText}>{snapshot.errorMessage}</Text>}
        {canRetryFinalize && (
          <TouchableOpacity style={[styles.primaryButton, busy && styles.buttonDisabled]} disabled={busy} onPress={onRetry}>
            {busy ? <ActivityIndicator color={colors.textOnGold} /> : <Text style={styles.primaryButtonText}>採点をやり直す</Text>}
          </TouchableOpacity>
        )}
        <View style={styles.buttons}>
          {!analyzing ? (
            <TouchableOpacity
              style={[styles.primaryButton, (snapshot.status !== "ready" || busy) && styles.buttonDisabled]}
              disabled={snapshot.status !== "ready" || busy}
              onPress={start}
            >
              {snapshot.status === "loading" ? (
                <NarutoLoader size={20} color={colors.textOnGold} />
              ) : (
                <Text style={styles.primaryButtonText}>判定を開始</Text>
              )}
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity style={[styles.primaryButton, busy && styles.buttonDisabled]} disabled={busy} onPress={onFinish}>
                {busy ? <ActivityIndicator color={colors.textOnGold} /> : <Text style={styles.primaryButtonText}>終了して採点</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryButton} disabled={busy} onPress={onCancel}>
                <Text style={styles.secondaryButtonText}>中止</Text>
              </TouchableOpacity>
            </>
          )}
          {!analyzing && (
            <TouchableOpacity style={styles.secondaryButton} disabled={busy} onPress={() => navigation.goBack()}>
              <Text style={styles.secondaryButtonText}>戻る</Text>
            </TouchableOpacity>
          )}
        </View>
        <Text style={styles.footnote}>
          LIVE SCORE は練習中の目安です。{"\n"}極め度（0〜100点）は終了後にサーバで確定します。
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  videoArea: { flex: 1, position: "relative" },
  topBar: { position: "absolute", left: spacing.md, top: spacing.md, right: spacing.md, flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.sm, pointerEvents: "none" },
  statusChip: { backgroundColor: "rgba(11,19,43,0.75)", borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: 4, borderWidth: 1, borderColor: colors.indigoLine },
  statusChipLive: { backgroundColor: colors.aka, borderColor: colors.aka },
  statusText: { ...typography.caption, color: colors.textPrimary, fontWeight: "700", letterSpacing: 1 },
  metaText: { ...typography.caption, color: colors.textPrimary, backgroundColor: "rgba(11,19,43,0.6)", paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.sm },
  warningChip: { backgroundColor: colors.aka, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: 4 },
  warningText: { ...typography.caption, color: colors.textOnAka, fontWeight: "700" },
  centerOverlay: { position: "absolute", left: 0, right: 0, top: "30%", alignItems: "center", pointerEvents: "none" },
  gradeFlash: { ...typography.displaySerif, fontSize: 56, letterSpacing: 4, textShadowColor: "rgba(0,0,0,0.8)", textShadowRadius: 8 },
  adviceText: { marginTop: spacing.sm, color: colors.textPrimary, fontSize: 18, fontWeight: "700", backgroundColor: "rgba(11,19,43,0.7)", paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.sm },
  sidePanel: { position: "absolute", right: spacing.md, top: 56, width: 190, backgroundColor: "rgba(11,19,43,0.85)", borderRadius: radius.md, borderWidth: 1, borderColor: colors.indigoLine, padding: spacing.md, pointerEvents: "none" },
  liveLabel: { ...typography.sectionLabel, color: colors.gold },
  liveScore: { color: colors.textPrimary, fontSize: 40, fontWeight: "900", lineHeight: 44 },
  combo: { color: colors.gold, fontWeight: "bold", marginBottom: 4 },
  countsRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.sm, flexWrap: "wrap" },
  countText: { ...typography.caption, fontWeight: "700" },
  gaugeRow: { marginTop: spacing.sm },
  gaugeLabel: { ...typography.caption, color: colors.textPrimary, marginBottom: 2 },
  gaugeTrack: { height: 8, backgroundColor: colors.indigoRaised, borderRadius: 4, overflow: "hidden" },
  gaugeFill: { height: 8, backgroundColor: colors.goldBright, borderRadius: 4 },
  gaugeFillHolding: { backgroundColor: colors.gold },
  rhythmText: { ...typography.caption, color: colors.textPrimary },
  bottom: { maxHeight: 200, backgroundColor: colors.indigoDeep, borderTopWidth: 1, borderTopColor: colors.indigoLine },
  bottomContent: { padding: spacing.md },
  infoRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, alignItems: "center", marginBottom: spacing.sm },
  infoTag: { backgroundColor: colors.indigoRaised, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  infoText: { ...typography.caption, color: colors.gold, fontWeight: "700" },
  infoMuted: { ...typography.caption, color: colors.textMuted },
  errorText: { color: colors.aka, marginBottom: spacing.sm },
  buttons: { flexDirection: "row", gap: spacing.sm, alignItems: "center", flexWrap: "wrap" },
  primaryButton: { backgroundColor: colors.gold, paddingVertical: spacing.md, paddingHorizontal: spacing.xl, borderRadius: radius.sm, minWidth: 140, alignItems: "center" },
  primaryButtonText: { ...typography.button, color: colors.textOnGold, fontSize: 15 },
  secondaryButton: { borderWidth: 1, borderColor: colors.indigoLine, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, borderRadius: radius.sm },
  secondaryButtonText: { ...typography.button, color: colors.textPrimary },
  buttonDisabled: { opacity: 0.5 },
  footnote: { ...typography.caption, color: colors.textMuted, marginTop: spacing.md, lineHeight: 16 },
});
