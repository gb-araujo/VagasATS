# 💼 vagasATS - Plataforma Inteligente de Vagas Tech & Otimização de Currículos ATS

> Plataforma web SaaS orientada a carreiras em Tecnologia e Programação, desenvolvida para conectar desenvolvedores e profissionais de TI às melhores oportunidades do mercado, diagnosticar descrições de vagas e gerar currículos e cartas de apresentação sob medida, 100% otimizados para sistemas ATS (Applicant Tracking Systems).

---

## 📌 Sumário

1. [Sobre o Projeto](#-sobre-o-projeto)
2. [Principais Funcionalidades](#-principais-funcionalidades)
3. [Stack Tecnológica](#%EF%B8%8F-stack-tecnol%C3%B3gica)
4. [Como Ativar a Chave de IA (Google Gemini Gratuito & OpenAI)](#-como-ativar-a-chave-de-ia-google-gemini-gratuito--openai)
5. [Arquitetura do Motor de IA](#-arquitetura-do-motor-de-ia)
6. [Segurança e Privacidade Local-First](#-seguran%C3%A7a-e-privacidade-local-first)
7. [Estrutura de Diretórios](#-estrutura-de-diret%C3%B3rios)
8. [Instalação e Execução Local](#-instala%C3%A7%C3%A3o-e-execu%C3%A7%C3%A3o-local)
9. [Scripts Disponíveis](#-scripts-dispon%C3%ADveis)
10. [Robô de Candidaturas Automáticas](#-rob%C3%B4-de-candidaturas-autom%C3%A1ticas)
11. [Licença](#-licen%C3%A7a)

---

## 🚀 Sobre o Projeto

Conquistar uma oportunidade em Tecnologia exige superar a primeira barreira dos processos seletivos modernos: **os robôs de triagem (ATS - Applicant Tracking Systems)**, como Gupy, Workday, Greenhouse e Lever.

O **vagasATS** nivela o jogo a favor do candidato. A plataforma agrega oportunidades reais e recentes do mercado de TI, calcula a compatibilidade técnica entre o perfil do desenvolvedor e o edital da vaga, aponta as lacunas de habilidades (*skill gaps*) e gera currículos estruturados com as palavras-chave exatas que garantem alta pontuação nos filtros automáticos de RH.

---

## ✨ Principais Funcionalidades

### 1. 🔍 Mural de Oportunidades em Tempo Real

- **Conexão Direta com Vagas Reais**: Integração via proxy da API pública da Gupy e repositórios abertos da comunidade dev brasileira.
- **Filtros por Especialidade Técnica**:
  - Frontend, Backend, Full Stack, DevOps & Cloud, QA & Testes, Dados & IA, Suporte TI / Service Desk, Estágios e Início de Carreira.
- **Filtros por Modelo e Localização**:
  - Vagas 100% Remotas, Híbridas ou Presenciais.
  - Filtragem por Estado brasileiro (UF), com foco em polos de tecnologia como São Paulo e capitais.
- **Senioridade Múltipla**: Estágio, Júnior, Pleno, Sênior e Especialista.

### 2. 🎯 Analisador de Links de Vagas (Job Link Analyzer)

- **Extração Automática de Requisitos**: Basta colar a URL de uma vaga externa (Gupy, Vagas.com, Catho, Greenhouse, Lever, Programathor, Nerdin, etc.) ou o texto bruto da descrição.
- **Scraper Inteligente com Fallback**: Extrai cargo, empresa, modelo e requisitos técnicos via Schema.org JSON-LD (`JobPosting`), metatags OpenGraph e expressões regulares.
- **Cálculo de Match Score**: Diagnóstico em porcentagem indicando a aderência imediata do candidato à vaga.

### 3. 📄 Gerador de Currículo Sob Medida para ATS (Tailored Resume)

- **Palavras-chave Otimizadas**: Incorpora termos técnicos prioritários da vaga nas descrições de experiência.
- **Resumo Profissional STAR**: Redige de 1 a 2 parágrafos de alto impacto (~4 a 5 linhas) no padrão Ação + Tecnologia + Resultado Prático.
- **Janela de Contexto & Trajetória**: Permite detalhar projetos práticos e rotinas de estudo para que a IA desdobre experiências em tópicos densos e verídicos, com **zero alucinação**.
- **Exportação em PDF Limpo**: Gera PDFs em coluna única estruturada, sem tabelas complexas ou gráficos que travam os parsers de recrutamento.
- **Carta de Apresentação (Cover Letter)**: Cria cartas formais ou dinâmicas em português e inglês para envio ao recrutador.

### 4. 📊 Rastreador de Candidaturas (Kanban ATS)

- Gestão completa das aplicações em formato de funil:
  - *Salvas* ➔ *Candidatura Enviada* ➔ *Em Processo / Teste Técnico* ➔ *Entrevista* ➔ *Aprovado / Rejeitado*.
- Armazenamento de anotações, links diretos e datas das etapas.

### 5. 🎨 Interface Moderna & UX Premium

- **Modos Escuro & Claro (Dark/Light Mode)**: Alternância suave com paleta ajustada para conforto visual e legibilidade.
- **Animação Ripple de Fundo**: Círculos ondulantes concêntricos em CSS puro que criam uma estética imersiva e sofisticada.
- **Layout 100% Responsivo**: Menu lateral expansível no desktop e drawer otimizado com acesso completo a todas as funções no mobile.

---

## 🛠️ Stack Tecnológica

| Camada | Tecnologia | Função no Projeto |
| :--- | :--- | :--- |
| **Base** | JavaScript (ESNext), HTML5, CSS3 | Linguagem e fundação da aplicação |
| **Interface** | React 19 | Renderização reativa de componentes e gerenciamento de estado |
| **Build & Dev Server** | Vite 8 | Servidor de desenvolvimento ultrarrápido com Hot Module Replacement (HMR) |
| **Estilização** | Tailwind CSS v4 + Vanilla CSS | Design system fluido, classes utilitárias e animações CSS |
| **Ícones** | Lucide React | Conjunto moderno de ícones vetoriais |
| **Exportação PDF** | jsPDF + html2canvas | Compilação e download direto do currículo ATS formatado |
| **Linter** | Oxlint | Auditoria estática e padronização do código-fonte |

---

## 🔑 Como Ativar a Chave de IA (Google Gemini Gratuito & OpenAI)

O **vagasATS** adota a filosofia **BYOK (Bring Your Own Key)**: você utiliza as APIs oficiais de IA diretamente do seu navegador, sem intermediários, sem custos ocultos e com privacidade absoluta.

> 💡 **Nota Importante**: O uso de uma chave de API externa é **totalmente opcional**. Se nenhuma chave for cadastrada, a plataforma continuará funcionando com seu motor local algorítmico integrado!

---

### Opção 1: Google Gemini (Recomendado - 100% Gratuito)

O Google disponibiliza uma cota gratuita generosa e oficial para desenvolvedores através do **Google AI Studio**, com suporte aos modelos ultrarrápidos **Gemini 2.0 Flash** e **Gemini 1.5 Flash**, **sem necessidade de cadastrar cartão de crédito**.

#### 📋 Passo a Passo para Obter a Chave do Google Gemini

1. **Acesse o Google AI Studio**:
   - Abra o link oficial: [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
2. **Faça login com sua Conta Google**:
   - Entre com qualquer conta Gmail comum ou corporativa.
3. **Crie a sua Chave de API**:
   - Clique no botão azul **"Create API key"** (ou "Criar chave de API").
   - Selecione a opção *"Create API key in new project"* (Criar chave em novo projeto) ou escolha um projeto existente do Google Cloud.
4. **Copie a chave gerada**:
   - A chave será exibida na tela (uma sequência de caracteres iniciando com `AIzaSy...`). Clique no ícone de cópia.
5. **Ative no vagasATS**:
   - No menu lateral do aplicativo, abra a aba **Perfil** (ou clique no atalho de configurações de IA).
   - Localize o bloco **"Conectar Inteligência Artificial"**.
   - Selecione o provedor **Google Gemini**.
   - Cole a chave no campo de texto e clique no botão **"Salvar & Testar Conexão"**.
   - O aplicativo fará um teste em tempo real com a API da Google, medirá a latência (ms) e exibirá o selo verde de **Operacional**.

#### ⚡ Limites da Cota Gratuita Oficial do Google Gemini

- **15 requisições por minuto (RPM)**.
- **1.500 requisições por dia (RPD)**.
- **1 milhão de tokens por minuto (TPM)**.
- *Mais que suficiente para gerar dezenas de currículos e analisar centenas de vagas diariamente sem custo algum.*

---

### Opção 2: OpenAI (ChatGPT / GPT-4o Mini)

Caso prefira utilizar os modelos da OpenAI, o sistema possui compatibilidade total com o modelo `gpt-4o-mini`.

#### 📋 Passo a Passo para Obter a Chave da OpenAI

1. **Acesse a plataforma de desenvolvedores da OpenAI**:
   - Acesse: [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. **Faça login ou crie sua conta**.
3. **Verifique seu saldo de créditos**:
   - Acesse o menu **Settings ➔ Billing**. A OpenAI exige recarga pré-paga mínima de $5 USD para habilitar o uso da API (a assinatura do ChatGPT Plus não inclui créditos de API).
4. **Gere a Chave Secreta**:
   - No menu lateral esquerdo, clique em **API keys**.
   - Clique em **"Create new secret key"**.
   - Dê um nome (ex: `vagasATS`) e copie a chave gerada (iniciada por `sk-proj-...`).
5. **Ative no vagasATS**:
   - Na aba **Perfil**, cole a chave no campo correspondente e clique em **Salvar**.
   - O sistema identifica automaticamente o prefixo `sk-` e configura o provedor para OpenAI.

---

## 🧠 Arquitetura do Motor de IA

O arquivo [`src/services/aiEngine.js`](src/services/aiEngine.js) gerencia as análises e gerações de documentos através de um pipeline inteligente de 2 camadas:

```plaintext
              ┌──────────────────────────────────────────────┐
              │             vagasATS Frontend                │
              └──────────────────────┬───────────────────────┘
                                     │
                     ¿Possui Chave de API Salva?
                              /            \
                         SIM /              \ NÃO
                            v                v
   ┌──────────────────────────────┐   ┌──────────────────────────────┐
   │   Camada Cloud Generativa    │   │     Camada Local Nativa      │
   │   (Gemini 2.0 / GPT-4o Mini) │   │     (Algorítmica & RegEx)    │
   ├──────────────────────────────┤   ├──────────────────────────────┤
   │ • Reescrita STAR profunda    │   │ • Zero custo e offline-ready │
   │ • Cartas persuasivas         │   │ • Dicionário léxico tech     │
   │ • Adaptação de tom e idioma  │   │ • Pontuação Match ATS        │
   └──────────────────────────────┘   └──────────────────────────────┘
```

1. **Motor Local Heurístico (Nativo)**:
   - Baseado em processamento léxico e expressões regulares especializadas em TI.
   - Cruza a base de conhecimento de mais de 80 tecnologias (React, Node, Python, AWS, Docker, Kubernetes, etc.) com a descrição da vaga para pontuar a probabilidade de aprovação na triagem ATS.
2. **Motor Generativo Conectado (Cloud)**:
   - Disparado quando uma chave válida está configurada.
   - Aplica engenharia de prompt avançada orientada a recrutamento de tecnologia, instruindo os modelos a agirem como *Tech Recruiters* e engenheiros de software seniores.

---

## 🔒 Segurança e Privacidade Local-First

- **Zero Chaves no Código**: Nenhuma chave de API, senha ou credencial privada está chumbada no código-fonte.
- **Armazenamento 100% no Dispositivo**: Suas chaves de API, perfil profissional e candidaturas são gravados exclusivamente no `localStorage` do seu navegador.
- **Repositório Protegido**: O arquivo [`.gitignore`](.gitignore) já possui regras ativas para `.env`, `.env.*` e arquivos de log, impossibilitando vazamentos acidentais para o GitHub.
- **Transparência**: O aplicativo não mantém servidores intermediários, bancos de dados externos nem telemetria invasiva de dados de candidatos.

---

## 📂 Estrutura de Diretórios

```plaintext
ia_vagas/
├── public/                     # Ativos estáticos públicos (logos, ícones, favicons)
├── src/
│   ├── assets/                 # Imagens e vetores da interface
│   ├── components/             # Componentes reativos da interface
│   │   ├── AIScanModal.jsx           # Diagnóstico rápido de vaga por IA
│   │   ├── ApplicationsTracker.jsx   # Gestão de candidaturas em funil estilo Kanban
│   │   ├── Header.jsx                # Cabeçalho com status e alternador de tema
│   │   ├── JobCard.jsx               # Card de exibição de oportunidade
│   │   ├── JobDetailsModal.jsx       # Modal completo com descrição da vaga
│   │   ├── JobLinkAnalyzer.jsx       # Analisador de links e colagem de editais
│   │   ├── Navigation.jsx            # Navegação principal por abas
│   │   ├── ProfileTab.jsx            # Configuração de perfil, skills e chaves de IA
│   │   ├── SearchFilters.jsx         # Filtros de stack, local e modalidade
│   │   ├── Sidebar.jsx               # Menu lateral retrátil (Desktop e Mobile)
│   │   ├── TailoredResumeModal.jsx   # Gerador de currículo ATS e exportação PDF
│   │   ├── TechAreaIcon.jsx          # Ícones temáticos por especialidade de TI
│   │   └── UserGuideTab.jsx          # Guia oficial de uso integrado na UI
│   ├── data/
│   │   └── mockJobs.js         # Base curada de vagas de TI e perfil inicial
│   ├── services/
│   │   ├── aiEngine.js         # Motor de inteligência artificial e cálculo ATS
│   │   ├── pdfService.js       # Sanitização de texto e renderização do PDF
│   │   ├── quotaTracker.js     # Monitor de limites de taxa das APIs
│   │   └── storageService.js   # Gerenciamento de persistência no localStorage
│   ├── App.jsx                 # Componente mestre da aplicação
│   ├── index.css               # Estilos globais, temas claro/escuro e efeito ripple
│   └── main.jsx                # Ponto de inicialização do React
├── .gitignore                  # Regras de exclusão de arquivos no Git
├── package.json                # Dependências do ecossistema Node.js
├── README.md                   # Documentação do projeto
└── vite.config.js              # Configurações do Vite, Tailwind e proxy da Gupy
```

---

## 💻 Instalação e Execução Local

### Pré-requisitos

- [Node.js](https://nodejs.org/) (versão 18.0.0 ou superior)
- Gerenciador de pacotes **npm** (incluso com a instalação do Node)

### Passo a Passo

1. **Acesse o diretório do projeto:**

```bash
   cd ia_vagas
```

2. **Instale as dependências:**

```bash
   npm install
```

3. **Inicie o servidor de desenvolvimento:**

```bash
   npm run dev
```

4. **Abra no seu navegador** o endereço exibido no terminal:

```
   http://localhost:5173
```

---

## 📜 Scripts Disponíveis

| Comando | Descrição |
| :--- | :--- |
| `npm run dev` | Inicia o servidor local de desenvolvimento com recarregamento em tempo real (HMR). |
| `npm run build` | Compila e minifica a aplicação para distribuição em produção dentro da pasta `/dist`. |
| `npm run preview` | Executa localmente o bundle de produção gerado para validação final. |
| `npm run lint` | Realiza a verificação estática do código-fonte através do Oxlint. |
| `npm run hunt` | Executa o robô de candidaturas automáticas localmente (lê `.env`). |
| `npm run hunt:dry` | Executa o robô em modo simulação: avalia vagas e salva prévias de currículo/carta em `automation/state/preview`, sem enviar nada. |

---

## 🤖 Robô de Candidaturas Automáticas

O robô (`scripts/auto-hunter/`) roda sozinho no **GitHub Actions** a cada 2 horas (08h–22h, horário de Brasília) e:

1. Busca vagas reais com o mesmo motor do app (Gupy, Nerdin e comunidades do GitHub).
2. Descarta vagas já vistas e filtra pelo seu perfil (senioridade, modalidade e match local).
3. Avalia as melhores com o **Google Gemini** (score, motivo, riscos e se a vaga aceita candidatura por email).
4. **Vagas que pedem currículo por email**: gera currículo ATS em PDF e carta sob medida e envia pelo seu Gmail (com cópia oculta para você).
5. **Demais vagas aprovadas** (Gupy, formulários, etc.): entram no relatório *"Prontas para aplicar"* enviado ao seu email, com link, score e motivo, para você aplicar com a extensão.

O histórico (vagas vistas e candidaturas) fica no branch `bot-state`, que não dispara deploys na Vercel.

### Configuração (uma vez)

1. **Exporte seu perfil** no app: aba *Perfil* → *Exportar Perfil (.json)* → *Exportar Perfil Profissional (Recomendado)* (sem a chave de API).
2. **Crie uma senha de app do Gmail**: ative a verificação em duas etapas e gere em [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords).
3. No GitHub, vá em *Settings → Secrets and variables → Actions* e crie os secrets:

| Secret | Valor |
| :--- | :--- |
| `PROFILE_JSON` | Conteúdo completo do JSON exportado do perfil |
| `GEMINI_API_KEY` | Sua chave do Google AI Studio |
| `GMAIL_USER` | Seu endereço do Gmail que enviará as candidaturas |
| `GMAIL_APP_PASSWORD` | A senha de app de 16 caracteres |
| `NOTIFY_EMAIL` | *(opcional)* Email que recebe os relatórios (padrão: `GMAIL_USER`) |

4. Em *Actions → Robô de candidaturas → Run workflow*, rode primeiro com **Simulação** marcada para validar.

### Ajustes em `automation/config.json`

| Campo | Padrão | Função |
| :--- | :--- | :--- |
| `search.searchTerms` | `[""]` | Termos de busca (vazio = busca ampla em tecnologia). Ex.: `["java", "kotlin"]` |
| `search.maxJobAgeHours` | `72` | Ignora vagas mais antigas que isso |
| `filters.minLocalScore` | `60` | Match local mínimo para gastar uma chamada de IA |
| `filters.blockedKeywords` / `blockedCompanies` | `[]` | Títulos ou empresas a ignorar |
| `ai.maxEvaluationsPerRun` | `15` | Limite de avaliações por execução (respeita a cota gratuita do Gemini) |
| `ai.minAiScore` | `70` | Nota mínima da IA para aplicar/entrar na fila |
| `autoSend.enabled` | `true` | Liga/desliga o envio automático por email |
| `autoSend.maxEmailsPerRun` | `5` | Máximo de candidaturas enviadas por execução |
| `autoSend.requireRealAI` | `true` | Só envia se currículo e carta foram gerados pela IA (nunca envia texto genérico) |

### Uso local

Crie um `.env` com as mesmas variáveis (ou salve o perfil em `automation/profile.json`, ignorado pelo git) e rode `npm run hunt:dry` ou `npm run hunt`.

> ⚠️ O robô **não** se candidata sozinho na Gupy e em outros portais com login: os termos de uso proíbem automação e a conta pode ser bloqueada. Essas vagas vão para o relatório para você aplicar em poucos cliques com a extensão.

---

## 📄 Licença

Este projeto está sob a licença **MIT**. Consulte o arquivo `LICENSE` para mais detalhes.
