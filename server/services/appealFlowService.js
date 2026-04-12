import newAppealModel from '../models/NewAppeal.js';
import merchantModel from '../models/Merchant.js';
import materialModel from '../models/Material.js';
import timelineModel from '../models/Timeline.js';
import materialService from './materialService.js';
import logger from '../utils/logger.js';

export class AppealFlowService {
  constructor() {
    this.logger = logger;
  }

  async createAppeal(dto) {
    this.logger.info('Creating appeal', dto);

    let merchant = await merchantModel.findByMerchantId(dto.merchantId);
    if (!merchant) {
      return {
        success: false,
        message: '商户号不存在，请先进行诊断'
      };
    }

    const existingAppeal = await newAppealModel.findActiveByMerchantId(merchant.id);
    if (existingAppeal) {
      return {
        success: false,
        message: `该商户号存在进行中的申诉（ID: ${existingAppeal.id}），请先处理`
      };
    }

    const appeal = await newAppealModel.create({
      merchant_id: merchant.id,
      risk_type: dto.riskType,
      risk_details: dto.riskDetails || '',
      status: 'preparing',
      progress: 0,
      submitter_name: dto.submitterName,
      submitter_phone: dto.submitterPhone,
      submitter_email: dto.submitterEmail || '',
      appeal_reason: dto.appealReason || '',
      improvement_measures: dto.improvementMeasures || ''
    });

    await materialService.generateMaterialChecklist(appeal.id, dto.riskType, merchant.merchant_type);

    await timelineModel.create({
      appeal_id: appeal.id,
      event: '创建申诉',
      status: 'success',
      operator_type: 'user',
      details: { riskType: dto.riskType }
    });

    this.logger.info(`Appeal created successfully: ${appeal.id}`);

    return {
      success: true,
      appeal: {
        id: appeal.id,
        merchantId: dto.merchantId,
        status: 'preparing',
        progress: 0,
        createdAt: appeal.created_at
      },
      message: '申诉创建成功，请按照材料清单准备申诉材料',
      nextSteps: [
        '查看材料清单',
        '上传必需材料',
        '确认材料完整后提交'
      ]
    };
  }

  async submitAppeal(appealId) {
    this.logger.info(`Submitting appeal: ${appealId}`);

    const appeal = await newAppealModel.findById(appealId);
    if (!appeal) {
      return { success: false, message: '申诉不存在' };
    }

    if (appeal.status !== 'preparing') {
      return { success: false, message: '当前状态不允许提交' };
    }

    const materials = await materialModel.findByAppealId(appealId);
    const completionRate = await this.calculateCompletionRate(materials);

    if (completionRate < 100) {
      return {
        success: false,
        message: `材料完整度不足，当前为${completionRate}%，请完善材料后提交`,
        nextSteps: ['补充缺失材料']
      };
    }

    const now = new Date().toISOString();
    await newAppealModel.update(appealId, {
      status: 'submitted',
      progress: 30,
      submitted_at: now
    });

    await timelineModel.create({
      appeal_id: appealId,
      event: '提交申诉',
      status: 'submitted',
      operator_type: 'user',
      details: { submittedAt: now }
    });

    this.logger.info(`Appeal submitted successfully: ${appealId}`);

    return {
      success: true,
      appeal: {
        id: appealId,
        status: 'submitted',
        progress: 30,
        submittedAt: now
      },
      message: '申诉提交成功，预计1-7个工作日内完成审核',
      nextSteps: [
        '等待审核',
        '可通过公众号查看进度',
        '如有需要会通知补充材料'
      ]
    };
  }

  async cancelAppeal(appealId) {
    const appeal = await newAppealModel.findById(appealId);
    if (!appeal) {
      return { success: false, message: '申诉不存在' };
    }

    if (['approved', 'rejected', 'cancelled'].includes(appeal.status)) {
      return { success: false, message: '当前状态不允许取消' };
    }

    await newAppealModel.update(appealId, {
      status: 'cancelled'
    });

    await timelineModel.create({
      appeal_id: appealId,
      event: '取消申诉',
      status: 'cancelled',
      operator_type: 'user'
    });

    return {
      success: true,
      appeal: {
        id: appealId,
        status: 'cancelled'
      },
      message: '申诉已取消'
    };
  }

  async getAppealDetails(appealId) {
    const appeal = await newAppealModel.findById(appealId);
    if (!appeal) {
      return null;
    }

    const merchant = await merchantModel.findById(appeal.merchant_id);
    const materials = await materialModel.findByAppealId(appealId);
    const timeline = await timelineModel.findByAppealId(appealId);

    const completionRate = await this.calculateCompletionRate(materials);

    return {
      id: appeal.id,
      merchantId: merchant?.merchant_id || '',
      merchant: {
        name: merchant?.name || '',
        merchantType: merchant?.merchant_type || ''
      },
      riskType: appeal.risk_type,
      riskDetails: appeal.risk_details,
      status: appeal.status,
      progress: appeal.progress,
      submitterName: appeal.submitter_name,
      submitterPhone: appeal.submitter_phone,
      submitterEmail: appeal.submitter_email,
      appealReason: appeal.appeal_reason,
      improvementMeasures: appeal.improvement_measures,
      submittedAt: appeal.submitted_at,
      reviewedAt: appeal.reviewed_at,
      completedAt: appeal.completed_at,
      reviewerName: appeal.reviewer_name,
      reviewerNotes: appeal.reviewer_notes,
      materials: materials.map(m => ({
        id: m.id,
        type: m.type,
        name: m.name,
        required: m.required,
        status: m.status,
        fileName: m.file_name,
        uploadedAt: m.uploaded_at
      })),
      timeline: timeline.map(t => ({
        id: t.id,
        event: t.event,
        status: t.status,
        operator: t.operator,
        operatorType: t.operator_type,
        details: t.details,
        timestamp: t.timestamp
      })),
      completionRate
    };
  }

  async getAppeals(filters = {}) {
    const page = filters.page || 1;
    const pageSize = filters.pageSize || 10;
    const offset = (page - 1) * pageSize;

    const appeals = await newAppealModel.findAll({
      ...filters,
      limit: pageSize,
      offset
    });

    const total = await newAppealModel.count(filters);

    const enrichedAppeals = await Promise.all(
      appeals.map(async appeal => {
        const merchant = await merchantModel.findById(appeal.merchant_id);
        return {
          id: appeal.id,
          merchantId: merchant?.merchant_id || '',
          merchantName: merchant?.name || '',
          riskType: appeal.risk_type,
          status: appeal.status,
          progress: appeal.progress,
          submittedAt: appeal.submitted_at,
          createdAt: appeal.created_at
        };
      })
    );

    return {
      list: enrichedAppeals,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    };
  }

  async calculateCompletionRate(materials) {
    if (materials.length === 0) return 0;

    const requiredMaterials = materials.filter(m => m.required);
    if (requiredMaterials.length === 0) return 100;

    const completedMaterials = requiredMaterials.filter(
      m => m.status === 'uploaded' || m.status === 'verified'
    );

    return Math.round((completedMaterials.length / requiredMaterials.length) * 100);
  }
}

export default new AppealFlowService();
