import './hypathia-loader.css';
import './document-loading.css';
/** The exact Polis plume and three-particle cycle, using the shared orange/light-theme tokens. */
const PLUME_PATH = 'M 39.48 7.00 L 33.98 13.01 L 28.23 20.94 L 25.03 26.82 L 23.75 30.02 L 22.86 33.21 L 22.09 38.46 L 22.35 44.47 L 23.50 49.71 L 24.65 52.91 L 25.03 53.16 L 24.90 50.99 L 25.16 45.11 L 25.80 40.25 L 26.69 36.28 L 27.97 32.19 L 29.76 27.84 L 31.94 23.88 L 33.09 22.47 L 33.21 22.98 L 30.02 34.11 L 28.61 41.27 L 27.72 48.18 L 27.33 56.87 L 30.53 50.61 L 38.07 39.10 L 39.99 35.01 L 41.27 30.91 L 41.27 30.40 L 33.47 35.26 L 33.09 35.13 L 33.98 33.60 L 37.18 30.02 L 39.23 27.20 L 40.38 24.90 L 41.27 21.96 L 41.78 17.49 L 41.65 14.54 L 40.76 9.94 L 39.86 7.38 Z';
export function DocumentLoading({label}:{label:string}) {
 return <div className="document-loading" data-document-loading role="status" aria-live="polite" aria-busy="true">
  <span className="hypathia-loader" aria-hidden="true"><svg viewBox="0 0 64 64" focusable="false">
   <path className="hypathia-loader__guide" pathLength={1} d="M20 49 C27 46 30 39 31 33 C33 22 37 13 40 8"/>
   <path className="hypathia-loader__plume" d={PLUME_PATH}/>
   <circle className="hypathia-loader__spark" cx="40" cy="8" r="1.25"/>
   <circle className="hypathia-loader__particle hypathia-loader__p1" cx="0" cy="0" r="3.15"/>
   <circle className="hypathia-loader__particle hypathia-loader__p2" cx="0" cy="0" r="2.6"/>
   <circle className="hypathia-loader__particle hypathia-loader__p3" cx="0" cy="0" r="2.05"/>
  </svg></span><span className="document-loading__label">{label}</span>
 </div>;
}
