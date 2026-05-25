'use client'
import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function StudentsPage() {
  const [students, setStudents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => { loadStudents() }, [])

  const loadStudents = async () => {
    const { data } = await supabase
      .from('students')
      .select('*, school:schools(name)')
      .eq('is_active', true)
      .order('last_name')
    if (data) setStudents(data)
    setLoading(false)
  }

  const filtered = students.filter(s =>
    `${s.first_name} ${s.last_name}`.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div style={{ flex: 1, padding: '32px', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontFamily: 'sans-serif', fontSize: '24px', fontWeight: '700', color: '#072B57', margin: 0 }}>Élèves</h1>
          <p style={{ color: '#9BB0CE', fontSize: '14px', marginTop: '4px' }}>{students.length} élèves inscrits</p>
        </div>
        <input
          type="text"
          placeholder="Rechercher un élève..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ padding: '10px 16px', border: '1px solid #E8EDF4', borderRadius: '8px', fontSize: '14px', width: '240px' }}
        />
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#9BB0CE' }}>Chargement...</div>
      ) : (
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #E8EDF4', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #E8EDF4', background: '#F5F7FA' }}>
                {['Élève', 'École', 'Grade', 'Besoins spéciaux', 'Statut'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#9BB0CE', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(student => (
                <tr key={student.id} style={{ borderBottom: '1px solid #F5F7FA' }}>
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#E0F9F7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '600', color: '#16C7B8', flexShrink: 0 }}>
                        {student.first_name[0]}{student.last_name[0]}
                      </div>
                      <div>
                        <p style={{ margin: 0, fontWeight: '600', fontSize: '14px', color: '#072B57' }}>{student.first_name} {student.last_name}</p>
                        {student.student_number && <p style={{ margin: 0, fontSize: '12px', color: '#9BB0CE' }}>#{student.student_number}</p>}
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: '14px', color: '#5578AA' }}>{student.school?.name ?? '—'}</td>
                  <td style={{ padding: '14px 16px', fontSize: '14px', color: '#5578AA' }}>{student.grade ? `Grade ${student.grade}` : '—'}</td>
                  <td style={{ padding: '14px 16px' }}>
                    {student.special_needs ? (
                      <span style={{ background: '#FFF5E6', color: '#FF9500', padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' }}>Oui</span>
                    ) : (
                      <span style={{ color: '#C4D0E3', fontSize: '14px' }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{ background: '#E8F8F1', color: '#34C759', padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' }}>Actif</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px', color: '#9BB0CE', fontSize: '14px' }}>Aucun élève trouvé</div>
          )}
        </div>
      )}
    </div>
  )
}