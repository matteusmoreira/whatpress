-- Remover políticas RLS recursivas em public.user_tenants e reinstalar políticas seguras
-- Corrige erro: 42P17: infinite recursion detected in policy for relation "user_tenants"

-- Garantir RLS habilitado
ALTER TABLE public.user_tenants ENABLE ROW LEVEL SECURITY;

-- Remover políticas problemáticas que fazem subselect na própria tabela
DROP POLICY IF EXISTS "SuperAdmin can see all associations" ON public.user_tenants;
DROP POLICY IF EXISTS "SuperAdmin can manage associations" ON public.user_tenants;
DROP POLICY IF EXISTS "Manage own user_tenants" ON public.user_tenants;
DROP POLICY IF EXISTS "Users can see their own associations" ON public.user_tenants;

-- Política segura de leitura: cada usuário só vê suas próprias associações
CREATE POLICY "Users can see their own associations" ON public.user_tenants FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- (Opcional) Política segura de atualização: usuário só atualiza seus registros
CREATE POLICY "Users can update own associations" ON public.user_tenants FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- (Opcional) Inserção controlada deve ser feita pelo service_role (backend) quando necessário
-- Isto evita que o cliente crie associações indevidas
CREATE POLICY "Service role can manage associations" ON public.user_tenants FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Observação: Não criar políticas em user_tenants que checam SUPERADMIN usando subconsultas
-- para a própria tabela. Use claims JWT ou funções auxiliares em outras tabelas.