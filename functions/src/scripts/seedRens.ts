/**
 * 「連を探す」画面向けのサンプル連データ投入。
 *
 *   # エミュレータへ
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 GCLOUD_PROJECT=demo-renkei \
 *     npm run seed:rens
 *   # 本番へ(要: gcloud auth application-default login 等の資格情報。実行前に承認を得る)
 *   GCLOUD_PROJECT=ren-kei npm run seed:rens
 *
 * SEED_ADMIN_UID を指定すると、そのuidを各サンプル連の管理者(role:'admin')として
 * ren/{renId}/members にも登録する。指定しない場合は連本体のみ作成され、
 * 一覧・検索・参加申請はできるが、申請を承認できる管理者がいない状態になる。
 *
 * 既に同名の連が存在する場合は再作成しない(--force で無視して常に追加)。
 */
import {getApps, initializeApp} from "firebase-admin/app";
import {FieldValue, getFirestore} from "firebase-admin/firestore";

interface SeedRen {
  name: string;
  description: string;
  location: string;
  beginnerFriendly: boolean;
  memberCount: number;
}

const SAMPLE_RENS: SeedRen[] = [
  {
    name: "阿波の風連",
    description: "徳島市を拠点に週2回稽古している中規模の連です。男踊り・女踊りどちらも募集中。",
    location: "徳島市",
    beginnerFriendly: true,
    memberCount: 24,
  },
  {
    name: "藍空連",
    description: "鳴門市の学生中心の連。初心者向けの基礎稽古から丁寧に指導します。",
    location: "鳴門市",
    beginnerFriendly: true,
    memberCount: 15,
  },
  {
    name: "眉山組",
    description: "眉山ふもとで30年以上続く伝統連。経験者を中心に本番同様の稽古を行っています。",
    location: "徳島市・眉山周辺",
    beginnerFriendly: false,
    memberCount: 41,
  },
  {
    name: "鳴り物座",
    description: "鳴り物方(締太鼓・鉦・笛)専門の連。踊り手ではなくお囃子方を探している方向け。",
    location: "小松島市",
    beginnerFriendly: true,
    memberCount: 12,
  },
  {
    name: "佐古連",
    description: "徳島市佐古を拠点にした社会人中心の連。土日夜の稽古が中心です。",
    location: "徳島市・佐古",
    beginnerFriendly: false,
    memberCount: 19,
  },
];

/**
 * サンプル連を ren コレクションへ書き込む。
 * @return {Promise<void>}
 */
async function main(): Promise<void> {
  const force = process.argv.includes("--force");
  const adminUid = process.env.SEED_ADMIN_UID;
  if (getApps().length === 0) initializeApp();
  const db = getFirestore();

  let written = 0;
  let skipped = 0;
  for (const ren of SAMPLE_RENS) {
    const existing = await db
      .collection("ren")
      .where("name", "==", ren.name)
      .limit(1)
      .get();
    if (!existing.empty && !force) {
      skipped += 1;
      continue;
    }

    const renRef = db.collection("ren").doc();
    await db.runTransaction(async (tx) => {
      tx.set(renRef, {
        name: ren.name,
        description: ren.description,
        location: ren.location,
        iconUrl: "",
        beginnerFriendly: ren.beginnerFriendly,
        memberCount: adminUid ? Math.max(ren.memberCount, 1) : ren.memberCount,
        createdBy: adminUid ?? "seed-script",
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      if (adminUid) {
        tx.set(renRef.collection("members").doc(adminUid), {
          userId: adminUid,
          role: "admin",
          status: "active",
          joinedAt: FieldValue.serverTimestamp(),
        });
      }
    });
    written += 1;
  }

  const summary = `ren: ${written} written, ${skipped} skipped` +
    (adminUid ? ` (admin: ${adminUid})` : " (no admin member created)");
  console.log(summary + (skipped > 0 ? " — 常に追加するには --force" : ""));
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
