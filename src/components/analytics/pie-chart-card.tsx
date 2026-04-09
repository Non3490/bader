'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts'
import { cn } from '@/lib/utils'

interface StatusBreakdown {
  status: string
  count: number
  percentage: number
  color: string
}

interface PieChartCardProps {
  title: string
  data: StatusBreakdown[]
  onSegmentClick?: (status: string) => void
  className?: string
}

export function PieChartCard({ title, data, onSegmentClick, className }: PieChartCardProps) {
  const formatStatusLabel = (status: string) => {
    return status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())
  }

  return (
    <Card className={cn('', className)}>
      <CardHeader>
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <span>{title}</span>
          {onSegmentClick && (
            <span className="text-xs text-muted-foreground font-normal">(Click to filter)</span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground text-sm">No data yet</p>
        ) : (
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ status, percentage }) => `${percentage > 5 ? percentage + '%' : ''}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="count"
                  onClick={onSegmentClick ? (entry) => onSegmentClick(entry.status) : undefined}
                  className={onSegmentClick ? 'cursor-pointer' : ''}
                >
                  {data.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.color}
                      stroke={onSegmentClick ? 'transparent' : entry.color}
                      strokeWidth={onSegmentClick ? 2 : 0}
                      className={onSegmentClick ? 'hover:opacity-80 transition-opacity' : ''}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number, name: string, props: any) => [
                    `${value} (${props.payload.percentage}%)`,
                    formatStatusLabel(props.payload.status)
                  ]}
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                />
                <Legend
                  formatter={(value) => formatStatusLabel(value)}
                  iconType="circle"
                  verticalAlign="bottom"
                  height={60}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
