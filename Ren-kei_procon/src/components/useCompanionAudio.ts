/**
 * 動画の再生に合わせて、別の音(採点時のBGMなど)を一緒に流すフック。
 * 録画した動画には音が入っていないので、再生・一時停止・シーク・終了を動画に追従させる。
 * BGMは動画の録画開始と同時に頭から流れ、ループしていたので、
 * 動画の再生位置 % BGMの長さ の位置から流せば撮ったときと同じ流れになる。
 * Web標準のAudio要素だけで鳴らす(ネイティブには無いので何もしない。CameraScreenと同じ方針)。
 */
import { useEffect } from "react";
import { Platform } from "react-native";
import type { VideoPlayer } from "expo-video";

/** 動画とのずれがこれ(秒)を超えたら音の位置を合わせ直す */
const MAX_DRIFT_SEC = 0.6;
const BGM_VOLUME = 0.5;

export default function useCompanionAudio(player: VideoPlayer, uri: string | undefined): void {
  useEffect(() => {
    if (!uri || Platform.OS !== "web") return;
    const AudioCtor = (globalThis as { Audio?: typeof window.Audio }).Audio;
    if (!AudioCtor) return;

    const audio = new AudioCtor(uri);
    audio.loop = true;
    audio.volume = BGM_VOLUME;
    audio.preload = "auto";

    /** 動画の今の位置に対応する、音の中の位置[秒] */
    const expectedPosition = (): number => {
      const t = player.currentTime;
      const d = audio.duration;
      return Number.isFinite(d) && d > 0 ? t % d : t;
    };
    const start = () => {
      try {
        audio.currentTime = expectedPosition();
      } catch {
        // 長さが分かる前は位置を設定できないことがある。頭から流して、次のtimeUpdateで合わせる
      }
      audio.play().catch((e) => console.warn("BGMの再生に失敗しました", e));
    };

    const prevInterval = player.timeUpdateEventInterval;
    player.timeUpdateEventInterval = 0.5;

    const subs = [
      player.addListener("playingChange", ({ isPlaying }) => {
        if (isPlaying) start();
        else audio.pause();
      }),
      player.addListener("playToEnd", () => audio.pause()),
      // 再生中にシークされた・音がずれたときの合わせ直し。ループの継ぎ目(0秒付近と末尾付近)は差とみなさない
      player.addListener("timeUpdate", () => {
        if (audio.paused) return;
        const d = audio.duration;
        const diff = Math.abs(audio.currentTime - expectedPosition());
        const wrapped = Number.isFinite(d) ? Math.min(diff, d - diff) : diff;
        if (wrapped > MAX_DRIFT_SEC) {
          try {
            audio.currentTime = expectedPosition();
          } catch {
            // 設定できなければ次の更新で再試行する
          }
        }
      }),
    ];
    if (player.playing) start();

    return () => {
      subs.forEach((s) => s.remove());
      player.timeUpdateEventInterval = prevInterval;
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    };
  }, [player, uri]);
}
