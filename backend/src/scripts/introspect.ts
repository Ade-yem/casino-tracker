/**
 * Schema verification utility. Run with:
 *   cd backend && npx ts-node src/scripts/introspect.ts
 *
 * Confirms actual entity names, field names, and discovers Bank/Store address.
 * Requires GRAPH_API_KEY in backend/.env.
 */
import { rawGql, introspectQueryType, fetchAllBets } from '../adapters/graph';

interface FieldInfo {
  name: string;
  type: { name: string | null; kind: string; ofType: { name: string | null } | null };
}
interface TypeInfo { name: string; kind: string; fields: FieldInfo[] | null }

function typeName(t: FieldInfo['type'] | null): string {
  if (!t) return '';
  return t.name ?? typeName(t.ofType as FieldInfo['type']) ?? '';
}

async function main() {
  console.log('=== Top-level query fields ===');
  const fields = await introspectQueryType("base");
  console.log(fields.join(', '));

  console.log('\n=== Schema for key entities ===');
  const targets = ['Bet', 'GameToken', 'GameTokenDayData', 'Token', 'Casino', 'Bank', 'Store'];
  const schema = await rawGql<{ __schema: { types: TypeInfo[] } }>(`
    {
      __schema {
        types {
          name kind
          fields { name type { name kind ofType { name kind } } }
        }
      }
    }
  `, {}, "base");
  for (const target of targets) {
    const t = schema.__schema.types.find(x => x.name === target);
    if (!t) { console.log(`\n### ${target}: NOT IN SCHEMA`); continue; }
    console.log(`\n### ${target}`);
    for (const f of t.fields ?? []) {
      console.log(`  ${f.name}: ${typeName(f.type)}`);
    }
  }

  console.log('\n=== Sample bets (last 24h) ===');
  const now = Math.floor(Date.now() / 1000);
  const bets = await fetchAllBets(now - 86400, now);
  console.log(`Fetched ${bets.length} resolved bets in the last 24 hours`);
  if (bets.length > 0) {
    const b = bets[0];
    console.log('First bet:', JSON.stringify(b, null, 2));
  }
}

main().catch(err => { console.error('Introspection failed:', err.message); process.exit(1); });
