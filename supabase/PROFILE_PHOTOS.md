# Fotos de perfil

O bucket privado `profile-photos` já foi criado no Supabase pela migração `private_profile_photos`. Publique o código para exibir a foto junto ao nome no Dashboard. Clique na foto para enviar JPG, PNG ou WebP de até 2 MB, ou voltar à imagem do Google/remover a foto própria.

Preferência: arquivo próprio em `user_metadata.profile_photo_path`, depois imagem HTTPS de `googleusercontent.com` fornecida pela identidade Google/metadados, depois iniciais. Metadados de foto são somente apresentação, nunca autorização. Cada arquivo tem um nome único dentro da pasta do UUID autenticado. RLS permite somente upload, consulta e remoção dos próprios arquivos; não há sobrescrita ou acesso público. O servidor gera URL assinada por uma hora. Se o armazenamento estiver indisponível ou a imagem falhar, o Dashboard continua disponível com a imagem do provedor ou iniciais.

As políticas foram testadas no banco real com `tests/profile-photo-storage.sql` usando papel `authenticated` e rollback. O teste verifica metadados e RLS; não envia bytes ao serviço Storage nem autentica uma conta Google real. Upload, preferência, restauração e falhas são cobertos com serviços simulados nos testes automatizados.

Fotos são objetos do Storage e precisam de backup separado do banco de dados.
