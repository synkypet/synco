"use client"
import React, { useEffect, useState } from 'react'

const NoSSR = ({ children }: { children: React.ReactNode }) => {
  const [isClient, setIsClient] = useState(false)
  useEffect(() => { setIsClient(true) }, [])
  return isClient ? <>{children}</> : null
}
export default NoSSR
