import { Router } from 'express';
import { CASINOS } from '../registry/casinos.js';
import { CHAINS } from '../registry/chains.js';

const router = Router();

const DEPRECATION_NOTES: Record<string, string> = {
  'polymarket/polygon': 'Subgraph deprecated 2026-04-28 (new CTF Exchange). Historical data only.',
};

/**
 * GET /api/catalog
 * Returns all registered casino+chain combinations with metadata.
 * Used by the frontend CasinoSelector.
 */
router.get('/', (_req, res) => {
  const entries = Object.values(CASINOS).flatMap((casino) =>
    Object.entries(casino.chains).map(([chainId, chainCfg]) => {
      const chainMeta = CHAINS[chainId];
      const key = `${casino.id}/${chainId}`;
      return {
        casinoId:    casino.id,
        casinoName:  casino.name,
        casinoUrl:   casino.url,
        chainId,
        chainName:   chainMeta?.name ?? chainId,
        sources:     chainCfg.sources,
        note:        DEPRECATION_NOTES[key] ?? null,
      };
    })
  );
  res.json(entries);
});

export default router;
