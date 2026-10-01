/**
 * InPageVideoRecorder のネイティブ向けフォールバック。
 *
 * getUserMedia + MediaRecorder はWeb専用のため、ネイティブでは常にキャンセル
 * 扱いにする(呼び出し側のHomeScreenは、ネイティブでは従来どおり
 * expo-image-picker の launchCameraAsync を使うため、実際には描画されない想定)。
 */
import React, { useEffect } from "react";
import type { RecordedVideo } from "./InPageVideoRecorder.web";

export type { RecordedVideo };

export default function InPageVideoRecorder({
  visible,
  onCancel,
}: {
  visible: boolean;
  onCancel: () => void;
  onDone: (media: RecordedVideo) => void;
}) {
  useEffect(() => {
    if (visible) onCancel();
  }, [visible, onCancel]);
  return null;
}
