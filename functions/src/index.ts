import {initializeApp} from "firebase-admin/app";
import {setGlobalOptions} from "firebase-functions";

initializeApp();

// リージョンはasia-northeast1(東京)。ユーザーは日本国内のみのため、
// クライアント↔Functions間のレイテンシを優先する
// (Firestoreはnam5だが、現状の各関数はDB操作が少なく往復増の影響は
// 小さい。docs/design/api-functions.md 6章のN-4を参照)。
// maxInstancesはコスト制御のため維持する。
setGlobalOptions({region: "asia-northeast1", maxInstances: 10});

export {publishPost} from "./community/publishPost";
export {createRen} from "./ren/createRen";
export {submitJoinRequest} from "./ren/submitJoinRequest";
export {updateJoinRequestStatus} from "./ren/updateJoinRequestStatus";
export {updateMemberRole} from "./ren/updateMemberRole";
export {removeMember} from "./ren/removeMember";
export {onLikeWrite} from "./triggers/onLikeWrite";
export {onCommentWrite} from "./triggers/onCommentWrite";
export {onMemberWrite} from "./triggers/onMemberWrite";
export {onVideoDeleted} from "./triggers/onVideoDeleted";
