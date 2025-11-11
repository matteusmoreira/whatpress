-- Adicionar campos de criptografia para dados sensíveis

-- Tabela de contatos
ALTER TABLE contacts 
ADD COLUMN IF NOT EXISTS is_encrypted BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS encrypted_name TEXT,
ADD COLUMN IF NOT EXISTS encrypted_email TEXT,
ADD COLUMN IF NOT EXISTS encrypted_notes TEXT,
ADD COLUMN IF NOT EXISTS encrypted_custom_fields TEXT;

-- Tabela de mensagens
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS is_encrypted BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS encrypted_content TEXT,
ADD COLUMN IF NOT EXISTS encrypted_media_url TEXT,
ADD COLUMN IF NOT EXISTS encrypted_caption TEXT;

-- Tabela de templates
ALTER TABLE message_templates 
ADD COLUMN IF NOT EXISTS is_encrypted BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS encrypted_content TEXT,
ADD COLUMN IF NOT EXISTS encrypted_variables TEXT;

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_contacts_encrypted ON contacts(is_encrypted);
CREATE INDEX IF NOT EXISTS idx_messages_encrypted ON messages(is_encrypted);
CREATE INDEX IF NOT EXISTS idx_templates_encrypted ON message_templates(is_encrypted);

-- Adicionar política de segurança para garantir que apenas dados criptografados sejam armazenados
-- Isso será implementado via RLS nas aplicações

-- Adicionar comentários para documentação
COMMENT ON COLUMN contacts.is_encrypted IS 'Indica se os dados do contato estão criptografados';
COMMENT ON COLUMN contacts.encrypted_name IS 'Nome criptografado do contato';
COMMENT ON COLUMN contacts.encrypted_email IS 'Email criptografado do contato';
COMMENT ON COLUMN contacts.encrypted_notes IS 'Notas criptografadas do contato';
COMMENT ON COLUMN contacts.encrypted_custom_fields IS 'Campos customizados criptografados do contato';

COMMENT ON COLUMN messages.is_encrypted IS 'Indica se a mensagem está criptografada';
COMMENT ON COLUMN messages.encrypted_content IS 'Conteúdo criptografado da mensagem';
COMMENT ON COLUMN messages.encrypted_media_url IS 'URL da mídia criptografada';
COMMENT ON COLUMN messages.encrypted_caption IS 'Legenda criptografada da mídia';

COMMENT ON COLUMN message_templates.is_encrypted IS 'Indica se o template está criptografado';
COMMENT ON COLUMN message_templates.encrypted_content IS 'Conteúdo criptografado do template';
COMMENT ON COLUMN message_templates.encrypted_variables IS 'Variáveis criptografadas do template';