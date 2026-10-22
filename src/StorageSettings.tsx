import { useState } from 'react';
import { FolderOpen, HardDrive, Unplug } from 'lucide-react';
import { t } from './i18n';
import { GitHubSettings } from './GitHubSettings';
import { githubSelection } from './lib/github';
import { canChooseFolder } from './lib/deviceFolder';
import { isIosApp } from './lib/ios';

interface StorageSettingsProps {
  /** User-visible folder label; an empty label means no external folder. */
  folder: string;
  /** Whether a document operation currently prevents destination changes. */
  busy: boolean;
  /** Preserves the current document before changing its storage destination. */
  canSwitch: () => boolean;
  /** Opens the platform folder picker and imports the selected library. */
  onChooseFolder: () => void;
  /** Disconnects only the external folder, preserving its files. */
  onDisconnectFolder: () => void;
  /** Refreshes the library after the GitHub destination changes. */
  onGitHubChange: () => Promise<void>;
}

/** One active destination, with connection setup revealed only on request. */
export function StorageSettings(props: StorageSettingsProps) {
  const [githubSetup, setGitHubSetup] = useState(false);
  const remote = githubSelection();
  return <section className="storage-settings storage-destination" aria-label={t('Armazenamento')}>
    <h3>{t('Armazenamento')}</h3>
    {remote ? <GitHubSettings canSwitch={props.canSwitch} onChange={props.onGitHubChange}/> : props.folder ? <>
      <div className="storage-current"><FolderOpen size={22} aria-hidden="true"/><div><strong>{t('Pasta em Arquivos')}</strong><p className="storage-path">{props.folder}</p></div></div>
      <p>{t('As notas são salvas automaticamente nesta pasta. Desconectar não apaga os arquivos.')}</p>
      <button className="storage-disconnect" disabled={props.busy} onClick={props.onDisconnectFolder}><Unplug size={16} aria-hidden="true"/>{t('Desconectar pasta')}</button>
    </> : <>
      <div className="storage-current"><HardDrive size={22} aria-hidden="true"/><div><strong>{isIosApp ? t('Neste aplicativo') : t('Neste navegador')}</strong><p>{t('Salvamento automático ativo.')}</p></div></div>
      <p>{t('Para guardar suas notas em outro destino, escolha uma das opções abaixo.')}</p>
      {!githubSetup ? <div className="storage-choices">
        {canChooseFolder() && <button disabled={props.busy} onClick={props.onChooseFolder}><FolderOpen size={18} aria-hidden="true"/>{t('Escolher pasta')}</button>}
        <button disabled={props.busy} onClick={() => setGitHubSetup(true)}>{t('Conectar GitHub')}</button>
      </div> : <div className="storage-setup"><button className="storage-back" onClick={() => setGitHubSetup(false)}>{t('Voltar aos destinos')}</button><GitHubSettings canSwitch={props.canSwitch} onChange={async () => {await props.onGitHubChange();setGitHubSetup(false);}}/></div>}
    </>}
  </section>;
}
