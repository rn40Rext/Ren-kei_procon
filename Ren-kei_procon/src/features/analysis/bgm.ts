/**
 * 採点時に流す既定のBGM(自前で撮影した動画から抽出した音源)。
 * 採点中は scoringBgm.ts がこれをループ再生し、同じ音を録画の音声トラックにも入れる。
 * そのため、採点済みの動画を再生すると、採点時と同じBGMが同じ位置で鳴る。
 */
export const SCORING_BGM_URL: string = require("../../../assets/audio/bgm-awaodori.mp3");
