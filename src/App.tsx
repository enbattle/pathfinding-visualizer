import Workspace from './components/workspace';
import { ErrorBoundary } from './components/error-boundary';

// The last line of defense: an unexpected error anywhere shows a way out
// instead of a blank page. (The 3D view has its own, narrower boundary.)
function AppCrashed({ retry }: { retry: () => void }) {
  return (
    <main
      role="alert"
      className="grid min-h-screen place-items-center p-6 text-center"
    >
      <div className="flex max-w-md flex-col items-center gap-3">
        <h1 className="text-lg font-semibold">Something went wrong</h1>
        <p className="text-sm text-muted-foreground">
          The visualizer hit an unexpected error. Trying again usually fixes it;
          reloading the page always starts fresh.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent"
            onClick={retry}
          >
            Try again
          </button>
          <button
            type="button"
            className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground"
            onClick={() => window.location.reload()}
          >
            Reload page
          </button>
        </div>
      </div>
    </main>
  );
}

function App() {
  return (
    <ErrorBoundary fallback={retry => <AppCrashed retry={retry} />}>
      <Workspace />
    </ErrorBoundary>
  );
}

export default App;
