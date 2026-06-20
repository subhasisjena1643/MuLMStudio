import { useEffect, useRef, useCallback } from 'react'

export function useTracer(code, onGraphUpdate, onError) {
  const ws = useRef(null)
  const debounceRef = useRef(null)
  const reconnectRef = useRef(null)
  const unmountedRef = useRef(false)
  const pendingCode = useRef(null)

  useEffect(() => {
    unmountedRef.current = false

    function connect() {
      if (unmountedRef.current) return

      const socket = new WebSocket('ws://localhost:8001/ws/trace')
      ws.current = socket

      socket.onopen = () => {
        // flush code typed while socket was still connecting
        if (pendingCode.current !== null) {
          socket.send(JSON.stringify({ code: pendingCode.current }))
          pendingCode.current = null
        }
      }

      socket.onmessage = (event) => {
        const data = JSON.parse(event.data)
        if (data.status === 'success') onGraphUpdate(data.graph)
        else onError(data.error)
      }

      socket.onclose = () => {
        // auto-reconnect unless we deliberately unmounted
        if (!unmountedRef.current) {
          reconnectRef.current = setTimeout(connect, 2000)
        }
      }

      socket.onerror = () => socket.close() // triggers onclose → reconnect
    }

    connect()

    return () => {
      unmountedRef.current = true
      clearTimeout(reconnectRef.current)
      ws.current?.close()
    }
  }, [onGraphUpdate, onError])

  const trace = useCallback((codeToSend) => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      if (ws.current?.readyState === WebSocket.OPEN) {
        ws.current.send(JSON.stringify({ code: codeToSend }))
      } else {
        pendingCode.current = codeToSend // queue for onopen
      }
    }, 300)
  }, [])

  useEffect(() => {
    trace(code)
  }, [code, trace])
}
