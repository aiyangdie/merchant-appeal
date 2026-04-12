import merchantModel from '../models/Merchant.js';
import newAppealModel from '../models/NewAppeal.js';
import logger from '../utils/logger.js';

export class MerchantDiagnosisService {
  constructor() {
    this.logger = logger;
  }

  async diagnose(merchantId) {
    this.logger.info(`Starting merchant diagnosis: ${merchantId}`);

    if (!this.validateMerchantIdFormat(merchantId)) {
      return this.createErrorResult(merchantId, '商户号格式不正确，应为10位数字');
    }

    let merchant = await merchantModel.findByMerchantId(merchantId);

    if (!merchant) {
      merchant = await this.createMerchantFromInput(merchantId);
    }

    const riskStatus = this.analyzeRiskStatus(merchant);

    await merchantModel.update(merchant.id, {
      risk_status: riskStatus.status,
      risk_level: riskStatus.level,
      risk_reasons: riskStatus.reasons
    });

    return {
      merchantId,
      merchantType: merchant.merchant_type || '普通商户',
      subjectType: merchant.subject_type || '企业',
      businessScene: merchant.business_scene || [],
      settlementCycle: merchant.settlement_cycle || 'T+1',
      appIdCount: Array.isArray(merchant.app_ids) ? merchant.app_ids.length : 0,
      riskStatus: riskStatus.status,
      riskLevel: riskStatus.level,
      riskReasons: riskStatus.reasons,
      isValid: true,
      merchant: {
        id: merchant.id,
        name: merchant.name,
        contactName: merchant.contact_name,
        contactPhone: merchant.contact_phone
      }
    };
  }

  validateMerchantIdFormat(merchantId) {
    return /^\d{10}$/.test(merchantId);
  }

  createErrorResult(merchantId, errorMessage) {
    return {
      merchantId,
      merchantType: null,
      subjectType: null,
      businessScene: [],
      settlementCycle: null,
      appIdCount: 0,
      riskStatus: null,
      isValid: false,
      errorMessage
    };
  }

  async createMerchantFromInput(merchantId) {
    return await merchantModel.create({
      merchant_id: merchantId,
      name: '',
      merchant_type: '普通商户',
      subject_type: '企业',
      business_scene: [],
      app_ids: [],
      settlement_cycle: 'T+1',
      risk_status: 'UNKNOWN',
      risk_level: '',
      risk_reasons: []
    });
  }

  analyzeRiskStatus(merchant) {
    const status = merchant.risk_status || 'UNKNOWN';
    const reasons = merchant.risk_reasons || [];

    let level = 'normal';
    if (status === 'limited') {
      level = reasons.some(r => r.includes('赌') || r.includes('欺诈')) ? 'high' : 'medium';
    } else if (status === 'closed') {
      level = 'high';
    }

    return {
      status: status === 'UNKNOWN' ? 'NORMAL' : status,
      level,
      reasons
    };
  }

  async getMerchantDetails(merchantId) {
    const merchant = await merchantModel.findByMerchantId(merchantId);
    if (!merchant) {
      return null;
    }

    const appeals = await newAppealModel.findByMerchantId(merchant.id);

    return {
      id: merchant.id,
      merchantId: merchant.merchant_id,
      name: merchant.name,
      merchantType: merchant.merchant_type,
      subjectType: merchant.subject_type,
      businessScene: merchant.business_scene,
      settlementCycle: merchant.settlement_cycle,
      riskStatus: merchant.risk_status,
      riskLevel: merchant.risk_level,
      riskReasons: merchant.risk_reasons,
      contactName: merchant.contact_name,
      contactPhone: merchant.contact_phone,
      contactEmail: merchant.contact_email,
      businessAddress: merchant.business_address,
      licenseNumber: merchant.license_number,
      licenseExpiry: merchant.license_expiry,
      appeals: appeals.map(a => ({
        id: a.id,
        status: a.status,
        riskType: a.risk_type,
        submittedAt: a.submitted_at,
        progress: a.progress
      }))
    };
  }

  async updateMerchant(merchantId, updateData) {
    const merchant = await merchantModel.findByMerchantId(merchantId);
    if (!merchant) {
      throw new Error('商户号不存在');
    }

    await merchantModel.update(merchant.id, updateData);
    return this.getMerchantDetails(merchantId);
  }
}

export default new MerchantDiagnosisService();
