/**
 * Cloud Functions のエントリポイント。各関数の export のみを置く。
 * 設計は docs/design/api-functions.md を参照。
 */
import {setGlobalOptions} from "firebase-functions";

// コスト管理のための同時実行上限
setGlobalOptions({maxInstances: 10});

// AI機能② 連スタイル類似度判定
export {analyzeStyle} from "./analysis/analyzeStyle";
export {rebuildRenStyleProfile} from "./style/rebuildRenStyleProfile";
export {registerStyleReference} from "./style/registerStyleReference";
export {deleteStyleReference} from "./style/deleteStyleReference";
export {onStyleReferenceWritten} from "./style/onStyleReferenceWritten";
