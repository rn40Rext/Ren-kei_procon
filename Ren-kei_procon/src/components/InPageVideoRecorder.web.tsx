/**
 * 投稿用の「今すぐ撮る」をアプリ内で完結させる録画モーダル(Web実装)。
 *
 * これまでは expo-image-picker の launchCameraAsync() でOS標準のカメラアプリに
 * 丸投げしていたが、Web版では「カメラが起動するだけで戻ってこない」という
 * ブラウザ間の不整合が公式ドキュメントにも明記されている
 * (requestCameraPermissionsAsyncはWebでは何もせず、キャンセルイベントも
 * ブラウザによって正しく返らない)。
 *
 * 採点画面(PoseCameraView.web.tsx)と同じ getUserMedia + MediaRecorder を使い、
 * ページ内で録画から確認まで完結させる。骨格検出・判定ロジックは持たない
 * (投稿用の単純な録画なので不要)。
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { X } from "lucide-react-native";
import { colors, spacing, radius, typography } from "../theme";

export type RecordedVideo = { blob: Blob; contentType: string };

type Stage = "preparing" | "ready" | "recording" | "review" | "error";

const MAX_DURATION_SEC = 120;

function pickMimeType(): string {
  const candidates = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"];
  const MR = (globalThis as { MediaRecorder?: typeof MediaRecorder }).MediaRecorder;
  if (!MR) return "";
  return candidates.find((c) => MR.isTypeSupported(c)) ?? "";
}

export default function InPageVideoRecorder({
  visible,
  onCancel,
  onDone,
}: {
  visible: boolean;
  onCancel: () => void;
  onDone: (media: RecordedVideo) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reviewUrlRef = useRef<string | null>(null);

  const [stage, setStage] = useState<Stage>("preparing");
  const [errorText, setErrorText] = useState("");
  const [elapsedSec, setElapsedSec] = useState(0);
  const [reviewBlob, setReviewBlob] = useState<RecordedVideo | null>(null);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const openCamera = useCallback(async () => {
    setStage("preparing");
    setErrorText("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 }, facingMode: "user" },
        audio: true,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play().catch(() => undefined);
      }
      setStage("ready");
    } catch (e) {
      const name = (e as { name?: string }).name;
      setErrorText(
        name === "NotAllowedError" || name === "SecurityError"
          ? "カメラ・マイクの使用が許可されていません。ブラウザのアドレスバーのカメラアイコンから許可してください。"
          : `カメラを開けませんでした(${name ?? String(e)})`
      );
      setStage("error");
    }
  }, []);

  // モーダルを開いたらカメラを起動、閉じたら後片付け
  useEffect(() => {
    if (!visible) return;
    void openCamera();
    return () => {
      clearTimer();
      stopStream();
      if (reviewUrlRef.current) {
        URL.revokeObjectURL(reviewUrlRef.current);
        reviewUrlRef.current = null;
      }
      chunksRef.current = [];
      recorderRef.current = null;
      setStage("preparing");
      setElapsedSec(0);
      setReviewBlob(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const startRecording = useCallback(() => {
    const stream = streamRef.current;
    const MR = (globalThis as { MediaRecorder?: typeof MediaRecorder }).MediaRecorder;
    if (!stream || !MR) return;
    const mimeType = pickMimeType();
    chunksRef.current = [];
    const rec = new MR(stream, mimeType ? { mimeType } : undefined);
    rec.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };
    rec.start(1000);
    recorderRef.current = rec;
    setElapsedSec(0);
    setStage("recording");
    timerRef.current = setInterval(() => {
      setElapsedSec((s) => {
        const next = s + 1;
        if (next >= MAX_DURATION_SEC) {
          // 最大時間に達したら自動で停止する(stopRecordingは参照が不安定なので直接呼ぶ)
          clearTimer();
          recorderRef.current?.stop();
        }
        return next;
      });
    }, 1000);
  }, [clearTimer]);

  const stopRecording = useCallback(() => {
    const rec = recorderRef.current;
    if (!rec || rec.state === "inactive") return;
    clearTimer();
    rec.onstop = () => {
      const type = rec.mimeType || "video/webm";
      const blob = new Blob(chunksRef.current, { type });
      chunksRef.current = [];
      recorderRef.current = null;
      stopStream();
      if (blob.size === 0) {
        setErrorText("録画データが空でした。もう一度お試しください。");
        setStage("error");
        return;
      }
      const media: RecordedVideo = { blob, contentType: type.split(";")[0] };
      setReviewBlob(media);
      const url = URL.createObjectURL(blob);
      reviewUrlRef.current = url;
      const video = videoRef.current;
      if (video) {
        video.srcObject = null;
        video.src = url;
        video.muted = false;
        video.loop = true;
        void video.play().catch(() => undefined);
      }
      setStage("review");
    };
    rec.stop();
  }, [clearTimer, stopStream]);

  const retake = useCallback(() => {
    if (reviewUrlRef.current) {
      URL.revokeObjectURL(reviewUrlRef.current);
      reviewUrlRef.current = null;
    }
    setReviewBlob(null);
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.removeAttribute("src");
      video.load();
      video.muted = true;
      video.loop = false;
    }
    void openCamera();
  }, [openCamera]);

  const confirm = useCallback(() => {
    if (!reviewBlob) return;
    onDone(reviewBlob);
  }, [reviewBlob, onDone]);

  const formatTime = (sec: number) => `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancel}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>動画を撮影</Text>
          <TouchableOpacity onPress={onCancel} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="閉じる">
            <X size={22} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        <View style={styles.videoArea}>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video ref={videoRef as any} muted={stage !== "review"} playsInline style={domFill as any} />
          {stage === "recording" && (
            <View style={styles.recTag}>
              <View style={styles.recDot} />
              <Text style={styles.recTagText}>{formatTime(elapsedSec)} / {formatTime(MAX_DURATION_SEC)}</Text>
            </View>
          )}
          {stage === "preparing" && (
            <View style={styles.centerNotice}>
              <Text style={styles.centerNoticeText}>カメラを準備しています…</Text>
            </View>
          )}
          {stage === "error" && (
            <View style={styles.centerNotice}>
              <Text style={styles.centerNoticeText}>{errorText}</Text>
            </View>
          )}
        </View>

        <View style={styles.footer}>
          {stage === "ready" && (
            <TouchableOpacity style={styles.recordBtn} onPress={startRecording} accessibilityLabel="録画開始">
              <View style={styles.recordBtnInner} />
            </TouchableOpacity>
          )}
          {stage === "recording" && (
            <TouchableOpacity style={styles.recordBtn} onPress={stopRecording} accessibilityLabel="停止">
              <View style={styles.stopBtnInner} />
            </TouchableOpacity>
          )}
          {stage === "review" && (
            <View style={styles.reviewRow}>
              <TouchableOpacity style={styles.secondaryButton} onPress={retake}>
                <Text style={styles.secondaryButtonText}>撮り直す</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryButton} onPress={confirm}>
                <Text style={styles.primaryButtonText}>この動画を使う</Text>
              </TouchableOpacity>
            </View>
          )}
          {stage === "error" && (
            <TouchableOpacity style={styles.secondaryButton} onPress={openCamera}>
              <Text style={styles.secondaryButtonText}>もう一度試す</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

const domFill: React.CSSProperties = { position: "absolute", left: 0, top: 0, width: "100%", height: "100%", objectFit: "contain" };

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.md,
    backgroundColor: colors.indigoDeep,
  },
  headerTitle: { ...typography.headingSerif, color: colors.textPrimary },
  videoArea: { flex: 1, position: "relative" },
  recTag: {
    position: "absolute",
    top: spacing.md,
    left: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(11,19,43,0.75)",
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    gap: spacing.xs,
  },
  recDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.aka },
  recTagText: { ...typography.caption, color: colors.textPrimary, fontWeight: "700" },
  centerNotice: { position: "absolute", left: spacing.lg, right: spacing.lg, top: "45%", alignItems: "center" },
  centerNoticeText: { ...typography.body, color: colors.textPrimary, textAlign: "center" },
  footer: { backgroundColor: colors.indigoDeep, paddingVertical: spacing.lg, paddingHorizontal: spacing.lg, alignItems: "center" },
  recordBtn: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 4,
    borderColor: colors.textPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  recordBtnInner: { width: 54, height: 54, borderRadius: 27, backgroundColor: colors.aka },
  stopBtnInner: { width: 26, height: 26, borderRadius: 4, backgroundColor: colors.aka },
  reviewRow: { flexDirection: "row", gap: spacing.md, alignSelf: "stretch" },
  primaryButton: { flex: 1, backgroundColor: colors.gold, paddingVertical: spacing.md, borderRadius: radius.sm, alignItems: "center" },
  primaryButtonText: { ...typography.button, color: colors.textOnGold, fontSize: 15 },
  secondaryButton: { flex: 1, borderWidth: 1, borderColor: colors.indigoLine, paddingVertical: spacing.md, borderRadius: radius.sm, alignItems: "center" },
  secondaryButtonText: { ...typography.button, color: colors.textPrimary },
});
