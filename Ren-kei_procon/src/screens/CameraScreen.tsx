/**
 * U-02 踊り解析(本体)。仕様書 5.2 / 7.6、docs/design/ai-basic-motion.md 10章。
 *
 * ライブカメラ + 骨格表示、下に判定ゲージ・GREAT/GOOD/MISS 回数、
 * 映像上に GREAT 等と改善メッセージを重ねる。終了時に FN-01 でスコアを確定し U-03 へ。
 * LIVE SCORE(Game Score)はチーム判断でユーザーには表示しない(2026-10-01)。
 * gameScore自体の算出・保存(useLiveAnalysis/SessionAggregator)は変更していない。
 *
 * 判定ロジックは src/features/pose・src/features/rules・useLiveAnalysis にあり、
 * この画面はそれを呼び出して表示するだけ（判定ロジックをここに書かない）。
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Alert } from "../utils/alert";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../navigation/AppNavigator";
import PoseCameraView, { POSE_CAMERA_SUPPORTED } from "../components/PoseCameraView";
import { useAuth } from "../hooks/useAuth";
import { useLiveAnalysis } from "../features/analysis/useLiveAnalysis";
import { LiveVideoSource } from "../features/analysis/liveTypes";
import { SCORING_DURATIONS_SEC, STANCE_HOLD_MS, ScoringDurationSec, stanceGuide } from "../features/analysis/stance";
import { RuleSnapshot } from "../features/rules/types";
import { colors, spacing, radius, typography } from "../theme";
import { NarutoLoader } from "../components/motifs";
import { StancePoseGuide } from "../components/StancePoseGuide";
import { USING_FIREBASE_EMULATOR } from "../config/firebaseConfig";

type CameraRoute = RouteProp<RootStackParamList, "Camera">;
type CameraNav = NativeStackNavigationProp<RootStackParamList, "Camera">;

// 採点中(analyzing)の雰囲気づくり用BGM。自前で撮影した動画から抽出した音源。
// リアルタイム判定はWeb版のみ対応(TBD-01)なので、ネイティブのAudio実装
// (expo-av等)には依存せず、Web標準のAudio要素だけで再生する。
// (expo-avは静的importするだけでネイティブモジュール'ExponentAV'が
// 見つからずクラッシュするため、ここでは使わない)
const BGM_URL: string = require("../../assets/audio/bgm-awaodori.mp3");

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
  waitingStance: "構え待ち",
  analyzing: "ANALYZING",
  timeUp: "時間終了",
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

function formatSec(sec: number): string {
  return `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;
}

export default function CameraScreen() {
  const route = useRoute<CameraRoute>();
  const navigation = useNavigation<CameraNav>();
  const { danceType, scorePart, baseBpm } = route.params;
  const { uid } = useAuth();
  const [source, setSource] = useState<LiveVideoSource | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [durationSec, setDurationSec] = useState<ScoringDurationSec>(SCORING_DURATIONS_SEC[0]);

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

  // 採点時間が来たら自動で保存・採点へ進む
  useEffect(() => {
    if (snapshot.status === "timeUp") void onFinish();
  }, [snapshot.status, onFinish]);

  const gauges = useMemo(() => mergeGauges(snapshot.gauges), [snapshot.gauges]);
  const analyzing = snapshot.status === "analyzing";
  const waitingStance = snapshot.status === "waitingStance";

  // 採点中(analyzing)だけBGMをループ再生する。判定ロジックとは無関係なので
  // useLiveAnalysisではなくこの画面側で扱う(docs/rules/coding.md: 画面は判定ロジックを持たない)。
  // リアルタイム判定はWeb版のみなのでWeb標準のAudio要素で十分(ネイティブでは何もしない)。
  // モバイルブラウザは「ユーザー操作と同期していない再生」をブロックするため
  // (構えを待ってから始まるカメラのanalyzingはボタン押下から時間差があり、
  // そのままだと再生がブロックされる)、「判定を開始」ボタン押下の中で
  // 同期的に一度play()しておき(unlockBgm)、以降はそのAudioを使い回す。
  // Audio要素はボタン押下時(unlockBgm)に初めて作る。採点しないなら音源を読み込まない。
  const bgmRef = useRef<HTMLAudioElement | null>(null);
  /** 今BGMを鳴らすべきか。unlockの非同期な後始末が本再生を止めないよう判定に使う */
  const bgmWantedRef = useRef(false);
  const getBgmAudio = useCallback((): HTMLAudioElement | null => {
    if (Platform.OS !== "web") return null;
    const AudioCtor = (globalThis as { Audio?: typeof window.Audio }).Audio;
    if (!AudioCtor) return null;
    if (!bgmRef.current) {
      const audio = new AudioCtor(BGM_URL);
      audio.loop = true;
      audio.volume = 0.5;
      bgmRef.current = audio;
    }
    return bgmRef.current;
  }, []);
  const unlockBgm = useCallback(() => {
    const audio = getBgmAudio();
    if (!audio || bgmWantedRef.current) return;
    // unlockの再生音は聞かせない。動画ファイルの判定はstart()直後にanalyzingになるので、
    // play()の解決より先に本再生が始まっていたら止めずにそのまま鳴らす
    audio.muted = true;
    audio
      .play()
      .then(() => {
        if (!bgmWantedRef.current) audio.pause();
      })
      .catch(() => undefined)
      .finally(() => {
        audio.muted = false;
      });
  }, [getBgmAudio]);

  useEffect(() => {
    bgmWantedRef.current = analyzing;
    const audio = bgmRef.current;
    if (!audio) return;
    if (analyzing) {
      audio.muted = false;
      audio.currentTime = 0;
      audio.play().catch((e) => console.warn("BGMの再生に失敗しました", e));
    } else {
      audio.pause();
    }
  }, [analyzing]);

  // 画面を離れるときは確実に止める
  useEffect(() => {
    return () => {
      bgmRef.current?.pause();
      bgmRef.current = null;
    };
  }, []);
  /** 判定を始めてから保存に入るまで(構え待ち + 採点中) */
  const active = waitingStance || analyzing;
  const remainingSec = Math.max(0, Math.ceil((snapshot.durationMs - snapshot.elapsedMs) / 1000));
  const stanceCountdown = Math.max(1, Math.ceil(((1 - snapshot.stanceProgress) * STANCE_HOLD_MS) / 1000));

  // リアルタイム判定はWeb版のみ対応(TBD-01)。スマホアプリでは判定不能な画面を
  // 中途半端に出さず、その場でわかる案内に差し替える。
  if (!POSE_CAMERA_SUPPORTED) {
    return (
      <View style={styles.unsupportedContainer}>
        <Text style={styles.unsupportedTitle}>この端末では未対応です</Text>
        <Text style={styles.unsupportedText}>
          自主稽古のAI解析（動きのリアルタイム判定）は、現在パソコンのブラウザ版のみ対応しています。{"\n\n"}
          お手数ですが、パソコンでこのアプリを開いて自主稽古をお試しください。
        </Text>
        <TouchableOpacity style={styles.unsupportedButton} onPress={() => navigation.goBack()} activeOpacity={0.85}>
          <Text style={styles.unsupportedButtonText}>戻る</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.videoArea}>
        <PoseCameraView onSource={onSource} onEnded={analyzing ? onFinish : undefined} allowFile={!active && !busy} />

        {/* 構え待ち中、阿波踊りを知らない人でも真似しやすいよう構えのお手本を薄く重ねる */}
        {waitingStance && (
          <View style={styles.stanceGuideLayer} pointerEvents="none">
            <StancePoseGuide scorePart={scorePart} />
          </View>
        )}

        {/* 上: 状態・警告 */}
        <View style={styles.topBar}>
          <View style={[styles.statusChip, analyzing && styles.statusChipLive]}>
            <Text style={styles.statusText}>{STATUS_LABEL[snapshot.status]}</Text>
          </View>
          {analyzing && (
            <Text style={styles.metaText}>
              残り {formatSec(remainingSec)}　{snapshot.fps.toFixed(0)}fps
            </Text>
          )}
          {warningMessage && active && (
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
          {waitingStance && (
            <View style={styles.stancePanel}>
              <Text style={styles.stanceTitle}>{stanceGuide(scorePart)}</Text>
              {snapshot.stanceProgress > 0 ? (
                <Text style={styles.stanceCount}>{stanceCountdown}</Text>
              ) : (
                <Text style={styles.stanceHint}>構えを {STANCE_HOLD_MS / 1000} 秒続けると採点が始まります</Text>
              )}
              <View style={styles.stanceTrack}>
                <View style={[styles.stanceFill, { width: `${Math.round(snapshot.stanceProgress * 100)}%` }]} />
              </View>
            </View>
          )}
          {snapshot.lastEvent && (
            <Text style={[styles.gradeFlash, { color: GRADE_COLORS[snapshot.lastEvent.grade] }]}>{snapshot.lastEvent.grade}</Text>
          )}
          {snapshot.message && analyzing && <Text style={styles.adviceText}>{snapshot.message}</Text>}
        </View>

      </View>

      {/* 下: 情報(スクロール) + 操作ボタン(常に見える位置に固定) */}
      <View style={styles.bottom}>
        <ScrollView style={styles.bottomScroll} contentContainerStyle={styles.bottomContent}>
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
          {/* 判定ゲージ・回数・リズム。映像に重ねず、ここにまとめて表示する */}
          {(analyzing || snapshot.status === "timeUp" || snapshot.status === "finalizing") && (
            <View style={styles.scoreDetail}>
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
          <Text style={styles.footnote}>極め度（0〜100点）は終了後にサーバで確定します。</Text>
        </ScrollView>
        {/* 操作ボタンはスクロール領域の外に置き、ゲージが増えても押せる位置から外さない */}
        <View style={styles.bottomActions}>
          {canRetryFinalize && (
            <TouchableOpacity style={[styles.primaryButton, busy && styles.buttonDisabled]} disabled={busy} onPress={onRetry}>
              {busy ? <ActivityIndicator color={colors.textOnGold} /> : <Text style={styles.primaryButtonText}>採点をやり直す</Text>}
            </TouchableOpacity>
          )}
          {!active && (
            <View style={styles.durationRow}>
              <Text style={styles.durationLabel}>採点時間</Text>
              {SCORING_DURATIONS_SEC.map((sec) => (
                <TouchableOpacity
                  key={sec}
                  style={[styles.durationChip, durationSec === sec && styles.durationChipSelected]}
                  disabled={busy}
                  onPress={() => setDurationSec(sec)}
                >
                  <Text style={[styles.durationChipText, durationSec === sec && styles.durationChipTextSelected]}>{sec}秒</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          <View style={styles.buttons}>
            {waitingStance ? (
              <TouchableOpacity style={styles.secondaryButton} disabled={busy} onPress={onCancel}>
                <Text style={styles.secondaryButtonText}>中止</Text>
              </TouchableOpacity>
            ) : !analyzing ? (
              <TouchableOpacity
                style={[styles.primaryButton, (snapshot.status !== "ready" || busy) && styles.buttonDisabled]}
                disabled={snapshot.status !== "ready" || busy}
                onPress={() => {
                  // モバイルブラウザの自動再生制限を回避するため、ボタン押下(ユーザー操作)の
                  // 中で同期的にBGMを一度再生しておく。実際の採点開始とBGM再生はこの後始まる
                  unlockBgm();
                  start(durationSec);
                }}
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
            {!active && (
              <TouchableOpacity style={styles.secondaryButton} disabled={busy} onPress={() => navigation.goBack()}>
                <Text style={styles.secondaryButtonText}>戻る</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  unsupportedContainer: { flex: 1, backgroundColor: colors.indigoDeep, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  unsupportedTitle: { ...typography.titleSerif, color: colors.textPrimary, marginBottom: spacing.md },
  unsupportedText: { ...typography.body, color: colors.textSecondary, textAlign: "center", lineHeight: 20 },
  unsupportedButton: { backgroundColor: colors.gold, paddingVertical: spacing.md, paddingHorizontal: spacing.xxl, borderRadius: radius.sm, marginTop: spacing.xl },
  unsupportedButtonText: { ...typography.button, color: colors.textOnGold, fontSize: 15 },

  container: { flex: 1, backgroundColor: "#000" },
  videoArea: { flex: 1, position: "relative" },
  stanceGuideLayer: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  topBar: { position: "absolute", left: spacing.md, top: spacing.md, right: spacing.md, flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.sm, pointerEvents: "none" },
  statusChip: { backgroundColor: "rgba(11,19,43,0.75)", borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: 4, borderWidth: 1, borderColor: colors.indigoLine },
  statusChipLive: { backgroundColor: colors.aka, borderColor: colors.aka },
  statusText: { ...typography.caption, color: colors.textPrimary, fontWeight: "700", letterSpacing: 1 },
  metaText: { ...typography.caption, color: colors.textPrimary, backgroundColor: "rgba(11,19,43,0.6)", paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.sm },
  warningChip: { backgroundColor: colors.aka, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: 4 },
  warningText: { ...typography.caption, color: colors.textOnAka, fontWeight: "700" },
  centerOverlay: { position: "absolute", left: 0, right: 0, top: "30%", alignItems: "center", pointerEvents: "none" },
  gradeFlash: { ...typography.displaySerif, fontSize: 44, letterSpacing: 3, textShadowColor: "rgba(0,0,0,0.8)", textShadowRadius: 8 },
  adviceText: { marginTop: spacing.sm, color: colors.textPrimary, fontSize: 18, fontWeight: "700", backgroundColor: "rgba(11,19,43,0.7)", paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.sm },
  scoreDetail: { backgroundColor: colors.indigoRaised, borderRadius: radius.md, borderWidth: 1, borderColor: colors.indigoLine, padding: spacing.md, marginBottom: spacing.sm },
  countsRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.sm, flexWrap: "wrap" },
  countText: { ...typography.caption, fontWeight: "700" },
  gaugeRow: { marginTop: spacing.sm },
  gaugeLabel: { ...typography.caption, color: colors.textPrimary, marginBottom: 2 },
  gaugeTrack: { height: 8, backgroundColor: colors.indigo, borderRadius: 4, overflow: "hidden" },
  gaugeFill: { height: 8, backgroundColor: colors.goldBright, borderRadius: 4 },
  gaugeFillHolding: { backgroundColor: colors.gold },
  rhythmText: { ...typography.caption, color: colors.textPrimary },
  stancePanel: { alignItems: "center", backgroundColor: "rgba(11,19,43,0.8)", borderRadius: radius.md, borderWidth: 1, borderColor: colors.indigoLine, paddingHorizontal: spacing.xl, paddingVertical: spacing.lg, marginHorizontal: spacing.lg },
  stanceTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: "700", textAlign: "center" },
  stanceHint: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.sm },
  stanceCount: { ...typography.displaySerif, color: colors.gold, fontSize: 56, lineHeight: 64, marginTop: spacing.xs },
  stanceTrack: { alignSelf: "stretch", height: 8, backgroundColor: colors.indigoRaised, borderRadius: 4, overflow: "hidden", marginTop: spacing.md },
  stanceFill: { height: 8, backgroundColor: colors.gold, borderRadius: 4 },
  durationRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  durationLabel: { ...typography.caption, color: colors.textSecondary },
  durationChip: { borderWidth: 1, borderColor: colors.indigoLine, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  durationChipSelected: { backgroundColor: colors.gold, borderColor: colors.gold },
  durationChipText: { ...typography.caption, color: colors.textPrimary, fontWeight: "700" },
  durationChipTextSelected: { color: colors.textOnGold },
  bottom: { backgroundColor: colors.indigoDeep, borderTopWidth: 1, borderTopColor: colors.indigoLine },
  bottomScroll: { maxHeight: 200 },
  bottomContent: { padding: spacing.md, paddingBottom: spacing.sm },
  bottomActions: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.md, borderTopWidth: 1, borderTopColor: colors.indigoLine, gap: spacing.sm },
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
