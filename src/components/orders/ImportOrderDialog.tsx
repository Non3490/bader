'use client'

import { useState } from 'react'
import Papa from 'papaparse'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Upload, FileUp, AlertCircle, CheckCircle, Download } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

interface ImportOrderDialogProps {
    onImportSuccess: () => void
}

export function ImportOrderDialog({ onImportSuccess }: ImportOrderDialogProps) {
    const [open, setOpen] = useState(false)
    const [file, setFile] = useState<File | null>(null)
    const [importing, setImporting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<{ total: number; imported: number; duplicates: number } | null>(null)
    const [validationErrors, setValidationErrors] = useState<{ rowIndex: number; errors: string[] }[] | null>(null)

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0])
            setError(null)
            setSuccess(null)
        }
    }

    const handleDownloadTemplate = async () => {
        try {
            const response = await fetch('/api/orders/template')
            if (!response.ok) {
                throw new Error('Failed to download template')
            }

            const blob = await response.blob()
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = 'order-import-template.xlsx'
            document.body.appendChild(a)
            a.click()
            window.URL.revokeObjectURL(url)
            document.body.removeChild(a)
        } catch (err: any) {
            setError(err.message || 'Failed to download template')
        }
    }

    const handleImport = async () => {
        if (!file) {
            setError('Please select a CSV file first.')
            return
        }

        setImporting(true)
        setError(null)
        setSuccess(null)

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                try {
                    const response = await fetch('/api/orders/import', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ orders: results.data }),
                    })

                    const result = await response.json()

                    if (!response.ok) {
                        // Check for validation errors
                        if (result.validationErrors && Array.isArray(result.validationErrors)) {
                            setValidationErrors(result.validationErrors)
                            setError(`Validation failed for ${result.validationErrors.length} row(s). ${result.totalRows - result.validRows} valid rows will not be imported.`)
                        } else {
                            throw new Error(result.error || 'Failed to import orders')
                        }
                    } else {
                        setSuccess({
                            total: result.total,
                            imported: result.imported,
                            duplicates: result.duplicates,
                        })
                    }

                    if (result.imported > 0) {
                        onImportSuccess()
                    }
                } catch (err: any) {
                    setError(err.message || 'An error occurred during import.')
                } finally {
                    setImporting(false)
                }
            },
            error: (error) => {
                setError(`Failed to read CSV: ${error.message}`)
                setImporting(false)
            }
        })
    }

    return (
        <Dialog open={open} onOpenChange={(isOpen) => {
            setOpen(isOpen)
            if (!isOpen) {
                setFile(null)
                setError(null)
                setSuccess(null)
            }
        }}>
            <DialogTrigger asChild>
                <Button variant="secondary">
                    <Upload className="mr-2 h-4 w-4" />
                    Import CSV
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Import Orders</DialogTitle>
                    <DialogDescription>
                        Upload a CSV or Excel file from Shopify, YouCan, or Google Sheets.
                        Required columns: customerName, customerPhone, city, productName, codAmount.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="flex justify-center">
                        <Button
                            variant="outline"
                            onClick={handleDownloadTemplate}
                            className="w-full max-w-sm"
                        >
                            <Download className="mr-2 h-4 w-4" />
                            Download Excel Template
                        </Button>
                    </div>
                    <div className="flex items-center justify-center w-full">
                        <label htmlFor="dropzone-file" className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-muted/50 hover:bg-muted/70 transition-colors">
                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                <FileUp className="w-8 h-8 mb-3 text-muted-foreground" />
                                <p className="mb-2 text-sm text-muted-foreground">
                                    <span className="font-semibold">Click to upload</span> or drag and drop
                                </p>
                                <p className="text-xs text-muted-foreground">CSV formatting required</p>
                                {file && (
                                    <p className="mt-2 text-sm font-medium text-primary bg-primary/10 px-2 py-1 rounded">
                                        {file.name}
                                    </p>
                                )}
                            </div>
                            <Input
                                id="dropzone-file"
                                type="file"
                                accept=".csv"
                                className="hidden"
                                onChange={handleFileChange}
                            />
                        </label>
                    </div>

                    {error && (
                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>Error</AlertTitle>
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    {success && (
                        <Alert className="bg-green-50 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-200 dark:border-green-900">
                            <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                            <AlertTitle>Import Complete</AlertTitle>
                            <AlertDescription>
                                Processed {success.total} rows. Successfully imported {success.imported} new orders.
                                {success.duplicates > 0 && ` Skipped ${success.duplicates} exact duplicates.`}
                            </AlertDescription>
                        </Alert>
                    )}

                    {validationErrors && validationErrors.length > 0 && (
                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>Validation Errors</AlertTitle>
                            <AlertDescription>
                                <div className="max-h-32 overflow-y-auto text-xs">
                                    {validationErrors.slice(0, 5).map((err, idx) => (
                                        <div key={idx} className="mb-1">
                                            Row {err.rowIndex}: {err.errors.join(', ')}
                                        </div>
                                    ))}
                                    {validationErrors.length > 5 && (
                                        <div className="font-medium mt-1">...and {validationErrors.length - 5} more</div>
                                    )}
                                </div>
                            </AlertDescription>
                        </Alert>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>
                        Close
                    </Button>
                    <Button onClick={handleImport} disabled={!file || importing}>
                        {importing ? 'Importing...' : 'Start Import'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
