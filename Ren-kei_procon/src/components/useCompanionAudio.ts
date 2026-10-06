/**
 * 動画の再生に合わせて、別の音(採点時のBGMなど)を一緒に流すフック。
 * 録画した動画には音が入っていないので、再生・一時停止・シーク・終了を動画に追従させる。
 * BGMは動画の録画開始と同時に頭から流れ、ループしていたので、
 * 動画の再生位置 % BGMの長さ の位置から流せば撮ったときと同じ流れになる。
 * Web標準のAudio要素だけで鳴らす(ネイティブには無いので何もしない。CameraScreenと同じ方針)。
 *
 * ずれの抑え方(スマホは再生開始が遅れやすく、動画と音のテンポも少し違うことがある):
 *  - 音が実際に鳴り始めた(playing)時点で、動画の位置に一度合わせ直す
 *  - 動画の位置との差が HARD_SEEK_SEC を超えたら、位置を飛ばして合わせる
 *  - それより小さい差は、再生速度を数%だけ変えてなめらかに寄せる(位置を飛ばさないので音が途切れない)
 */
import { useEffect } from "react";
import { Platform } from "react-native";
import type { VideoPlayer } from "expo-video";

/** この秒数を超えてずれたら、音の位置を直接合わせ直す */
const HARD_SEEK_SEC = 0.25;
/** これ未満のずれは放っておく(測定の揺らぎ) */
const DEAD_ZONE_SEC = 0.03;
/** ずれ1秒あたりに変える再生速度の割合(0.5 = ずれ0.1秒で速度を5%変える) */
const RATE_GAIN = 0.5;
/** 速度を変える幅の上限(±)。これ以上は音程・テンポが不自然になる */
const MAX_RATE_TRIM = 0.06;
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
    const seekToExpected = () => {
      try {
        audio.currentTime = expectedPosition();
      } catch {
        // 長さが分かる前は位置を設定できないことがある。次の確認で再試行する
      }
    };
    const start = () => {
      audio.playbackRate = videoRate();
      seekToExpected();
      audio.play().catch((e) => console.warn("BGMの再生に失敗しました", e));
    };
    /** 動画との差を見て、大きければ位置を飛ばし、小さければ速度で寄せる */
    const follow = () => {
      if (audio.paused) return;
      const diff = offset();
      const base = videoRate();
      if (Math.abs(diff) > HARD_SEEK_SEC) {
        seekToExpected();
        audio.playbackRate = base;
      } else if (Math.abs(diff) > DEAD_ZONE_SEC) {
        const trim = Math.max(-MAX_RATE_TRIM, Math.min(MAX_RATE_TRIM, -diff * RATE_GAIN));
        audio.playbackRate = base * (1 + trim);
      } else {
        audio.playbackRate = base;
      }
    };

    const prevInterval = player.timeUpdateEventInterval;
    player.timeUpdateEventInterval = CHECK_INTERVAL_SEC;

    // 音が実際に鳴り始めた時点(再生開始の遅れが過ぎた後)で、動画の位置に合わせ直す
    const onAudioPlaying = () => seekToExpected();
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
