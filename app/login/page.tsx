import { login, signup } from './actions'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>
}) {
  const params = await searchParams

  return (
    <div className="flex justify-center items-center h-screen">
      <div className="p-8 border rounded-lg shadow-md w-96 space-y-4">
        <h2 className="text-2xl font-bold text-center">Entrar</h2>
        <form className="flex flex-col space-y-4">
          <div className="flex flex-col">
            <label htmlFor="email">E-mail:</label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="p-2 border rounded"
            />
          </div>
          <div className="flex flex-col">
            <label htmlFor="password">Senha:</label>
            <input
              id="password"
              name="password"
              type="password"
              required
              className="p-2 border rounded"
            />
          </div>
          <button
            formAction={login}
            className="bg-blue-500 text-white p-2 rounded w-full"
          >
            Entrar
          </button>
          <button
            formAction={signup}
            className="bg-gray-200 text-gray-800 p-2 rounded w-full"
          >
            Criar conta
          </button>
          {params?.message && (
            <p className="text-center text-sm mt-4 text-red-500">
              {params.message}
            </p>
          )}
        </form>
      </div>
    </div>
  )
}