import express from 'express';
import copywritingService from '../services/copywritingService.js';
import { optionalUser } from '../middleware/auth.js';
import logger from '../utils/logger.js';

const router = express.Router();

router.get('/types', (req, res) => {
  res.json({
    success: true,
    appeal_types: copywritingService.getAppealTypes(),
  });
});

router.post('/generate', optionalUser, async (req, res) => {
  try {
    const { appeal_type, merchant_data, temperature, max_tokens } = req.body;
    if (!appeal_type) {
      return res.status(400).json({ success: false, error: '缺少 appeal_type 参数' });
    }
    if (!merchant_data) {
      return res.status(400).json({ success: false, error: '缺少 merchant_data 参数' });
    }
    const result = await copywritingService.generate(appeal_type, merchant_data, { temperature, maxTokens: max_tokens });
    res.json(result);
  } catch (error) {
    logger.error('Copywriting Generate Error', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/generate/stream', optionalUser, async (req, res) => {
  try {
    const { appeal_type, merchant_data, temperature, max_tokens } = req.body;
    if (!appeal_type) {
      return res.status(400).json({ success: false, error: '缺少 appeal_type 参数' });
    }
    if (!merchant_data) {
      return res.status(400).json({ success: false, error: '缺少 merchant_data 参数' });
    }
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    await copywritingService.generateStream(appeal_type, merchant_data, res, { temperature, maxTokens: max_tokens });
  } catch (error) {
    logger.error('Copywriting Stream Error', error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: error.message });
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
      res.end();
    }
  }
});

router.post('/refine', optionalUser, async (req, res) => {
  try {
    const { original_content, refinement_instructions, merchant_data, temperature } = req.body;
    if (!original_content || !refinement_instructions) {
      return res.status(400).json({ success: false, error: '缺少 original_content 或 refinement_instructions 参数' });
    }
    const result = await copywritingService.refine(original_content, refinement_instructions, merchant_data, { temperature });
    res.json(result);
  } catch (error) {
    logger.error('Copywriting Refine Error', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'copywriting',
    supported_types: Object.keys(copywritingService.getAppealTypes()),
  });
});

export default router;
