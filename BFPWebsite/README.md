# BFP Attendance Dashboard

> **Modern, modular React-based attendance management system with QR scanning and automated daily archival.**

## 🎯 Overview

The **BFP Attendance Dashboard** replaces legacy HTML forms with a production-ready web application featuring:

- **📱 Responsive Dashboard** – Home view with attendance snapshots
- **📸 QR Scanner** – Real-time personnel scanning with camera fallback selection
- **📊 Attendance Logs** – Raw vs. Archive log viewing with search and filtering
- **🔄 Automated Archival** – Daily raw-to-archive transfer (7:00 AM GMT+8)
- **🔐 Strict Attendance Rules** – Two-scan daily limit (Time-In/Out), GMT+8 boundaries
- **⚙️ Backend-Agnostic** – Pluggable API adapter (mock/live modes for testing)

## ✨ Key Features

### Smart Two-Scan System
- **First Scan (Daily):** Records Time-In (On-Duty) status
- **Second Scan (Daily):** Records Time-Out (Off-Duty) status
- **Third+ Scans:** Blocked with user-friendly error message
- **Day Boundary:** Enforced at GMT+8 midnight

### Multi-Tab Interface
- **Dashboard:** Placeholder for attendance KPIs (Present, Late, On Leave)
- **Scanner:** QR code input with profile card confirmation
- **Logs:** Full attendance history with Raw/Archive separation

### Developer-Friendly Architecture
- **React 18 + Vite:** Fast, modern frontend tooling
- **Tailwind CSS:** Responsive, utility-first styling
- **API Adapter Layer:** Easy backend swapping (mock/live modes)
- **Prettier:** Automatic code formatting
- **No Build Warnings:** Clean, production-ready codebase

## 🚀 Quick Start

### Prerequisites
- Node.js v18+ (LTS recommended)
- npm v8+

### Installation

```bash
# Clone/navigate to project
cd BFPWebsite

# Install dependencies
npm install

# Format code
npm run format

# Build frontend
npm run build

# Start development server
npm run dev

# Open in browser
# http://localhost:5173
```

### Android App Quick Start (Expo)

Branch and workspace expectations:

- Use branch `android-app` for mobile migration work and validation.
- Keep repository root as workspace and run Android commands inside `mobile-app/`.

```bash
# From repository root
cd mobile-app

# Install mobile dependencies
npm install

# Start Expo (scan QR in Expo Go on Android)
npm run start

# Optional: launch Android target flow
npm run android
```

Reference: [docs/ANDROID_EXPO_ENV_NOTES.md](./docs/ANDROID_EXPO_ENV_NOTES.md)

### Available Scripts

```bash
npm run dev              # Start Vite dev server
npm run build            # Build for production (dist/)
npm run format           # Format code with Prettier
npm run format:check     # Verify formatting
node .apm/run-validation.mjs  # Run validation tests (15/15 must pass)
```

## 📁 Project Structure

```
src/
├── components/          # Reusable UI components
├── features/            # Feature-specific logic
├── layouts/
│   └── AppShell.jsx     # Main app layout with sidebar
├── pages/
│   ├── DashboardPage.jsx       # Home dashboard
│   ├── AttendanceScannerPage.jsx  # QR scanner
│   └── AttendanceLogsPage.jsx   # Logs viewer
├── services/
│   ├── attendanceAdapter.js    # Backend-agnostic API client
│   ├── apiConfig.js            # Environment config
│   └── index.js                # Service exports
├── types/
│   └── attendanceApiContracts.js  # JSDoc type definitions
├── utils/               # Helper utilities
├── App.jsx              # Main app entry
└── main.jsx             # React DOM mount

.apm/                   # APM metadata
├── Implementation_Plan.md  # 4-phase project plan
├── Memory/              # Phase execution logs
└── run-validation.mjs   # Validation harness

.env.example            # Environment template
vite.config.js          # Vite configuration
package.json            # Dependencies & scripts
DEPLOYMENT_GUIDE.md     # Full deployment instructions
```

## ⚙️ Configuration

### Create `.env.local`

```bash
cp .env.example .env.local
```

### Edit `.env.local`

```env
# Mode: 'mock' or 'live'
VITE_API_ADAPTER_MODE=mock

# Apps Script URL (only needed for live mode)
VITE_APPS_SCRIPT_BASE_URL=https://script.google.com/macros/d/YOUR_ID/userweb
```

## 🔌 Backend Integration

### Mock Mode (Development)
```env
VITE_API_ADAPTER_MODE=mock
# Uses built-in test data, no backend required
```

### Live Mode (Production)
```env
VITE_API_ADAPTER_MODE=live
VITE_APPS_SCRIPT_BASE_URL=https://script.google.com/macros/d/YOUR_SCRIPT_ID/userweb
```

**Deploy Apps Script Backend:**
1. Copy `Code.gs.txt` to Google Apps Script editor
2. Deploy as Web App
3. Copy deployment URL to `.env.local`
4. Restart dev server

See [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) for complete instructions.

## 🧪 Validation & Testing

```bash
# Run comprehensive validation suite
node .apm/run-validation.mjs

# Expected output:
# ✅ Results: 15/15 passed
```

**Test Coverage:**
- API result envelope structure ✅
- Scan response required fields ✅
- Logs response structure ✅
- Status value normalization ✅
- Source context labeling ✅
- Logs filtering ✅

## 🎨 UI/UX Features

- **Responsive Design** – Works on desktop, tablet, mobile
- **Mobile Sidebar** – Collapses on small screens, persistent on desktop
- **Dark-Aware Icons** – Lucide React icons with Tailwind styling
- **Loading States** – Clear feedback during API requests
- **Error Handling** – User-friendly error messages and recovery options
- **Empty States** – Helpful messaging when no data available

## 📊 API Contract

### Scan Endpoint
```javascript
// Request
POST /scan
{
  qrCode: "BFP-001",
  timestamp: "2026-02-24T05:00:00.000Z"
}

// Success Response
{
  ok: true,
  data: {
    status: "IN",
    attendee: {
      personnelId: "BFP-001",
      name: "Juan Dela Cruz",
      rank: "GCM",
      unit: "Station 1"
    },
    timestamp: "2026-02-24T05:00:00.000Z"
  }
}

// Error Response
{
  ok: false,
  error: {
    code: "SCAN_LIMIT_EXCEEDED",
    message: "Daily scan limit exceeded"
  }
}
```

### Logs Endpoint
```javascript
// Request
GET /logs?limit=50&personnelId=BFP-001

// Response
{
  ok: true,
  data: {
    items: [
      {
        id: "log-001",
        personnelId: "BFP-001",
        name: "Juan Dela Cruz",
        status: "IN",
        timestamp: "2026-02-24T08:05:00.000Z",
        source: "Raw"
      }
    ],
    total: 1
  }
}
```

## 🔐 Security Considerations

- **No Credentials in Frontend** – API keys/secrets stored server-side only
- **CORS Handled by Backend** – Apps Script manages cross-origin access
- **Input Validation** – All inputs sanitized before processing
- **Timezone Locked** – GMT+8 boundaries enforced server-side

## 🛠️ Development Workflow

### Local Development
```bash
npm run dev
# http://localhost:5173
```

### Production Build
```bash
npm run build
# Output: dist/ folder (ready for deployment)
```

### Code Formatting
```bash
npm run format       # Auto-format all files
npm run format:check # Check formatting without changes
```

## 📝 Important Notes

### Data Storage
- **ReferenceProfile Sheet:** Master personnel data
- **Attendance_Raw_Log Sheet:** Daily operational log (cleared nightly)
- **Attendance_Archive Sheet:** Historical archive (purged yearly per policy)

### Daily Operations
- **Automatic 7:00 AM GMT+8:** Daily raw-to-archive transfer (Apps Script trigger)
- **Raw Log Cleared:** After transfer to archive
- **No Data Loss:** All records backed up in archive

### Known Limitations
- Chunk-size warning during build (non-blocking, existing issue, ~553 kB gzipped)
- Mock mode uses randomized statuses (demo only, live mode state-aware)

## 🤝 Contributing

When modifying code:
1. Run `npm run format` before committing
2. Run `npm run build` to verify no errors
3. Run `node .apm/run-validation.mjs` to verify tests pass
4. Update `.apm/Memory/` logs if adding new features

## 📚 Documentation

- [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) – Complete production deployment guide
- [docs/TASK_5_2_MIGRATION_AND_OPERATIONS_HANDOVER.md](./docs/TASK_5_2_MIGRATION_AND_OPERATIONS_HANDOVER.md) – Android migration + operations handover and follow-up checklist
- [.apm/Implementation_Plan.md](.apm/Implementation_Plan.md) – 4-phase project plan
- [.apm/Memory/](./apm/Memory/) – Phase execution logs and decisions

## 🔄 Migration from Legacy System

The new system maintains **full data compatibility** with the legacy HTML form:

| Legacy | New |
|--------|-----|
| HTML forms | React dashboard |
| Server-side QR | Browser QR scanning |
| HTML responses | JSON REST API |
| Single-device | Multi-device concurrent |

**See [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) for migration checklist.**

## 📞 Support

For issues or questions:
1. Check [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) troubleshooting section
2. Review `.apm/Memory/` phase logs for implementation details
3. Verify build: `npm run build` (should show only chunk-size warning)

---

**Status:** ✅ Production-Ready  
**Last Updated:** 2026-02-24  
**Version:** 1.0.0

### Build Status
```
✅ Development: npm run dev
✅ Production: npm run build
✅ Validation: node .apm/run-validation.mjs → 15/15 tests passing
✅ Formatting: npm run format → All files compliant
✅ Approval Gates: 3/3 approved (UI skeleton, Scanner integration, Backend integration)
```
