/**
 * 動画の再生に合わせて、別の音(採点時のBGMなど)を一緒に流すフック。
 * 録画した動画には音が入っていないので、再生・一時停止・シーク・終了を動画に追従させる。
 * BGMは動画の録画開始と同時に頭から流れ、ループしていたので、
 * 動画の再生位置 % BGMの長さ の位置から流せば撮ったときと同じ流れになる。
 * Web標準のAudio要素だけで鳴らす(ネイティブには無いので何もしない。CameraScreenと同じ方針)。
 *
 * ずれの抑え方(スマホは再生開始が遅れやすく、動画と音のテンポも少し違うことがある):
 *  - 再生を始めて音が実際に鳴り始めた(playing)時点で、動画の位置に一度だけ合わせ直す
 *  - 動画の位置との差が HARD_SEEK_SEC を超えたら、位置を飛ばして合わせる(連続して飛ばさないよう間隔を空ける)
 *  - それより小さい差は、再生速度を数%だけ変えてなめらかに寄せる(位置を飛ばさないので音が途切れない)
 *
 * 位置を飛ばすと、音は読み込み待ち(waiting)のあと再び playing を出す。
 * playing のたびに位置を飛ばし直すと、飛ばしが際限なく続いて音がとぎれとぎれになるので、
 * 「再生開始の直後の1回」と「飛ばしの間隔」で必ず止まるようにしている。
 */
import { useEffect } from "react";
import { Platform } from "react-native";
import type { VideoPlayer } from "expo-video";

/** この秒数を超えてずれたら、音の位置を直接合わせ直す */
const HARD_SEEK_SEC = 0.25;
/** 位置を飛ばす間隔の下限[ms]。飛ばした直後の読み込み待ちで、またずれて見えるのを避ける */
const HARD_SEEK_COOLDOWN_MS = 1500;
/** 鳴り始めに合わせ直すのは、これ(秒)以上ずれているときだけ */
const START_RESYNC_MIN_SEC = 0.08;
/** これ未満のずれは放っておく(測定の揺らぎ) */
const DEAD_ZONE_SEC = 0.04;
/** ずれ1秒あたりに変える再生速度の割合(0.5 = ずれ0.1秒で速度を5%変える) */
const RATE_GAIN = 0.5;
/** 速度を変える幅の上限(±)。これ以上は音程・テンポが不自然になる */
const MAX_RATE_TRIM = 0.04;
const BGM_VOLUME = 0.5;
/** 動画との差を調べる間隔[秒] */
const CHECK_INTERVAL_SEC = 0.25;

export default function useCompanionAudio(player: VideoPlayer, uri: string | undefined): void {
  useEffect(() => {
    if (!uri || Platform.OS !== "web") return;
    const AudioCtor = (globalThis as { Audio?: typeof window.Audio }).Audio;
    if (!AudioCtor) return;

    const audio = new AudioCtor(uri);
    audio.loop = true;
    audio.volume = BGM_VOLUME;
    audio.preload = "auto";

    const videoRate = () => (player.playbackRate > 0 ? player.playbackRate : 1);

    /** 動画の今の位置に対応する、音の中の位置[秒] */
    const expectedPosition = (): number => {
      const t = player.currentTime;
      const d = audio.duration;
      return Number.isFinite(d) && d > 0 ? t % d : t;
    };
    /** 音の位置 − 動画に対応する位置[秒]。プラスなら音が先走っている。ループの継ぎ目をまたぐずれは短いほうで測る */
    const offset = (): number => {
      let diff = audio.currentTime - expectedPosition();
      const d = audio.duration;
      if (Number.isFinite(d) && d > 0) {
        if (diff > d / 2) diff -= d;
        else if (diff < -d / 2) diff += d;
      }
      return diff;
    };
    /** 再生開始から、鳴り始めの合わせ直しをまだしていないか / 最後に位置を飛ばした時刻 */
    let resyncPending = false;
    let lastSeekAt = 0;
    const seekToExpected = () => {
      lastSeekAt = Date.now();
      try {
        audio.currentTime = expectedPosition();
      } catch {
        // 長さが分かる前は位置を設定できないことがある。次の確認で再試行する
      }
    };
    const start = () => {
      audio.playbackRate = videoRate();
      resyncPending = true;
      seekToExpected();
      audio.play().catch((e) => console.warn("BGMの再生に失敗しました", e));
    };
    /** 再生速度は、ほとんど変わらないなら設定しない(設定のたびに音が揺れるのを避ける) */
    const setRate = (rate: number) => {
      if (Math.abs(audio.playbackRate - rate) > 0.005) audio.playbackRate = rate;
    };
    /** 動画との差を見て、大きければ位置を飛ばし、小さければ速度で寄せる */
    const follow = () => {
      // 位置を飛ばしている最中や、飛ばした直後は測り直さない(読み込み待ちのずれを拾ってしまう)
      if (audio.paused || audio.seeking || Date.now() - lastSeekAt < HARD_SEEK_COOLDOWN_MS) return;
      const diff = offset();
      const base = videoRate();
      if (Math.abs(diff) > HARD_SEEK_SEC) {
        seekToExpected();
        setRate(base);
      } else if (Math.abs(diff) > DEAD_ZONE_SEC) {
        const trim = Math.max(-MAX_RATE_TRIM, Math.min(MAX_RATE_TRIM, -diff * RATE_GAIN));
        setRate(base * (1 + trim));
      } else {
        setRate(base);
      }
    };

    const prevInterval = player.timeUpdateEventInterval;
    player.timeUpdateEventInterval = CHECK_INTERVAL_SEC;

    // 音が実際に鳴り始めた時点(再生開始の遅れが過ぎた後)で、動画の位置に一度だけ合わせ直す。
    // 位置を飛ばした後にも playing は出るので、再生開始ごとの1回に限る
    const onAudioPlaying = () => {
      if (!resyncPending) return;
      resyncPending = false;
      if (Math.abs(offset()) > START_RESYNC_MIN_SEC) seekToExpected();
    };
    audio.addEventListener("playing", onAudioPlaying);

    const subs = [
      player.addListener("playingChange", ({ isPlaying }) => {
        if (isPlaying) start();
        else audio.pause();
      }),
      player.addListener("playToEnd", () => audio.pause()),
      player.addListener("timeUpdate", follow),
    ];
    if (player.playing) start();

    return () => {
      subs.forEach((s) => s.remove());
      audio.removeEventListener("playing", onAudioPlaying);
      player.timeUpdateEventInterval = prevInterval;
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    };
  }, [player, uri]);
}
