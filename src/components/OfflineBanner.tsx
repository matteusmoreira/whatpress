import React, { useEffect, useState } from 'react'

export default function OfflineBanner() {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine)

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  if (isOnline) return null

  return (
    <div className="bg-red-100 dark:bg-red-900 border-b border-red-300 dark:border-red-700 text-red-900 dark:text-red-200 text-sm px-4 py-2 text-center">
      Sem conexão com a internet. Algumas funcionalidades podem não funcionar.
    </div>
  )
}