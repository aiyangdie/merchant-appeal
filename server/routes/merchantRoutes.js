import express from 'express';
import merchantDiagnosisService from '../services/merchantDiagnosisService.js';
import logger from '../utils/logger.js';

const router = express.Router();

router.post('/diagnose', async (req, res) => {
  try {
    const { merchantId } = req.body;

    if (!merchantId) {
      return res.status(400).json({
        success: false,
        error: { code: 'E001', message: '商户号不能为空' }
      });
    }

    const result = await merchantDiagnosisService.diagnose(merchantId);

    if (!result.isValid) {
      return res.status(400).json({
        success: false,
        error: { code: 'E201', message: result.errorMessage }
      });
    }

    res.json({
      success: true,
      data: result,
      message: '诊断成功'
    });
  } catch (error) {
    logger.error('Merchant diagnose error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'E101', message: '服务器内部错误' }
    });
  }
});

router.get('/:merchantId', async (req, res) => {
  try {
    const { merchantId } = req.params;

    const result = await merchantDiagnosisService.getMerchantDetails(merchantId);

    if (!result) {
      return res.status(404).json({
        success: false,
        error: { code: 'E201', message: '商户号不存在' }
      });
    }

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Get merchant details error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'E101', message: '服务器内部错误' }
    });
  }
});

router.put('/:merchantId', async (req, res) => {
  try {
    const { merchantId } = req.params;
    const updateData = req.body;

    const result = await merchantDiagnosisService.updateMerchant(merchantId, updateData);

    res.json({
      success: true,
      data: result,
      message: '更新成功'
    });
  } catch (error) {
    logger.error('Update merchant error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'E101', message: error.message || '服务器内部错误' }
    });
  }
});

export default router;
