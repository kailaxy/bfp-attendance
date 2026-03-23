import { useCallback, useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { AlertTriangle, CheckCircle2, Loader2, QrCode, ShieldAlert } from 'lucide-react'
import { attendanceApi } from '../services'

const SCANNER_REGION_ID = 'attendance-scanner-region'
const CAMERA_FALLBACK_ORDER = [
  { facingMode: { exact: 'environment' } },
  { facingMode: 'environment' },
  { facingMode: 'user' },
]
const SUCCESS_COOLDOWN_MS = 3000

const ERROR_MESSAGE_BY_CODE = {
  INVALID_JSON: 'Scan request format is invalid. Please try scanning again.',
  MALFORMED_PAYLOAD: 'Scan request could not be processed. Please rescan the QR code.',
  VALIDATION_ERROR: 'No valid QR code was detected. Please retry.',
  USER_NOT_FOUND: 'Personnel record was not found. Verify the QR code and try again.',
  INVALID_TRANSITION:
    'Daily scan limit reached for this personnel. Please contact your supervisor if needed.',
  NETWORK_ERROR: 'Unable to reach the attendance service. Check connection and retry.',
  SCAN_PROCESS_FAILED: 'Scan processing failed on the server. Please retry in a moment.',
  INTERNAL_ERROR: 'Attendance service encountered an error. Please retry shortly.',
}

const toDisplayName = (data) => {
  const firstName = data?.attendee?.firstName || data?.profile?.firstName || ''
  const lastName = data?.attendee?.lastName || data?.profile?.lastName || ''
  const rank = data?.attendee?.rank || data?.profile?.rank || ''
  const composed = [rank, lastName, firstName].filter(Boolean).join(' ').trim()
  if (composed) {
    return composed
  }

  const attendeeName = data?.attendee?.name
  if (attendeeName) {
    return attendeeName
  }

  const profileFullName = data?.profile?.fullName
  if (profileFullName) {
    return profileFullName
  }

  return 'Unknown Personnel'
}

const toProfileCard = (data) => ({
  photoUrl: data?.attendee?.photoUrl || data?.profile?.photoUrl || '',
  name: toDisplayName(data),
  rank: data?.attendee?.rank || data?.profile?.rank || 'N/A',
  status:
    data?.attendee?.status || data?.profile?.status || (data?.success ? 'On-Duty' : 'Unknown'),
  message: data?.message || 'Scan submitted successfully.',
})

const toErrorMessage = (error) =>
  ERROR_MESSAGE_BY_CODE[error?.code] || error?.message || 'Scan failed. Please try again.'

const AttendanceScannerPage = () => {
  const scannerRef = useRef(null)
  const scanGuardRef = useRef(false)
  const isScanningRef = useRef(false)
  const isSubmittingRef = useRef(false)
  const releaseGuardTimeoutRef = useRef(null)
  const successResetTimeoutRef = useRef(null)
  const [cameraState, setCameraState] = useState('idle')
  const [statusMessage, setStatusMessage] = useState(
    'Camera is idle. Select Start Camera to begin.'
  )
  const [latestScanValue, setLatestScanValue] = useState('No scan captured yet.')
  const [submissionState, setSubmissionState] = useState('idle')
  const [scanResult, setScanResult] = useState(null)

  const releaseScanGuard = useCallback(() => {
    if (releaseGuardTimeoutRef.current) {
      clearTimeout(releaseGuardTimeoutRef.current)
      releaseGuardTimeoutRef.current = null
    }

    releaseGuardTimeoutRef.current = setTimeout(() => {
      scanGuardRef.current = false
      releaseGuardTimeoutRef.current = null
    }, 1200)
  }, [])

  const cleanupScanner = useCallback(async () => {
    if (releaseGuardTimeoutRef.current) {
      clearTimeout(releaseGuardTimeoutRef.current)
      releaseGuardTimeoutRef.current = null
    }

    if (successResetTimeoutRef.current) {
      clearTimeout(successResetTimeoutRef.current)
      successResetTimeoutRef.current = null
    }

    scanGuardRef.current = false
    isSubmittingRef.current = false

    const scanner = scannerRef.current
    if (!scanner) {
      return
    }

    try {
      if (isScanningRef.current) {
        await scanner.stop()
      }
    } catch {
      // No-op: scanner can already be stopped by runtime transitions.
    } finally {
      try {
        await scanner.clear()
      } catch {
        // No-op: clear may fail if scanner state already reset.
      }

      isScanningRef.current = false
      scannerRef.current = null
    }
  }, [])

  const handleStartCamera = useCallback(async () => {
    if (cameraState === 'starting' || cameraState === 'active') {
      return
    }

    setCameraState('starting')
    setStatusMessage('Starting camera...')

    if (!scannerRef.current) {
      scannerRef.current = new Html5Qrcode(SCANNER_REGION_ID)
    }

    const scanner = scannerRef.current
    const onScanSuccess = async (decodedText) => {
      if (scanGuardRef.current) {
        return
      }

      if (isSubmittingRef.current) {
        setStatusMessage('Submission in progress. Please hold the QR code steady...')
        return
      }

      scanGuardRef.current = true
      isSubmittingRef.current = true
      setLatestScanValue(decodedText)
      setSubmissionState('loading')
      setScanResult(null)
      setStatusMessage('Scan detected. Submitting to attendance service...')

      let scannerPaused = false
      try {
        scanner.pause(true)
        scannerPaused = true
        setCameraState('paused')
      } catch {
        scannerPaused = false
      }

      const result = await attendanceApi.submitScan({
        qrCode: decodedText,
        scannedAt: new Date().toISOString(),
        scannerId: 'attendance-scanner-ui',
      })

      if (result.ok) {
        setSubmissionState('success')
        setScanResult({
          type: 'success',
          profile: toProfileCard(result.data),
          referenceId: result.data?.referenceId,
          timestamp: result.data?.timestamp,
        })

        const cooldownSeconds = Math.floor(SUCCESS_COOLDOWN_MS / 1000)
        setStatusMessage(
          `Scan submitted successfully. Camera paused for ${cooldownSeconds} seconds before next scan.`
        )

        if (releaseGuardTimeoutRef.current) {
          clearTimeout(releaseGuardTimeoutRef.current)
          releaseGuardTimeoutRef.current = null
        }

        if (successResetTimeoutRef.current) {
          clearTimeout(successResetTimeoutRef.current)
          successResetTimeoutRef.current = null
        }

        successResetTimeoutRef.current = setTimeout(() => {
          setSubmissionState('idle')
          setScanResult(null)
          scanGuardRef.current = false
          isSubmittingRef.current = false

          if (scannerPaused && scannerRef.current) {
            try {
              scannerRef.current.resume()
              setCameraState('active')
              setStatusMessage('Camera is active. Point the QR code inside the scanner frame.')
            } catch {
              setCameraState('error')
              setStatusMessage(
                'Scan completed but camera failed to resume. Restart camera to continue scanning.'
              )
            }
          } else {
            setStatusMessage('Scan cooldown completed. Ready for next scan.')
          }

          successResetTimeoutRef.current = null
        }, SUCCESS_COOLDOWN_MS)

        return
      } else {
        setSubmissionState('error')
        setScanResult({
          type: 'error',
          message: toErrorMessage(result.error),
          code: result.error?.code || 'SCAN_FAILED',
        })
        setStatusMessage('Scan submission failed. Please review the error card and retry.')
      }

      isSubmittingRef.current = false
      if (scannerPaused && scannerRef.current) {
        try {
          scannerRef.current.resume()
          setCameraState('active')
        } catch {
          setCameraState('error')
          setStatusMessage('Camera failed to resume after scan error. Restart camera and retry.')
        }
      }
      releaseScanGuard()
    }

    const onScanFailure = () => {
      // Intentionally no-op to avoid UI thrash from frequent decode misses.
    }

    let started = false

    for (const cameraConfig of CAMERA_FALLBACK_ORDER) {
      try {
        await scanner.start(
          cameraConfig,
          {
            fps: 10,
            qrbox: { width: 260, height: 260 },
          },
          onScanSuccess,
          onScanFailure
        )

        started = true
        break
      } catch {
        // Try the next fallback camera preference.
      }
    }

    if (!started) {
      await cleanupScanner()
      setCameraState('error')
      setStatusMessage('Unable to start camera. Check browser permissions and camera availability.')
      return
    }

    isScanningRef.current = true
    setCameraState('active')
    setStatusMessage('Camera is active. Point the QR code inside the scanner frame.')
  }, [cameraState, cleanupScanner, releaseScanGuard])

  const handleStopCamera = useCallback(async () => {
    if (cameraState === 'idle' || cameraState === 'stopping') {
      return
    }

    setCameraState('stopping')
    setStatusMessage('Stopping camera...')
    await cleanupScanner()
    setCameraState('idle')
    setStatusMessage('Camera is idle. Select Start Camera to begin.')
  }, [cameraState, cleanupScanner])

  useEffect(() => {
    return () => {
      void cleanupScanner()
    }
  }, [cleanupScanner])

  return (
    <section className="space-y-4">
      <header className="rounded-panel border border-brand-secondary/20 bg-surface-base p-5 shadow-card">
        <p className="text-meta font-semibold uppercase tracking-wide text-brand-secondary">
          Attendance Scanner
        </p>
        <h2 className="mt-1 font-heading text-heading-1 text-text-heading">QR Check-In Control</h2>
        <p className="mt-2 text-body text-text-body">
          Start the camera manually, scan personnel QR, and submit attendance events through the
          configured adapter.
        </p>
      </header>

      <article className="rounded-panel border border-brand-secondary/20 bg-surface-base p-5 shadow-card">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleStartCamera}
            disabled={cameraState === 'starting' || cameraState === 'active'}
            className="inline-flex items-center gap-2 rounded-control border border-brand-primary/30 bg-brand-primary px-4 py-2 text-meta font-semibold text-text-inverse transition duration-160 hover:bg-brand-primary-hover active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
          >
            <QrCode size={16} />
            {cameraState === 'starting' ? 'Starting...' : 'Start Camera'}
          </button>

          <button
            type="button"
            onClick={handleStopCamera}
            disabled={cameraState !== 'active' && cameraState !== 'paused'}
            className="rounded-control border border-brand-secondary/30 bg-surface-base px-4 py-2 text-meta font-semibold text-brand-secondary transition duration-160 hover:bg-brand-secondary-soft active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
          >
            Stop Camera
          </button>
        </div>

        <div className="mt-4 rounded-control border border-brand-secondary/20 bg-surface-muted p-3">
          <p className="text-meta font-semibold uppercase tracking-wide text-text-muted">
            Scanner Status
          </p>
          <p className="mt-1 text-body text-text-body">{statusMessage}</p>
        </div>

        <div className="mt-4 rounded-control border border-brand-secondary/20 bg-surface-muted p-3">
          <p className="text-meta font-semibold uppercase tracking-wide text-text-muted">
            Latest Scan
          </p>
          <p className="mt-1 break-all text-body text-text-body">{latestScanValue}</p>
        </div>

        {submissionState === 'loading' ? (
          <div className="mt-4 rounded-control border border-status-warning/30 bg-status-warning-soft p-4">
            <p className="inline-flex items-center gap-1 text-meta font-semibold uppercase tracking-wide text-status-warning">
              <Loader2 size={14} className="animate-spin" />
              Processing
            </p>
            <p className="mt-1 text-body text-status-warning">
              Submitting scan to attendance service...
            </p>
          </div>
        ) : null}

        {submissionState === 'success' && scanResult?.type === 'success' ? (
          <div className="mt-4 rounded-control border border-status-success/30 bg-status-success-soft p-4">
            <p className="inline-flex items-center gap-1 text-meta font-semibold uppercase tracking-wide text-status-success">
              <CheckCircle2 size={14} />
              Scan Success
            </p>
            <div className="mt-3 flex items-start gap-3">
              {scanResult.profile.photoUrl ? (
                <img
                  src={scanResult.profile.photoUrl}
                  alt={`${scanResult.profile.name} profile`}
                  className="h-16 w-16 rounded-control border border-status-success/30 object-cover"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-control border border-status-success/30 bg-surface-base text-meta font-medium text-status-success">
                  No Photo
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-body font-semibold text-text-heading">{scanResult.profile.name}</p>
                <p className="text-body text-text-body">Rank: {scanResult.profile.rank}</p>
                <p className="text-body text-text-body">Status: {scanResult.profile.status}</p>
                <p className="mt-1 text-meta text-status-success">{scanResult.profile.message}</p>
                {scanResult.referenceId ? (
                  <p className="text-meta text-status-success">Reference: {scanResult.referenceId}</p>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {submissionState === 'error' && scanResult?.type === 'error' ? (
          <div className="mt-4 rounded-control border border-status-danger/30 bg-status-danger-soft p-4">
            <p className="inline-flex items-center gap-1 text-meta font-semibold uppercase tracking-wide text-status-danger">
              <ShieldAlert size={14} />
              Scan Error
            </p>
            <p className="mt-1 text-body text-status-danger">{scanResult.message}</p>
            <p className="mt-1 text-meta text-status-danger">Error Code: {scanResult.code}</p>
            <p className="mt-2 inline-flex items-center gap-1 text-meta text-status-danger">
              <AlertTriangle size={13} />
              Retry guidance: keep the QR code centered and scan again.
            </p>
          </div>
        ) : null}

        <div className="mt-4 overflow-hidden rounded-panel border border-brand-secondary/20 bg-surface-inverse shadow-card">
          <div id={SCANNER_REGION_ID} className="min-h-[320px] w-full" />
        </div>
      </article>
    </section>
  )
}

export default AttendanceScannerPage
