import { Component } from 'react';
import { RefreshCw, Wrench } from 'lucide-react';

export default class ErrorBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <main className="boot-screen"><div className="empty-state"><Wrench size={36} aria-hidden="true" /><h1>No pudimos mostrar esta pantalla</h1><p>Recarga la aplicación para volver a intentarlo.</p><button className="primary-button" type="button" onClick={() => window.location.reload()}><RefreshCw size={17} aria-hidden="true" />Recargar aplicación</button></div></main>;
    return this.props.children;
  }
}
