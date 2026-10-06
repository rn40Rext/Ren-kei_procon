/**
 * カメラ映像 + 骨格オーバーレイ(Web 実装)。
 *
 * getUserMedia の映像を <video> に流し、<canvas> に骨格を重ねる。
 * 映像ソース(LiveVideoSource)を onSource で親へ渡し、useLiveAnalysis が
 * 毎フレーム推論・描画する。録画は MediaRecorder(webm)。
 * デモのフォールバックとして、保存済み動画ファイルを入力にすることもできる
 * (仕様書 7.2「スマートフォンのカメラ映像、または保存済み動画」)。
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Landmark, SKELETON_CONNECTIONS } from "../features/pose/types";
import { LiveVideoSource, RecordedMedia } from "../features/analysis/liveTypes";
import { MIN_VISIBILITY } from "../features/pose/normalize";
import { colors } from "../theme";
import type { PoseCameraViewProps } from "./PoseCameraView";

/** この端末でリアルタイム判定ができるか(Web版は true) */
export const POSE_CAMERA_SUPPORTED = true;

/** 映像の入力元。camera=カメラ、file=保存済みの動画ファイル */
type Mode = "camera" | "file";

/** play() の拒否・中断(AbortError / NotAllowedError)を例外にしない。 */
async function playQuietly(video: HTMLVideoElement): Promise<void> {
  try {
    await video.play();
  } catch {
    /* 背面タブ・自動再生制限。isPlaying() が再試行する */
  }
}

/** MediaRecorderで使える動画MIMEタイプをブラウザ対応状況から選ぶ(非対応ならrecordingなし) */
function pickMimeType(): string {
  const candidates = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"];
  const MR = (globalThis as { MediaRecorder?: typeof MediaRecorder }).MediaRecorder;
  if (!MR) return "";
  return candidates.find((c) => MR.isTypeSupported(c)) ?? "";
}

/** カメラ映像(またはファイル再生)を<video>に出し、骨格を<canvas>に重ねるWeb実装の本体 */
export default function PoseCameraView({ onSource, onEnded, showSkeleton = true, allowFile = true, style }: PoseCameraViewProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const fileMediaRef = useRef<RecordedMedia | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // 動画ファイルを再生するために作ったblob:URL。差し替え・カメラへ戻る・画面離脱時に解放する
  const fileUrlRef = useRef<string | null>(null);
  const setFileSrc = useCallback((video: HTMLVideoElement, blob: Blob) => {
    if (fileUrlRef.current) URL.revokeObjectURL(fileUrlRef.current);
    fileUrlRef.current = URL.createObjectURL(blob);
    video.src = fileUrlRef.current;
  }, []);
  useEffect(
    () => () => {
      if (fileUrlRef.current) URL.revokeObjectURL(fileUrlRef.current);
    },
    []
  );
  const [mode, setMode] = useState<Mode>("camera");
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [mirror, setMirror] = useState(true);

  /** 骨格オーバーレイをcanvasへ描く。主人物以外は薄く描く */
  const draw = useCallback(
    (primary: Landmark[] | null, allPoses: Landmark[][]) => {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (!canvas || !video) return;
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (!showSkeleton) return;
      const w = canvas.width;
      const h = canvas.height;
      // 主人物以外は薄く描く(複数人の警告を目で確認できるように)
      for (const pose of allPoses) {
        if (pose === primary) continue;
        drawPose(ctx, pose, w, h, "rgba(255,255,255,0.25)", "rgba(255,255,255,0.25)");
      }
      if (primary) drawPose(ctx, primary, w, h, "#00E5FF", "#D4AF37");
    },
    [showSkeleton]
  );

  /** 今のmode(camera/file)に応じたLiveVideoSourceを組み立てる */
  const buildSource = useCallback((): LiveVideoSource | null => {
    const video = videoRef.current;
    if (!video) return null;
    const isFile = mode === "file";
    return {
      frame: video,
      nowMs: () => (isFile ? video.currentTime * 1000 : performance.now()),
      isFile,
      isPlaying: () => {
        if (video.readyState < 2 || video.ended) return false;
        if (video.paused) {
          // 背面タブで中断された再生を戻す(失敗は無視。次のフレームで再試行)
          void playQuietly(video);
          return false;
        }
        return true;
      },
      draw,
      startRecording: isFile
        ? undefined
        : () => {
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
          },
      stopRecording: isFile
        ? undefined
        : () =>
            new Promise<RecordedMedia | null>((resolve) => {
              const rec = recorderRef.current;
              if (!rec || rec.state === "inactive") {
                resolve(null);
                return;
              }
              rec.onstop = () => {
                const type = rec.mimeType || "video/webm";
                const blob = new Blob(chunksRef.current, { type });
                chunksRef.current = [];
                recorderRef.current = null;
                resolve(blob.size > 0 ? { blob, contentType: type.split(";")[0] } : null);
              };
              rec.stop();
            }),
      fileMedia: isFile ? fileMediaRef.current : null,
    };
  }, [draw, mode]);

  // デモ・検証用: URL に ?demoVideo=<動画URL> があれば、その動画をソースにする
  // (ファイル選択ダイアログを使えない環境でも「保存済み動画」の導線を確認できる)
  const demoVideoUrl = useMemo(() => {
    if (typeof location === "undefined") return null;
    return new URLSearchParams(location.search).get("demoVideo");
  }, []);
  useEffect(() => {
    if (!demoVideoUrl) return;
    const video = videoRef.current;
    if (!video) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(demoVideoUrl);
        const blob = await res.blob();
        if (cancelled) return;
        fileMediaRef.current = { blob, contentType: blob.type || "video/webm" };
        setMode("file");
        setMirror(false);
        video.srcObject = null;
        setFileSrc(video, blob);
        video.loop = false;
        video.muted = true;
        // 「判定を開始」を押した瞬間に再生が始まるよう、ここでは再生しない
        // (ファイルモードではautoPlayを付けていない。念のため明示的にpauseもする)。
        // 実際の再生開始はisPlaying()が判定ループの最初のフレームで担う
        video.pause();
        onSource(buildSourceFor("file"));
      } catch (e) {
        setPermissionError(`デモ動画を読み込めませんでした(${String(e)})`);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoVideoUrl]);

  // カメラを開く
  useEffect(() => {
    if (mode !== "camera" || demoVideoUrl) return;
    let cancelled = false;
    const video = videoRef.current;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 }, facingMode: "user" },
          audio: false,
        });
        if (cancelled || !video) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        video.srcObject = stream;
        await playQuietly(video);
        setPermissionError(null);
        onSource(buildSource());
      } catch (e) {
        const name = (e as { name?: string }).name;
        setPermissionError(
          name === "NotAllowedError" || name === "SecurityError"
            ? "CAMERA_PERMISSION_DENIED"
            : `カメラを開けませんでした(${name ?? String(e)})`
        );
        onSource(null);
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      if (video) video.srcObject = null;
    };
  }, [mode, buildSource, onSource]);

  /** 「動画ファイルで試す」ボタン。隠しinput[type=file]のダイアログを開く */
  const openFile = useCallback(() => fileInputRef.current?.click(), []);

  /** ファイルが選ばれたら保存済み動画モードへ切り替える */
  const onFileChosen = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      const video = videoRef.current;
      if (!file || !video) return;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      fileMediaRef.current = { blob: file, contentType: file.type || "video/mp4" };
      setMode("file");
      setMirror(false);
      video.srcObject = null;
      setFileSrc(video, file);
      video.loop = false;
      video.muted = true;
      // 「判定を開始」を押した瞬間に再生が始まるよう、選択直後は再生しない
      // (ファイルモードではautoPlayを付けていない。念のため明示的にpauseもする)。
      // 実際の再生開始はisPlaying()が判定ループの最初のフレームで担う
      video.pause();
      onSource(buildSourceFor("file"));
      e.target.value = "";
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onSource]
  );

  // mode が変わった直後に buildSource の closure が古い mode を掴まないための版
  const buildSourceFor = useCallback(
    (m: Mode): LiveVideoSource | null => {
      const video = videoRef.current;
      if (!video) return null;
      const isFile = m === "file";
      const base = buildSource();
      if (!base) return null;
      return {
        ...base,
        nowMs: () => (isFile ? video.currentTime * 1000 : performance.now()),
        isFile,
        startRecording: isFile ? undefined : base.startRecording,
        stopRecording: isFile ? undefined : base.stopRecording,
        fileMedia: isFile ? fileMediaRef.current : null,
      };
    },
    [buildSource]
  );

  /** 動画ファイルモードからカメラモードへ戻す */
  const backToCamera = useCallback(() => {
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.removeAttribute("src");
      video.load();
    }
    fileMediaRef.current = null;
    if (fileUrlRef.current) {
      URL.revokeObjectURL(fileUrlRef.current);
      fileUrlRef.current = null;
    }
    setMirror(true);
    setMode("camera");
  }, []);

  return (
    <View style={[styles.container, style]}>
      <video
        ref={videoRef}
        // autoPlay属性は付けない(setMode→再レンダーの反映が非同期なため、
        // src設定と属性の反映タイミングが競合して、ファイル選択直後に
        // 自動再生されてしまうことがあった)。再生はすべて明示的にplay()/pause()で制御する
        muted
        playsInline
        onEnded={onEnded}
        style={{ ...domFill, objectFit: "contain", transform: mirror ? "scaleX(-1)" : undefined }}
      />
      <canvas ref={canvasRef} style={{ ...domFill, objectFit: "contain", transform: mirror ? "scaleX(-1)" : undefined, pointerEvents: "none" }} />
      {permissionError !== null && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>
            {permissionError === "CAMERA_PERMISSION_DENIED"
              ? "カメラの使用が許可されていません。ブラウザのアドレスバーのカメラアイコンから許可し、ページを再読み込みしてください。"
              : permissionError}
          </Text>
        </View>
      )}
      {allowFile && (
        <View style={styles.fileRow}>
          {mode === "camera" ? (
            <TouchableOpacity style={styles.fileButton} onPress={openFile}>
              <Text style={styles.fileButtonText}>動画ファイルで試す</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.fileButton} onPress={backToCamera}>
              <Text style={styles.fileButtonText}>カメラに戻す</Text>
            </TouchableOpacity>
          )}
          <input ref={fileInputRef} type="file" accept="video/*" onChange={onFileChosen} style={{ display: "none" }} />
        </View>
      )}
    </View>
  );
}

/** <video>と<canvas>を同じ位置・大きさで重ねるための共通スタイル */
const domFill: React.CSSProperties = {
  position: "absolute",
  left: 0,
  top: 0,
  width: "100%",
  height: "100%",
};

/** 1人分の骨格(線・関節点)をcanvasに描く。可視性の低いランドマークは描かない */
function drawPose(ctx: CanvasRenderingContext2D, pose: Landmark[], w: number, h: number, line: string, dot: string) {
  ctx.lineWidth = 3;
  ctx.strokeStyle = line;
  for (const [a, b] of SKELETON_CONNECTIONS) {
    const pa = pose[a];
    const pb = pose[b];
    if (!pa || !pb || pa.visibility < MIN_VISIBILITY || pb.visibility < MIN_VISIBILITY) continue;
    ctx.beginPath();
    ctx.moveTo(pa.x * w, pa.y * h);
    ctx.lineTo(pb.x * w, pb.y * h);
    ctx.stroke();
  }
  ctx.fillStyle = dot;
  for (const [a, b] of SKELETON_CONNECTIONS) {
    for (const idx of [a, b]) {
      const p = pose[idx];
      if (!p || p.visibility < MIN_VISIBILITY) continue;
      ctx.beginPath();
      ctx.arc(p.x * w, p.y * h, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

const styles = StyleSheet.create({
  // 黒背景で画面いっぱいに映像を出す。はみ出した部分は隠す
  container: { flex: 1, backgroundColor: "#000", overflow: "hidden" },
  // カメラを開けなかったときに画面上部に出す朱色の枠のエラー表示
  errorBox: {
    position: "absolute",
    left: 12,
    right: 12,
    top: 12,
    backgroundColor: colors.akaSoft,
    borderWidth: 1,
    borderColor: colors.aka,
    borderRadius: 10,
    padding: 12,
  },
  errorText: { color: colors.textPrimary, fontSize: 13, lineHeight: 19 },
  // 左下の「動画ファイルで試す/カメラに戻す」ボタン(半透明の黒)
  fileRow: { position: "absolute", left: 12, bottom: 12, flexDirection: "row" },
  fileButton: {
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.4)",
  },
  fileButtonText: { color: "#fff", fontSize: 12 },
});
