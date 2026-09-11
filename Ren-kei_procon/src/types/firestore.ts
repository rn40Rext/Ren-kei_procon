import { Timestamp } from 'firebase/firestore';

/**
 * Firestore エンティティの型定義(docs/design/data-model.md)。
 * 画面とリポジトリで共有する。
 */

// Firestoreから読んだ日時。サーバ書き込み直後のローカルキャッシュでは
// nullになり得るため、表示側では未設定を考慮する必要がある。
export type FirestoreDate = Timestamp | null;

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
  videoUrl: string;
  score: number;
  likeCount: number;
  commentCount: number;
  tags: string[];
  createdAt?: FirestoreDate;
}

export type CommentType = 'instructor' | 'normal';

// docs/design/data-model.md 3.4章
export interface PostComment {
  id: string;
  userId: string;
  userName: string;
  text: string;
  type: CommentType;
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

export type RenMemberRole = 'member' | 'admin';
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

// 仕様書には無い1対1チャット(プロトタイプ限定機能。gap-analysis 7章のN-1)
export interface ChatMessage {
  id: string;
  text: string;
  senderId: string;
  createdAt?: FirestoreDate;
}
