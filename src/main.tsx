import { Suspense } from "react";
import ReactDOM from "react-dom/client";
import MainPage from "./pages/MainPage.tsx";
import "./index.css";
import "./styles/styles.css";
import "./i18n/index.ts";
import "./config/env";
import { errorTracker } from "./util/errorTracking";
import { logger } from "./util/logger";

if (!import.meta.env.DEV) {
  errorTracker.initialize().catch(console.error);
  
  // Global unhandled promise rejection handler
  window.addEventListener('unhandledrejection', (event) => {
    logger.error('Unhandled promise rejection', event.reason);
    
    // Convert rejection reason to Error if it's not already
    const error = event.reason instanceof Error 
      ? event.reason 
      : new Error(String(event.reason));
    
    // Capture exception in error tracking
    errorTracker.captureException(error, {
      type: 'unhandledrejection',
      reason: event.reason,
    }).catch(() => {
      // Silently fail if error tracking fails
    });
    
    // Prevent default browser error handling in production
    event.preventDefault();
  });
}
import { createBrowserRouter, RouterProvider, Outlet } from "react-router-dom";
import { ThemeProvider } from "@gravity-ui/uikit";
import SingleProgramPage from "./pages/SingleProgramPage.tsx";
import InstructionPage from "./pages/InstructionPage.tsx";
import CardPayPage from "./pages/CardPayPage.tsx";
import SuccessPaymentPage from "./pages/SuccessPaymentPage.tsx";
import ErrorPaymentPage from "./pages/ErrorPaymentPage.tsx";
import WashingInProgressPage from "./pages/WashingInProgressPage.tsx";
import QueueWaitingPage from "./pages/QueueWaitingPage.tsx";
import { NavigationHandler } from "./components/navigationHandler/NavigationHandler.tsx";
import { GlobalWebSocketManager } from "./components/globalWebSocketManager/GlobalWebSocketManager.tsx";
import { ModalProvider } from "./components/modalProvider/ModalProvider.tsx";
import { ErrorBoundary } from "./components/ErrorBoundary.tsx";
import { PaymentGuard } from "./components/guards/PaymentGuard.tsx";

// eslint-disable-next-line react-refresh/only-export-components
function Root() {
  return (
    <>
      <ModalProvider />
      <GlobalWebSocketManager />
      <NavigationHandler />
      <Outlet />
    </>
  );
}

const router = createBrowserRouter([
  {
    path: "/",
    element: <Root />,
    children: [
      {
        path: "/",
        element: <MainPage />,
      },
      {
        path: "/programs/:program",
        element: <SingleProgramPage />,
      },
      {
        path: "/programs/:program/bankCard",
        element: <CardPayPage />,
      },
      {
        path: "/instruction",
        element: <InstructionPage />,
      },
      {
        path: "/success",
        element: (
          <PaymentGuard>
            <SuccessPaymentPage />
          </PaymentGuard>
        ),
      },
      {
        path: "/error",
        element: (
          <PaymentGuard>
            <ErrorPaymentPage />
          </PaymentGuard>
        ),
      },
      {
        path: "/washing",
        element: (
          <PaymentGuard>
            <WashingInProgressPage />
          </PaymentGuard>
        ),
      },
      {
        path: "/queue-waiting",
        element: (
          <PaymentGuard>
            <QueueWaitingPage />
          </PaymentGuard>
        ),
      },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <ThemeProvider theme="light">
      <Suspense fallback="...is loading">
        <RouterProvider router={router} />
      </Suspense>
    </ThemeProvider>
  </ErrorBoundary>
);
