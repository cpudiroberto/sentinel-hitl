import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  handleReset = () => {
    this.setState({ hasError: false });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="welcome-wrap">
          <div className="welcome-card" style={{ maxWidth: 480 }}>
            <span className="badge badge-critical">Recuperación Segura</span>
            <h2 style={{ marginTop: '0.75rem' }}>
              Se detectó un estado inesperado
            </h2>
            <p className="welcome-sub">
              La barrera de errores ha protegido la sesión para evitar fallos
              visuales. Puedes reiniciar la demostración en un clic.
            </p>
            <button className="btn-primary" onClick={this.handleReset}>
              Reiniciar sesión de prueba
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}