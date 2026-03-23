import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { CameraView, useCameraPermissions, type BarcodeType } from 'expo-camera';
import * as Location from 'expo-location';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  AppState,
  Image,
  LayoutChangeEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  flushQueuedScans,
  getQueuedScanCount,
  submitScanWithQueue,
} from '../services';
import { spacing, typography, type AppColors, useAppTheme } from '../theme';
import type { ApiErrorPayload, ScanResponsePayload } from '../types';

type ScanOutcome =
  | {
      kind: 'idle';
    }
  | {
      kind: 'success';
      payload: ScanResponsePayload;
    }
  | {
      kind: 'error';
      error: ApiErrorPayload;
    };

type ScanDisplayPayload = {
  name: string;
  unit: string;
  status: string;
  action: string;
  timestamp: string;
  photoUrl: string;
  locationLabel?: string;
};

type BarcodePoint = {
  x: number;
  y: number;
};

type ScanEventPayload = {
  data?: string;
  bounds?: unknown;
  cornerPoints?: BarcodePoint[];
};

type ScanLocationPayload = {
  latitude: number | null;
  longitude: number | null;
  accuracyMeters: number | null;
  locationLabel: string;
  capturedAt: string;
  permissionGranted: boolean;
  unavailableReason: string;
};

const QR_BARCODE_SCANNER_SETTINGS: {
  barcodeTypes: BarcodeType[];
} = {
  barcodeTypes: [
    'qr',
    'code128',
    'code39',
    'code93',
    'codabar',
    'ean13',
    'ean8',
    'upc_a',
    'upc_e',
    'itf14',
    'pdf417',
    'aztec',
    'datamatrix',
  ],
};

const asReadable = (value: string | undefined, fallback: string) => {
  const text = String(value || '').trim();
  return text || fallback;
};

const formatScanAction = (action: string | undefined) => {
  const normalized = String(action || '').trim().toLowerCase();
  if (!normalized) return 'Unknown';
  if (normalized === 'timein') return 'Time-in';
  if (normalized === 'timeout') return 'Time-out';
  return normalized;
};

const formatScanTimestamp = (timestamp: string | undefined) => {
  const parsed = new Date(String(timestamp || ''));
  if (Number.isNaN(parsed.getTime())) {
    return 'Just now';
  }

  return parsed.toLocaleString([], {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const toScanDisplayPayload = (payload: ScanResponsePayload): ScanDisplayPayload => {
  const firstName =
    asReadable(payload.attendee?.firstName, '') ||
    asReadable(payload.profile?.firstName, '');
  const lastName =
    asReadable(payload.attendee?.lastName, '') ||
    asReadable(payload.profile?.lastName, '');
  const rank = asReadable(payload.attendee?.rank, '') || asReadable(payload.profile?.rank, '');

  const composedName = [rank, lastName, firstName].filter(Boolean).join(' ').trim();
  const attendeeName = asReadable(payload.attendee?.name, '');
  const profileName = asReadable(payload.profile?.fullName, '');
  const name = composedName || attendeeName || profileName || 'Unknown Personnel';

  const unit =
    asReadable(payload.attendee?.unit, '') ||
    asReadable(payload.profile?.unit, '') ||
    'N/A';

  const status =
    asReadable(payload.attendee?.status, '') ||
    asReadable(payload.profile?.status, '') ||
    asReadable(payload.status, '') ||
    'Unknown';

  return {
    name,
    unit,
    status,
    action: formatScanAction(payload.action),
    timestamp: formatScanTimestamp(payload.timestamp),
    photoUrl:
      asReadable(payload.attendee?.photoUrl, '') ||
      asReadable(payload.profile?.photoUrl, '') ||
      '',
    locationLabel: asReadable(
      typeof payload.data?.message === 'string' ? payload.data.message : '',
      ''
    ),
  };
};

const getDeterministicErrorMessage = (error: ApiErrorPayload): string => {
  const code = String(error.code || '').trim().toUpperCase();

  if (code === 'INVALID_TRANSITION') {
    return 'Daily scan limit reached. This personnel already completed today\'s time-in/time-out cycle.';
  }

  if (code === 'USER_NOT_FOUND') {
    return 'Personnel record not found for this QR code.';
  }

  if (code === 'VALIDATION_ERROR' || code === 'MALFORMED_PAYLOAD') {
    return 'Invalid QR payload. Please scan a valid attendance QR code.';
  }

  if (code === 'NETWORK_ERROR' || code === 'TIMEOUT') {
    return 'Cannot reach attendance server right now. Please retry.';
  }

  if (code === 'CONFIG_ERROR') {
    return 'Scanner API is not configured. Contact the administrator.';
  }

  if (code === 'QUEUED_OFFLINE') {
    return 'No connection. Scan saved locally and will sync when online.';
  }

  if (code === 'SYNC_COMPLETED') {
    return asReadable(error.message, 'Queued scans synced successfully.');
  }

  return asReadable(error.message, 'Scan failed. Please retry.');
};

const clampNumber = (value: number, min: number, max: number): number => {
  return Math.min(max, Math.max(min, value));
};

const toFiniteNumber = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const pickBestTargetPoint = (
  candidates: Array<{ centerX: number; centerY: number }>,
  frameWidth: number,
  frameHeight: number
): { centerX: number; centerY: number } => {
  const frameCenterX = frameWidth / 2;
  const frameCenterY = frameHeight / 2;

  let best = {
    centerX: frameCenterX,
    centerY: frameCenterY,
  };
  let bestScore = Number.POSITIVE_INFINITY;

  candidates.forEach((candidate) => {
    const clampedX = clampNumber(candidate.centerX, 0, frameWidth);
    const clampedY = clampNumber(candidate.centerY, 0, frameHeight);
    const clampPenalty =
      Math.abs(candidate.centerX - clampedX) +
      Math.abs(candidate.centerY - clampedY);
    const distanceFromCenter =
      Math.abs(clampedX - frameCenterX) + Math.abs(clampedY - frameCenterY);
    const score = clampPenalty * 10 + distanceFromCenter;

    if (score < bestScore) {
      bestScore = score;
      best = {
        centerX: clampedX,
        centerY: clampedY,
      };
    }
  });

  return best;
};

const extractScanTarget = (
  event: ScanEventPayload,
  frameWidth: number,
  frameHeight: number
): { centerX: number; centerY: number; qrSize: number } | null => {
  return null;
};

export const ScannerScreen = () => {
  const DECODE_COOLDOWN_MS = 1800;
  const SLOW_SUBMISSION_THRESHOLD_MS = 2500;
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isFocused = useIsFocused();
  const tabBarHeight = useBottomTabBarHeight();
  const [permission, requestPermission] = useCameraPermissions();
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isCameraLocked, setIsCameraLocked] = useState(false);
  const [frozenFrameUri, setFrozenFrameUri] = useState('');
  const [isSubmittingScan, setIsSubmittingScan] = useState(false);
  const [isSlowSubmission, setIsSlowSubmission] = useState(false);
  const [lastDecodedValue, setLastDecodedValue] = useState('');
  const [lastDecodedAt, setLastDecodedAt] = useState(0);
  const [scanOutcome, setScanOutcome] = useState<ScanOutcome>({ kind: 'idle' });
  const [queuedScanCount, setQueuedScanCount] = useState(0);
  const [isSyncingQueue, setIsSyncingQueue] = useState(false);
  const [locationStatus, setLocationStatus] = useState('Location will be attached when available.');
  const isMountedRef = useRef(true);
  const cameraRef = useRef<CameraView | null>(null);
  const isPreviewPausedRef = useRef(false);
  const submissionVersionRef = useRef(0);
  const slowSubmissionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pulseAnim = useRef(new Animated.Value(0.7)).current;
  const guideScaleAnim = useRef(new Animated.Value(1)).current;
  const guideTranslateXAnim = useRef(new Animated.Value(0)).current;
  const guideTranslateYAnim = useRef(new Animated.Value(0)).current;

  const clearSlowSubmissionTimer = useCallback(() => {
    if (slowSubmissionTimerRef.current) {
      clearTimeout(slowSubmissionTimerRef.current);
      slowSubmissionTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      clearSlowSubmissionTimer();
    };
  }, [clearSlowSubmissionTimer]);

  useEffect(() => {
    const shouldAnimate = isCameraActive && !isCameraLocked && !isSubmittingScan;

    if (!shouldAnimate) {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(0.7);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.7,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    );

    loop.start();

    return () => {
      loop.stop();
    };
  }, [isCameraActive, isCameraLocked, isSubmittingScan, pulseAnim]);

  useFocusEffect(
    useCallback(() => {
      let disposed = false;

      const refreshQueue = async () => {
        const count = await getQueuedScanCount();
        if (!disposed) {
          setQueuedScanCount(count);
        }

        if (count > 0) {
          if (!disposed) {
            setIsSyncingQueue(true);
          }
          const syncResult = await flushQueuedScans();
          if (!disposed) {
            setQueuedScanCount(syncResult.queueCount);
            setIsSyncingQueue(false);
          }
        }
      };

      void refreshQueue();

      if (permission?.granted && !isCameraLocked) {
        setIsCameraActive(true);
      }

      return () => {
        disposed = true;
        setIsCameraActive(false);
      };
    }, [permission?.granted])
  );

  const handleSyncQueuedScans = useCallback(async () => {
    setIsSyncingQueue(true);
    const result = await flushQueuedScans();
    setQueuedScanCount(result.queueCount);
    setIsSyncingQueue(false);

    if (result.successCount > 0) {
      setScanOutcome({
        kind: 'error',
        error: {
          code: 'SYNC_COMPLETED',
          message: `Synced ${result.successCount} queued scan(s).`,
        },
      });
    }
  }, []);

  useEffect(() => {
    if (!isFocused) {
      return;
    }

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      const shouldActivate =
        nextAppState === 'active' && isFocused && Boolean(permission?.granted) && !isCameraLocked;
      setIsCameraActive(shouldActivate);
    });

    return () => {
      subscription.remove();
    };
  }, [isCameraLocked, isFocused, permission?.granted]);

  const handleGrantPermission = useCallback(async () => {
    await requestPermission();
  }, [requestPermission]);

  const ensureLocationPermission = useCallback(async (): Promise<boolean> => {
    const current = await Location.getForegroundPermissionsAsync();
    if (current.granted) {
      setLocationStatus('Location ready');
      return true;
    }

    const requested = await Location.requestForegroundPermissionsAsync();
    if (requested.granted) {
      setLocationStatus('Location ready');
      return true;
    }

    setLocationStatus('Location permission denied');
    return false;
  }, []);

  const captureScanLocation = useCallback(async (): Promise<ScanLocationPayload> => {
    const granted = await ensureLocationPermission();
    if (!granted) {
      return {
        latitude: null,
        longitude: null,
        accuracyMeters: null,
        locationLabel: '',
        capturedAt: new Date().toISOString(),
        permissionGranted: false,
        unavailableReason: 'permission_denied',
      };
    }

    try {
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const latitude = Number(position.coords.latitude);
      const longitude = Number(position.coords.longitude);
      const accuracyMeters = Number.isFinite(position.coords.accuracy)
        ? Number(position.coords.accuracy)
        : null;

      const locationLabel = `${latitude.toFixed(7)}, ${longitude.toFixed(7)}`;

      setLocationStatus('Location captured for this scan.');

      return {
        latitude,
        longitude,
        accuracyMeters,
        locationLabel,
        capturedAt: new Date().toISOString(),
        permissionGranted: true,
        unavailableReason: '',
      };
    } catch (error) {
      setLocationStatus('Location unavailable');
      return {
        latitude: null,
        longitude: null,
        accuracyMeters: null,
        locationLabel: '',
        capturedAt: new Date().toISOString(),
        permissionGranted: true,
        unavailableReason: String(error || ''),
      };
    }
  }, [ensureLocationPermission]);

  const resumePreviewIfPaused = useCallback(async () => {
    if (!cameraRef.current || !isPreviewPausedRef.current) {
      return;
    }

    try {
      const cameraWithControls = cameraRef.current as unknown as {
        resumePreview?: () => Promise<void>;
      };
      if (cameraWithControls.resumePreview) {
        await cameraWithControls.resumePreview();
      }
    } catch {
      // Best effort.
    } finally {
      isPreviewPausedRef.current = false;
    }
  }, []);

  const handleResetScanState = useCallback(() => {
    submissionVersionRef.current += 1;
    clearSlowSubmissionTimer();
    setIsCameraLocked(false);
    setFrozenFrameUri('');
    void resumePreviewIfPaused();
    if (permission?.granted && isFocused) {
      setIsCameraActive(true);
    }
    setScanOutcome({ kind: 'idle' });
    setLastDecodedAt(0);
    setLastDecodedValue('');
    setIsSlowSubmission(false);
    setIsSubmittingScan(false);
    guideScaleAnim.setValue(1);
    guideTranslateXAnim.setValue(0);
    guideTranslateYAnim.setValue(0);
  }, [clearSlowSubmissionTimer, isFocused, permission?.granted, resumePreviewIfPaused]);

  const handleCancelPendingSubmission = useCallback(() => {
    submissionVersionRef.current += 1;
    clearSlowSubmissionTimer();
    setIsCameraLocked(false);
    setFrozenFrameUri('');
    void resumePreviewIfPaused();
    if (permission?.granted && isFocused) {
      setIsCameraActive(true);
    }
    setIsSubmittingScan(false);
    setIsSlowSubmission(false);
    setScanOutcome({
      kind: 'error',
      error: {
        code: 'TIMEOUT',
        message: 'Scan request is taking too long. Please retry.',
      },
    });
    guideScaleAnim.setValue(1);
    guideTranslateXAnim.setValue(0);
    guideTranslateYAnim.setValue(0);
  }, [clearSlowSubmissionTimer, isFocused, permission?.granted, resumePreviewIfPaused]);

  const canAcceptDecode = useCallback(
    (rawValue: string) => {
      if (!rawValue || isSubmittingScan) {
        return false;
      }

      const normalizedValue = rawValue.trim();
      const now = Date.now();

      if (
        normalizedValue === lastDecodedValue &&
        now - lastDecodedAt < DECODE_COOLDOWN_MS
      ) {
        return false;
      }

      return true;
    },
    [isSubmittingScan, lastDecodedAt, lastDecodedValue]
  );

  const captureFrozenFrame = useCallback(async () => {
    if (!cameraRef.current) {
      return '';
    }

    try {
      const picture = await cameraRef.current.takePictureAsync({
        quality: 0.4,
        skipProcessing: true,
        shutterSound: false,
      });
      return String(picture?.uri || '');
    } catch {
      return '';
    }
  }, []);

  const pausePreviewWithFallback = useCallback(async () => {
    if (!cameraRef.current) {
      return;
    }

    try {
      const cameraWithControls = cameraRef.current as unknown as {
        pausePreview?: () => Promise<void>;
      };

      if (cameraWithControls.pausePreview) {
        await cameraWithControls.pausePreview();
        isPreviewPausedRef.current = true;
        return;
      }
    } catch {
      // Fallback to still-image overlay below.
    }

    const freezeUri = await captureFrozenFrame();
    if (freezeUri) {
      setFrozenFrameUri(freezeUri);
    }
  }, [captureFrozenFrame]);

  const animateGuideToTarget = useCallback(
    async (_event: ScanEventPayload) => {
      return;
    },
    []
  );

  const handleCameraFrameLayout = useCallback((_event: LayoutChangeEvent) => {}, []);

  const handleBarcodeScanned = useCallback(
    async (event: ScanEventPayload) => {
      const decodedValue = String(event?.data || '').trim();
      if (!canAcceptDecode(decodedValue)) {
        return;
      }

      submissionVersionRef.current += 1;
      const submissionVersion = submissionVersionRef.current;

      setLastDecodedValue(decodedValue);
      setLastDecodedAt(Date.now());
      setIsCameraLocked(true);
      await pausePreviewWithFallback();

      setIsSubmittingScan(true);
      setIsSlowSubmission(false);
      setScanOutcome({ kind: 'idle' });

      clearSlowSubmissionTimer();
      slowSubmissionTimerRef.current = setTimeout(() => {
        if (
          !isMountedRef.current ||
          submissionVersionRef.current !== submissionVersion
        ) {
          return;
        }

        setIsSlowSubmission(true);
      }, SLOW_SUBMISSION_THRESHOLD_MS);

      try {
        const scanLocation = await captureScanLocation();

        const result = await submitScanWithQueue({
          qrCode: decodedValue,
          scannedAt: new Date().toISOString(),
          metadata: {
            scanLocationLabel: scanLocation.locationLabel,
            scanLatitude: scanLocation.latitude,
            scanLongitude: scanLocation.longitude,
            scanAccuracyMeters: scanLocation.accuracyMeters,
            locationCapturedAt: scanLocation.capturedAt,
            locationPermissionGranted: scanLocation.permissionGranted,
            locationUnavailableReason: scanLocation.unavailableReason,
          },
        });

        if (
          !isMountedRef.current ||
          submissionVersionRef.current !== submissionVersion
        ) {
          return;
        }

        if (result.kind === 'submitted') {
          setScanOutcome({ kind: 'success', payload: result.response });
          const count = await getQueuedScanCount();
          setQueuedScanCount(count);
          return;
        }

        if (result.kind === 'queued') {
          setQueuedScanCount(result.queueCount);
          setScanOutcome({
            kind: 'error',
            error: {
              code: 'QUEUED_OFFLINE',
              message: `Scan saved locally. ${result.queueCount} queued for sync.`,
            },
          });
          return;
        }

        setScanOutcome({ kind: 'error', error: result.error });
      } catch (error) {
        if (
          !isMountedRef.current ||
          submissionVersionRef.current !== submissionVersion
        ) {
          return;
        }

        setScanOutcome({
          kind: 'error',
          error: {
            code: 'UNKNOWN_ERROR',
            message: 'Unexpected scanner submission failure.',
            details: String(error),
          },
        });
      } finally {
        if (
          !isMountedRef.current ||
          submissionVersionRef.current !== submissionVersion
        ) {
          return;
        }

        clearSlowSubmissionTimer();
        setIsSlowSubmission(false);
        setIsSubmittingScan(false);
      }
    },
    [
      canAcceptDecode,
      captureScanLocation,
      clearSlowSubmissionTimer,
      pausePreviewWithFallback,
    ]
  );

  const successDetails = useMemo(() => {
    if (scanOutcome.kind !== 'success') {
      return null;
    }

    return toScanDisplayPayload(scanOutcome.payload);
  }, [scanOutcome]);

  const scanErrorMessage = useMemo(() => {
    if (scanOutcome.kind !== 'error') {
      return '';
    }

    return getDeterministicErrorMessage(scanOutcome.error);
  }, [scanOutcome]);

  if (!permission) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.subtitle}>Checking camera permission…</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Camera access required</Text>
        <Text style={styles.subtitle}>
          Allow camera access to scan attendance QR codes.
        </Text>
        <Pressable onPress={handleGrantPermission} style={styles.button}>
          <Text style={styles.buttonLabel}>Grant camera access</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: tabBarHeight + spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerCard}>
          <Text style={styles.title}>Scanner</Text>
          <Text style={styles.subtitle}>Scan attendance QR codes</Text>
          <Text style={styles.caption}>Align the QR code inside the camera frame.</Text>
          <Text style={styles.caption}>Location: {locationStatus}</Text>
          {queuedScanCount > 0 ? (
            <View style={styles.queueBanner}>
              <Text style={styles.queueTitle}>Offline queue pending</Text>
              <Text style={styles.caption}>{queuedScanCount} queued scan(s) waiting to sync.</Text>
              <Pressable
                onPress={handleSyncQueuedScans}
                style={styles.buttonAlt}
                disabled={isSyncingQueue}
              >
                <Text style={styles.buttonAltLabel}>
                  {isSyncingQueue ? 'Syncing…' : 'Sync queued scans'}
                </Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        <View
          style={[styles.cameraFrame, isCameraLocked ? styles.cameraFrameCompact : null]}
          onLayout={handleCameraFrameLayout}
        >
          <CameraView
            ref={cameraRef}
            facing="back"
            style={styles.camera}
            active={isCameraActive}
            onBarcodeScanned={isCameraLocked ? undefined : handleBarcodeScanned}
            barcodeScannerSettings={QR_BARCODE_SCANNER_SETTINGS}
          />
          {isCameraLocked && frozenFrameUri ? (
            <Image source={{ uri: frozenFrameUri }} style={styles.frozenFrame} />
          ) : null}
          <View pointerEvents="none" style={styles.scannerOverlay}>
            <View style={styles.scanMask}>
              <View style={styles.scanMaskBand} />
              <View style={styles.scanMaskMiddle}>
                <View style={styles.scanMaskSide} />
                <View style={styles.scanMaskHole} />
                <View style={styles.scanMaskSide} />
              </View>
              <View style={styles.scanMaskBand} />
            </View>
            <Animated.View
              style={[
                styles.scanGuideSquare,
                isCameraLocked ? styles.scanGuideSquareLocked : null,
                {
                  opacity: isCameraLocked ? 1 : pulseAnim,
                },
              ]}
            >
              <View style={[styles.scanCorner, styles.topLeft, isCameraLocked ? styles.scanCornerLocked : null]} />
              <View style={[styles.scanCorner, styles.topRight, isCameraLocked ? styles.scanCornerLocked : null]} />
              <View style={[styles.scanCorner, styles.bottomLeft, isCameraLocked ? styles.scanCornerLocked : null]} />
              <View style={[styles.scanCorner, styles.bottomRight, isCameraLocked ? styles.scanCornerLocked : null]} />
            </Animated.View>
          </View>
        </View>

        {isSubmittingScan ? (
          <View style={styles.feedbackCard}>
            <Text style={styles.statusLabel}>PROCESSING</Text>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.feedbackTitle}>Processing scan…</Text>
            <Text style={styles.caption}>Submitting QR attendance request.</Text>
            {isSlowSubmission ? (
              <>
                <Text style={styles.caption}>
                  This is taking longer than expected. You can cancel and retry safely.
                </Text>
                <Pressable onPress={handleCancelPendingSubmission} style={styles.buttonAlt}>
                  <Text style={styles.buttonAltLabel}>Cancel request</Text>
                </Pressable>
              </>
            ) : null}
          </View>
        ) : null}

        {scanOutcome.kind === 'success' ? (
          <View style={[styles.feedbackCard, styles.successCard]}>
            <Text style={styles.successBadge}>SUCCESSFUL SCAN</Text>
            <Text style={[styles.feedbackTitle, styles.successText]}>Attendance recorded</Text>
            {successDetails ? (
              <>
                {successDetails.photoUrl ? (
                  <Image source={{ uri: successDetails.photoUrl }} style={styles.successPhoto} />
                ) : null}
                <Text style={styles.successName}>{successDetails.name}</Text>
                <View style={styles.successMetaRow}>
                  <Text style={styles.successMetaLabel}>Status</Text>
                  <Text style={styles.successMetaValue}>{successDetails.status}</Text>
                </View>
                <View style={styles.successMetaRow}>
                  <Text style={styles.successMetaLabel}>Action</Text>
                  <Text style={styles.successMetaValue}>{successDetails.action}</Text>
                </View>
                <View style={styles.successMetaRow}>
                  <Text style={styles.successMetaLabel}>Unit</Text>
                  <Text style={styles.successMetaValue}>{successDetails.unit}</Text>
                </View>
                <View style={styles.successMetaRow}>
                  <Text style={styles.successMetaLabel}>Time</Text>
                  <Text style={styles.successMetaValue}>{successDetails.timestamp}</Text>
                </View>
              </>
            ) : null}
            <Pressable onPress={handleResetScanState} style={styles.buttonPrimary}>
              <Text style={styles.buttonPrimaryLabel}>Scan another</Text>
            </Pressable>
          </View>
        ) : null}

        {scanOutcome.kind === 'error' ? (
          <View style={styles.feedbackCard}>
            <Text style={[styles.statusLabel, styles.errorText]}>ERROR</Text>
            <Text style={[styles.feedbackTitle, styles.errorText]}>Scan failed</Text>
            <Text style={styles.detailValue}>{scanErrorMessage}</Text>
            <Pressable onPress={handleResetScanState} style={styles.buttonAlt}>
              <Text style={styles.buttonAltLabel}>Retry scan</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
};

const createStyles = (colors: AppColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingTop: spacing.lg,
  },
  headerBlock: {
    marginBottom: spacing.md,
  },
  headerCard: {
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.md,
    backgroundColor: colors.surface,
    padding: spacing.lg,
  },
  queueBanner: {
    borderWidth: 1,
    borderColor: colors.warning,
    borderRadius: spacing.sm,
    padding: spacing.sm,
    marginTop: spacing.sm,
    backgroundColor: colors.surface,
  },
  queueTitle: {
    ...typography.caption,
    color: colors.warning,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  cameraFrame: {
    height: 260,
    borderRadius: spacing.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginBottom: spacing.lg,
  },
  cameraFrameCompact: {
    height: 220,
  },
  camera: {
    flex: 1,
  },
  frozenFrame: {
    ...StyleSheet.absoluteFillObject,
  },
  scannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanMask: {
    ...StyleSheet.absoluteFillObject,
  },
  scanMaskBand: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  scanMaskMiddle: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scanMaskSide: {
    flex: 1,
    height: 196,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  scanMaskHole: {
    width: 196,
    height: 196,
    borderRadius: 16,
    backgroundColor: 'transparent',
  },
  scanGuideSquare: {
    width: 196,
    height: 196,
    borderWidth: 0,
    borderRadius: 16,
    backgroundColor: 'transparent',
    position: 'relative',
  },
  scanGuideSquareLocked: {
    borderColor: colors.primary,
  },
  scanCorner: {
    position: 'absolute',
    width: 34,
    height: 34,
    borderColor: colors.success,
  },
  scanCornerLocked: {
    borderColor: colors.primary,
  },
  topLeft: {
    top: -2,
    left: -2,
    borderTopWidth: 6,
    borderLeftWidth: 6,
    borderTopLeftRadius: 12,
    borderColor: colors.success,
  },
  topRight: {
    top: -2,
    right: -2,
    borderTopWidth: 6,
    borderRightWidth: 6,
    borderTopRightRadius: 12,
    borderColor: colors.warning,
  },
  bottomLeft: {
    bottom: -2,
    left: -2,
    borderBottomWidth: 6,
    borderLeftWidth: 6,
    borderBottomLeftRadius: 12,
    borderColor: colors.primary,
  },
  bottomRight: {
    bottom: -2,
    right: -2,
    borderBottomWidth: 6,
    borderRightWidth: 6,
    borderBottomRightRadius: 12,
    borderColor: colors.danger,
  },
  title: {
    ...typography.title,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  feedbackCard: {
    borderRadius: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    marginTop: spacing.sm,
  },
  feedbackContent: {
    gap: spacing.xs,
  },
  successCard: {
    borderColor: colors.success,
  },
  successBadge: {
    ...typography.caption,
    color: colors.success,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  successName: {
    ...typography.heading,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  successPhoto: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignSelf: 'center',
    marginBottom: spacing.sm,
    backgroundColor: colors.border,
  },
  successMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  successMetaLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  successMetaValue: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  feedbackTitle: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  statusLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  detailLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    width: 84,
  },
  detailValue: {
    ...typography.body,
    color: colors.textPrimary,
    flex: 1,
    textAlign: 'right',
  },
  caption: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  successText: {
    color: colors.success,
  },
  errorText: {
    color: colors.danger,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: spacing.sm,
    minHeight: 44,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  buttonLabel: {
    ...typography.body,
    color: colors.surface,
    fontWeight: '600',
  },
  buttonAlt: {
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: spacing.sm,
    minHeight: 44,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    alignSelf: 'flex-start',
    justifyContent: 'center',
  },
  buttonAltLabel: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '600',
  },
  buttonPrimary: {
    marginTop: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: spacing.sm,
    minHeight: 44,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPrimaryLabel: {
    ...typography.body,
    color: colors.surface,
    fontWeight: '700',
  },
});
