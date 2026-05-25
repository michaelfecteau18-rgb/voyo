'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { cn } from '@/lib/utils'

export default function AdminDashboard() {
  const [orgs, setOrgs] = useState<any[]>([])
  const [stats, setStats] = useState({
    totalOrgs: 0, activeOrgs: 0,
    totalVehicles: 0, totalStudents: 0,
    tripsToday: 0, activeNow: 0,
  })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    const [orgsRes, statsRes] = await Promise.all([
      supabase
        .from('organisations')
        .select('*, vehicles:vehicles(count), students:students(count)')
        .order('created_at', { ascending: false }),
      supabase.rpc('get_platform_stats'),
    ])

    if (orgsRes.data) {
      setOrgs(orgsRes.data)
      setStats(prev => ({
        ...prev,
        totalOrgs: orgsRes.data.length,
        activeOrgs: orgsRes.data.filter((o: any) => o.is_active).length,
      }))
    }
    setLoading(false)
  }

  const filteredOrgs = orgs.filter(o =>
    o.name.toLowerCase().includes(search.toLowerCase()) ||
    o.slug.toLowerCase().includes(search.toLowerCase())
  )

  const toggleOrgActive = async (orgId: string, isActive: boolean) => {
    await supabase
      .from('organisations')
      .update({ is_active: !isActive })
      .eq('id', orgId)
    setOrgs(prev => prev.map(o =>
      o.id === orgId ? { ...o, is_active: !isActive } : o
    ))
  }

  return (
    <div className="flex h-screen bg-surface">
      {/* Sidebar admin */}
      <AdminSidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-navy-100 px-8 py-4">
          <h1 className="font-poppins font-bold text-2xl text-navy-900">
            Portail d'administration
          </h1>
          <p className="text-sm text-navy-400 mt-0.5">
            Vue globale de la plateforme VOYO
          </p>
        </header>

        <div className="flex-1 overflow-y-auto px-8 py-6">
          {/* Métriques globales */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            {[
              { label: 'Organisations', value: stats.totalOrgs, sub: `${stats.activeOrgs} actives`, color: 'text-teal-600', bg: 'bg-teal-50' },
              { label: 'Véhicules', value: stats.totalVehicles, sub: 'toutes orgs', color: 'text-blue-600', bg: 'bg-blue-50' },
              { label: 'Élèves inscrits', value: stats.totalStudents, sub: 'toutes orgs', color: 'text-navy-900', bg: 'bg-navy-50' },
            ].map((m, i) => (
              <div key={i} className={cn('rounded-xl p-5', m.bg)}>
                <p className={cn('font-poppins font-bold text-4xl', m.color)}>{m.value}</p>
                <p className="text-sm font-medium text-navy-700 mt-1">{m.label}</p>
                <p className="text-xs text-navy-400">{m.sub}</p>
              </div>
            ))}
          </div>

          {/* Liste organisations */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-poppins font-semibold text-lg text-navy-900">
                Organisations
              </h2>
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Rechercher…"
                  className="input text-sm py-2 w-56"
                />
                <button className="btn-secondary text-sm py-2">
                  + Nouvelle organisation
                </button>
              </div>
            </div>

            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-16 bg-navy-50 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-navy-100">
                      {['Organisation', 'Abonnement', 'Véhicules', 'Élèves', 'Créé le', 'Statut', 'Actions'].map(h => (
                        <th key={h} className="text-left py-3 px-2 text-xs font-semibold text-navy-400 uppercase tracking-wide">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-navy-50">
                    {filteredOrgs.map(org => (
                      <tr key={org.id} className="hover:bg-navy-50 transition-colors">
                        <td className="py-3 px-2">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold font-poppins"
                              style={{ backgroundColor: org.primary_color ?? '#072B57' }}
                            >
                              {org.name[0]}
                            </div>
                            <div>
                              <p className="font-medium text-sm text-navy-900">{org.name}</p>
                              <p className="text-xs text-navy-400">{org.slug}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-2">
                          <span className={cn(
                            'badge text-xs',
                            org.plan === 'enterprise' ? 'badge-info' :
                            org.plan === 'pro' ? 'badge-success' : 'badge-neutral'
                          )}>
                            {org.plan}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-sm text-navy-700">
                          {org.vehicles?.[0]?.count ?? 0} / {org.max_vehicles}
                        </td>
                        <td className="py-3 px-2 text-sm text-navy-700">
                          {org.students?.[0]?.count ?? 0} / {org.max_students}
                        </td>
                        <td className="py-3 px-2 text-xs text-navy-400">
                          {format(new Date(org.created_at), 'd MMM yyyy', { locale: fr })}
                        </td>
                        <td className="py-3 px-2">
                          <span className={org.is_active ? 'badge-success' : 'badge-neutral'}>
                            {org.is_active ? 'Actif' : 'Inactif'}
                          </span>
                        </td>
                        <td className="py-3 px-2">
                          <div className="flex items-center gap-2">
                            <button className="text-xs text-teal-600 hover:text-teal-700 font-medium">
                              Gérer
                            </button>
                            <button
                              onClick={() => toggleOrgActive(org.id, org.is_active)}
                              className={cn(
                                'text-xs font-medium',
                                org.is_active ? 'text-danger hover:text-red-700' : 'text-success hover:text-green-700'
                              )}
                            >
                              {org.is_active ? 'Désactiver' : 'Activer'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {filteredOrgs.length === 0 && (
                  <div className="text-center py-12">
                    <p className="text-sm text-navy-400">Aucune organisation trouvée</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function AdminSidebar() {
  const links = [
    { label: 'Vue d\'ensemble', href: '/admin' },
    { label: 'Organisations', href: '/admin/orgs' },
    { label: 'Utilisateurs', href: '/admin/users' },
    { label: 'Facturation', href: '/admin/billing' },
    { label: 'Journaux d\'audit', href: '/admin/audit' },
    { label: 'Paramètres système', href: '/admin/settings' },
  ]

  return (
    <aside className="w-56 bg-navy-950 text-white flex flex-col shrink-0">
      <div className="px-4 py-5 border-b border-navy-800">
        <p className="font-poppins font-bold text-white text-lg">VOYO</p>
        <p className="text-xs text-navy-400 mt-0.5">Portail super-admin</p>
      </div>
      <nav className="flex-1 p-3 space-y-0.5">
        {links.map(l => (
          <a
            key={l.href}
            href={l.href}
            className="block px-3 py-2.5 rounded-lg text-sm text-navy-400 hover:bg-navy-800 hover:text-white transition-colors"
          >
            {l.label}
          </a>
        ))}
      </nav>
      <div className="p-4 border-t border-navy-800">
        <p className="text-xs text-navy-500">VOYO Platform v1.0.0</p>
      </div>
    </aside>
  )
}
