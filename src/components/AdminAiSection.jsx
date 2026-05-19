import AdminAiTabLayout from './AdminAiTabLayout.jsx'

/**
 * @deprecated 请使用 AdminAiTabLayout。保留此组件以兼容旧引用，行为已改为 Tab 切换模式。
 */
export default function AdminAiSection({
  tabKey,
  module: moduleProp,
  adminFetch,
  showToast,
  onRefresh,
  loading,
  mainTabLabel,
  children,
  className,
  // 忽略旧版折叠条参数
  defaultOpen: _defaultOpen,
  compact: _compact,
}) {
  return (
    <AdminAiTabLayout
      tabKey={tabKey}
      module={moduleProp}
      adminFetch={adminFetch}
      showToast={showToast}
      onRefresh={onRefresh}
      loading={loading}
      mainTabLabel={mainTabLabel}
      className={className}
    >
      {children}
    </AdminAiTabLayout>
  )
}
