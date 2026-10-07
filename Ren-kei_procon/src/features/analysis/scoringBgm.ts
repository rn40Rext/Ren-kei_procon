/**
 * 採点中に流すBGMを、スピーカーで聞こえる音と、録画に入る音の両方として出す(Webのみ)。
 *
 * 以前は <audio> でBGMを鳴らすだけで、録画した動画には音が入らなかった。そのため、閲覧時に
 * 別にBGMを動画へ合わせて流していたが、「録画の開始」と「BGMの開始」の間の遅れが分からず、
 * どうしても少しずれて聞こえた。
 * 今は Web Audio でBGMを鳴らし、同じ音を録画の音声トラックにも流す。録画の中で音と映像の
 * 位置関係が決まるので、閲覧時の補正は要らない。
 *
 * 使い方(呼ぶ場所が決まっている):
 *  - prepareScoringBgm: 「判定を開始」を押した操作の中で呼ぶ(スマホは操作の中でしか音を出せない)
 *  - startScoringBgm:   録画を始める瞬間(PoseCameraView.startRecording)と、採点中になったとき(CameraScreen)。
 *                       何度呼んでも、鳴っていれば何もしない
 *  - stopScoringBgm:    採点が終わったとき
 *  - disposeScoringBgm: 画面を離れるとき
 *  - getScoringBgmRecordingTracks: 録画に混ぜる音声トラック(準備できていなければ空)
 */
import { Platform } from "react-native";
import { SCORING_BGM_URL } from "./bgm";

/** スピーカーで聞く音量(従来の <audio> と同じ) */
const MONITOR_VOLUME = 0.5;
/** 録画に入れる音量。見る人が再生側の音量で調整できるので、やや大きめにしておく */
const RECORD_VOLUME = 0.8;

type AudioContextCtor = typeof AudioContext;

interface BgmState {
  ctx: AudioContext;
  /** 録画へ流す出口。このストリームの音声トラックを MediaRecorder に渡す */
  dest: MediaStreamAudioDestinationNode;
  monitor: GainNode;
  record: GainNode;
  buffer: AudioBuffer | null;
  source: AudioBufferSourceNode | null;
  /** 今鳴らすべきか(音源の読み込みが終わる前に start が呼ばれた場合に使う) */
  wanted: boolean;
  /** 音源の読み込み・デコードに失敗した(その場合は <audio> で鳴らし、録画には入らない) */
  failed: boolean;
  fallback: HTMLAudioElement | null;
}

let state: BgmState | null = null;

/** 音源を読み込んでデコードする(古いSafariはPromise版が無いのでコールバック版も受ける) */
function decode(ctx: AudioContext, data: ArrayBuffer): Promise<AudioBuffer> {
  return new Promise((resolve, reject) => {
    const p = ctx.decodeAudioData(data, resolve, reject);
    if (p && typeof p.then === "function") p.then(resolve, reject);
  });
}

/** <audio> で鳴らす(Web Audioが使えないときの代わり。録画には入らない) */
function startFallback(s: BgmState) {
  const AudioCtor = (globalThis as { Audio?: typeof window.Audio }).Audio;
  if (!AudioCtor) return;
  if (!s.fallback) {
    s.fallback = new AudioCtor(SCORING_BGM_URL);
    s.fallback.loop = true;
    s.fallback.volume = MONITOR_VOLUME;
  }
  s.fallback.currentTime = 0;
  s.fallback.play().catch((e) => console.warn("BGMの再生に失敗しました", e));
}

function begin(s: BgmState) {
  if (s.source || !s.buffer) return;
  s.ctx.resume().catch(() => undefined);
  const src = s.ctx.createBufferSource();
  src.buffer = s.buffer;
  src.loop = true;
  src.connect(s.monitor);
  src.connect(s.record);
  src.start();
  s.source = src;
}

/** 音を出す準備(AudioContextの作成・音源の読み込み)。「判定を開始」を押した操作の中で呼ぶ */
export function prepareScoringBgm(): void {
  if (Platform.OS !== "web") return;
  if (state) {
    state.ctx.resume().catch(() => undefined);
    return;
  }
  const g = globalThis as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor };
  const Ctor = g.AudioContext ?? g.webkitAudioContext;
  if (!Ctor) return;
  try {
    // iPhoneのサイレントスイッチがオンでも、BGMが鳴るようにする(対応しているSafariのみ)
    const session = (navigator as { audioSession?: { type: string } }).audioSession;
    if (session) session.type = "playback";
  } catch {
    // 設定できなくても、BGMが鳴らないだけで続行できる
  }
  const ctx = new Ctor();
  ctx.resume().catch(() => undefined);
  const dest = ctx.createMediaStreamDestination();
  const monitor = ctx.createGain();
  monitor.gain.value = MONITOR_VOLUME;
  monitor.connect(ctx.destination);
  const record = ctx.createGain();
  record.gain.value = RECORD_VOLUME;
  record.connect(dest);
  const s: BgmState = { ctx, dest, monitor, record, buffer: null, source: null, wanted: false, failed: false, fallback: null };
  state = s;

  fetch(SCORING_BGM_URL)
    .then((r) => r.arrayBuffer())
    .then((data) => decode(ctx, data))
    .then((buffer) => {
      s.buffer = buffer;
      if (s.wanted && state === s) begin(s);
    })
    .catch((e) => {
      console.warn("BGMの読み込みに失敗しました。録画にはBGMが入りません", e);
      s.failed = true;
      if (s.wanted && state === s) startFallback(s);
    });
}

/** BGMを頭から鳴らす。すでに鳴っていれば何もしない */
export function startScoringBgm(): void {
  const s = state;
  if (!s) return;
  s.wanted = true;
  if (s.source || s.fallback?.paused === false) return;
  if (s.failed) startFallback(s);
  else begin(s);
}

/** BGMを止める */
export function stopScoringBgm(): void {
  const s = state;
  if (!s) return;
  s.wanted = false;
  if (s.source) {
    try {
      s.source.stop();
    } catch {
      // すでに止まっている
    }
    s.source.disconnect();
    s.source = null;
  }
  s.fallback?.pause();
}

/** 録画に混ぜる音声トラック。準備できていない・読み込みに失敗したときは空(音なしで録画する) */
export function getScoringBgmRecordingTracks(): MediaStreamTrack[] {
  if (!state || state.failed) return [];
  return state.dest.stream.getAudioTracks();
}

/** 後片付け(画面を離れるとき) */
export function disposeScoringBgm(): void {
  const s = state;
  if (!s) return;
  stopScoringBgm();
  state = null;
  s.ctx.close().catch(() => undefined);
}
