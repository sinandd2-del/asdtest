export function MobileShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-6xl px-3 pb-safe pt-4 sm:px-6 sm:pt-6 lg:px-8">
      {children}
    </main>
  );
}
