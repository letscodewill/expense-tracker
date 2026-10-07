# Backup NoControle — Google Drive e HD

## Estado da implementação

A autorização Google foi concluída e um primeiro backup real foi enviado ao Drive, copiado para o HD e verificado em 6 de outubro de 2026. A tarefa diária de cópia no Windows está registrada e foi executada com resultado zero. **A geração diária na nuvem ainda não está ativa:** faltam a publicação do workflow na branch padrão, os Secrets/Variables do GitHub e uma execução manual bem-sucedida. A conexão Google deste chat não fornece credenciais para o GitHub Actions.

- Conta escolhida: **willslima123@gmail.com**.
- Pasta criada pela autorização da rotina: **Backups NoControle**, na raiz do Meu Drive, sem compartilhamento.
- Destino local: **C:\backupNoControle**.
- Nuvem: diariamente às **03h17 de São Paulo** (06h17 UTC). O GitHub pode atrasar uma execução; o workflow agendado precisa estar na branch padrão.
- HD: diariamente às **07h30 do Windows**, quando o usuário estiver conectado e houver internet; `StartWhenAvailable` recupera horários perdidos. O computador precisa estar ligado para essa cópia adicional.
- A rotina principal não depende da Vercel nem do computador ligado.

## O que é preservado

Cada execução cria uma subpasta datada com:

1. `database.dump.enc`: dump PostgreSQL custom dos schemas `public`, `app_private`, `auth`, `storage` e `supabase_migrations`; inclui dados, funções, gatilhos, políticas RLS e permissões desses schemas.
2. `roles.sql.enc`: definições de roles, **sem senhas de roles**.
3. `storage-000000.enc`, etc.: conteúdo dos objetos do Storage, incluindo fotos de perfil. Os nomes originais e os buckets ficam no manifesto criptografado.
4. `manifest.json.enc`: identificação do projeto, versão PostgreSQL, inventário e SHA-256 de cada arquivo original.

O `pg_dump` usa uma visão consistente do banco. O inventário do Storage é comparado antes/depois; se mudar durante a execução, o backup falha e precisa ser refeito. Banco e Storage não possuem uma única transação compartilhada.

Configurações externas do Supabase (provedores OAuth, SMTP, chaves, configurações de plataforma), variáveis da Vercel e código do GitHub **não são restaurados pelo dump**. Guarde suas configurações e segredos separadamente. Novos schemas da aplicação precisam ser adicionados à lista `SCHEMAS` em `scripts/backup/core.mjs`. O projeto atual não utiliza Vault; sua futura adoção exigirá preservar também as respectivas chaves de recuperação.

## Criptografia e publicação

AES-256-GCM, chave de 32 bytes, nonce aleatório por arquivo e cabeçalho autenticado. No backup, o dump é criptografado diretamente da saída do PostgreSQL; a pasta temporária contém somente arquivos criptografados. Nenhum dump financeiro em texto é salvo no disco do runner.

Cada arquivo é verificado por autenticação GCM e SHA-256 antes do envio. Uploads são conferidos pelo tamanho e MD5 do arquivo criptografado informado pelo Drive. O MD5 serve apenas para conferir a transferência; a autenticidade é garantida pelo GCM.

A subpasta recebe `complete=true` somente após todos os uploads válidos. A cópia local aceita somente essas subpastas, verifica os arquivos novamente e publica a pasta local por renomeação, após a conferência completa. Não sobrescreve uma cópia existente com falha de integridade.

O Drive é verificado para rejeitar pastas compartilhadas. A autorização `drive.file` permite acessar os arquivos criados/autorizados para essa integração; não solicita acesso irrestrito ao Drive. Por isso a pasta precisa ser criada pelo assistente de configuração abaixo, não por outra integração.

## 1. Autorizar Google (uma vez)

No Google Cloud, escolha ou crie um projeto para a integração:

1. Ative **Google Drive API**.
2. Configure o consentimento OAuth, com sua conta como usuária autorizada.
3. Para funcionamento contínuo, use publicação **Em produção**. Em modo **Teste**, tokens offline com acesso ao Drive expiram em sete dias. Isso não publica nem compartilha sua pasta; trata do estado da integração OAuth.
4. Crie uma credencial **OAuth Client ID → Desktop app / Aplicativo para computador** e baixe o JSON. Não reutilize a credencial web do login Google/Supabase.
5. No terminal da pasta do projeto, com Node 22:

```powershell
node scripts/backup/configure-google.mjs "C:\caminho\cliente-oauth.json"
```

Abra o endereço mostrado e entre como **willslima123@gmail.com**. O assistente verifica a conta, cria/verifica a pasta privada e salva a configuração em `.env.backup.local`, ignorado pelo Git. Não imprime a chave nem tokens.

**Guarde uma cópia da chave `BACKUP_ENCRYPTION_KEY` em um gerenciador de senhas.** Ela não fica no Drive nem em `C:\backupNoControle`. Perder a chave impede recuperar os backups. Não gere outra chave para reutilizar arquivos antigos.

Se precisar renovar a autorização Google, execute o assistente novamente: ele preserva a chave e as configurações existentes em `.env.backup.local`. Depois atualize o refresh token nos Secrets do GitHub. Não apague esse arquivo para reautorizar.

Nunca envie o JSON OAuth, `.env.backup.local` ou os Secrets pelo chat. Guarde o JSON fora da pasta sincronizada do Drive e fora de commits.

## 2. Completar Supabase e GitHub

Em `.env.backup.local`, complete:

- `BACKUP_DATABASE_URL`: conexão **Session Pooler**, porta **5432**, obtida em Supabase → Connect; inclui a senha do banco e exige TLS. Não use Transaction Pooler/6543. Se a senha contiver caracteres especiais, codifique-os na URL.
- `BACKUP_SUPABASE_SECRET_KEY`: chave server-side secret/service-role do mesmo projeto, necessária para ler todos os arquivos privados do Storage. **Nunca** use prefixo `NEXT_PUBLIC_`.

A URL já é `https://qxicijewzwrmpuiktthr.supabase.co`. O usuário do pooler precisa terminar em `.qxicijewzwrmpuiktthr`, ou a conexão direta deve indicar esse projeto no host; isso evita misturar bancos e Storage de projetos diferentes.

Em GitHub → `letscodewill/expense-tracker` → Settings → Secrets and variables → Actions, configure como **Secrets**:

| Nome | Origem |
|---|---|
| BACKUP_DATABASE_URL | Supabase → Connect, com senha do banco |
| BACKUP_SUPABASE_SECRET_KEY | Supabase → API Keys, chave secret/service-role |
| BACKUP_ENCRYPTION_KEY | `.env.backup.local`; exatamente a mesma chave da cópia local |
| GOOGLE_BACKUP_CLIENT_ID | `.env.backup.local` |
| GOOGLE_BACKUP_CLIENT_SECRET | `.env.backup.local` |
| GOOGLE_BACKUP_REFRESH_TOKEN | `.env.backup.local` |

Como **Variables**, configure:

| Nome | Valor |
|---|---|
| BACKUP_SUPABASE_URL | `https://qxicijewzwrmpuiktthr.supabase.co` |
| GOOGLE_BACKUP_FOLDER_ID | `.env.backup.local` |

Não configure `BACKUP_LOCAL_DIR` no GitHub: `C:\backupNoControle` pertence ao seu Windows, não ao runner Linux. As variáveis de backup não precisam ser adicionadas à Vercel.

Publique `.github/workflows/backup.yml` na branch padrão e execute **Actions → Backup diario NoControle → Run workflow**. Confirme uma execução verde e uma subpasta no Drive contendo `manifest.json.enc`. A execução passa a ocorrer diariamente. Ajuste as preferências de notificações de falha do GitHub Actions na sua conta; não há envio de e-mail próprio pelo aplicativo.

Os comandos PostgreSQL são executados com credenciais em variáveis de ambiente; a senha não entra nos argumentos do processo nem nos logs. O runner instala o cliente PostgreSQL 17, compatível com o servidor atual 17.6.

## 3. Ativar cópia no HD

Após um backup real bem-sucedido no Drive:

```powershell
node --env-file=.env.backup.local scripts/backup.mjs sync
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/backup/install-windows-task.ps1
```

O primeiro comando baixa somente arquivos criptografados para `C:\backupNoControle`. O segundo restringe as permissões da pasta e do arquivo de configuração ao usuário Windows e SYSTEM, e registra a tarefa diária. O destino é lido de `BACKUP_LOCAL_DIR`.

Se mover o projeto, reinstale a tarefa para atualizar os caminhos. O Windows precisa ter Node 22; **a cópia local não precisa de PostgreSQL**. Consulte o Agendador de Tarefas para verificar `Último resultado`, que deve ser `0x0`.

## Retenção

Depois de publicar um novo backup válido, subpastas da rotina com mais de 30 dias são movidas para a lixeira do Drive, preservando pelo menos três backups completos. Pastas de outras integrações são ignoradas. A lixeira ainda consome espaço até sua exclusão; acompanhe a cota do Drive.

As cópias no HD **não são apagadas automaticamente**. Isso mantém uma cópia adicional mesmo após a retenção na nuvem. Uma política de limpeza local poderá ser adicionada depois de medir o uso do disco.

## Verificação e recuperação

Para autenticar uma cópia local sem revelar os dados:

```powershell
node --env-file=.env.backup.local scripts/backup.mjs verify "C:\backupNoControle\nocontrole-AAAA-MM-DDTHH-MM-SS-ID"
```

Para recuperar arquivos em uma **nova pasta protegida**:

```powershell
node --env-file=.env.backup.local scripts/backup.mjs extract "C:\backupNoControle\nocontrole-AAAA-MM-DDTHH-MM-SS-ID" "C:\recuperacaoNoControle"
```

Esse comando não se conecta a nenhum banco nem sobrescreve uma pasta existente. O destino conterá dados descriptografados: proteja-o e remova-o ao terminar. `manifest.json` identifica o bucket e o caminho originais dos arquivos numerados.

### Teste completo do banco (antes de considerar a recuperação validada)

A restauração de um projeto Supabase exige mais que descriptografar os arquivos. Ela deve ser feita em uma instância **isolada**, compatível com PostgreSQL 17 e as extensões, roles e schemas Supabase, nunca diretamente na produção:

1. Recuperar os arquivos e conferir o manifesto.
2. Executar `pg_restore --list database.dump` e revisar extensões, roles, grants e objetos gerenciados. Não aplicar `roles.sql` cegamente em outro projeto Supabase: roles do serviço já existem.
3. Planejar a restauração do dump no destino isolado. Não usar `--clean` contra produção. Para um destino Supabase gerenciado, objetos `auth`/`storage`, proprietários e roles demandam revisão das permissões de plataforma.
4. Restaurar os arquivos do Storage usando os nomes/buckets do manifesto e conferir hashes e quantidade. Metadados do banco sem os bytes não recuperam fotos.
5. Conferir despesas, quadros, salários, categorias, orçamentos, tickets e relações; testar RLS com duas contas, login, pagamento de quadros e uma nova exportação.
6. Registrar data, duração, resultado e divergências. Repetir periodicamente e após mudanças importantes de schema.

**Validação realizada:** criptografia/descriptografia e recuperação exata de arquivos de teste, corrupção/truncamento/chave incorreta, manifesto, cópia local idempotente, arquivos inesperados, paginação Drive, pastas compartilhadas, falhas de upload e retenção. Além dos testes com serviços simulados, um backup real foi enviado ao Drive privado e copiado para o HD; os arquivos criptografados passaram na autenticação e nos hashes, e `pg_restore --list` leu o dump real, com 46 entradas de dados. A tarefa do Windows também foi testada com resultado zero. **Isso valida a geração e a integridade, mas não comprova a restauração completa do banco: essa etapa ainda depende de um destino isolado e não foi executada.**

## Referências

- [Supabase: backup e restauração](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)
- [Supabase: cobertura dos backups e Storage](https://supabase.com/docs/guides/platform/backups)
- [PostgreSQL: pg_dump](https://www.postgresql.org/docs/17/app-pgdump.html)
- [Google: tokens offline e expiração no modo de teste](https://developers.google.com/identity/protocols/oauth2)
- [Google: permissões drive.file](https://developers.google.com/workspace/drive/api/guides/api-specific-auth)
- [GitHub: limitações do agendamento](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)
