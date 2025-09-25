export default function History(): JSX.Element {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Processing History</h1>
        <p className="text-gray-600">View your email processing history and analytics</p>
      </div>

      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Processing</h3>
        <p className="text-sm text-gray-600">No processing history available</p>
      </div>
    </div>
  )
}