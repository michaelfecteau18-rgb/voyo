'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface BroadcastModalProps {
  onClose: () => void
}

const MESSAGE_TEMPLATES = [
  { id: 'delay', label: '⏰ Retard général', text: 'Des retards sont à prévoir ce matin en raison de conditions routières difficiles. Nous vous tiendrons informés.' },
  { id: 'weather', label: '⛈️ Météo', text: 'En raison des conditions météorologiques, des délais sont possibles. Veuillez habiller votre enfant chaudement.' },
  { id: 'route_change', label: '🔄 Changement itinéraire', text: "L'itinéraire a été modifié aujourd'hui. Consultez l'application pour voir les nouveaux arrêts." },
  { id: 'custom', label: '✏️ Message personnalisé', text: '' },
]

const CHANNELS = [
  { id: 'in_app', label: 'Application', icon: '📱' },
  { id: 'push', label: 'Push', icon: '🔔' },
  { id: 'sms', label: 'SMS', icon: '💬' },
]

export function BroadcastModal({ onClose }: BroadcastModalProps) {
  const [selectedTemplate, setSelectedTemplate] = useState(MESSAGE_TEMPLATES[0].id)
  const [message, setMessage] = useState(MESSAGE_TEMPLATES[0].text)
  const [selectedChannels, setSelectedChannels] = useState<string[]>(['in_app', 'push'])
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplate(templateId)
    const tpl = MESSAGE_TEMPLATES.find(t => t.id === templateId)
    if (tpl && tpl.text) setMessage(tpl.text)
    else setMessage('')
  }

  const toggleChannel = (channelId: string) => {
    setSelectedChannels(prev =>
      prev.includes(channelId)
        ? prev.filter(c => c !== channelId)
        : [...prev, channelId]
    )
  }

  const handleSend = async () => {
    if (!message.trim() || selectedChannels.length === 0) return
    setSending(true)
    try {
      // Appeler l'Edge Function de diffusion
      const { error } = await supabase.functions.invoke('send-broadcast', {
        body: {
          message: message.trim(),
          channels: selectedChannels,
          type: selectedTemplate === 'custom' ? 'custom' : selectedTemplate,
        },
      })
      if (error) throw error
      setSent(true)
      toast.success('Message diffusé à tous les parents')
      setTimeout(onClose, 1500)
    } catch {
      toast.error('Erreur lors de l\'envoi. Veuillez réessayer.')
    } finally {
      setSending(false)
    }
  }

  return (
    // Backdrop
    <div
      className="fixed inset-0 bg-navy-950/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-navy-100">
          <div>
            <h2 className="font-poppins font-semibold text-xl text-navy-900">
              Diffusion parents
            </h2>
            <p className="text-sm text-navy-400 mt-0.5">
              Envoyer un message à tous les parents actifs
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-navy-50 rounded-lg transition-colors"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Corps */}
        <div className="p-6 space-y-5">
          {/* Modèles */}
          <div>
            <label className="label">Modèle de message</label>
            <div className="grid grid-cols-2 gap-2">
              {MESSAGE_TEMPLATES.map(tpl => (
                <button
                  key={tpl.id}
                  onClick={() => handleTemplateChange(tpl.id)}
                  className={cn(
                    'text-left text-sm px-3 py-2.5 rounded-lg border transition-all duration-100',
                    selectedTemplate === tpl.id
                      ? 'border-teal-400 bg-teal-50 text-teal-700 font-medium'
                      : 'border-navy-200 text-navy-600 hover:border-navy-300 hover:bg-navy-50'
                  )}
                >
                  {tpl.label}
                </button>
              ))}
            </div>
          </div>

          {/* Message */}
          <div>
            <label className="label">Message</label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={4}
              maxLength={500}
              placeholder="Saisissez votre message..."
              className="input resize-none"
            />
            <div className="flex justify-between mt-1">
              <span className="text-xs text-navy-400">
                Le message sera traduit automatiquement si nécessaire
              </span>
              <span className={cn(
                'text-xs',
                message.length > 450 ? 'text-warning' : 'text-navy-300'
              )}>
                {message.length}/500
              </span>
            </div>
          </div>

          {/* Canaux */}
          <div>
            <label className="label">Canaux d'envoi</label>
            <div className="flex gap-2">
              {CHANNELS.map(ch => (
                <button
                  key={ch.id}
                  onClick={() => toggleChannel(ch.id)}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm transition-all',
                    selectedChannels.includes(ch.id)
                      ? 'border-teal-400 bg-teal-50 text-teal-700 font-medium'
                      : 'border-navy-200 text-navy-500 hover:border-navy-300'
                  )}
                >
                  <span>{ch.icon}</span>
                  <span>{ch.label}</span>
                </button>
              ))}
            </div>
            {selectedChannels.includes('sms') && (
              <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                <span>⚠️</span>
                Des frais Twilio s'appliquent pour les SMS
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 px-6 py-4 bg-navy-50 rounded-b-2xl">
          <button onClick={onClose} className="btn-outline flex-1">
            Annuler
          </button>
          <button
            onClick={handleSend}
            disabled={!message.trim() || selectedChannels.length === 0 || sending || sent}
            className="btn-secondary flex-1 flex items-center justify-center gap-2"
          >
            {sending ? (
              <>
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Envoi…
              </>
            ) : sent ? (
              '✓ Envoyé!'
            ) : (
              'Diffuser maintenant'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

const CloseIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-navy-500">
    <path d="M18 6L6 18M6 6l12 12"/>
  </svg>
)
