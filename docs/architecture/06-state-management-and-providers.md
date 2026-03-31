# State Management and Providers

- `client/src/App.tsx`
- `client/src/app/layout.tsx`
- `client/src/components/ChatAgentProvider.tsx`
- `client/src/components/ThemeProvider.tsx`
- `client/src/pages/settings/PaymentProviders.tsx`

- App wrapper order: StrictMode -> App -> ErrorBoundary -> QueryClientProvider -> TooltipProvider -> BrowserRouter -> Routes.
