import './globals.css'

export const metadata = {
  title: 'Relatórios de Anúncios',
  description: 'PWA para geração automática de relatórios de campanhas publicitárias',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}