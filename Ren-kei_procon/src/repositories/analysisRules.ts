/**
 * 判定ルール定義(analysisRules)へのアクセス(仕様書 7.9 / #21)。
 *
 * 閾値の正本は Firestore の analysisRules/{ruleId}。起動時(セッション開始時)に
 * 取得してメモリにキャッシュし、オフライン時・取得失敗時はアプリ内バンドルの
 * 既定値(src/features/rules/defaultRules.json)へフォールバックする。
 * Security Rules で read 専用(クライアントから write 不可)。
 */
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { db } from '../config/firebaseConfig';
import { DEFAULT_RULE_SET, RHYTHM_RULE_ID, RhythmConfig, RuleSet } from '../features/rules/definitions';
import { RuleDefinition } from '../features/rules/types';

const COLLECTION = 'analysisRules';
/** リズム設定は analysisRules/RHYTHM の rhythm フィールドに置く */
const META_DOC = RHYTHM_RULE_ID;

export type RuleSetSource = 'remote' | 'bundled';

export type LoadedRuleSet = RuleSet & {
  source: RuleSetSource;
  /** remote のとき、取得できた件数 */
  remoteCount: number;
};

let cache: LoadedRuleSet | null = null;

/** テスト・再取得用にキャッシュを捨てる。 */
export function clearRuleSetCache(): void {
  cache = null;
}

function isRuleDefinition(v: unknown): v is RuleDefinition {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.ruleId === 'string' &&
    typeof r.metric === 'string' &&
    typeof r.enabled === 'boolean' &&
    typeof r.version === 'string'
  );
}

/**
 * Firestore の定義でバンドル既定値を上書きしたルールセットを返す。
 * Firestore に無いルールは既定値のまま残す(片方だけ変えても全体が動くように)。
 * 取得に失敗したら既定値をそのまま返す(source: 'bundled')。
 */
export async function loadRuleSet(): Promise<LoadedRuleSet> {
  if (cache) return cache;
  const bundled: LoadedRuleSet = { ...DEFAULT_RULE_SET, source: 'bundled', remoteCount: 0 };
  try {
    const snap = await getDocs(collection(db, COLLECTION));
    if (snap.empty) {
      cache = bundled;
      return bundled;
    }
    const remote = new Map<string, RuleDefinition>();
    let rhythm: RhythmConfig = DEFAULT_RULE_SET.rhythm;
    let version = DEFAULT_RULE_SET.version;
    snap.forEach((d) => {
      const raw = d.data() as Record<string, unknown>;
      const rhythmField = raw.rhythm;
      if (isRuleDefinition(raw)) {
        remote.set(raw.ruleId, raw);
        // 版はルールのうち最も新しいもの(辞書順で最大)を全体の版にする
        if (raw.version > version) version = raw.version;
      }
      if (d.id === META_DOC && typeof rhythmField === 'object' && rhythmField !== null) {
        rhythm = { ...DEFAULT_RULE_SET.rhythm, ...(rhythmField as Partial<RhythmConfig>) };
      }
    });
    const rules = DEFAULT_RULE_SET.rules.map((r) => remote.get(r.ruleId) ?? r);
    for (const [id, r] of remote) {
      if (!rules.some((x) => x.ruleId === id)) rules.push(r);
    }
    cache = { version, rules, rhythm, source: 'remote', remoteCount: remote.size };
    return cache;
  } catch {
    // オフライン・権限エラー等は既定値で続行する
    cache = bundled;
    return bundled;
  }
}

/** 1 件だけ取得(管理・デバッグ用)。 */
export async function fetchRule(ruleId: string): Promise<RuleDefinition | null> {
  const snap = await getDoc(doc(db, COLLECTION, ruleId));
  const data = snap.data();
  return snap.exists() && isRuleDefinition(data) ? data : null;
}
