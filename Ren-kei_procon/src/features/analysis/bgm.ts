/**
 * 採点時に流す既定のBGM(自前で撮影した動画から抽出した音源)。
 * 採点中は CameraScreen がこれをループ再生し、採点済みの投稿を見るときは
 * useCompanionAudio が動画の再生位置に合わせて同じ音を流す。
 * 録画する動画そのものにはBGMは入らない(PoseCameraView は audio:false で撮る)。
 */
export const SCORING_BGM_URL: string = require("../../../assets/audio/bgm-awaodori.mp3");
