export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">
            Relatórios de Anúncios
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Sistema funcionando! ✅
          </p>
          <div className="mt-6 space-y-4">
            <div className="bg-white p-4 rounded-lg shadow">
              <h2 className="font-semibold text-gray-800">FASE 1 COMPLETA</h2>
              <p className="text-sm text-gray-600">Infraestrutura Base ✅</p>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg">
              <h2 className="font-semibold text-blue-800">FASE 2 INICIANDO</h2>
              <p className="text-sm text-blue-600">Sistema de Autenticação 🚀</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}