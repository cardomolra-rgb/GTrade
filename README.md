<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# TradeFlow - Diário de Trading Inteligente

Este projeto é um Diário de Trading completo construído em React, TypeScript e Tailwind CSS v4, com suporte a banco de dados em tempo real via Supabase.

---

## ⚡ Inicialização Rápida (Offline/Local)

O aplicativo possui um **Modo Offline automático** integrado. Caso você não possua uma conexão válida com o Supabase ou o servidor esteja fora do ar, o app continuará funcionando normalmente salvando todos os dados de forma segura no navegador (`localStorage`).

1. **Instale as dependências**:
   ```bash
   npm install
   ```

2. **Inicie o servidor de desenvolvimento**:
   ```bash
   npm run dev
   ```
   Acesse a aplicação em [http://localhost:3000/](http://localhost:3000/).

---

## ☁️ Conectando ao seu Banco de Dados Supabase (Online)

Para habilitar a sincronização em nuvem das suas contas e operações entre múltiplos dispositivos, siga os passos abaixo:

### Passo 1: Criar o Projeto no Supabase
1. Acesse o painel do [Supabase](https://supabase.com/) e crie um novo projeto.
2. Defina uma senha forte para o banco de dados e selecione a região de sua preferência.

### Passo 2: Executar o Script do Banco de Dados
1. No menu lateral do painel do Supabase, clique em **SQL Editor** (ícone de terminal `>_`).
2. Clique em **New query**.
3. Copie o conteúdo completo do arquivo local [schema.sql](schema.sql).
4. Cole no editor do Supabase e clique em **Run** (no canto inferior direito).
   *Este comando criará automaticamente as tabelas `users` e `trades` e ativará as políticas de segurança RLS (Row Level Security).*

### Passo 3: Configurar as Credenciais no Aplicativo
1. Abra o arquivo local `.env` na raiz do projeto.
2. Substitua os valores de `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` com os dados do seu projeto:
   - Vá em **Project Settings** (engrenagem) > **API** no painel do Supabase.
   - Copie o **Project URL** e cole em `VITE_SUPABASE_URL`.
   - Copie a chave **anon public** e cole em `VITE_SUPABASE_ANON_KEY`.
3. Salve o arquivo `.env`. O servidor de desenvolvimento irá recarregar automaticamente e o indicador no topo do app mudará para **Online (Supabase)**.
