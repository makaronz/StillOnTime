export default function Configuration(): JSX.Element {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Configuration</h1>
        <p className="text-gray-600">Manage your system settings and preferences</p>
      </div>

      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">API Configuration</h3>
        <p className="text-sm text-gray-600">Configure your Google OAuth and API settings</p>
      </div>
    </div>
  )
}