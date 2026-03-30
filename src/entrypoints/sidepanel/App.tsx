import { Shell } from '@/components/shell';
import { ErrorBoundary } from '@/components/error-boundary';

export function App() {
  return (
    <ErrorBoundary>
      <Shell />
    </ErrorBoundary>
  );
}
