# Sempre Responda em Português!
# Sempre que iniciar localhost, inicie na porta 8080 e fecha as demais conexões abertas!

# Padrões Lovable


# Estrutura de Componente Padrão

// UserCard.tsx

interface UserCardProps {

user: {

id: string;

name: string;

email: string;

};

onEdit?: () => void;

}



export const UserCard: React.FC<UserCardProps> = ({ user, onEdit }) => {

// Lógica aqui

return (

<Card variant="elevated">

{/\* UI usando tokens semânticos \*/}

</Card>

);

};



text



\## Pattern: Discriminated Unions para Estados

type DataState<T> =

| { status: 'idle' }

| { status: 'loading' }

| { status: 'success'; data: T }

| { status: 'error'; error: Error };



// Uso em componente

const \[state, setState] = useState<DataState<User>>({ status: 'idle' });



// Type narrowing automático

if (state.status === 'success') {

console.log(state.data); // TypeScript sabe que data existe

}



text



\## Pattern: Custom Hooks

// useAuth.ts

interface UseAuthReturn {

user: User | null;

login: (credentials: Credentials) => Promise<void>;

logout: () => Promise<void>;

isLoading: boolean;

}



export const useAuth = (): UseAuthReturn => {

// Implementação

};



text



\## Pattern: API Services

// userService.ts

export const userService = {

async getUser(id: string): Promise<User> {

try {

const { data, error } = await supabase

.from('users')

.select('\*')

.eq('id', id)

.single();



text

  if (error) throw error;

  return data;

} catch (error) {

  logger.error('Failed to fetch user', { id, error });

  throw error;

}

}

};

undefined



\# Checklist de Qualidade Lovable



Antes de concluir qualquer implementação, verifique:



\## Design System

\- \[ ] Usei apenas tokens semânticos (nenhum text-white, bg-black)

\- \[ ] Cores são HSL no index.css

\- \[ ] Variantes de componentes estão definidas

\- \[ ] Testei modo claro E escuro



\## TypeScript

\- \[ ] Zero uso de `any`

\- \[ ] Todas props têm interface

\- \[ ] Named exports (não default)

\- \[ ] JSDoc para funções públicas



\## React

\- \[ ] Apenas componentes funcionais

\- \[ ] Componente tem menos de 200 linhas

\- \[ ] Tratamento de erros implementado

\- \[ ] Custom hooks começam com "use"



\## Performance

\- \[ ] Imports otimizados

\- \[ ] Memoização onde necessário

\- \[ ] Imagens otimizadas

\- \[ ] Sem re-renders desnecessários



\## Código Limpo

\- \[ ] Funções fazem UMA coisa

\- \[ ] Nomes descritivos

\- \[ ] Sem console.log

\- \[ ] Comentários explicam PORQUÊ

