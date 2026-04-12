import express from 'express';
import multer from 'multer';
import path from 'path';
import materialService from '../services/materialService.js';
import logger from '../utils/logger.js';

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(process.cwd(), 'uploads', 'materials'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('不支持的文件格式'));
    }
  }
});

router.post('/:id/upload', upload.single('file'), async (req, res) => {
  try {
    const { id } = req.params;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: { code: 'E206', message: '请选择要上传的文件' }
      });
    }

    const fileData = {
      path: req.file.path,
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
      url: `/uploads/materials/${req.file.filename}`
    };

    const material = await materialService.uploadMaterial(id, fileData);

    res.json({
      success: true,
      data: {
        id: material.id,
        status: material.status,
        fileName: material.file_name,
        fileUrl: material.upload_url,
        uploadedAt: material.uploaded_at
      },
      message: '上传成功'
    });
  } catch (error) {
    logger.error('Upload material error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'E104', message: error.message || '上传失败' }
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const materialModel = (await import('../models/Material.js')).default;
    const material = await materialModel.findById(id);

    if (!material) {
      return res.status(404).json({
        success: false,
        error: { code: 'E205', message: '材料不存在' }
      });
    }

    res.json({
      success: true,
      data: material
    });
  } catch (error) {
    logger.error('Get material error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'E101', message: '服务器内部错误' }
    });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const materialModel = (await import('../models/Material.js')).default;
    const material = await materialModel.findById(id);

    if (!material) {
      return res.status(404).json({
        success: false,
        error: { code: 'E205', message: '材料不存在' }
      });
    }

    await materialModel.update(id, {
      status: 'pending',
      file_path: '',
      file_name: '',
      file_size: 0,
      mime_type: '',
      upload_url: ''
    });

    res.json({
      success: true,
      message: '材料已删除'
    });
  } catch (error) {
    logger.error('Delete material error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'E101', message: '服务器内部错误' }
    });
  }
});

export default router;
