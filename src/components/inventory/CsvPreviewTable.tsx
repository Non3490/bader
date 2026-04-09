'use client'

import { Check, X } from 'lucide-react'

interface CsvRow {
  rowNumber: number
  data: {
    sku: string
    quantity: number
    operation: 'ADD' | 'REMOVE' | 'SET'
    cost_per_unit?: number
    reason?: string
    notes?: string
  }
  valid: boolean
  errors: string[]
}

interface CsvPreviewTableProps {
  rows: CsvRow[]
  summary: {
    total: number
    valid: number
    invalid: number
  }
  onConfirm?: () => void
  onCancel?: () => void
  isProcessing?: boolean
}

export function CsvPreviewTable({
  rows,
  summary,
  onConfirm,
  onCancel,
  isProcessing = false
}: CsvPreviewTableProps) {
  const getOperationBadge = (operation: string) => {
    const styles = {
      ADD: 'bg-green-100 text-green-800',
      REMOVE: 'bg-red-100 text-red-800',
      SET: 'bg-blue-100 text-blue-800'
    }
    return styles[operation as keyof typeof styles] || 'bg-gray-100 text-gray-800'
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
        <div className="text-sm">
          <span className="font-medium text-gray-700">Total:</span> {summary.total} lignes
        </div>
        <div className="text-sm">
          <span className="font-medium text-green-700">Valides:</span> {summary.valid}
        </div>
        {summary.invalid > 0 && (
          <div className="text-sm">
            <span className="font-medium text-red-700">Erreurs:</span> {summary.invalid}
          </div>
        )}
      </div>

      {/* Preview Table */}
      <div className="border border-gray-200 rounded-lg overflow-hidden max-h-96 overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="px-3 py-2 text-left font-semibold text-gray-700 w-12">État</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-700">Ligne</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-700">SKU</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-700">Opération</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-700">Quantité</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-700">Coût</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-700">Raison</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-700">Notes</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-700">Erreurs</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {rows.map((row) => (
              <tr
                key={row.rowNumber}
                className={row.valid ? 'bg-white' : 'bg-red-50'}
              >
                <td className="px-3 py-2">
                  {row.valid ? (
                    <Check className="w-4 h-4 text-green-600" />
                  ) : (
                    <X className="w-4 h-4 text-red-600" />
                  )}
                </td>
                <td className="px-3 py-2 text-gray-600">#{row.rowNumber}</td>
                <td className="px-3 py-2 font-medium text-gray-900">{row.data.sku}</td>
                <td className="px-3 py-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getOperationBadge(row.data.operation)}`}>
                    {row.data.operation}
                  </span>
                </td>
                <td className="px-3 py-2 text-gray-700">{row.data.quantity}</td>
                <td className="px-3 py-2 text-gray-700">
                  {row.data.cost_per_unit ? `${row.data.cost_per_unit.toLocaleString('fr-FR')} FCFA` : '-'}
                </td>
                <td className="px-3 py-2 text-gray-700">{row.data.reason || '-'}</td>
                <td className="px-3 py-2 text-gray-700 max-w-xs truncate">{row.data.notes || '-'}</td>
                <td className="px-3 py-2">
                  {row.errors.length > 0 ? (
                    <ul className="text-xs text-red-600 space-y-0.5">
                      {row.errors.map((error, idx) => (
                        <li key={idx}>• {error}</li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-green-600 text-xs">OK</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Action Buttons */}
      {(onConfirm || onCancel) && (
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
          {onCancel && (
            <button
              onClick={onCancel}
              disabled={isProcessing}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Annuler
            </button>
          )}
          {onConfirm && (
            <button
              onClick={onConfirm}
              disabled={isProcessing || summary.invalid > 0}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? 'Traitement...' : `Importer ${summary.valid} lignes valides`}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
