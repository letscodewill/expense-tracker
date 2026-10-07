param([string]$NodePath = (Get-Command node -ErrorAction Stop).Source)
$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$configPath = Join-Path $projectRoot '.env.backup.local'
if (-not (Test-Path -LiteralPath $configPath)) { throw 'Conclua a configuração Google e crie .env.backup.local primeiro.' }
$BackupDirectory = & $NodePath "--env-file=$configPath" -e 'process.stdout.write(process.env.BACKUP_LOCAL_DIR || String())'
if ($LASTEXITCODE -ne 0 -or -not $BackupDirectory) { throw 'Configure BACKUP_LOCAL_DIR no arquivo .env.backup.local.' }
if (-not [System.IO.Path]::IsPathRooted($BackupDirectory)) { throw 'Informe um caminho absoluto para a pasta de backup.' }
New-Item -ItemType Directory -Path $BackupDirectory -Force | Out-Null
$identity = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
# Restrict the local credentials and encrypted backup directory to this Windows user and SYSTEM.
& icacls.exe $configPath /inheritance:r /grant:r "${identity}:(F)" 'SYSTEM:(F)' | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Não foi possível restringir as permissões do arquivo de configuração.' }
& icacls.exe $BackupDirectory /inheritance:r /grant:r "${identity}:(OI)(CI)F" 'SYSTEM:(OI)(CI)F' | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Não foi possível restringir as permissões da pasta de backup.' }
$taskAction = New-ScheduledTaskAction -Execute $NodePath -Argument '--env-file=.env.backup.local scripts/backup.mjs sync' -WorkingDirectory $projectRoot
# Windows uses the local timezone; this task runs when the user is signed in.
$taskTrigger = New-ScheduledTaskTrigger -Daily -At '07:30'
$taskSettings = New-ScheduledTaskSettingsSet -StartWhenAvailable -RunOnlyIfNetworkAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Hours 2)
$taskPrincipal = New-ScheduledTaskPrincipal -UserId $identity -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName 'NoControle - Copia diaria do Drive' -Action $taskAction -Trigger $taskTrigger -Settings $taskSettings -Principal $taskPrincipal -Description 'Baixa e verifica backups criptografados do NoControle, sem alterar o banco.' -Force | Out-Null
Write-Output 'Cópia diária configurada para 07h30 no horário do Windows, quando o usuário estiver conectado. O destino efetivo é BACKUP_LOCAL_DIR em .env.backup.local.'
