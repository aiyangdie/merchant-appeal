import materialModel from '../models/Material.js';
import logger from '../utils/logger.js';

const MATERIAL_CONFIG = {
  basic: [
    { type: 'MERCHANT_ID', name: '商户号', required: true, description: '微信支付分配的商户号' },
    { type: 'CONTACT_INFO', name: '联系方式', required: true, description: '联系人姓名、电话、邮箱' }
  ],
  license: [
    { type: 'BUSINESS_LICENSE', name: '营业执照', required: true, description: '有效期内的营业执照副本', formatRequirements: ['JPG/PNG/PDF', '不超过10MB'] },
    { type: 'ID_CARD_FRONT', name: '身份证正面', required: true, description: '法人身份证正面照片', formatRequirements: ['JPG/PNG', '不超过5MB'] },
    { type: 'ID_CARD_BACK', name: '身份证反面', required: true, description: '法人身份证反面照片', formatRequirements: ['JPG/PNG', '不超过5MB'] },
    { type: 'ID_CARD_HANDHELD', name: '手持身份证照', required: true, description: '法人手持身份证的半身照', formatRequirements: ['JPG/PNG', '不超过5MB'] }
  ],
  business: [
    { type: 'STORE_PHOTO', name: '经营场所照片', required: true, description: '门头照片和体现经营范围的内景照片', examples: ['门头照片1张', '内景照片2-3张'], formatRequirements: ['JPG/PNG', '每张不超过10MB'] },
    { type: 'LOCATION_SCREENSHOT', name: '定位截图', required: true, description: '营业地点在地图上的定位截图', formatRequirements: ['JPG/PNG', '不超过5MB'] },
    { type: 'TRANSACTION_RECEIPT', name: '交易小票', required: true, description: '近3个月内的成功交易小票', examples: ['至少3张', '需包含订单号、时间、金额'], formatRequirements: ['JPG/PNG/PDF', '不超过10MB'] }
  ],
  improvement: [
    { type: 'IMPROVEMENT_PLAN', name: '整改计划', required: true, description: '针对违规原因的整改措施说明', formatRequirements: ['Word/PDF', '内容需具体可执行'] },
    { type: 'COMMITMENT_LETTER', name: '承诺书', required: true, description: '合规经营承诺书', formatRequirements: ['PDF或图片', '需加盖公章/签字'] }
  ]
};

const RISK_TYPES_REQUIRING_IMPROVEMENT = [
  'TRANSACTION_DISPUTE',
  'MERCHANT_FRAUD',
  'CROSS_CATEGORY',
  'NO_QUALIFICATION',
  '涉嫌交易纠纷',
  '涉嫌商户欺诈',
  '涉嫌跨类目经营',
  '涉嫌无资质经营'
];

export class MaterialService {
  constructor() {
    this.logger = logger;
  }

  async generateMaterialChecklist(appealId, riskType, merchantType) {
    for (const item of MATERIAL_CONFIG.basic) {
      await this.createMaterial(appealId, item);
    }

    for (const item of MATERIAL_CONFIG.license) {
      await this.createMaterial(appealId, item);
    }

    for (const item of MATERIAL_CONFIG.business) {
      await this.createMaterial(appealId, item);
    }

    if (this.isImprovementRequired(riskType)) {
      for (const item of MATERIAL_CONFIG.improvement) {
        await this.createMaterial(appealId, item);
      }
    }
  }

  async createMaterial(appealId, item) {
    return await materialModel.create({
      appeal_id: appealId,
      type: item.type,
      name: item.name,
      required: item.required,
      status: 'pending'
    });
  }

  async getMaterialsByAppeal(appealId) {
    return await materialModel.findByAppealId(appealId);
  }

  async getMaterialChecklist(riskType, merchantType) {
    const checklist = [];

    checklist.push({
      category: '基础信息',
      items: MATERIAL_CONFIG.basic.map(item => this.formatChecklistItem(item))
    });

    checklist.push({
      category: '证照文件',
      items: MATERIAL_CONFIG.license.map(item => this.formatChecklistItem(item))
    });

    checklist.push({
      category: '经营证明',
      items: MATERIAL_CONFIG.business.map(item => this.formatChecklistItem(item))
    });

    if (this.isImprovementRequired(riskType)) {
      checklist.push({
        category: '整改材料',
        items: MATERIAL_CONFIG.improvement.map(item => this.formatChecklistItem(item))
      });
    }

    return checklist;
  }

  formatChecklistItem(item) {
    return {
      type: item.type,
      name: item.name,
      required: item.required,
      description: item.description,
      examples: item.examples || [],
      formatRequirements: item.formatRequirements || []
    };
  }

  async uploadMaterial(materialId, fileData) {
    const material = await materialModel.findById(materialId);
    if (!material) {
      throw new Error('材料不存在');
    }

    if (!this.validateFileFormat(fileData.mimeType)) {
      throw new Error('不支持的文件格式，请上传JPG/PNG/PDF格式');
    }

    if (!this.validateFileSize(fileData.size)) {
      throw new Error('文件大小超过限制（最大10MB）');
    }

    const now = new Date().toISOString();
    await materialModel.update(materialId, {
      status: 'uploaded',
      file_path: fileData.path || '',
      file_name: fileData.originalName || fileData.filename || '',
      file_size: fileData.size || 0,
      mime_type: fileData.mimeType || fileData.mimetype || '',
      upload_url: fileData.url || '',
      uploaded_at: now
    });

    return await materialModel.findById(materialId);
  }

  async getMaterialStats(appealId) {
    return await materialModel.countByStatus(appealId);
  }

  async calculateCompletionRate(appealId) {
    const materials = await materialModel.findByAppealId(appealId);
    if (materials.length === 0) return 0;

    const requiredMaterials = materials.filter(m => m.required);
    if (requiredMaterials.length === 0) return 100;

    const completedMaterials = requiredMaterials.filter(
      m => m.status === 'uploaded' || m.status === 'verified'
    );

    return Math.round((completedMaterials.length / requiredMaterials.length) * 100);
  }

  validateFileFormat(mimeType) {
    const allowedFormats = ['image/jpeg', 'image/png', 'application/pdf'];
    return allowedFormats.includes(mimeType);
  }

  validateFileSize(fileSize) {
    return fileSize <= 10 * 1024 * 1024;
  }

  isImprovementRequired(riskType) {
    return RISK_TYPES_REQUIRING_IMPROVEMENT.some(
      type => riskType && riskType.includes(type)
    );
  }
}

export default new MaterialService();
