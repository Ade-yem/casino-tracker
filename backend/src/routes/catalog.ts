import { Router } from 'express';
import { CASINOS } from '../registry/casinos.js';
import { CHAINS } from '../registry/chains.js';

const router = Router();

/**
 * GET /api/catalog
 * Returns all registered casino+chain combinations with their metadata.
 * Used by the frontend CasinoSelector to populate the dropdown.
 */
router.get('/', (_req, res) => {
  const entries = Object.values(CASINOS).flatMap((casino) =>
    Object.entries(casino.chains).map(([chainId, chainCfg]) => {
      const chainMeta = CHAINS[chainId];
      return {
        casinoId: casino.id,
        casinoName: casino.name,
        casinoUrl: casino.url,
        chainId,
        chainName: chainMeta?.name ?? chainId,
        sources: chainCfg.sources,
      };
    })
  );
  res.json(entries);
});

export default router;
