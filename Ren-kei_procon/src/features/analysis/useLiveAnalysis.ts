/**
 * U-02 踊り解析のリアルタイム判定を束ねるフック(docs/design/ai-basic-motion.md 2章の [1]〜[7])。
 *
 *   映像 → 姿勢推定 → 前処理(平滑化) → 指標 → Rule Engine → イベント
 *        ├→ Game Score(LIVE SCORE) / 改善メッセージ / ゲージ(UI)
 *        ├→ リズム解析(腰の上下動)
 *        ├→ 姿勢系列の記録(AI② 用)
 *        └→ セッション集計 → 終了時に FN-01 finalizeBasicAnalysis(サーバでスコア確定)
 *
 * 毎フレームの結果は ref に持ち、React の state は約 10Hz でしか更新しない
 * (60fps で setState すると描画が追いつかない)。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PoseSmoother, meanVisibility } from "../pose/preprocess";
import { PoseSeriesRecorder } from "../pose/poseSeries";
import { LM, Landmark, PoseFrame } from "../pose/types";
import { PoseDetector, createPoseDetector } from "../pose/PoseDetector";
import { bodyScale, hipCenterY } from "../pose/normalize";
import { GameScoreState, applyGrade, initialGameScore } from "../rules/gameScore";
import { MetricsTracker } from "../rules/metrics";
import { RhythmAnalyzer, RhythmEstimate } from "../rules/rhythm";
import { RuleEvaluator, createEvaluators, requiresLowerBody } from "../rules/ruleEngine";
import { FinalizeRequest, ScorePart, SessionAggregator } from "../rules/session";
import { DanceType, RuleEvent, RuleSnapshot } from "../rules/types";
import { frameRules, RHYTHM_RULE_ID } from "../rules/definitions";
import { LoadedRuleSet, loadRuleSet } from "../../repositories/analysisRules";
import { finalizeBasicAnalysis, FinalizeResponse } from "../../repositories/analysis";
import { createPracticeVideo, uploadPoseSeries, uploadPracticeVideo } from "../../repositories/videos";
import { LIVE_WARNING_MESSAGES, LiveSnapshot, LiveStatus, LiveVideoSource, LiveWarning, framingMessage } from "./liveTypes";
import { finalizeErrorMessage } from "./errorMessages";

/** 検出信頼度を見る landmark。脚のルールを評価しないときは脚を数えない */
const UPPER_LANDMARKS = [LM.NOSE, LM.L_SHOULDER, LM.R_SHOULDER, LM.L_WRIST, LM.R_WRIST, LM.L_HIP, LM.R_HIP];
const FULL_LANDMARKS = [...UPPER_LANDMARKS, LM.L_KNEE, LM.R_KNEE, LM.L_ANKLE, LM.R_ANKLE];
const UI_UPDATE_INTERVAL_MS = 100;
const EVENT_DISPLAY_MS = 900;

export type LiveAnalysisOptions = {
  uid: string | null;
  danceType: DanceType;
  scorePart: ScorePart;
  /** 基準テンポ。省略時はルールセットの既定(112) */
  baseBpm?: number;
};

export type FinishResult = {
  videoId: string;
  analysisId: string;
  response: FinalizeResponse;
};

function newRequestId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function initialSnapshot(): LiveSnapshot {
  return {
    status: "idle",
    warning: null,
    fps: 0,
    inferenceMs: 0,
    elapsedMs: 0,
    game: initialGameScore(),
    lastEvent: null,
    message: null,
    gauges: [],
    rhythm: null,
    ruleSource: null,
    analysisVersion: null,
    errorMessage: null,
  };
}

/** 複数人のときは体が最も大きく映っている人物を採る(手前の人)。 */
function pickPrimary(poses: Landmark[][], timestampMs: number): PoseFrame | null {
  let best: PoseFrame | null = null;
  let bestScale = -1;
  for (const landmarks of poses) {
    const f = { timestampMs, landmarks };
    const s = bodyScale(f) ?? 0;
    if (s > bestScale) {
      bestScale = s;
      best = f;
    }
  }
  return best;
}

export function useLiveAnalysis(options: LiveAnalysisOptions) {
  const [snapshot, setSnapshot] = useState<LiveSnapshot>(initialSnapshot);

  // 毎フレーム触る状態は ref に置く
  const detectorRef = useRef<PoseDetector | null>(null);
  const sourceRef = useRef<LiveVideoSource | null>(null);
  const ruleSetRef = useRef<LoadedRuleSet | null>(null);
  const evaluatorsRef = useRef<RuleEvaluator[]>([]);
  const smootherRef = useRef(new PoseSmoother());
  const trackerRef = useRef(new MetricsTracker());
  const rhythmRef = useRef<RhythmAnalyzer | null>(null);
  const recorderRef = useRef(new PoseSeriesRecorder(15));
  const sessionRef = useRef<SessionAggregator | null>(null);
  const gameRef = useRef<GameScoreState>(initialGameScore());
  const rafRef = useRef<number | null>(null);
  const runningRef = useRef(false);
  const statusRef = useRef<LiveStatus>("idle");
  const startMsRef = useRef<number | null>(null);
  const lastEventRef = useRef<LiveSnapshot["lastEvent"]>(null);
  const messageRef = useRef<string | null>(null);
  const warningRef = useRef<LiveWarning | null>(null);
  const rhythmEstRef = useRef<RhythmEstimate | null>(null);
  const fpsRef = useRef({ frames: 0, windowStart: 0, fps: 0, inferSum: 0 });
  const lastUiMsRef = useRef(0);
  const lastTsRef = useRef(-1);
  const gaugesRef = useRef<RuleSnapshot[]>([]);
  /** 選んだ部位のルールが脚を必要とするか(構図ガイドと信頼度判定に使う) */
  const needsLowerBodyRef = useRef(true);
  /** 今回評価しているルール ID。保持率の集計対象を絞るのに使う */
  const activeRuleIdsRef = useRef<Set<string>>(new Set());
  /** RHYTHM が今回の部位で有効か */
  const rhythmActiveRef = useRef(true);
  /** FN-01 だけ失敗したときの再試行用。動画と姿勢系列は保存済み */
  const pendingRef = useRef<{ videoId: string; payload: FinalizeRequest } | null>(null);

  const optionsRef = useRef(options);
  optionsRef.current = options;

  const publish = useCallback((patch?: Partial<LiveSnapshot>) => {
    if (__DEV__) {
      // 開発時の計測用(ブラウザの console から window.__renkeiLive で読める)
      (globalThis as { __renkeiLive?: unknown }).__renkeiLive = {
        status: statusRef.current,
        fps: fpsRef.current.fps,
        inferenceMs: fpsRef.current.frames ? fpsRef.current.inferSum / fpsRef.current.frames : null,
        elapsedMs: sessionRef.current?.durationMs ?? 0,
        game: gameRef.current,
        events: sessionRef.current?.eventCount ?? 0,
        rhythm: rhythmEstRef.current,
        warning: warningRef.current,
      };
    }
    setSnapshot((prev) => ({
      ...prev,
      status: statusRef.current,
      warning: warningRef.current,
      fps: fpsRef.current.fps,
      inferenceMs: fpsRef.current.frames ? fpsRef.current.inferSum / fpsRef.current.frames : prev.inferenceMs,
      elapsedMs: sessionRef.current?.durationMs ?? 0,
      game: gameRef.current,
      lastEvent: lastEventRef.current,
      message: messageRef.current,
      gauges: gaugesRef.current,
      rhythm: rhythmEstRef.current,
      ruleSource: ruleSetRef.current?.source ?? null,
      analysisVersion: ruleSetRef.current?.version ?? null,
      ...patch,
    }));
  }, []);

  const setStatus = useCallback(
    (status: LiveStatus, errorMessage: string | null = null) => {
      statusRef.current = status;
      publish({ errorMessage });
    },
    [publish]
  );

  /** モデルとルール定義を読み込む。source が決まったら呼ぶ。 */
  const prepare = useCallback(
    async (source: LiveVideoSource) => {
      sourceRef.current = source;
      // ソースが変わると時刻の基準も変わる(カメラ: performance.now / 動画: currentTime)
      lastTsRef.current = -1;
      if (statusRef.current === "loading" || statusRef.current === "ready" || statusRef.current === "analyzing") return;
      setStatus("loading");
      try {
        const [ruleSet] = await Promise.all([
          loadRuleSet(),
          (async () => {
            if (!detectorRef.current) {
              const d = createPoseDetector({ model: "full", delegate: "GPU", numPoses: 2 });
              await d.load();
              detectorRef.current = d;
            }
          })(),
        ]);
        const baseBpm = optionsRef.current.baseBpm ?? ruleSet.rhythm.baseBpm;
        ruleSetRef.current = { ...ruleSet, rhythm: { ...ruleSet.rhythm, baseBpm } };
        rhythmRef.current = new RhythmAnalyzer(ruleSetRef.current.rhythm, 1000);
        setStatus("ready");
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setStatus("error", msg);
      }
    },
    [setStatus]
  );

  const handleEvent = useCallback((e: RuleEvent) => {
    sessionRef.current?.addEvent(e);
    gameRef.current = applyGrade(gameRef.current, e.grade);
    lastEventRef.current = { ...e, shownAtMs: e.timestampMs };
    if (e.grade === "MISS" && e.message) messageRef.current = e.message;
    if (e.grade !== "MISS" && e.message) messageRef.current = e.message;
  }, []);

  const processFrame = useCallback(() => {
    const source = sourceRef.current;
    const detector = detectorRef.current;
    const ruleSet = ruleSetRef.current;
    if (!source || !detector || !ruleSet || !runningRef.current) return;
    if (!source.isPlaying()) return;

    const nowMs = source.nowMs();
    if (nowMs <= lastTsRef.current) return; // 同じフレーム
    lastTsRef.current = nowMs;
    if (startMsRef.current === null) startMsRef.current = nowMs;
    const t = nowMs - startMsRef.current;

    const detection = detector.detect(source.frame, nowMs);

    // fps 計測(直近 1 秒)
    const f = fpsRef.current;
    f.frames += 1;
    f.inferSum += detection.inferenceMs;
    if (nowMs - f.windowStart >= 1000) {
      f.fps = (f.frames * 1000) / Math.max(1, nowMs - f.windowStart);
      f.windowStart = nowMs;
      f.frames = 0;
      f.inferSum = 0;
    }

    // 人物検出の状態 → 警告
    let warning: LiveWarning | null = null;
    if (detection.poses.length === 0) warning = "PERSON_NOT_DETECTED";
    else if (detection.poses.length > 1) warning = "MULTIPLE_PERSONS_DETECTED";

    const primaryRaw = pickPrimary(detection.poses, t);
    let primary: PoseFrame | null = null;
    if (primaryRaw) {
      primary = smootherRef.current.apply(primaryRaw);
    } else {
      smootherRef.current.reset();
    }
    source.draw?.(primary?.landmarks ?? null, detection.poses);

    const session = sessionRef.current;
    const values = primary ? trackerRef.current.update(primary) : trackerRef.current.update({ timestampMs: t, landmarks: [] });

    // 構図の警告は「実際に評価するルールに必要な範囲」で判断する。
    // 「手だけ」なら脚が枠外でも判定できるので、全身を求めない
    const needsLower = needsLowerBodyRef.current;
    if (primary) {
      const scaleOk = values.bodyScale !== null && values.bodyScale !== undefined;
      const lowerOk = !needsLower || (values.kneeAngleDeg !== null && values.kneeAngleDeg !== undefined);
      if (!scaleOk || !lowerOk) warning = warning ?? "NOT_FULL_BODY";
      else if (meanVisibility(primary, needsLower ? FULL_LANDMARKS : UPPER_LANDMARKS) < 0.6) {
        warning = warning ?? "LOW_LANDMARK_CONFIDENCE";
      }
    }
    warningRef.current = warning;
    const gauges: RuleSnapshot[] = [];
    for (const ev of evaluatorsRef.current) {
      const e = ev.evaluate(values, t);
      if (e) handleEvent(e);
      gauges.push(ev.snapshot(t));
    }
    gaugesRef.current = gauges;

    if (session) {
      // 保持率は「実際に評価しているルール」だけ集計する。
      // 評価していないルールを入れると、「手だけ」を選んだのに腰のスコアが
      // 付いてしまう(全身が映っていると値自体は計算できてしまうため)
      const active = activeRuleIdsRef.current;
      if (active.has("HIP_LOW")) {
        const hip = SessionAggregator.hipLowInRange(values);
        session.trackHold("HIP_LOW", hip.value, hip.inRange, t);
      }
      if (active.has("BASE_POSTURE")) {
        const posture = values.basePostureMargin;
        session.trackHold("BASE_POSTURE", posture ?? null, posture !== null && posture !== undefined && posture >= 0, t);
      }
      session.endFrame(t);
    }

    // リズム(腰の上下動)
    const rhythm = rhythmRef.current;
    if (rhythm && primary && rhythmActiveRef.current) {
      rhythm.push(t, hipCenterY(primary));
      const est = rhythm.tick(t);
      if (est) {
        rhythmEstRef.current = est;
        if (est.grade && est.userBpm !== null) {
          session?.addRhythm(est);
          const rule = ruleSet.rules.find((r) => r.ruleId === RHYTHM_RULE_ID);
          handleEvent({
            ruleId: RHYTHM_RULE_ID,
            grade: est.grade,
            timestampMs: t,
            value: est.userBpm,
            message: est.grade === "MISS" ? rule?.improveMessage : rule?.goodMessage,
          });
        }
      }
    }

    if (primary) recorderRef.current.push(primary);

    // 表示の更新は 10Hz に抑える
    if (nowMs - lastUiMsRef.current >= UI_UPDATE_INTERVAL_MS) {
      lastUiMsRef.current = nowMs;
      if (lastEventRef.current && t - lastEventRef.current.shownAtMs > EVENT_DISPLAY_MS) {
        lastEventRef.current = null;
      }
      publish();
    }
  }, [handleEvent, publish]);

  const loop = useCallback(() => {
    if (!runningRef.current) return;
    try {
      processFrame();
    } catch (e) {
      runningRef.current = false;
      setStatus("error", e instanceof Error ? e.message : String(e));
      return;
    }
    rafRef.current = globalThis.requestAnimationFrame(loop);
  }, [processFrame, setStatus]);

  /** 判定を開始する。 */
  const start = useCallback(() => {
    const ruleSet = ruleSetRef.current;
    const source = sourceRef.current;
    if (!ruleSet || !source || statusRef.current !== "ready") return;
    const defs = frameRules(ruleSet);
    const { danceType, scorePart } = optionsRef.current;
    evaluatorsRef.current = createEvaluators(defs, danceType, scorePart);
    activeRuleIdsRef.current = new Set(evaluatorsRef.current.map((e) => e.ruleId));
    // RHYTHM は状態機械を持たないので評価器に現れない。別途 rhythm 側で扱う
    needsLowerBodyRef.current = requiresLowerBody(defs, scorePart);
    const rhythmDef = ruleSet.rules.find((r) => r.ruleId === RHYTHM_RULE_ID);
    rhythmActiveRef.current =
      !!rhythmDef?.enabled && !(rhythmDef.scoreParts && !rhythmDef.scoreParts.includes(scorePart));
    pendingRef.current = null;
    smootherRef.current.reset();
    trackerRef.current.reset();
    recorderRef.current.reset();
    rhythmRef.current?.reset();
    sessionRef.current = new SessionAggregator(ruleSet.version);
    gameRef.current = initialGameScore();
    lastEventRef.current = null;
    messageRef.current = null;
    rhythmEstRef.current = null;
    startMsRef.current = null;
    lastTsRef.current = -1;
    fpsRef.current = { frames: 0, windowStart: source.nowMs(), fps: 0, inferSum: 0 };
    source.startRecording?.();
    runningRef.current = true;
    setStatus("analyzing");
    rafRef.current = globalThis.requestAnimationFrame(loop);
  }, [loop, setStatus]);

  const stopLoop = useCallback(() => {
    runningRef.current = false;
    if (rafRef.current !== null) {
      globalThis.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  /** 中止(保存しない)。 */
  const cancel = useCallback(async () => {
    stopLoop();
    await sourceRef.current?.stopRecording?.();
    setStatus("ready");
  }, [setStatus, stopLoop]);

  /**
   * 終了して保存・スコア確定。
   * 動画・姿勢系列を Storage へ置き、集計値を FN-01 へ送る。
   */
  const finish = useCallback(async (): Promise<FinishResult> => {
    stopLoop();
    const { uid, danceType, scorePart } = optionsRef.current;
    const session = sessionRef.current;
    const source = sourceRef.current;
    if (!uid) throw new Error("UNAUTHORIZED");
    if (!session) throw new Error("セッションが開始されていません");
    setStatus("finalizing");
    try {
      const recorded = (await source?.stopRecording?.()) ?? source?.fileMedia ?? null;
      const videoId = await createPracticeVideo({ uid, danceType, scorePart });
      if (recorded) {
        await uploadPracticeVideo(uid, videoId, recorded.blob, recorded.contentType);
      }
      if (recorderRef.current.frameCount > 0) {
        await uploadPoseSeries(uid, videoId, recorderRef.current.toSeries(), session.durationMs);
      }
      const payload: FinalizeRequest = session.build({
        videoId,
        clientRequestId: newRequestId(),
        danceType,
        scorePart,
        game: gameRef.current,
      });
      // ここから先が失敗しても、動画と姿勢系列は保存済み。
      // 同じ payload(clientRequestId 込み)で再試行できるよう控えておく
      pendingRef.current = { videoId, payload };
      const response = await finalizeBasicAnalysis(payload);
      pendingRef.current = null;
      setStatus("done");
      return { videoId, analysisId: response.analysisId, response };
    } catch (e) {
      setStatus("error", finalizeErrorMessage(e));
      throw e;
    }
  }, [setStatus, stopLoop]);

  /**
   * FN-01 だけをやり直す。動画・姿勢系列は保存済みなので再アップロードしない。
   * clientRequestId が同じなので、サーバ側で二重に結果が作られることはない(冪等)。
   */
  const retryFinalize = useCallback(async (): Promise<FinishResult> => {
    const pending = pendingRef.current;
    if (!pending) throw new Error("再試行できる採点がありません");
    setStatus("finalizing");
    try {
      const response = await finalizeBasicAnalysis(pending.payload);
      pendingRef.current = null;
      setStatus("done");
      return { videoId: pending.videoId, analysisId: response.analysisId, response };
    } catch (e) {
      setStatus("error", finalizeErrorMessage(e));
      throw e;
    }
  }, [setStatus]);

  /** 採点だけが未完了か(動画は保存済み)。UI の再試行ボタン表示に使う */
  const canRetryFinalize = snapshot.status === "error" && pendingRef.current !== null;

  useEffect(() => {
    return () => {
      stopLoop();
      detectorRef.current?.close();
      detectorRef.current = null;
    };
  }, [stopLoop]);

  const warningMessage = useMemo(() => {
    if (!snapshot.warning) return null;
    if (snapshot.warning === "NOT_FULL_BODY") return framingMessage(needsLowerBodyRef.current);
    return LIVE_WARNING_MESSAGES[snapshot.warning];
  }, [snapshot.warning]);

  return { snapshot, warningMessage, prepare, start, cancel, finish, retryFinalize, canRetryFinalize };
}
