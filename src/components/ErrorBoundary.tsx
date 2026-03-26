import React, { Component, ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  details?: string;
}

const FALLBACK_LABELS: Record<string, { title: string; reload: string }> = {
  ru: { title: 'Что-то пошло не так', reload: 'Перезагрузить' },
  en: { title: 'Something went wrong', reload: 'Reload' },
  uz: { title: 'Xatolik yuz berdi', reload: 'Qayta yuklash' }
};

function getLabels(): { title: string; reload: string } {
  if (typeof document === 'undefined') return FALLBACK_LABELS.en;
  const lang = document.documentElement.lang || 'ru';
  return FALLBACK_LABELS[lang] ?? FALLBACK_LABELS.en;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, details: error?.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('app-error', error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false });
  };

  handleReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      const labels = getLabels();
      return (
        <div className="error-boundary">
          <h1>{labels.title}</h1>
          <button type="button" onClick={this.handleReset}>
            {labels.reload}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
