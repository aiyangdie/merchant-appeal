import React, { useState, useEffect } from 'react';

export default function MaterialChecklistPanel({ appealId, materials = [], completionRate = 0, onUploadComplete }) {
  const [activeTab, setActiveTab] = useState('basic');
  const [uploadingId, setUploadingId] = useState(null);

  const categories = [
    { key: 'basic', label: '基础信息' },
    { key: 'license', label: '证照文件' },
    { key: 'business', label: '经营证明' },
    { key: 'improvement', label: '整改材料' }
  ];

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

  const groupedMaterials = categories.reduce((acc, cat) => {
    acc[cat.key] = {
      category: cat.label,
      items: materials.filter(m => typeToCategory[m.type] === cat.key)
    };
    return acc;
  }, {});

  const getStatusIcon = (status) => {
    switch (status) {
      case 'uploaded':
      case 'verified':
        return (
          <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'rejected':
        return (
          <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      default:
        return (
          <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  };

  const handleFileUpload = async (materialId) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.jpg,.jpeg,.png,.pdf';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      setUploadingId(materialId);

      const formData = new FormData();
      formData.append('file', file);

      try {
        const response = await fetch(`/api/materials/${materialId}/upload`, {
          method: 'POST',
          body: formData
        });

        const data = await response.json();

        if (data.success) {
          if (onUploadComplete) {
            onUploadComplete(data.data);
          }
        } else {
          alert(data.error?.message || '上传失败');
        }
      } catch (err) {
        alert('上传失败，请稍后重试');
      } finally {
        setUploadingId(null);
      }
    };
    input.click();
  };

  const currentItems = groupedMaterials[activeTab]?.items || [];

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-800">材料准备</h2>
          <span className="text-sm text-gray-500">步骤 2/4</span>
        </div>

        <div className="mb-4">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>材料完整度</span>
            <span>{completionRate}%</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                completionRate >= 100 ? 'bg-green-500' : 'bg-[#07C160]'
              }`}
              style={{ width: `${completionRate}%` }}
            />
          </div>
        </div>
      </div>

      <div className="border-b border-gray-200">
        <div className="flex">
          {categories.map(cat => (
            <button
              key={cat.key}
              onClick={() => setActiveTab(cat.key)}
              className={`flex-1 py-3 text-sm font-medium text-center transition-colors ${
                activeTab === cat.key
                  ? 'text-[#07C160] border-b-2 border-[#07C160]'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6 max-h-[400px] overflow-y-auto">
        <div className="space-y-4">
          {currentItems.map(item => (
            <div
              key={item.id}
              className={`p-4 rounded-lg border ${
                item.status === 'uploaded' || item.status === 'verified'
                  ? 'border-green-200 bg-green-50'
                  : item.status === 'rejected'
                  ? 'border-red-200 bg-red-50'
                  : 'border-gray-200 bg-white'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  {getStatusIcon(item.status)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-gray-800">{item.name}</h3>
                    {item.required && (
                      <span className="px-2 py-0.5 text-xs bg-red-100 text-red-600 rounded">
                        必需
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-1">{item.description}</p>

                  {item.status === 'pending' && (
                    <button
                      onClick={() => handleFileUpload(item.id)}
                      disabled={uploadingId === item.id}
                      className="mt-3 px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-600 hover:border-[#07C160] hover:text-[#07C160] transition-colors disabled:opacity-50"
                    >
                      {uploadingId === item.id ? (
                        <span className="flex items-center gap-2">
                          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          上传中...
                        </span>
                      ) : (
                        '上传文件'
                      )}
                    </button>
                  )}

                  {item.status === 'uploaded' && (
                    <div className="mt-2 flex items-center gap-2">
                      <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-sm text-green-600">{item.fileName || '已上传'}</span>
                      <button
                        onClick={() => handleFileUpload(item.id)}
                        className="text-sm text-[#07C160] hover:underline"
                      >
                        重新上传
                      </button>
                    </div>
                  )}

                  {item.formatRequirements && item.formatRequirements.length > 0 && (
                    <div className="mt-2 text-xs text-gray-400">
                      支持格式：{item.formatRequirements.join(', ')}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
