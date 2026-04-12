import React, { useState } from 'react';

export default function MerchantDiagnosisPanel({ onDiagnosisComplete, onStartAppeal }) {
  const [merchantId, setMerchantId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [diagnosisResult, setDiagnosisResult] = useState(null);

  const handleDiagnose = async () => {
    if (!merchantId || merchantId.length !== 10) {
      setError('请输入正确的10位商户号');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/merchant/diagnose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ merchantId })
      });

      const data = await response.json();

      if (data.success) {
        setDiagnosisResult(data.data);
        if (onDiagnosisComplete) {
          onDiagnosisComplete(data.data);
        }
      } else {
        setError(data.error?.message || '诊断失败');
      }
    } catch (err) {
      setError('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const getRiskStatusDisplay = (status, level) => {
    if (status === 'NORMAL') {
      return { label: '正常', color: 'text-green-600', bg: 'bg-green-50' };
    }
    if (status === 'LIMITED') {
      return level === 'high'
        ? { label: '受限（高风险）', color: 'text-red-600', bg: 'bg-red-50' }
        : { label: '受限（中风险）', color: 'text-orange-600', bg: 'bg-orange-50' };
    }
    if (status === 'CLOSED') {
      return { label: '已关闭', color: 'text-red-700', bg: 'bg-red-100' };
    }
    return { label: '未知', color: 'text-gray-600', bg: 'bg-gray-50' };
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-bold text-gray-800 mb-6">商户号诊断</h2>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            输入商户号（mchid）
          </label>
          <input
            type="text"
            value={merchantId}
            onChange={(e) => {
              setMerchantId(e.target.value.replace(/\D/g, '').slice(0, 10));
              setError('');
            }}
            placeholder="请输入10位商户号"
            className="w-full h-12 px-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all"
            maxLength={10}
          />
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        <button
          onClick={handleDiagnose}
          disabled={loading || merchantId.length !== 10}
          className={`w-full h-12 rounded-lg font-medium text-white transition-all ${
            loading || merchantId.length !== 10
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-[#07C160] hover:bg-[#068c4c] active:scale-[0.98]'
          }`}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              诊断中...
            </span>
          ) : (
            '开始诊断'
          )}
        </button>
      </div>

      {diagnosisResult && (
        <div className="mt-6 space-y-4">
          <div className={`p-4 rounded-lg ${getRiskStatusDisplay(diagnosisResult.riskStatus, diagnosisResult.riskLevel).bg}`}>
            <div className="flex items-center gap-2 mb-2">
              <span className={`font-bold ${getRiskStatusDisplay(diagnosisResult.riskStatus, diagnosisResult.riskLevel).color}`}>
                {getRiskStatusDisplay(diagnosisResult.riskStatus, diagnosisResult.riskLevel).label}
              </span>
            </div>
            {diagnosisResult.riskReasons && diagnosisResult.riskReasons.length > 0 && (
              <div className="mt-2">
                <p className="text-sm text-gray-600">风控原因：</p>
                <ul className="list-disc list-inside text-sm text-gray-700 mt-1">
                  {diagnosisResult.riskReasons.map((reason, idx) => (
                    <li key={idx}>{reason}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">商户号类型</span>
              <span className="font-medium text-gray-800">{diagnosisResult.merchantType}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">主体类型</span>
              <span className="font-medium text-gray-800">{diagnosisResult.subjectType}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">结算周期</span>
              <span className="font-medium text-gray-800">{diagnosisResult.settlementCycle}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">关联AppID</span>
              <span className="font-medium text-gray-800">{diagnosisResult.appIdCount}个</span>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setDiagnosisResult(null)}
              className="flex-1 h-12 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              重新诊断
            </button>
            {diagnosisResult.riskStatus !== 'NORMAL' && (
              <button
                onClick={() => onStartAppeal && onStartAppeal(diagnosisResult)}
                className="flex-1 h-12 bg-[#07C160] rounded-lg font-medium text-white hover:bg-[#068c4c] transition-colors"
              >
                开始申诉
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
