'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Printer, Loader2 } from 'lucide-react'

interface Order {
    id: string
    trackingNumber: string
    customerName: string
    customerPhone: string
    customerAddress: string
    city: string
    productName: string
    quantity: number
    codAmount: number
    status: string
    createdAt: string
    seller?: {
        id: string
        name: string
        email: string
    }
    user?: {
        id: string
        name: string
        email: string
        role: string
    }
}

interface PrintLabelsButtonProps {
    selectedOrders: Order[]
    onPrintComplete?: () => void
}

export function PrintLabelsButton({ selectedOrders, onPrintComplete }: PrintLabelsButtonProps) {
    const [printing, setPrinting] = useState(false)
    const iframeRef = useRef<HTMLIFrameElement | null>(null)

    const generateLabels = () => {
        if (selectedOrders.length === 0) {
            alert('Please select at least one order to print labels.')
            return
        }

        setPrinting(true)

        try {
            if (iframeRef.current) {
                document.body.removeChild(iframeRef.current)
                iframeRef.current = null
            }

            const labelsHTML = selectedOrders.map(order => {
                const sellerName = order.seller?.name || order.user?.name || 'N/A'
                
                return `
                <div class="label-page">
                    <div class="label-content">
                        <div class="tracking">${order.trackingNumber}</div>
                        <div class="section">
                            <span class="label-text">Customer:</span>
                            <div class="value">${order.customerName}</div>
                        </div>
                        <div class="section">
                            <span class="label-text">Phone:</span>
                            <div class="value">${order.customerPhone}</div>
                        </div>
                        <div class="section">
                            <span class="label-text">Address:</span>
                            <div class="value">${order.customerAddress}</div>
                            <div class="value">${order.city}</div>
                        </div>
                        <div class="divider"></div>
                        <div class="section">
                            <span class="label-text">Product:</span>
                            <div class="value">${order.productName} (x${order.quantity})</div>
                        </div>
                        <div class="section">
                            <span class="label-text">Seller:</span>
                            <div class="value">${sellerName}</div>
                        </div>
                        <div class="divider" style="margin-top: auto;"></div>
                        <div class="cod">COD Amount:</div>
                        <div class="cod-value">${order.codAmount.toLocaleString('en-GA')} XAF</div>
                        <div class="signature-label">Signature:</div>
                        <div class="signature-box"></div>
                    </div>
                </div>
            `
            }).join('')

            const iframe = document.createElement('iframe')
            iframe.style.display = 'none'
            document.body.appendChild(iframe)
            iframeRef.current = iframe

            const doc = iframe.contentWindow?.document
            if (!doc) throw new Error('Could not access iframe content')

            doc.open()
            doc.write(`
                <html>
                <head>
                    <title>Print Labels</title>
                    <style>
                        @page {
                            size: 102mm 152mm;
                            margin: 0;
                        }
                        body {
                            margin: 0;
                            padding: 0;
                            font-family: Arial, sans-serif;
                            background: white;
                        }
                        .label-page {
                            width: 102mm;
                            height: 152mm;
                            page-break-after: always;
                            box-sizing: border-box;
                            padding: 5mm;
                            overflow: hidden;
                        }
                        .label-page:last-child {
                            page-break-after: auto;
                        }
                        .label-content {
                            height: 100%;
                            display: flex;
                            flex-direction: column;
                        }
                        .tracking {
                            font-size: 24px;
                            font-weight: bold;
                            text-align: center;
                            margin-bottom: 3mm;
                            padding-bottom: 3mm;
                            border-bottom: 2px solid #000;
                        }
                        .section { margin-bottom: 3mm; }
                        .label-text {
                            font-weight: normal;
                            color: #555;
                            font-size: 12px;
                        }
                        .value {
                            font-weight: bold;
                            font-size: 16px;
                            line-height: 1.2;
                        }
                        .divider {
                            border-bottom: 1px dashed #000;
                            margin: 3mm 0;
                        }
                        .cod {
                            font-size: 14px;
                            font-weight: bold;
                            text-align: center;
                        }
                        .cod-value {
                            font-size: 26px;
                            text-align: center;
                            font-weight: bold;
                            margin-bottom: 3mm;
                        }
                        .signature-box {
                            border: 1px solid #000;
                            height: 15mm;
                            margin-top: 1mm;
                        }
                        .signature-label {
                            font-size: 12px;
                            margin-bottom: 1mm;
                        }
                    </style>
                </head>
                <body>
                    ${labelsHTML}
                </body>
                </html>
            `)
            doc.close()

            iframe.onload = () => {
                iframe.contentWindow?.focus()
                iframe.contentWindow?.print()
                
                // Set a timeout to clear the printing status, 
                // as we can't always reliably detect when print dialog is closed
                setTimeout(() => {
                    setPrinting(false)
                    if (onPrintComplete) onPrintComplete()
                }, 500)
            }
        } catch (error) {
            console.error('Failed to generate labels', error)
            alert('Failed to generate labels. Please try again.')
            setPrinting(false)
        }
    }

    return (
        <Button
            variant="secondary"
            onClick={generateLabels}
            disabled={selectedOrders.length === 0 || printing}
        >
            {printing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
                <Printer className="mr-2 h-4 w-4" />
            )}
            Print Labels ({selectedOrders.length})
        </Button>
    )
}
