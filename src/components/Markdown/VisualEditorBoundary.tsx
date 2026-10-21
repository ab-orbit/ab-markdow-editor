import { t } from '../../i18n';
import { Component, type ReactNode } from 'react';
import styles from './MarkdownWorkbench.module.css';

/** A failed lazy load or unsupported editor block must leave the host's Markdown reachable. */
export class VisualEditorBoundary extends Component<{ children: ReactNode; onRead: () => void; onSource: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    return <div className={styles.visualError} role="alert"><p>{t("Não foi possível abrir a edição visual. Sua nota continua preservada.")}</p><div><button type="button" onClick={this.props.onRead}>{t("Voltar à leitura")}</button><button type="button" onClick={this.props.onSource}>{t("Editar fonte")}</button></div></div>;
  }
}
