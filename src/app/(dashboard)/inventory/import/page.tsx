'use client'

import { useState, useRef } from 'react'
import { Upload, Download, FileSpreadsheet, CheckCircle, AlertCircle, Info, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface ImportRow {
  sku: string
  quantity: number
  operation: string
  note?: string
}

interface ValidationResult {
  valid: ImportRow[]
  errors: { row: number; sku: string; message: string }[]
  warnings: { row: number; message: string }[]
}

export default function ImportInventoryPage() {
  const [csvContent, setCsvContent] = useState<string | null>(null)
  const [fileName, setFileName] = useState('')
  const [validating, setValidating] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [validation, setValidation] = useState<ValidationResult | null>(null)
  const [done, setDone] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setValidation(null)
    setDone(false)
    const reader = new FileReader()
    reader.onload = (ev) => setCsvContent(ev.target?.result as string)
    reader.readAsText(file)
  }

  const handleDownloadTemplate = async () => {
    try {
      const res = await fetch('/api/admin/inventory/import')
      if (!res.ok) throw new Error()
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'stock-import-template.csv'
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Impossible de télécharger le modèle')
    }
  }

  const handleValidate = async () => {
    if (!csvContent) return
    setValidating(true)
    setValidation(null)
    try {
      const res = await fetch('/api/admin/inventory/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvContent, action: 'validate' }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Erreur de validation'); return }
      setValidation(data)
      data.errors?.length === 0
        ? toast.success(`${data.valid?.length ?? 0} lignes valides, prêtes à importer`)
        : toast.warning(`${data.errors?.length} erreurs détectées`)
    } catch { toast.error('Erreur lors de la validation') }
    finally { setValidating(false) }
  }

  const handleProcess = async () => {
    if (!csvContent) return
    setProcessing(true)
    try {
      const res = await fetch('/api/admin/inventory/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvContent, action: 'process' }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || "Erreur d'importation"); return }
      setDone(true)
      setCsvContent(null)
      setFileName('')
      setValidation(null)
      if (fileRef.current) fileRef.current.value = ''
      toast.success(`Import réussi : ${data.processed ?? 0} lignes traitées`)
    } catch { toast.error("Erreur lors de l'importation") }
    finally { setProcessing(false) }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Import Inventaire</h1>
          <p className="text-sm text-muted-foreground">Importez votre stock en masse via un fichier CSV</p>
        </div>
        <button
          onClick={handleDownloadTemplate}
          className="flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-medium hover:bg-gray-50"
        >
          <Download className="h-4 w-4" /> Télécharger le modèle CSV
        </button>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
        <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800">
          <p className="font-semibold mb-1">Colonnes requises :</p>
          <p>
            <code className="bg-blue-100 px-1 rounded">sku</code> ·{' '}
            <code className="bg-blue-100 px-1 rounded">quantity</code> ·{' '}
            <code className="bg-blue-100 px-1 rounded">operation</code>{' '}
            (<code className="bg-blue-100 px-1 rounded">add</code>,{' '}
            <code className="bg-blue-100 px-1 rounded">set</code> ou{' '}
            <code className="bg-blue-100 px-1 rounded">deduct</code>) ·{' '}
            <code className="bg-blue-100 px-1 rounded">note</code> (optionnel)
          </p>
        </div>
      </div>

      {/* Upload Zone */}
      <div
        className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center cursor-pointer hover:border-orange-400 hover:bg-orange-50 transition-colors"
        onClick={() => fileRef.current?.click()}
      >
        <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFileChange} />
        <FileSpreadsheet className="h-12 w-12 text-gray-400 mx-auto mb-3" />
        {fileName
          ? <p className="font-semibold text-gray-700">{fileName}</p>
          : <>
              <p className="font-semibold text-gray-600">Cliquez pour sélectionner un fichier CSV</p>
              <p className="text-sm text-gray-400 mt-1">ou glissez-déposez ici</p>
            </>
        }
      </div>

      {csvContent && !done && (
        <div className="flex gap-3">
          <button
            onClick={handleValidate}
            disabled={validating}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
          >
            {validating ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
            {validating ? 'Validation...' : 'Valider le fichier'}
          </button>
          {validation && validation.errors?.length === 0 && (
            <button
              onClick={handleProcess}
              disabled={processing}
              className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-60"
            >
              {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {processing ? 'Importation...' : `Importer ${validation.valid?.length ?? 0} lignes`}
            </button>
          )}
        </div>
      )}

      {done && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
          <CheckCircle className="h-5 w-5 text-green-600" />
          <p className="text-green-800 font-medium">Import terminé ! Le stock a été mis à jour.</p>
        </div>
      )}

      {validation && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-green-700">{validation.valid?.length ?? 0}</p>
              <p className="text-sm text-green-600">Lignes valides</p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-red-700">{validation.errors?.length ?? 0}</p>
              <p className="text-sm text-red-600">Erreurs</p>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-yellow-700">{validation.warnings?.length ?? 0}</p>
              <p className="text-sm text-yellow-600">Avertissements</p>
            </div>
          </div>

          {(validation.errors?.length ?? 0) > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h3 className="font-semibold text-red-800 mb-2 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" /> Erreurs à corriger
              </h3>
              <ul className="space-y-1 text-sm text-red-700">
                {validation.errors.map((err, i) => (
                  <li key={i}>Ligne {err.row} — <span className="font-mono">{err.sku}</span> : {err.message}</li>
                ))}
              </ul>
            </div>
          )}

          {(validation.valid?.length ?? 0) > 0 && (
            <div className="bg-white border rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b bg-gray-50">
                <h3 className="font-semibold text-sm">Aperçu des lignes valides</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left py-2 px-4 font-medium">SKU</th>
                      <th className="text-center py-2 px-4 font-medium">Opération</th>
                      <th className="text-right py-2 px-4 font-medium">Quantité</th>
                      <th className="text-left py-2 px-4 font-medium">Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validation.valid.slice(0, 25).map((row, i) => (
                      <tr key={i} className="border-b hover:bg-gray-50">
                        <td className="py-2 px-4 font-mono text-xs">{row.sku}</td>
                        <td className="py-2 px-4 text-center">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            row.operation === 'add' ? 'bg-green-100 text-green-700' :
                            row.operation === 'deduct' ? 'bg-red-100 text-red-700' :
                            'bg-blue-100 text-blue-700'
                          }`}>{row.operation}</span>
                        </td>
                        <td className="py-2 px-4 text-right font-semibold">{row.quantity}</td>
                        <td className="py-2 px-4 text-gray-500 text-xs">{row.note || '—'}</td>
                      </tr>
                    ))}
                    {validation.valid.length > 25 && (
                      <tr>
                        <td colSpan={4} className="py-2 px-4 text-center text-gray-400 text-xs">
                          + {validation.valid.length - 25} autres lignes non affichées
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
