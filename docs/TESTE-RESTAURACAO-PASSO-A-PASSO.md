# Teste de restauração do NoControle — passo a passo

O objetivo é provar que um backup consegue recuperar o sistema em um **ambiente separado**, sem alterar a produção. Este guia não executa restauração. O backup de 19/10/2026 foi autenticado, mas ainda não passou por restauração completa.

## 1. Criar o ambiente de teste

1. No Supabase, crie outro projeto, por exemplo `nocontrole-restauracao-teste`, com uma senha de banco exclusiva. Confira eventuais custos antes de criar.
2. Use PostgreSQL 17, compatível com a origem. Anote o identificador do novo projeto: ele **não pode** ser `qxicijewzwrmpuiktthr`, que é produção.
3. Não associe esse projeto ao domínio principal nem altere variáveis da Vercel/backup de produção.
4. Não configure SMTP real, webhooks de produção ou cobrança. O teste não deve enviar e-mails nem gerar notificações/cobranças para usuários restaurados.
5. Tenha uma cópia separada do código para executar o app localmente ou em um preview privado com as chaves **do projeto de teste**. Não sobrescreva `.env.local` de produção para fazer o ensaio.

## 2. Escolher e autenticar o backup

No PowerShell:

```powershell
cd C:\projects\expense-tracker
node --env-file=.env.backup.local scripts/backup.mjs sync
Get-ChildItem -LiteralPath C:\backupNoControle -Directory | Sort-Object Name -Descending | Select-Object -First 3 Name
```

Escolha uma pasta completa. Este é o exemplo confirmado em 19/10/2026; substitua o nome se escolher uma cópia mais recente:

```powershell
node --env-file=.env.backup.local scripts/backup.mjs verify "C:\backupNoControle\nocontrole-2026-10-19T13-06-05-da242c51"
```

O resultado esperado é `Backup autenticado; todos os arquivos passaram na verificação de integridade.` Se falhar, não prossiga com essa cópia. Preserve `BACKUP_ENCRYPTION_KEY`; uma chave nova não abre arquivos antigos.

## 3. Recuperar os arquivos em uma pasta nova

Escolha uma pasta local fora do Drive e de outras pastas compartilhadas. Ela conterá dados pessoais e credenciais de autenticação exportadas do banco. O comando exige um destino que ainda não exista:

```powershell
node --env-file=.env.backup.local scripts/backup.mjs extract "C:\backupNoControle\nocontrole-2026-10-19T13-06-05-da242c51" "C:\recuperacaoNoControle-teste-20261019"
```

O comando apenas descriptografa; **não se conecta ao banco**. Restrinja o acesso à pasta ao seu usuário Windows pelas Propriedades → Segurança, antes de compartilhar o computador. Não envie esses arquivos por chat nem faça commit.

Ela conterá `database.dump`, `roles.sql`, `manifest.json` e, quando houver fotos/objetos salvos, arquivos `storage-000000`, `storage-000001` etc.

## 4. Conferir o conteúdo sem restaurar

Instale o cliente PostgreSQL 17, se ainda não tiver `pg_restore`. Confira:

```powershell
pg_restore --version
pg_restore --list "C:\recuperacaoNoControle-teste-20261019\database.dump" | Set-Content -Encoding utf8 "C:\recuperacaoNoControle-teste-20261019\inventario.txt"
```

Abra `inventario.txt` no editor. Há objetos dos schemas `public`, `app_private`, `auth`, `storage` e `supabase_migrations`. A presença das entradas não comprova que elas podem ser restauradas sem conflito no projeto novo.

Abra também `manifest.json` localmente. Confira o projeto de origem, data, versão do PostgreSQL e as listas de buckets/objetos. O manifesto associa a ordem de `storage.objects` aos arquivos `storage-000000`, `storage-000001` etc. Não compartilhe o conteúdo, que pode conter nomes de arquivos pessoais.

## 5. Preparar a restauração compatível com o destino

Este é um ponto necessário de revisão técnica: o nosso `database.dump` é um arquivo custom do `pg_dump`, **não** os três arquivos SQL do exemplo padrão da documentação do Supabase. O projeto novo já contém schemas, tabelas e roles gerenciados de Auth/Storage. Executar o dump integral sem revisão tende a causar conflitos de objetos, permissões e versões.

1. Compare as versões de Auth/Storage, extensões e roles da origem e do destino.
2. Gere um arquivo SQL para revisão **sem conectar a banco nenhum**:

   ```powershell
   pg_restore --no-owner --no-privileges --file "C:\recuperacaoNoControle-teste-20261019\restauracao-para-revisao.sql" "C:\recuperacaoNoControle-teste-20261019\database.dump"
   ```

3. Revise a criação de objetos da aplicação e os dados. Reconcilie os objetos que já existem no projeto novo, em vez de apagar schemas gerenciados. Preserve/reaplique triggers personalizados, funções, RLS e políticas do Storage.
4. `--no-privileges` evita importar grants da plataforma indiscriminadamente, mas exige restaurar os grants corretos da aplicação de forma explícita. Não significa que as permissões estão prontas.
5. Não execute `roles.sql` inteiro cegamente: roles Supabase já existem no destino. Senhas de roles não estão incluídas no backup.
6. Salve o resultado aprovado como `restauracao-revisada.sql`. Esse arquivo deve ser preparado para o projeto de teste escolhido, incluindo qualquer pré-requisito de extensões/grants. Não basta renomear o arquivo original.

**Se quiser fazer o teste comigo, você pode concluir os passos 1–4 e informar apenas o identificador do novo projeto e os caminhos dos arquivos.** Não precisa mandar senha ou dump no chat. A revisão do destino vem antes de executar SQL. Sem essa etapa, não considero a recuperação validada.

## 6. Aplicar somente no banco de teste

Depois da revisão técnica do passo anterior, configure uma sessão PowerShell exclusiva. No painel do projeto **novo**, abra Connect e copie separadamente host, porta e usuário do Session Pooler (5432). Os valores são solicitados interativamente para não colocar senha no histórico:

```powershell
$restoreProjectRef = Read-Host 'Identificador do projeto NOVO de teste'
if ($restoreProjectRef -eq 'qxicijewzwrmpuiktthr' -or $restoreProjectRef -notmatch '^[a-z0-9]+$') { throw 'Destino de teste inválido' }
$env:PGHOST = Read-Host 'Host do Session Pooler do projeto NOVO'
$env:PGPORT = '5432'
$env:PGUSER = Read-Host 'Usuario postgres.ID_DO_PROJETO_NOVO'
$env:PGDATABASE = 'postgres'
$env:PGSSLMODE = 'require'
$env:PGCONNECT_TIMEOUT = '30'
if (-not $env:PGUSER.EndsWith('.' + $restoreProjectRef) -or $env:PGHOST.Contains('qxicijewzwrmpuiktthr')) { throw 'Conexao nao corresponde ao destino de teste' }
$restorePassword = Read-Host 'Senha do banco NOVO' -AsSecureString
$env:PGPASSWORD = [System.Net.NetworkCredential]::new('', $restorePassword).Password
psql -X -A -t -v ON_ERROR_STOP=1 -c 'select current_database(), current_user, version();'
```

Confira o projeto no painel e o usuário retornado. As validações acima são uma proteção adicional, não substituem conferir os campos. Não carregue `BACKUP_DATABASE_URL` nessa sessão: ela aponta para produção.

Somente com `restauracao-revisada.sql` aprovado e destino confirmado:

```powershell
psql -X --single-transaction --set ON_ERROR_STOP=on --file "C:\recuperacaoNoControle-teste-20261019\restauracao-revisada.sql"
if ($LASTEXITCODE -ne 0) { throw 'Restauração falhou. Revise a causa antes de tentar novamente.' }
```

Não ignore erros, não acrescente `--clean` contra produção e não use a conexão antiga. Falhas exigem revisão do SQL e do estado do destino; não conclua que restaurou apenas porque algumas tabelas apareceram.

## 7. Recuperar Storage e configurar Auth

1. Os metadados do banco não recriam os bytes das fotos. Use o `manifest.json` para relacionar cada arquivo numerado ao `bucket_id` e `name` originais.
2. Recrie/reconcilie os buckets no projeto de teste com os mesmos controles de acesso e envie os arquivos pelo Storage do **novo projeto**, preservando nomes e tipos. Confira quantidade, tamanho e hash dos arquivos recuperados; valide que o upload/reconciliação não deixou metadados órfãos ou objetos sem bytes.
3. Não torne buckets privados públicos para fazer o teste passar.
4. Configure no ambiente de teste Site URL, URLs permitidas, provedor Google e SMTP de teste quando for necessário validar esses fluxos. Essas configurações do painel, chaves de API, secrets da Vercel e credenciais de provedores não são reconstituídas apenas pelo dump.
5. Não reutilize sessões restauradas como prova de login. Teste uma nova autenticação com contas que você controla. Para Google, configure o callback do novo projeto no cliente de teste; não remova o callback de produção.
6. Se houver Vault ou dados com criptografia de coluna do próprio Supabase no futuro, verifique também a chave de criptografia raiz da plataforma. Ela é diferente da `BACKUP_ENCRYPTION_KEY` dos arquivos.

## 8. Validar no aplicativo isolado

Na cópia separada do app, use a URL e a chave pública do projeto novo e uma porta/domínio de teste. Confira que o app aponta para o projeto novo antes de gravar qualquer lançamento.

- Faça login com uma conta de teste recuperada. Google e e-mail devem ser validados separadamente quando utilizados.
- Confira despesas antigas, meses, valores, parcelas, recorrências, categorias, orçamentos, salários e tickets de referência do momento do backup. Uma comparação com produção atual deve considerar mudanças posteriores ao backup.
- Confira fotos/objetos e permissões privadas.
- Use duas contas que você controla: A não deve ler/alterar despesas de B, inclusive por API.
- No teste, crie e pague uma despesa e confira os resumos dos quadros. Teste edição, exclusão e um relatório PDF.
- Confirme que solicitações de exclusão de dados atendidas depois do backup seriam reaplicadas após uma recuperação real.
- Registre o tempo entre iniciar a recuperação e conseguir usar o app. O horário do backup define até quando os dados foram recuperados; não há promessa de recuperação de alterações posteriores.

## 9. Registrar o resultado e encerrar

Guarde uma anotação **sem credenciais**: data, nome do backup, ID do projeto de teste, versões, duração, contagens e verificações feitas, divergências e resultado final. Só marque restauração completa como aprovada depois de banco, Auth, Storage e isolamento funcionarem.

Ao terminar, remova a senha desta sessão:

```powershell
Remove-Item Env:PGPASSWORD
```

Mantenha ou elimine o projeto de teste conforme sua necessidade e os custos. Exclua os arquivos descriptografados por um procedimento seguro, conferindo o caminho exato; preserve o backup criptografado e a chave no local adequado. Não deixe cópias pessoais restauradas expostas em um preview público.

## Referências

- [Supabase: backup e restauração, incluindo objetos gerenciados e configurações](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore).
- [Supabase: backups e arquivos do Storage](https://supabase.com/docs/guides/platform/backups).
- [PostgreSQL 17: pg_restore](https://www.postgresql.org/docs/17/app-pgrestore.html).
