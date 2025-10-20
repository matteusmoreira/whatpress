-- Criar tabela de corridas para sistema financeiro
CREATE TABLE IF NOT EXISTS corridas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    motorista_nome VARCHAR(100) NOT NULL,
    motorista_telefone VARCHAR(20),
    origem VARCHAR(255) NOT NULL,
    destino VARCHAR(255) NOT NULL,
    distancia_km DECIMAL(10,2),
    valor_corrida DECIMAL(10,2) NOT NULL,
    valor_combustivel DECIMAL(10,2),
    valor_pedagio DECIMAL(10,2),
    valor_total DECIMAL(10,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_andamento', 'concluida', 'cancelada')),
    data_corrida TIMESTAMP WITH TIME ZONE NOT NULL,
    observacoes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_corridas_user_id ON corridas(user_id);
CREATE INDEX IF NOT EXISTS idx_corridas_status ON corridas(status);
CREATE INDEX IF NOT EXISTS idx_corridas_data ON corridas(data_corrida DESC);
CREATE INDEX IF NOT EXISTS idx_corridas_motorista ON corridas(motorista_nome);

-- Habilitar Row Level Security
ALTER TABLE corridas ENABLE ROW LEVEL SECURITY;

-- Política de segurança - usuários só podem ver suas próprias corridas
CREATE POLICY "Users can view own corridas" ON corridas FOR ALL USING (user_id = auth.uid());

-- Trigger para atualizar updated_at automaticamente
CREATE TRIGGER update_corridas_updated_at BEFORE UPDATE ON corridas
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Permissões
GRANT ALL PRIVILEGES ON corridas TO authenticated;