import React from 'react'
import BackButton from '../components/BackButton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Link } from 'wouter'
import { FileText, ClipboardList, Calendar, TrendingUp } from 'lucide-react'

export default function FormLibrary() {
  const forms = [
    {
      id: 'daily-stock-sales',
      title: 'Daily Sales & Stock',
      description: 'Fort Knox locked form for daily sales and inventory tracking',
      path: '/daily-stock-sales',
      icon: ClipboardList,
      status: 'Active',
      color: 'bg-green-100 text-green-800'
    },
    {
      id: 'expenses',
      title: 'Expenses',
      description: 'Track business expenses and categorize spending',
      path: '/expenses',
      icon: TrendingUp,
      status: 'Active',
      color: 'bg-blue-100 text-blue-800'
    },
    {
      id: 'shift-reports',
      title: 'Shift Reports',
      description: 'Historical shift reports and analysis',
      path: '/reports-analysis',
      icon: Calendar,
      status: 'View Only',
      color: 'bg-gray-100 text-gray-800'
    }
  ]

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <BackButton />
      
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-800 font-['Poppins']">Form Library</h1>
        <p className="text-gray-600 mt-2">Access all available forms and reports</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {forms.map((form) => {
          const IconComponent = form.icon
          
          return (
            <Card key={form.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <IconComponent className="w-8 h-8 text-blue-600" />
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${form.color}`}>
                    {form.status}
                  </span>
                </div>
                <CardTitle className="text-lg">{form.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 text-sm mb-4">
                  {form.description}
                </p>
                <Link href={form.path}>
                  <Button className="w-full" variant="outline">
                    {form.status === 'View Only' ? 'View Reports' : 'Open Form'}
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Quick Stats */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Quick Stats
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-green-600">1</p>
              <p className="text-sm text-gray-600">Active Form</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-600">2</p>
              <p className="text-sm text-gray-600">Reporting Tools</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-purple-600">100%</p>
              <p className="text-sm text-gray-600">Fort Knox Secured</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}