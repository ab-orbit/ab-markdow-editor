# Compare os diagramas

Use o seletor no canto superior de cada desenho para alternar entre Mermaid, Pele e Beautiful Mermaid. A escolha muda a apresentação; o Markdown continua igual.

## Entidades e relacionamentos

```mermaid
erDiagram
    NOTEBOOK ||--o{ NOTE : contains
    NOTEBOOK {
        string title
    }
    NOTE {
        int id PK
        string text
    }
```

## Fluxo de notas

```mermaid
flowchart LR
    A[Capturar notas] --> B{Revisar?}
    B -->|Sim| C[Organizar]
    B -->|Depois| D[Guardar]
    C --> D
```

## Sequência

```mermaid
sequenceDiagram
    participant Autor
    participant Scriba
    Autor->>Scriba: Escrever uma nota
    Scriba-->>Autor: Mostrar a prévia
    Autor->>Scriba: Salvar
    Scriba-->>Autor: Nota guardada
```

## Cronograma

Mermaid e Pele suportam este exemplo. Beautiful Mermaid informa sua limitação e mantém o seletor disponível para trocar o motor.

```mermaid
gantt
    title Avaliação do Scriba
    dateFormat YYYY-MM-DD
    section Diagramas
    Comparar os motores :a1, 2026-10-18, 3d
    Revisar no celular :a2, after a1, 2d
```
