/**
 * Schema verification utility. Run with: npx ts-node src/scripts/introspect.ts
 *
 * Confirms the real field names on the BetSwirl subgraph before we trust the
 * data layer, and discovers the Store address. Requires GRAPH_API_KEY in .env.
 */
import { gql, listStores } from '../api/graph';

interface TypeRef {
  name: string | null;
  kind: string;
  ofType: TypeRef | null;
}

interface FieldInfo {
  name: string;
  type: TypeRef;
}

interface TypeInfo {
  name: string;
  kind: string;
  fields: FieldInfo[] | null;
}

function typeName(t: TypeRef | null): string {
  if (!t) return '';
  if (t.name) return t.name;
  return typeName(t.ofType);
}

async function main() {
  const introspection = await gql<{ __schema: { types: TypeInfo[] } }>(`
    {
      __schema {
        types {
          name
          kind
          fields { name type { name kind ofType { name kind ofType { name kind } } } }
        }
      }
    }
  `);

  const targets = [
    'Store',
    'GameTokenDayData',
    'DiceBet',
    'CoinTossBet',
    'RouletteBet',
    'KenoBet',
    'RussianRouletteBet',
    'GameToken',
    'Token',
  ];

  for (const target of targets) {
    const t = introspection.__schema.types.find((x) => x.name === target);
    if (!t) {
      console.log(`\n### ${target}: NOT FOUND in schema`);
      continue;
    }
    console.log(`\n### ${target} (${t.kind})`);
    for (const f of t.fields ?? []) {
      console.log(`  - ${f.name}: ${typeName(f.type)}`);
    }
  }

  console.log('\n### Stores (discover CASINO_STORE_ADDRESS):');
  const stores = await listStores();
  for (const s of stores) {
    console.log(
      `  - id=${s.id} bets=${s.totalBetAmount} payouts=${s.totalPayoutAmount} count=${s.totalBetCount}`
    );
  }
}

main().catch((err) => {
  console.error('Introspection failed:', err.message);
  process.exit(1);
});
