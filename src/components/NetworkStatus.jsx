import { WifiOff, Signal, Zap } from 'lucide-react'

export default function NetworkStatus({ connected, latency, reconnectCount }) {
  // Fix B18: Compute status as plain variable instead of useState/useEffect
  const status = !connected ? 'disconnected'
    : latency < 100 ? 'excellent'
    : latency < 300 ? 'good'
    : latency < 500 ? 'poor'
    : 'very-poor'

  if (!connected) {
    return (
      <div className="network-status disconnected">
        <WifiOff size={14} />
        <span>Offline</span>
      </div>
    )
  }

  const getLatencyColor = () => {
    if (latency < 100) return '#22C55E'
    if (latency < 300) return '#EAB308'
    return '#EF4444'
  }

  return (
    <div className={`network-status ${status}`}>
      <Signal size={14} style={{ color: getLatencyColor() }} />
      <span className="latency">{latency}ms</span>
      {reconnectCount > 0 && (
        <span className="reconnect-badge" title={`Reconnected ${reconnectCount} times`}>
          <Zap size={12} /> {reconnectCount}
        </span>
      )}
    </div>
  )
}
