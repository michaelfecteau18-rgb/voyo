import { DispatcherSidebar } from '@/components/dispatcher/Sidebar'

export default function DispatcherLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <DispatcherSidebar />
      <main style={{ flex: 1, overflowY: 'auto', background: '#F5F7FA' }}>
        {children}
      </main>
    </div>
  )
}
