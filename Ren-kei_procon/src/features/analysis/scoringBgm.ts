/**
 * 採点中に流すBGMを、スピーカーで聞こえる音と、録画に入る音の両方として出す(Webのみ)。
 *
 * 以前は <audio> でBGMを鳴らすだけで、録画した動画には音が入らなかった。そのため、閲覧時に
 * 別にBGMを動画へ合わせて流していたが、「録画の開始」と「BGMの開始」の間の遅れが分からず、
 * どうしても少しずれて聞こえた。
 * 今は Web Audio でBGMを鳴らし、同じ音を録画の音声トラックにも流す。録画の中で音と映像の
 * 位置関係が決まるので、閲覧時の補正は要らない。
 *
 * 【使い回し】AudioContext と、デコードした音源は、アプリを開いている間は1つだけ使い回す。
 * 採点のたびに作って閉じると、連続で採点したときに、スマホ(特にiPhoneのSafari)で
 * 作れる数の上限や解放の遅れに当たって、音が出なくなることがある。また採点のたびに
 * 音源(約340KB)を取り直すと、電波が弱いときに失敗して無音になりうる。
 * 採点ごとに作り直すのは、録画に流す出口(MediaStreamDestination)と音量のつまみだけ。
 *
 * 使い方(呼ぶ場所が決まっている):
 *  - preloadScoringBgm: 採点画面を開いたとき。音源の取得・デコードを先に始める(操作は不要)
 *  - prepareScoringBgm: 「判定を開始」を押した操作の中で呼ぶ(スマホは操作の中でしか音を出せない)。
 *                       戻り値の札(token)を覚えておき、後片付けに渡す
 *  - startScoringBgm:   録画を始める瞬間(PoseCameraView.startRecording)と、採点中になったとき(CameraScreen)。
 *                       何度呼んでも、鳴っていれば何もしない
 *  - stopScoringBgm:    採点が終わったとき
 *  - disposeScoringBgm: 画面を離れるとき(札を渡す。AudioContextは閉じず、一時停止するだけ)。
 *                       連続で採点するとき、新しい画面の準備が古い画面の後片付けより先に済んでも、
 *                       新しい採点の音を消さないよう、札が合うときだけ片付ける
 *  - getScoringBgmRecordingTracks: 録画に混ぜる音声トラック(準備できていなければ空)
 */
import { Platform } from "react-native";
import { SCORING_BGM_URL } from "./bgm";

/** スピーカーで聞く音量(従来の <audio> と同じ) */
const MONITOR_VOLUME = 0.5;
/** 録画に入れる音量。見る人が再生側の音量で調整できるので、やや大きめにしておく */
const RECORD_VOLUME = 0.8;

type AudioContextCtor = typeof AudioContext;

/** アプリを開いている間、使い回すもの */
interface Shared {
  ctx: AudioContext;
  /** デコード済みの音源(まだ、または失敗したときは null) */
  buffer: AudioBuffer | null;
  /** 取得・デコード中の処理(無いときは null) */
  loading: Promise<void> | null;
  /** 直近の取得・デコードが失敗した */
  failed: boolean;
}

/** 採点1回ぶん */
interface Session {
  shared: Shared;
  /** この採点を準備した画面の札。後片付けで、自分の分かを確かめる */
  token: symbol;
  /** 録画へ流す出口。このストリームの音声トラックを MediaRecorder に渡す */
  dest: MediaStreamAudioDestinationNode;
  monitor: GainNode;
  record: GainNode;
  source: AudioBufferSourceNode | null;
  /** 今鳴らすべきか(音源の読み込みが終わる前に start が呼ばれた場合に使う) */
  wanted: boolean;
  /** 音源が使えない(その場合は <audio> で鳴らし、録画には入らない) */
  failed: boolean;
  fallback: HTMLAudioElement | null;
}

let shared: Shared | null = null;
let session: Session | null = null;

/** 音源を読み込んでデコードする(古いSafariはPromise版が無いのでコールバック版も受ける) */
function decode(ctx: AudioContext, data: ArrayBuffer): Promise<AudioBuffer> {
  return new Promise((resolve, reject) => {
    const p = ctx.decodeAudioData(data, resolve, reject);
    if (p && typeof p.then === "function") p.then(resolve, reject);
  });
}

/** 使い回す AudioContext を返す(まだ無い・閉じられていれば作る)。Web以外・非対応なら null */
function getShared(): Shared | null {
  if (Platform.OS !== "web") return null;
  if (shared && shared.ctx.state !== "closed") return shared;
  const g = globalThis as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor };
  const Ctor = g.AudioContext ?? g.webkitAudioContext;
  if (!Ctor) return null;
  try {
    shared = { ctx: new Ctor(), buffer: null, loading: null, failed: false };
  } catch (e) {
    console.warn("AudioContextを作れませんでした。BGMは録画に入りません", e);
    return null;
  }
  return shared;
}

/** 音源の取得・デコードを始める(済み・途中なら何もしない。失敗していれば、やり直す) */
function loadBuffer(sh: Shared): Promise<void> {
  if (sh.buffer) return Promise.resolve();
  if (sh.loading) return sh.loading;
  sh.failed = false;
  sh.loading = fetch(SCORING_BGM_URL)
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.arrayBuffer();
    })
    .then((data) => decode(sh.ctx, data))
    .then((buffer) => {
      sh.buffer = buffer;
    })
    .catch((e) => {
      console.warn("BGMの読み込みに失敗しました。次の採点でやり直します", e);
      sh.failed = true;
    })
    .finally(() => {
      sh.loading = null;
    });
  return sh.loading;
}

/** <audio> で鳴らす(Web Audioが使えないときの代わり。録画には入らない) */
function startFallback(s: Session) {
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

function begin(s: Session) {
  const { ctx, buffer } = s.shared;
  if (s.source || !buffer) return;
  // 一時停止・中断されていたら、再開する(開始は予約され、再開した時点で鳴り出す)
  if (ctx.state !== "running") {
    ctx.resume().catch((e) => console.warn("AudioContextを再開できませんでした", ctx.state, e));
  }
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  src.connect(s.monitor);
  src.connect(s.record);
  src.start();
  s.source = src;
}

/** 採点1回ぶんの後片付け(鳴らしている音を止め、つまみ・出口を外す)。AudioContext は閉じない */
function teardown(s: Session) {
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
  try {
    s.monitor.disconnect();
    s.record.disconnect();
  } catch {
    // すでに外れている
  }
}

/** 採点画面を開いたとき、音源の取得・デコードを先に始める。操作は要らない */
export function preloadScoringBgm(): void {
  const sh = getShared();
  if (sh) void loadBuffer(sh);
}

/** 音を出す準備(AudioContextの再開・採点ぶんの出口の用意)。「判定を開始」を押した操作の中で呼ぶ */
export function prepareScoringBgm(): symbol | null {
  const sh = getShared();
  if (!sh) return null;
  try {
    // iPhoneのサイレントスイッチがオンでも、BGMが鳴るようにする(対応しているSafariのみ)
    const audioSession = (navigator as { audioSession?: { type: string } }).audioSession;
    if (audioSession) audioSession.type = "playback";
  } catch {
    // 設定できなくても、BGMが鳴らないだけで続行できる
  }
  // 操作の中で再開しておく(以降の再生は、この許可で鳴らせる)
  sh.ctx.resume().catch((e) => console.warn("AudioContextを再開できませんでした", sh.ctx.state, e));

  // 前の採点の後片付けが済んでいなければ、先に済ませる
  if (session) teardown(session);

  const { ctx } = sh;
  const dest = ctx.createMediaStreamDestination();
  const monitor = ctx.createGain();
  monitor.gain.value = MONITOR_VOLUME;
  monitor.connect(ctx.destination);
  const record = ctx.createGain();
  record.gain.value = RECORD_VOLUME;
  record.connect(dest);
  const token = Symbol("scoringBgm");
  const s: Session = { shared: sh, token, dest, monitor, record, source: null, wanted: false, failed: false, fallback: null };
  session = s;

  // 音源が未取得なら、ここで取得を始め(または、先に始めた取得を待ち)、できた時点で鳴らすべきなら鳴らす
  if (!sh.buffer) {
    void loadBuffer(sh).then(() => {
      if (session !== s) return;
      if (sh.buffer) {
        if (s.wanted) begin(s);
      } else {
        s.failed = true;
        if (s.wanted) startFallback(s);
      }
    });
  }
  return token;
}

/** BGMを頭から鳴らす。すでに鳴っていれば何もしない */
export function startScoringBgm(): void {
  const s = session;
  if (!s) return;
  s.wanted = true;
  if (s.source || s.fallback?.paused === false) return;
  if (s.failed) startFallback(s);
  else begin(s);
}

/** BGMを止める */
export function stopScoringBgm(): void {
  const s = session;
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

/** 録画に混ぜる音声トラック。準備できていない・音源が使えないときは空(音なしで録画する) */
export function getScoringBgmRecordingTracks(): MediaStreamTrack[] {
  if (!session || session.failed) return [];
  return session.dest.stream.getAudioTracks();
}

/** 後片付け(画面を離れるとき)。AudioContext は閉じず、一時停止して次の採点に使い回す */
export function disposeScoringBgm(token: symbol | null): void {
  const s = session;
  // 準備していない画面や、すでに新しい採点に置き換わっているときは、何もしない
  if (!s || token === null || s.token !== token) return;
  teardown(s);
  session = null;
  s.shared.ctx.suspend().catch(() => undefined);
}
