import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  public render() {
    if (this.state.hasError) {
      const isDynamicImportError = this.state.error?.message?.includes('dynamically imported module') ||
        this.state.error?.toString().includes('dynamically imported module');

      return (
        <div style={{ padding: '2rem', color: '#ffffff', background: '#09090b', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
          <div style={{ maxWidth: '600px', width: '100%', background: '#18181b', border: '1px solid #27272a', borderRadius: '16px', padding: '2rem', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444', fontSize: '20px', fontWeight: 'bold' }}>
                !
              </div>
              <div>
                <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '700', color: '#f4f4f5' }}>
                  {isDynamicImportError ? 'Обновление модулей' : 'Произошла непредвиденная ошибка'}
                </h1>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: '#a1a1aa' }}>
                  {isDynamicImportError 
                    ? 'Файлы приложения обновились. Пожалуйста, перезагрузите страницу.' 
                    : 'Не волнуйтесь, ваши данные в безопасности. Вы можете перезагрузить страницу или вернуться на главную.'}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
              <button
                onClick={() => window.location.reload()}
                style={{ flex: 1, padding: '0.75rem 1rem', background: '#10b981', color: '#ffffff', border: 'none', borderRadius: '12px', fontWeight: '600', cursor: 'pointer', transition: 'background 0.2s' }}
                onMouseOver={(e) => (e.currentTarget.style.background = '#059669')}
                onMouseOut={(e) => (e.currentTarget.style.background = '#10b981')}
              >
                Перезагрузить страницу
              </button>
              <button
                onClick={() => {
                  try {
                    window.location.href = '/';
                  } catch (e) {
                    window.location.reload();
                  }
                }}
                style={{ flex: 1, padding: '0.75rem 1rem', background: '#27272a', color: '#f4f4f5', border: '1px solid #3f3f46', borderRadius: '12px', fontWeight: '600', cursor: 'pointer', transition: 'background 0.2s' }}
                onMouseOver={(e) => (e.currentTarget.style.background = '#3f3f46')}
                onMouseOut={(e) => (e.currentTarget.style.background = '#27272a')}
              >
                На главную
              </button>
            </div>

            {this.state.error && (
              <details style={{ marginTop: '1.5rem', background: '#09090b', border: '1px solid #27272a', borderRadius: '8px', padding: '0.75rem' }}>
                <summary style={{ cursor: 'pointer', fontSize: '0.75rem', color: '#71717a', userSelect: 'none' }}>
                  Технические подробности
                </summary>
                <p style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '0.5rem', wordBreak: 'break-all' }}>
                  {this.state.error.toString()}
                </p>
                {this.state.errorInfo && (
                  <pre style={{ fontSize: '0.7rem', color: '#71717a', whiteSpace: 'pre-wrap', overflow: 'auto', maxHeight: '150px', marginTop: '0.5rem' }}>
                    {this.state.errorInfo.componentStack}
                  </pre>
                )}
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
