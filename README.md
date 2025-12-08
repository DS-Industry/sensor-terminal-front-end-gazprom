# Sensor Terminal Front-End (Gazprom)

A React + TypeScript terminal application for car wash payment system with real-time updates via WebSocket.

## 🚀 Features

- **Payment Processing**: Support for card payments with real-time status updates
- **Program Selection**: Interactive program selection with pricing and duration
- **Queue Management**: Real-time queue position tracking
- **WebSocket Integration**: Live updates for order status and device status
- **Internationalization**: Multi-language support (Russian, English, Uzbek)
- **Error Handling**: Comprehensive error boundaries and tracking
- **Accessibility**: ARIA labels and keyboard navigation support

## 🛠️ Tech Stack

- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite
- **State Management**: Zustand
- **Routing**: React Router v6
- **UI Components**: Gravity UI (@gravity-ui/uikit)
- **Styling**: Tailwind CSS
- **HTTP Client**: Axios
- **WebSocket**: Native WebSocket API
- **i18n**: react-i18next
- **Testing**: Vitest + React Testing Library
- **Error Tracking**: Sentry (optional)

## 📋 Prerequisites

- Node.js 20+ 
- npm or yarn
- Docker (for containerized deployment)

## 🔧 Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd sensor-terminal-front-end-gazprom
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file in the root directory:
```env
VITE_API_BASE_URL=http://localhost:8000
VITE_API_BASE_WS_URL=ws://localhost:8000
VITE_S3_URL=http://localhost:9000
VITE_ATTACHMENT_BASE_URL=http://localhost:9000/attachments
VITE_REFRESH_INTERVAL=3600000
VITE_SENTRY_DSN=your-sentry-dsn-here  # Optional, for error tracking
```

## 🚀 Development

Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:5173`

## 🧪 Testing

Run tests:
```bash
npm test
```

Run tests with UI:
```bash
npm run test:ui
```

Run tests with coverage:
```bash
npm run test:coverage
```

## 🏗️ Building

Build for production:
```bash
npm run build
```

The built files will be in the `dist/` directory.

Preview production build:
```bash
npm run preview
```

## 🐳 Docker Deployment

### Build Docker Image

```bash
docker build \
  --build-arg VITE_API_BASE_URL=https://api.example.com \
  --build-arg VITE_API_BASE_WS_URL=wss://api.example.com \
  --build-arg VITE_S3_URL=https://s3.example.com \
  --build-arg VITE_ATTACHMENT_BASE_URL=https://s3.example.com/attachments \
  --build-arg VITE_REFRESH_INTERVAL=3600000 \
  -t sensor-terminal-frontend .
```

### Run with Docker Compose

1. Create `.env` file or set environment variables:
```env
VITE_API_BASE_URL=https://api.example.com
VITE_API_BASE_WS_URL=wss://api.example.com
VITE_S3_URL=https://s3.example.com
VITE_ATTACHMENT_BASE_URL=https://s3.example.com/attachments
VITE_REFRESH_INTERVAL=3600000
```

2. Run:
```bash
docker-compose up -d
```

The application will be available at `http://localhost:3000`

## 📁 Project Structure

```
src/
├── api/                 # API configuration and services
│   ├── axiosConfig/    # Axios instance configuration
│   ├── interceptors/  # Request/response interceptors
│   ├── services/       # API service functions
│   └── types/          # API type definitions
├── components/         # React components
│   ├── cards/         # Card components
│   ├── modals/        # Modal components
│   ├── state/         # Zustand store slices
│   └── ui/            # UI components
├── config/            # Configuration files
│   └── env.ts         # Environment variable validation
├── constants/         # Application constants
├── hooks/             # Custom React hooks
├── i18n/              # Internationalization setup
├── layouts/           # Layout components
├── pages/             # Page components
├── test/              # Test utilities and setup
├── util/              # Utility functions
│   ├── logger.ts      # Logging utility
│   ├── errorTracking.ts # Error tracking (Sentry)
│   └── websocketManager.ts # WebSocket manager
└── main.tsx           # Application entry point
```

## 🔐 Environment Variables

### Required Variables

- `VITE_API_BASE_URL`: Base URL for REST API
- `VITE_API_BASE_WS_URL`: Base URL for WebSocket connections

### Optional Variables

- `VITE_S3_URL`: S3 bucket URL for media files
- `VITE_ATTACHMENT_BASE_URL`: Base URL for attachments
- `VITE_REFRESH_INTERVAL`: Refresh interval in milliseconds (default: 3600000)
- `VITE_SENTRY_DSN`: Sentry DSN for error tracking (optional)

**Note**: Environment variables are validated at application startup. Missing required variables will cause the application to fail with a clear error message.

## 🧩 Key Features Explained

### Payment Processing

The payment flow is handled by the `usePaymentProcessing` hook, which:
- Creates orders via API
- Polls for payment status
- Handles queue management
- Manages automatic robot start countdown

### WebSocket Integration

Real-time updates are handled by the `WebSocketManager` class:
- Automatic reconnection on disconnect
- Event-based message handling
- Connection status tracking

### Error Handling

- **Error Boundaries**: Catches React component errors
- **Error Tracking**: Sentry integration for production errors
- **Logger**: Environment-aware logging (debug in dev, errors only in prod)

### State Management

Zustand store slices:
- `orderSlice`: Order state management
- Global state for programs, queue, loading states

## 🧪 Testing

Tests are located in `src/**/__tests__/` directories:
- Unit tests for hooks
- Component tests
- Integration tests for payment flow

Test utilities are in `src/test/`:
- `setup.ts`: Test environment setup
- `utils.tsx`: Custom render with providers

## 📝 Code Quality

- **Linting**: ESLint with TypeScript rules
- **Type Safety**: Strict TypeScript configuration
- **Formatting**: Prettier (recommended)

Run linter:
```bash
npm run lint
```

## 🔒 Security

- Environment variable validation
- XSS protection via React's built-in escaping
- Security headers in nginx configuration
- No test code in production builds

## ♿ Accessibility

- ARIA labels on interactive elements
- Keyboard navigation support
- Semantic HTML structure

## 🐛 Debugging

In development mode:
- Detailed error messages in Error Boundary
- Console logging enabled
- WebSocket connection debugging

In production:
- Errors sent to Sentry (if configured)
- Minimal console output
- User-friendly error messages

## 📚 API Integration

### Endpoints

- `POST /api/orders` - Create order
- `GET /api/orders/:id` - Get order details
- `POST /api/orders/:id/cancel` - Cancel order
- `POST /api/orders/:id/start-robot` - Start robot

### WebSocket

- `ws://{VITE_API_BASE_WS_URL}/ws/orders/status/` - Order status updates

## 🚨 Troubleshooting

### Environment Variables Not Loading

Ensure variables are prefixed with `VITE_` and rebuild the application.

### WebSocket Connection Issues

Check:
- `VITE_API_BASE_WS_URL` is correctly set
- WebSocket server is running
- Network/firewall allows WebSocket connections

### Build Failures

- Ensure all required environment variables are set
- Check TypeScript errors: `npm run build`
- Verify Node.js version (20+)

## 📄 License

[Your License Here]

## 👥 Contributors

[Contributors List]

## 📞 Support

For issues and questions, please contact [Support Contact]

---

**Note**: This application requires a backend API server to function. Ensure the backend is running and accessible before starting the frontend.
