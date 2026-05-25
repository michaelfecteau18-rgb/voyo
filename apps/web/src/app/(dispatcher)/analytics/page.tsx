'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts'
import { format, subDays, startOfDay } from 'date-fns'
import { fr } from 'date-fns/locale'
import { cn } from '@/lib/utils'

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<7 | 30>(7)
  const [data, setData] = useState<any>({ trips: [], onTime: [], attendance: [] })
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadAnalytics() }, [period])

  const loadAnalytics = async () => {
    setLoading(true)
    const from = subDays(new Date(), period).toISOString()

    const [tripsRes, attendanceRes] = await Promise.all([
      supabase
        .from('trips')
        .select('trip_date, status, delay_minutes, students_total, students_boarded, route_type')
        .gte('trip_date', from)
        .order('trip_date'),
      supabase
        .from('attendance')
        .select('status, created_at')
        .gte('created_at', from),
    ])

    // Agréger par jour
    const byDay: Record<string, { trips: number; delayed: number; onTime: number; boarded: number }> = {}

    for (let i = period - 1; i >= 0; i--) {
      const d = format(subDays(new Date(), i), 'yyyy-MM-dd')
      byDay[d] = { trips: 0, delayed: 0, onTime: 0, boarded: 0 }
    }

    tripsRes.data?.forEach((t: any) => {
      const d = t.trip_date
      if (!byDay[d]) return
      byDay[d].trips++
      if ((t.delay_minutes ?? 0) <= 5) byDay[d].onTime++
      else byDay[d].delayed++
      byDay[d].boarded += t.students_boarded ?? 0
    })

    const chartData = Object.entries(byDay).map(([date, vals]) => ({
      date: format(new Date(date + 'T12:00:00'), 'EEE d', { locale: fr }),
      ...vals,
      ponctualite: vals.trips > 0 ? Math.round((vals.onTime / vals.trips) * 100) : 100,
    }))

    // Statut présence
    const attendanceCounts = { boarded: 0, absent: 0, dropped_off: 0 }
    attendanceRes.data?.forEach((a: any) => {
      if (a.status in attendanceCounts) attendanceCounts[a.status as keyof typeof attendanceCounts]++
    })

    setData({ chartData, attendanceCounts, rawTrips: tripsRes.data ?? [] })
    setLoading(false)
  }

  const totalTrips   = data.rawTrips?.length ?? 0
  const delayedTrips = data.rawTrips?.filter((t: any) => (t.delay_minutes ?? 0) > 5).length ?? 0
  const onTimeRate   = totalTrips > 0 ? Math.round(((totalTrips - delayedTrips) / totalTrips) * 100) : 0
  const totalStudents = data.rawTrips?.reduce((a: number, t: any) => a + (t.students_boarded ?? 0), 0) ?? 0

  const PIE_DATA = [
    { name: 'À bord', value: data.attendanceCounts?.boarded ?? 0, color: '#34C759' },
    { name: 'Absent', value: data.attendanceCounts?.absent ?? 0, color: '#FF3B30' },
    { name: 'Déposé', value: data.attendanceCounts?.dropped_off ?? 0, color: '#2D8CFF' },
  ]

  return (
    <div className="flex h-screen bg-surface">
      <div className="flex-1 overflow-y-auto">
        <div className="px-8 py-6">
          {/* Header + Filtre */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="font-poppins font-bold text-2xl text-navy-900">Analytique</h1>
              <p className="text-sm text-navy-400 mt-0.5">Performance opérationnelle</p>
            </div>
            <div className="flex rounded-lg border border-navy-200 overflow-hidden">
              {([7, 30] as const).map(p => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={cn(
                    'px-4 py-2 text-sm font-medium transition-colors',
                    period === p
                      ? 'bg-navy-900 text-white'
                      : 'text-navy-600 hover:bg-navy-50'
                  )}
                >
                  {p} jours
                </button>
              ))}
            </div>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Trajets complétés', value: totalTrips, suffix: '', color: 'text-navy-900' },
              { label: 'Ponctualité', value: onTimeRate, suffix: '%', color: onTimeRate >= 90 ? 'text-success' : 'text-warning' },
              { label: 'Élèves transportés', value: totalStudents, suffix: '', color: 'text-navy-900' },
              { label: 'Trajets en retard', value: delayedTrips, suffix: '', color: delayedTrips > 0 ? 'text-danger' : 'text-success' },
            ].map((kpi, i) => (
              <div key={i} className="card">
                <p className={cn('font-poppins font-bold text-4xl', kpi.color)}>
                  {kpi.value}{kpi.suffix}
                </p>
                <p className="text-sm text-navy-500 mt-1">{kpi.label}</p>
                <p className="text-xs text-navy-300 mt-0.5">sur {period} jours</p>
              </div>
            ))}
          </div>

          {/* Graphiques */}
          <div className="grid grid-cols-3 gap-6">
            {/* Ponctualité par jour */}
            <div className="card col-span-2">
              <h3 className="font-poppins font-semibold text-base text-navy-900 mb-4">
                Ponctualité quotidienne
              </h3>
              {loading ? (
                <div className="h-48 bg-navy-50 rounded-lg animate-pulse" />
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={data.chartData ?? []}>
                    <defs>
                      <linearGradient id="tealGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#16C7B8" stopOpacity={0.15}/>
                        <stop offset="95%" stopColor="#16C7B8" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F0F4F8" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9BB0CE' }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#9BB0CE' }} axisLine={false} tickLine={false} unit="%" />
                    <Tooltip
                      formatter={(v: number) => [`${v}%`, 'Ponctualité']}
                      contentStyle={{ borderRadius: 8, border: '1px solid #E8EDF4', fontSize: 13 }}
                    />
                    <Area
                      type="monotone" dataKey="ponctualite"
                      stroke="#16C7B8" strokeWidth={2}
                      fill="url(#tealGrad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Répartition présences */}
            <div className="card">
              <h3 className="font-poppins font-semibold text-base text-navy-900 mb-4">
                Présences
              </h3>
              {loading ? (
                <div className="h-48 bg-navy-50 rounded-lg animate-pulse" />
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie
                        data={PIE_DATA}
                        cx="50%" cy="50%"
                        innerRadius={45} outerRadius={70}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {PIE_DATA.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2 mt-2">
                    {PIE_DATA.map(item => (
                      <div key={item.name} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                          <span className="text-navy-600">{item.name}</span>
                        </div>
                        <span className="font-medium text-navy-900">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Trajets par jour */}
            <div className="card col-span-3">
              <h3 className="font-poppins font-semibold text-base text-navy-900 mb-4">
                Volume de trajets par jour
              </h3>
              {loading ? (
                <div className="h-36 bg-navy-50 rounded-lg animate-pulse" />
              ) : (
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={data.chartData ?? []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F0F4F8" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9BB0CE' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#9BB0CE' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E8EDF4', fontSize: 13 }} />
                    <Bar dataKey="onTime" name="À l'heure" fill="#34C759" stackId="a" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="delayed" name="En retard" fill="#FF9500" stackId="a" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
