import { Router } from 'express';
import { getPublicSitemap } from '../../presentation/controllers/publicSitemapController';

const router = Router();

router.get('/', getPublicSitemap);

export default router;
