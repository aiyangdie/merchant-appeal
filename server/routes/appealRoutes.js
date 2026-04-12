import express from 'express';
import appealFlowService from '../services/appealFlowService.js';
import materialService from '../services/materialService.js';
import logger from '../utils/logger.js';

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { merchantId, riskType, riskDetails, submitterName, submitterPhone, submitterEmail, appealReason, improvementMeasures } = req.body;

    if (!merchantId) {
      return res.status(400).json({
        success: false,
        error: { code: 'E001', message: '商户号不能为空' }
      });
    }

    if (!riskType) {
      return res.status(400).json({
        success: false,
        error: { code: 'E001', message: '风控类型不能为空' }
      });
    }

    if (!submitterName || !submitterPhone) {
      return res.status(400).json({
        success: false,
        error: { code: 'E001', message: '提交人姓名和电话不能为空' }
      });
    }

    const result = await appealFlowService.createAppeal({
      merchantId,
      riskType,
      riskDetails,
      submitterName,
      submitterPhone,
      submitterEmail,
      appealReason,
      improvementMeasures
    });

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: { code: 'E204', message: result.message }
      });
    }

    res.json({
      success: true,
      data: result.appeal,
      message: result.message
    });
  } catch (error) {
    logger.error('Create appeal error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'E101', message: '服务器内部错误' }
    });
  }
});

router.get('/', async (req, res) => {
  try {
    const { merchantId, status, page, pageSize } = req.query;

    const result = await appealFlowService.getAppeals({
      merchantId,
      status,
      page: parseInt(page) || 1,
      pageSize: parseInt(pageSize) || 10
    });

    res.json({
      success: true,
      data: result.list,
      pagination: result.pagination
    });
  } catch (error) {
    logger.error('Get appeals error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'E101', message: '服务器内部错误' }
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const appeal = await appealFlowService.getAppealDetails(id);

    if (!appeal) {
      return res.status(404).json({
        success: false,
        error: { code: 'E203', message: '申诉不存在' }
      });
    }

    res.json({
      success: true,
      data: appeal
    });
  } catch (error) {
    logger.error('Get appeal details error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'E101', message: '服务器内部错误' }
    });
  }
});

router.post('/:id/submit', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await appealFlowService.submitAppeal(id);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: { code: 'E204', message: result.message }
      });
    }

    res.json({
      success: true,
      data: result.appeal,
      message: result.message
    });
  } catch (error) {
    logger.error('Submit appeal error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'E101', message: '服务器内部错误' }
    });
  }
});

router.post('/:id/cancel', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await appealFlowService.cancelAppeal(id);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: { code: 'E204', message: result.message }
      });
    }

    res.json({
      success: true,
      data: result.appeal,
      message: result.message
    });
  } catch (error) {
    logger.error('Cancel appeal error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'E101', message: '服务器内部错误' }
    });
  }
});

router.get('/:appealId/materials', async (req, res) => {
  try {
    const { appealId } = req.params;

    const materials = await materialService.getMaterialsByAppeal(appealId);
    const completionRate = await materialService.calculateCompletionRate(appealId);

    const groupedMaterials = this.groupMaterialsByCategory(materials);

    res.json({
      success: true,
      data: {
        appealId,
        completionRate,
        checklist: groupedMaterials
      }
    });
  } catch (error) {
    logger.error('Get materials error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'E101', message: '服务器内部错误' }
    });
  }
});

router.post('/:appealId/materials', async (req, res) => {
  try {
    const { appealId } = req.params;
    const { riskType, merchantType } = req.query;

    const checklist = await materialService.getMaterialChecklist(riskType, merchantType);

    res.json({
      success: true,
      data: checklist
    });
  } catch (error) {
    logger.error('Generate material checklist error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'E101', message: '服务器内部错误' }
    });
  }
});

router.get('/:appealId/materials/stats', async (req, res) => {
  try {
    const { appealId } = req.params;

    const stats = await materialService.getMaterialStats(appealId);
    const completionRate = await materialService.calculateCompletionRate(appealId);

    res.json({
      success: true,
      data: {
        ...stats,
        completionRate
      }
    });
  } catch (error) {
    logger.error('Get material stats error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'E101', message: '服务器内部错误' }
    });
  }
});

router.post('/:appealId/timeline', async (req, res) => {
  try {
    const { appealId } = req.params;
    const { event, status, operator, operatorType, details } = req.body;

    const timelineService = (await import('../services/timelineService.js')).default;
    const result = await timelineService.recordEvent({
      appealId,
      event,
      status,
      operator,
      operatorType,
      details
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Create timeline event error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'E101', message: '服务器内部错误' }
    });
  }
});

router.get('/:appealId/timeline', async (req, res) => {
  try {
    const { appealId } = req.params;

    const timelineService = (await import('../services/timelineService.js')).default;
    const timeline = await timelineService.getTimelineFormatted(appealId);

    res.json({
      success: true,
      data: timeline
    });
  } catch (error) {
    logger.error('Get timeline error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'E101', message: '服务器内部错误' }
    });
  }
});

function groupMaterialsByCategory(materials) {
  const categories = {
    basic: { category: '基础信息', items: [] },
    license: { category: '证照文件', items: [] },
    business: { category: '经营证明', items: [] },
    improvement: { category: '整改材料', items: [] }
  };

  const typeToCategory = {
    'MERCHANT_ID': 'basic',
    'CONTACT_INFO': 'basic',
    'BUSINESS_LICENSE': 'license',
    'ID_CARD_FRONT': 'license',
    'ID_CARD_BACK': 'license',
    'ID_CARD_HANDHELD': 'license',
    'STORE_PHOTO': 'business',
    'LOCATION_SCREENSHOT': 'business',
    'TRANSACTION_RECEIPT': 'business',
    'IMPROVEMENT_PLAN': 'improvement',
    'COMMITMENT_LETTER': 'improvement'
  };

  for (const material of materials) {
    const catKey = typeToCategory[material.type] || 'business';
    if (categories[catKey]) {
      categories[catKey].items.push({
        id: material.id,
        type: material.type,
        name: material.name,
        required: material.required,
        status: material.status,
        fileName: material.file_name,
        uploadedAt: material.uploaded_at
      });
    }
  }

  return Object.values(categories).filter(cat => cat.items.length > 0);
}

export default router;
