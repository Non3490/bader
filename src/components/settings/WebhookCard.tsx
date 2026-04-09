'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CheckCircle, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface WebhookCardProps {
  key: string
  label: string
  color: string
  isConfigured: boolean
  onSave: (key: string) => void
  onDelete: (key: string) => void
}

export function WebhookCard({ key, label, color, isConfigured, onSave, onDelete }: WebhookCardProps) {
  const [localSecret, setLocalSecret] = useState('')

  const handleSave = async () => {
    if (localSecret.trim()) {
      await onSave(key)
      setLocalSecret('')
    }
  }

  return (
    <Card className={cn('transition-all', isConfigured && 'ring-2 ring-green-500')}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            {label}
          </CardTitle>
          <Badge className={cn(
            isConfigured
              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
              : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
          )}>
            {isConfigured ? 'Configured' : 'Not Configured'}
          </Badge>
        </div>
        {isConfigured && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDelete(key)}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor={`${key}-secret`}>
            {isConfigured ? 'Update Webhook Secret' : 'Webhook Secret'}
          </Label>
          <div className="flex gap-2 mt-1">
            <Input
              id={`${key}-secret`}
              type="password"
              placeholder={isConfigured ? 'Enter new secret to update...' : 'Paste your webhook secret...'}
              value={localSecret}
              onChange={(e) => setLocalSecret(e.target.value)}
            />
            {localSecret.trim() && (
              <Button
                variant="outline"
                size="icon"
                onClick={handleSave}
              >
                <CheckCircle className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        <div className="text-xs text-muted-foreground mt-2">
          {isConfigured
            ? 'Secret is stored securely. Enter a new value above to update, or delete to remove.'
            : 'The secret is stored securely and never exposed to the frontend.'}
        </div>
      </CardContent>
    </Card>
  )
}
