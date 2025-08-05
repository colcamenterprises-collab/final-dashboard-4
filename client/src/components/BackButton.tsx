import { useLocation } from 'wouter'

export default function BackButton() {
  const [, setLocation] = useLocation()
  
  const handleBack = () => {
    // Go back to dashboard or previous page
    window.history.back()
  }

  return (
    <button 
      className="flex items-center gap-2 mb-4 px-3 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
      onClick={handleBack}
    >
      ← Back
    </button>
  )
}