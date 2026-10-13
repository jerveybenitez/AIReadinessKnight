import React from 'react'

import './styles.css'

export const metadata = {
  title: 'AI-Ready Knight',
  description:
    'A gamified AI-readiness assessment. Train across three disciplines, see your scores, and share your knight’s report.',
}

export default async function RootLayout(props: { children: React.ReactNode }) {
  const { children } = props

  return (
    <html lang="en">
      <body>
        <main>{children}</main>
      </body>
    </html>
  )
}
