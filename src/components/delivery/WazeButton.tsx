'use client'

import { Button } from '@/components/ui/button'
import { ExternalLink } from 'lucide-react'

interface WazeButtonProps {
  address: string
  city: string
  lat?: number
  lng?: number
  variant?: 'default' | 'outline' | 'ghost' | 'destructive'
  size?: 'default' | 'sm' | 'icon' | 'lg'
}

export function WazeButton({
  address,
  city,
  lat,
  lng,
  variant = 'outline',
  size = 'sm'
}: WazeButtonProps) {
  const openWaze = () => {
    let url: string

    if (lat && lng) {
      // Use coordinates if available
      url = `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`
    } else {
      // Use address as fallback
      const query = encodeURIComponent(`${address}, ${city}`)
      url = `https://waze.com/ul?navigate=yes&q=${query}`
    }

    window.open(url, '_blank')
  }

  return (
    <Button
      onClick={openWaze}
      variant={variant}
      size={size}
      style={{
        backgroundColor: variant === 'outline' ? '#33ccff' : undefined,
        borderColor: variant === 'outline' ? '#33ccff' : undefined,
        color: variant === 'outline' ? 'white' : undefined
      }}
    >
      <ExternalLink className="h-4 w-4 mr-1" />
      Waze
    </Button>
  )
}
