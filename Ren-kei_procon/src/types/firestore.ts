import { Timestamp } from 'firebase/firestore';

/**
 * Firestore エンティティの型定義(docs/design/data-model.md)。
 * 画面とリポジトリで共有する。
 */

// Firestoreから読んだ日時。サーバ書き込み直後のローカルキャッシュでは
// nullになり得るため、表示側では未設定を考慮する必要がある。
export type FirestoreDate = Timestamp | null;

/** 踊りの種類(男踊り/女踊り)。未設定なら null */
export type DanceStyle = 'male' | 'female' | null;

// 仕様書2.2。ren_adminは「連管理者のロールを持ち得る」という印でしかなく、
// 特定の連の管理権限はren/{renId}/members/{uid}.roleで判定する(仕様書10.3)。
export type UserRole = 'user' | 'ren_admin';

// docs/design/data-model.md 3.1章
export interface UserProfile {
  uid: string;
  name: string;
  nickname?: string;
  mail?: string;
  icon?: string;
  profile?: string;
  danceStyle?: DanceStyle;
  role?: UserRole;
  createdAt?: FirestoreDate;
  updatedAt?: FirestoreDate;
}

// docs/design/data-model.md 3.3章
export interface Post {
  id: string;
  userId: string;
  authorName: string;
  title: string;
  description?: string;
  videoUrl: string;
  // AI採点(analysisResults.totalScore)の非正規化コピー。採点していない投稿には無い
  // (以前の乱数モックは廃止。#58)
  score?: number;
  // 練習動画(videos)から投稿した場合の元動画
  videoId?: string;
  // 師匠からのチャレンジへの挑戦として投稿した場合のお題(challenges/{id})。
  // 付いている投稿は交流広場には出さず、チャレンジ詳細の「挑戦した人の演舞」にだけ出す
  challengeId?: string;
  likeCount: number;
  commentCount: number;
  tags: string[];
  createdAt?: FirestoreDate;
}

/** コメントの種類(指導者からの指導コメント/通常のコメント) */
export type CommentType = 'instructor' | 'normal';

// docs/design/data-model.md 3.4章
export interface PostComment {
  id: string;
  userId: string;
  userName: string;
  text: string;
  type: CommentType;
  // type:'instructor'の場合のみ設定。「どの連の管理者としての発言か」を
  // 記録する(#31)。type:'normal'では無い
  renId?: string;
  createdAt?: FirestoreDate;
}

// docs/design/data-model.md 3.8章
export interface Ren {
  id: string;
  name: string;
  description: string;
  location: string;
  beginnerFriendly: boolean;
  memberCount: number;
  iconUrl?: string;
  createdBy?: string;
  createdAt?: FirestoreDate;
  updatedAt?: FirestoreDate;
}

/** 連の中での役割(メンバー/管理者) */
export type RenMemberRole = 'member' | 'admin';
/** 連への所属の状態(所属中/脱退済み) */
export type RenMemberStatus = 'active' | 'left';

// docs/design/data-model.md 3.9章
export interface RenMember {
  uid: string;
  userId: string;
  role: RenMemberRole;
  status: RenMemberStatus;
  joinedAt?: FirestoreDate;
}

// docs/design/data-model.md 3.11章(仕様書9.3 RenActivities)
export interface RenActivity {
  id: string;
  title: string;
  description?: string;
  startAt: FirestoreDate;
  endAt?: FirestoreDate;
  location?: string;
}

// docs/design/data-model.md 3.11章(仕様書9.3 Announcements)
export interface Announcement {
  id: string;
  title: string;
  content: string;
  createdAt?: FirestoreDate;
}

// docs/design/challenges.md(師匠からのチャレンジ。仕様書v0.3には無い追加機能)
/** チャレンジの踊りの種類 / 難易度(保存値。表示名は repositories/challenges.ts の LABEL で引く) */
export type ChallengeCategory = 'male' | 'female' | 'narimono';
export type ChallengeDifficulty = 'beginner' | 'intermediate' | 'advanced';

/** お題に添えるコツ1件(見出しと説明) */
export interface ChallengeAdviceItem {
  point: string;
  detail: string;
}

/** challenges/{challengeId}。連の管理者が自連の名義で出すお題 */
export interface ChallengeDoc {
  id: string;
  /** 出題した連(この連の管理者だけが作成・削除できる) */
  renId: string;
  renName: string;
  /** 出題者のuidと表示名・肩書き(肩書きは任意入力。例: 指導方・踊り歴20年) */
  createdBy: string;
  posterName: string;
  posterRole: string;
  title: string;
  /** 対象の型・所作(例: 女踊り・千鳥足) */
  move: string;
  category: ChallengeCategory;
  difficulty: ChallengeDifficulty;
  /** 師匠が見てほしいところ */
  focus: string;
  advice: ChallengeAdviceItem[];
  /** お手本動画(任意)。videoPathはStorage上の場所(削除用) */
  videoUrl?: string;
  videoPath?: string;
  createdAt?: FirestoreDate;
  updatedAt?: FirestoreDate;
}

/** 参加申請の状態(審査待ち/承認/却下/取り下げ) */
export type JoinRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

// docs/design/data-model.md 3.10章
export interface JoinRequest {
  id: string;
  userId: string;
  renId: string;
  message: string;
  status: JoinRequestStatus;
  createdAt?: FirestoreDate;
}

/** 通知の種類。種類によって referenceId が指すものが変わる */
export type NotificationType =
  | 'comment'
  | 'join_result'
  | 'announcement'
  | 'join_request'
  | 'member_removed'
  | 'role_changed'
  | 'member_joined'
  | 'invitation_result'
  | 'chat_message';

// docs/design/data-model.md 3.13章(仕様書9.3 Notifications)。
// referenceIdはtypeに応じてpostId/requestId/announcementId/renId/invitationId/
// chatIdのいずれか(#43、typeごとの対応はNotificationsScreen.tsxを参照)。
export interface AppNotification {
  id: string;
  userId: string;
  type: NotificationType;
  referenceId?: string;
  title: string;
  body: string;
  read: boolean;
  createdAt?: FirestoreDate;
}

// 仕様書には無い1対1チャット(プロトタイプ限定機能。gap-analysis 7章のN-1)
export interface ChatMessage {
  id: string;
  text: string;
  senderId: string;
  createdAt?: FirestoreDate;
}
