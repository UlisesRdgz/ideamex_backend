import { Router } from 'express';
const router = Router();

router.get('/status', (req, res) => {
  res.json({ message: 'API is up and running!' });
});

export default router;
