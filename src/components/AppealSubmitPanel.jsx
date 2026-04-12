import React, { useState } from 'react';

export default function AppealSubmitPanel({ appeal, materials = [], onSubmitSuccess, onCancel }) {
  const [loading, setLoading] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(false);

  const completedCount = materials.filter(
    m => m.status === 'uploaded' || m.status === 'verified'
  ).length;

  const totalCount = materials.length;
  const allCompleted = completedCount === totalCount;

  const handleSubmit = async () => {
    if (!allCompleted) {
      alert('请先完成所有必需材料的上传');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`/api/appeals/${appeal.id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await response.json();

      if (data.success) {
        if (onSubmitSuccess) {
          onSubmitSuccess(data.data);
        }
      } else {
        alert(data.error?.message || '提交失败');
      }
    } catch (err) {
      alert('提交失败，请稍后重试');
    } finally {
      setLoading(false);
      setConfirmDialog(false);
    }
  };

  const groupedMaterials = {
    basic: { label: '基础信息', items: [] },
    license: { label: '证照文件', items: [] },
    business: { label: '经营证明', items: [] },
    improvement: { label: '整改材料', items: [] }
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

  materials.forEach(m => {
    const cat = typeToCategory[m.type] || 'business';
    if (groupedMaterials[cat]) {
      groupedMaterials[cat].items.push(m);
    }
  });

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-xl font-bold text-gray-800">提交申诉</h2>
        <p className="text-sm text-gray-500 mt-1">步骤 3/4</p>
      </div>

      <div className="p-6 space-y-6">
        <div>
          <h3 className="font-medium text-gray-800 mb-3">提交确认清单</h3>
          <div className="space-y-3">
            {Object.values(groupedMaterials).map(cat => {
              if (cat.items.length === 0) return null;
              return (
                <div key={cat.label} className="space-y-2">
                  <p className="text-sm text-gray-500">{cat.label}</p>
                  {cat.items.map(item => (
                    <div key={item.id} className="flex items-center gap-2">
                      {(item.status === 'uploaded' || item.status === 'verified') ? (
                        <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      )}
                      <span className={item.status === 'uploaded' || item.status === 'verified'
                        ? 'text-gray-700'
                        : 'text-gray-400'
                      }>
                        {item.name}
                      </span>
                      {item.required && item.status !== 'uploaded' && item.status !== 'verified' && (
                        <span className="text-xs text-red-500">(必需)</span>
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-[#FFF8E6] border-l-4 border-[#FFB100] p-4 rounded-r-lg">
          <h4 className="font-medium text-[#FFB100] mb-2">提交须知</h4>
          <ul className="text-sm text-gray-700 space-y-1">
            <li>1. 请确保所有材料真实有效</li>
            <li>2. 申诉提交后将在1-7个工作日内审核</li>
            <li>3. 如需补充材料，官方会通过公众号通知</li>
            <li>4. 多次提交可能导致审核延迟</li>
          </ul>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 h-12 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            上一步
          </button>
          <button
            onClick={() => setConfirmDialog(true)}
            disabled={!allCompleted || loading}
            className={`flex-1 h-12 rounded-lg font-medium text-white transition-colors ${
              !allCompleted || loading
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-[#07C160] hover:bg-[#068c4c]'
            }`}
          >
            {loading ? '提交中...' : '确认提交'}
          </button>
        </div>
      </div>

      {confirmDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm mx-4">
            <h3 className="text-lg font-bold text-gray-800 mb-2">确认提交申诉？</h3>
            <p className="text-gray-600 text-sm mb-6">
              提交后将进入审核流程，请确保所有材料真实有效。
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDialog(false)}
                className="flex-1 h-10 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="flex-1 h-10 bg-[#07C160] rounded-lg font-medium text-white hover:bg-[#068c4c] disabled:opacity-50"
              >
                确认提交
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
