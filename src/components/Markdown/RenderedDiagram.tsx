import { DiagramBlock } from './DiagramBlock';
import { ExcalidrawBlock } from './ExcalidrawBlock';
import type { DiagramLanguage } from '@/lib/markdown/diagrams';

/** Scene editing is independent from presentation-only Mermaid engine preferences. */
export function RenderedDiagram({ source, language, identity, legacyIdentity, onEdit, onChange, onLayout }: { source: string; language: DiagramLanguage; identity: string; legacyIdentity?: string; onEdit?: () => void; onChange?: (source: string) => void; onLayout?: () => void }) {
  return language === 'excalidraw' ? <ExcalidrawBlock source={source} identity={identity} onChange={onChange} onEditSource={onEdit} onLayout={onLayout}/> : <DiagramBlock source={source} language={language} identity={identity} legacyIdentity={legacyIdentity} onEdit={onEdit} onLayout={onLayout}/>;
}
