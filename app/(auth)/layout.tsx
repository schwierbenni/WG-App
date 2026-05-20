export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-indigo-600">FlatMate</h1>
          <p className="text-gray-500 mt-1">WG-Verwaltung leicht gemacht</p>
        </div>
        {children}
      </div>
    </div>
  )
}
