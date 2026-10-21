# Deploy público — 20 de outubro de 2026

Site: https://scriba.aeonbridge.app/

Release ativa: `/var/www/scriba/releases/20261020T125400Z-public-1.16.1-ui`.
Anterior preservada: `/var/www/scriba/releases/20261020T030730Z-public-1.16.1`.

Build: `VITE_STORAGE_MODE=browser npm run build`. Apenas `dist/` foi enviado; serviço GitHub e dados existentes foram preservados. Link `current` substituído atomicamente após `nginx -t`; nginx recarregado.

SHA-256 do HTML local, enviado e servido por HTTPS: `53ad8df144cb68a143f52b1586a797cc66c57f20860b3f263c0cd6c86f272daa`.

Validação no domínio público:

- [Edição, salvar/reabrir, isolamento entre contextos, offline, ausência de chamadas à API local e largura no celular](public-production.txt).
- [H1 com foco, título como nome, colisão incremental, ausência de moldura e organização da barra/exportação](public-ui.txt).
- `/api/files` retorna 404, conforme a configuração pública.
- [Desktop: título e exportação](public-title-export-desktop.png).
- [Celular: salvamento offline](public-offline-mobile.png).
