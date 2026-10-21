import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { t } from './i18n';
import { isIosApp, iosBridge } from './lib/ios';
import { APP_STORE_URL, TESTFLIGHT_URL, availableStoreUpdate, type StoreUpdate } from './lib/appUpdates';

/** A nonmodal update notice never interrupts editing or refreshes an active draft automatically. */
export function UpdateNotice({webUpdate, applyWebUpdate, beforeUpdate}: {webUpdate: boolean; applyWebUpdate: () => Promise<void>; beforeUpdate: () => Promise<boolean>}) {
  const [update, setUpdate] = useState<StoreUpdate | null>(null);
  const [dismissed, setDismissed] = useState(''), [busy, setBusy] = useState(false), [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!isIosApp) return;
    let alive = true, checking = false, lastChecked = 0;
    const check = async () => {
      if (checking || document.visibilityState === 'hidden' || Date.now() - lastChecked < 300000) return;
      checking = true; lastChecked = Date.now();
      try { const info = await iosBridge.updateInfo(); if (alive) setUpdate(availableStoreUpdate(info)); }
      catch { /* Offline or store outages must never block writing. */ }
      finally { checking = false; }
    };
    void check();
    const timer = window.setInterval(() => void check(), 3600000);
    const resume = () => void check();
    window.addEventListener('online', resume); document.addEventListener('visibilitychange', resume);
    return () => { alive = false; clearInterval(timer); window.removeEventListener('online', resume); document.removeEventListener('visibilitychange', resume); };
  }, []);
  const key = update ? `${update.channel}:${update.version}:${update.build || ''}` : webUpdate ? 'web' : '';
  if (!key || key === dismissed) return null;
  const action = update?.channel === 'testflight' ? t('Abrir TestFlight') : update ? t('Abrir App Store') : t('Atualizar agora');
  async function activate(event: React.MouseEvent) {
    event.preventDefault(); if (busy) return;
    setBusy(true); setFailed(false);
    try {
      if (!await beforeUpdate()) throw new Error('Draft is not ready');
      if (update) await iosBridge.openUpdate({channel: update.channel});
      else await applyWebUpdate();
    } catch { setFailed(true); }
    finally { setBusy(false); }
  }
  return <aside className="app-update-notice" aria-label={t('Atualização do Scriba')}>
    <Download size={19} aria-hidden="true"/>
    <div role="status"><strong>{t('Nova versão disponível')}</strong><span>{update ? t('Scriba {0} está disponível para atualizar.', update.build ? `${update.version} (${update.build})` : update.version) : t('Uma atualização do Scriba está pronta.')}</span>{failed && <span>{t('Não foi possível abrir a atualização. Tente novamente.')}</span>}</div>
    <a href={update?.channel === 'testflight' ? TESTFLIGHT_URL : update ? APP_STORE_URL : '#atualizar'} aria-disabled={busy} onClick={activate}>{action}</a>
    <button type="button" disabled={busy} aria-label={t('Lembrar depois')} title={t('Lembrar depois')} onClick={() => setDismissed(key)}><X size={18}/></button>
  </aside>;
}
