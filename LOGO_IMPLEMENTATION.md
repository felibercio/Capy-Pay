# Logo do Capy Pay - Implementação

## Visão Geral

A logo do Capy Pay foi implementada como um componente React reutilizável que representa uma capivara estilizada em um design minimalista e amigável.

## Características da Logo

### Design
- **Formato**: Circular com fundo azul claro/teal (`#7ABDB0`)
- **Capivara**: Marrom médio (`#E89B4B`) com contornos azul escuro (`#2C3E2D`)
- **Expressão**: Olhos fechados (linhas curvas simples) e sorriso gentil
- **Estilo**: Minimalista, amigável e sereno

### Elementos Visuais
1. **Fundo**: Círculo azul claro/teal
2. **Corpo**: Elipse marrom representando o corpo da capivara
3. **Cabeça**: Círculo marrom
4. **Orelhas**: Pequenos círculos arredondados
5. **Olhos**: Linhas curvas simples (fechados)
6. **Nariz**: Pequeno ponto azul escuro
7. **Sorriso**: Linha curva gentil para cima

## Implementação Técnica

### Componente React
```tsx
import { CapyLogo } from '@/components/CapyLogo';

// Uso básico
<CapyLogo />

// Com tamanho específico
<CapyLogo size="sm" />  // 48x48px
<CapyLogo size="md" />  // 80x80px (padrão)
<CapyLogo size="lg" />  // 128x128px

// Com classes customizadas
<CapyLogo className="animate-pulse" />
```

### Propriedades
- `size`: 'sm' | 'md' | 'lg' - Define o tamanho da logo
- `className`: string - Classes CSS adicionais

### Arquivos Relacionados
- `src/components/CapyLogo.tsx` - Componente principal
- `public/capy-favicon.svg` - Favicon da aplicação
- `tailwind.config.js` - Cores personalizadas (capy-teal, etc.)

## Uso na Aplicação

### 1. Header
A logo é exibida no header da aplicação em tamanho pequeno:
```tsx
<CapyLogo size="sm" />
```

### 2. Tela de Carregamento
Durante a inicialização, a logo é exibida com animação:
```tsx
<LoadingSpinner variant="logo" />
```

### 3. Conectividade da Wallet
Na tela de conexão da wallet:
```tsx
<CapyLogo size="md" />
```

## Cores Utilizadas

### Tailwind CSS
- `capy-teal`: #7ABDB0 (fundo principal)
- `capy-orange`: #E89B4B (cor da capivara)
- `capy-dark`: #2C3E2D (contornos e detalhes)

### SVG
- Fundo: #7ABDB0
- Corpo/Cabeça: #E89B4B
- Contornos: #2C3E2D

## Responsividade

A logo é totalmente responsiva e se adapta a diferentes tamanhos de tela:
- **Mobile**: Tamanho pequeno (sm) para headers
- **Tablet**: Tamanho médio (md) para cards
- **Desktop**: Tamanho grande (lg) para splash screens

## Acessibilidade

- O componente é semanticamente correto
- Suporta classes customizadas para estilização
- Mantém proporções consistentes em todos os tamanhos

## Manutenção

### Atualizações de Design
Para modificar o design da logo:
1. Edite o SVG no componente `CapyLogo.tsx`
2. Atualize o favicon em `public/capy-favicon.svg`
3. Teste em diferentes tamanhos
4. Verifique a consistência visual

### Novos Tamanhos
Para adicionar novos tamanhos:
1. Adicione o tamanho ao objeto `sizeClasses`
2. Atualize a interface `CapyLogoProps`
3. Teste a responsividade

## Considerações de Performance

- O SVG é otimizado e leve
- O componente é memoizado para evitar re-renders desnecessários
- As cores são definidas via Tailwind CSS para consistência 