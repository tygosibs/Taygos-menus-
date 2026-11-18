import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    let readable = 'حدث خطأ غير متوقع أثناء تشغيل التطبيق.';
    try {
      const parsed = JSON.parse(error.message);
      if (parsed?.error) {
        readable = `خطأ في صلاحيات أو بيانات قاعدة البيانات: ${parsed.error}`;
      }
    } catch {
      if (error.message) readable = error.message;
    }
    return { hasError: true, message: readable };
  }

  componentDidCatch(error: Error): void {
    console.error('Application ErrorBoundary caught:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          dir="rtl"
          className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-6"
        >
          <div className="max-w-lg w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-8 space-y-5">
            <h1 className="text-xl font-bold text-white">تعذر إتمام العملية</h1>
            <p className="text-sm text-zinc-300 leading-relaxed">{this.state.message}</p>
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  this.setState({ hasError: false, message: '' });
                  window.location.reload();
                }}
                className="px-5 py-2.5 rounded-lg bg-amber-500 text-zinc-950 font-semibold text-sm hover:bg-amber-400 transition-colors cursor-pointer"
              >
                إعادة تحميل الصفحة
              </button>
              <a
                href="/"
                className="px-5 py-2.5 rounded-lg border border-zinc-700 text-zinc-200 text-sm hover:bg-zinc-800 transition-colors"
              >
                العودة للرئيسية
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
