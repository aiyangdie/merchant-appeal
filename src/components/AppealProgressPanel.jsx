import React, { useState, useEffect } from 'react';

export default function AppealProgressPanel({ appealId, status = 'submitted', timeline = [] }) {
  const [loading, setLoading] = useState(false);
  const [reminderSent, setReminderSent] = useState(false);

  const statusConfig = {
    not_started: { label: '未开始', color: 'gray', icon: '○' },
    preparing: { label: '准备中', color: 'blue', icon: '⏳' },
    submitted: { label: '审核中', color: 'orange', icon: '⏳' },
    reviewing: { label: '审核中', color: 'orange', icon: '⏳' },
    approved: { label: '已通过', color: 'green', icon: '✓' },
    rejected: { label: '已驳回', color: 'red', icon: '✗' },
    cancelled: { label: '已取消', color: 'gray', icon: '○' }
  };

  const currentStatus = statusConfig[status] || statusConfig.submitted;

  const steps = [
    { key: 'created', label: '创建申诉' },
    { key: 'materials', label: '材料准备' },
    { key: 'submitted', label: '提交申诉' },
    { key: 'reviewing', label: '审核中' },
    { key: 'completed', label: '完成' }
  ];

  const getStepStatus = (stepKey) => {
    const statusOrder = ['not_started', 'preparing', 'submitted', 'reviewing', 'approved', 'rejected'];
    const currentIndex = statusOrder.indexOf(status);

    const stepIndex = steps.findIndex(s => s.key === stepKey);

    if (status === 'approved' && stepKey === 'completed') {
      return 'completed';
    }
    if (status === 'rejected') {
      if (stepKey === 'submitted') return 'completed';
      if (stepKey === 'reviewing') return 'rejected';
      return 'pending';
    }

    if (stepIndex <= currentIndex) {
      return 'completed';
    }
    return 'pending';
  };

  const handleRemind = async () => {
    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      setReminderSent(true);
      setTimeout(() => setReminderSent(false), 3000);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBgColor = () => {
    switch (currentStatus.color) {
      case 'green':
        return 'bg-green-50 border-green-200';
      case 'red':
        return 'bg-red-50 border-red-200';
      case 'orange':
        return 'bg-orange-50 border-orange-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  const getStatusTextColor = () => {
    switch (currentStatus.color) {
      case 'green':
        return 'text-green-600';
      case 'red':
        return 'text-red-600';
      case 'orange':
        return 'text-orange-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-xl font-bold text-gray-800">申诉进度</h2>
        <p className="text-sm text-gray-500 mt-1">步骤 4/4</p>
      </div>

      <div className="p-6 space-y-6">
        <div className={`p-6 rounded-lg border ${getStatusBgColor()}`}>
          <div className="text-center">
            <div className={`text-4xl mb-2 ${currentStatus.icon === '⏳' ? 'animate-spin' : ''}`}>
              {currentStatus.icon === '⏳' && (
                <svg className="w-12 h-12 mx-auto text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              )}
              {currentStatus.icon === '✓' && (
                <svg className="w-12 h-12 mx-auto text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              {currentStatus.icon === '✗' && (
                <svg className="w-12 h-12 mx-auto text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
            </div>
            <h3 className={`text-xl font-bold ${getStatusTextColor()}`}>
              {currentStatus.label}
            </h3>
            {status === 'submitted' || status === 'reviewing' ? (
              <p className="text-sm text-gray-500 mt-2">
                预计剩余时间：3个工作日
              </p>
            ) : null}
          </div>
        </div>

        <div>
          <h4 className="font-medium text-gray-800 mb-4">审核进度</h4>
          <div className="flex items-center justify-between">
            {steps.map((step, index) => {
              const stepStatus = getStepStatus(step.key);
              return (
                <React.Fragment key={step.key}>
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                        stepStatus === 'completed'
                          ? 'bg-[#07C160] text-white'
                          : stepStatus === 'rejected'
                          ? 'bg-red-500 text-white'
                          : 'bg-gray-200 text-gray-500'
                      }`}
                    >
                      {stepStatus === 'completed' ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : stepStatus === 'rejected' ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      ) : (
                        <span>{index + 1}</span>
                      )}
                    </div>
                    <span className="text-xs text-gray-500 mt-1">{step.label}</span>
                  </div>
                  {index < steps.length - 1 && (
                    <div
                      className={`flex-1 h-0.5 mx-2 ${
                        stepStatus === 'completed' ? 'bg-[#07C160]' : 'bg-gray-200'
                      }`}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {timeline.length > 0 && (
          <div>
            <h4 className="font-medium text-gray-800 mb-3">操作记录</h4>
            <div className="space-y-3">
              {timeline.map((event, index) => (
                <div key={index} className="flex gap-3 text-sm">
                  <div className="w-2 h-2 mt-2 rounded-full bg-[#07C160] flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-gray-700">{event.event}</p>
                    <p className="text-gray-400 text-xs">{event.formattedTime || event.timestamp}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-3 pt-4">
          <button
            onClick={handleRemind}
            disabled={loading || reminderSent || (status !== 'submitted' && status !== 'reviewing')}
            className={`flex-1 h-12 rounded-lg font-medium border transition-colors ${
              reminderSent || (status !== 'submitted' && status !== 'reviewing')
                ? 'border-gray-200 text-gray-400 cursor-not-allowed'
                : 'border-[#07C160] text-[#07C160] hover:bg-green-50'
            }`}
          >
            {loading ? '发送中...' : reminderSent ? '已催办' : '催办申诉'}
          </button>
          <button
            onClick={() => window.open('https://kf.qq.com/', '_blank')}
            className="flex-1 h-12 bg-[#576BB0] rounded-lg font-medium text-white hover:bg-[#465a99] transition-colors"
          >
            联系客服
          </button>
        </div>
      </div>
    </div>
  );
}
