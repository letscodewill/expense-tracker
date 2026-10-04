import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const nodeRequire = createRequire(import.meta.url)

// Run the actual TypeScript modules with isolated services, without contacting
// Supabase or changing real financial data. UI primitives remain opaque elements.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const primitives = new Proxy({}, { get: (_, name) => String(name) })
function load(file, mocks = {}, globals = {}) {
  const filename = path.join(root, file)
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    fileName: filename,
  }).outputText
  const loadedModule = { exports: {} }
  const localRequire = (name) => {
    if (Object.hasOwn(mocks, name)) return mocks[name]
    if (name.includes('month-year-picker')) return { MonthYearPicker: 'MonthYearPicker', MONTH_NAMES_PT: Array(12).fill('Mês') }
    if (name.startsWith('@/components/') || name === 'lucide-react') return primitives
    if (name.startsWith('./') && file.startsWith('components/')) return primitives
    if (name === 'next/link') return 'Link'
    return nodeRequire(name)
  }
  vm.runInNewContext(output, {
    module: loadedModule, exports: loadedModule.exports, require: localRequire,
    URL,
    console: { ...console, error() {}, warn() {} },
    setTimeout: (callback) => { callback(); return 0 },
    ...globals,
  }, { filename })
  return loadedModule.exports
}

function hooks() {
  const slots = []
  let cursor = 0, dirty = false, pending = [], tree, component, props
  const equal = (a, b) => a && b && a.length === b.length && a.every((value, i) => Object.is(value, b[i]))
  const react = {
    useState(initial) {
      const index = cursor++
      if (!slots[index]) slots[index] = { value: typeof initial === 'function' ? initial() : initial }
      return [slots[index].value, (next) => {
        const value = typeof next === 'function' ? next(slots[index].value) : next
        if (!Object.is(value, slots[index].value)) { slots[index].value = value; dirty = true }
      }]
    },
    useReducer(reducer, initial) {
      const [value, set] = react.useState(initial)
      return [value, (action) => set((previous) => reducer(previous, action))]
    },
    useMemo(callback, deps) {
      const index = cursor++
      if (!slots[index] || !equal(slots[index].deps, deps)) slots[index] = { value: callback(), deps }
      return slots[index].value
    },
    useCallback(callback, deps) { return react.useMemo(() => callback, deps) },
    useEffect(callback, deps) {
      const index = cursor++
      if (!slots[index] || !equal(slots[index].deps, deps)) {
        slots[index] = { deps }; pending.push(callback)
      }
    },
    startTransition(callback) { callback() },
    useTransition() { return [false, react.startTransition] },
  }
  function render(nextComponent = component, nextProps = props) {
    component = nextComponent; props = nextProps
    let iterations = 0
    do {
      dirty = false; cursor = 0; tree = component(props)
      assert.ok(++iterations < 25, 'render must converge')
    } while (dirty)
    const effects = pending; pending = []; effects.forEach((effect) => effect())
    return tree
  }
  async function flush() {
    for (let i = 0; i < 8; i++) {
      await new Promise(setImmediate)
      if (dirty) render()
    }
    return tree
  }
  return { react, render, flush }
}
function elements(node, predicate) {
  if (Array.isArray(node)) return node.flatMap((child) => elements(child, predicate))
  if (!node || typeof node !== 'object' || !node.props) return []
  return [...(predicate(node) ? [node] : []), ...elements(node.props.children, predicate), ...elements(node.props.navigationActions, predicate)]
}
function find(tree, predicate) {
  const found = elements(tree, predicate)[0]
  assert.ok(found, 'expected UI element exists')
  return found
}
function database(responses) {
  const requests = []
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: 'test-user' } } }) },
    from(table) {
      const request = { table, calls: [] }; requests.push(request)
      const query = new Proxy({}, { get: (_, method) => {
        if (method === 'then') return (resolve, reject) => {
          const response = responses[table]?.shift() ?? { data: [], error: null }
          return Promise.resolve(response).then(resolve, reject)
        }
        return (...args) => { request.calls.push([method, ...args]); return query }
      } })
      return query
    },
  }
  return { client, requests }
}
const selected = { month: 9, year: 2026 }
const expense = { id: 1, nome: 'Mercado', valor: 80, data_pagamento: '2026-10-03', status: 'Pendente', comentario: 'Compra', installment_group_id: null, recurring_group_id: null }
const failure = { data: null, error: { message: 'offline' } }
const success = (data) => ({ data, error: null })

test('light and dark themes persist, synchronize tabs and survive blocked storage', () => {
  for (const blocked of [false, true]) {
    const values = new Map(), listeners = new Map()
    const html = { dataset: {}, classList: { toggle: (_, enabled) => { html.dark = enabled } } }
    const window = {
      localStorage: { getItem: key => { if (blocked) throw Error('blocked'); return values.get(key) ?? null }, setItem: (key, value) => { if (blocked) throw Error('blocked'); values.set(key, value) } },
      matchMedia: () => ({ matches: false }),
      addEventListener: (type, listener) => listeners.set(type, listener),
      removeEventListener: type => listeners.delete(type),
      dispatchEvent: event => listeners.get(event.type)?.(event),
    }
    const themes = load('lib/themes.ts', {}, { window, document: { documentElement: html }, Event: class { constructor(type) { this.type = type } } })
    assert.equal(themes.THEMES.filter(theme => theme.mode === 'light').length, 1)
    assert.equal(themes.THEMES.filter(theme => theme.mode === 'dark').length, 1)
    let changes = 0
    const unsubscribe = themes.subscribeTheme(() => changes++)
    for (const theme of themes.THEMES) {
      themes.selectTheme(theme.id)
      assert.equal(themes.getThemeSnapshot(), theme.id)
      assert.equal(html.dark, theme.mode === 'dark')
      if (!blocked) assert.equal(values.get(themes.THEME_STORAGE_KEY), theme.id)
    }
    assert.equal(changes, 2)
    themes.selectTheme('invalid')
    assert.equal(changes, 2)
    values.set(themes.THEME_STORAGE_KEY, 'mint-light')
    window.dispatchEvent({ type: 'storage', key: themes.THEME_STORAGE_KEY })
    assert.equal(themes.getThemeSnapshot(), 'lavender-light')
    unsubscribe()
    assert.equal(listeners.size, 0)
  }
})

test('theme bootstrap restores preferences before hydration and rejects unknown stored values', () => {
  const { THEME_INIT_SCRIPT } = load('lib/themes.ts')
  for (const [stored, darkSystem, expected] of [['lavender-dark', false, 'lavender-dark'], ['peach-dark', false, 'lavender-dark'], ['mint-light', true, 'lavender-light'], ['invalid', true, 'lavender-dark'], [null, false, 'lavender-light']]) {
    const html = { dataset: {}, classList: { toggle: (_, value) => { html.dark = value } } }
    vm.runInNewContext(THEME_INIT_SCRIPT, { localStorage: { getItem: () => stored }, window: { matchMedia: () => ({ matches: darkSystem }) }, document: { documentElement: html } })
    assert.equal(html.dataset.theme, expected)
    assert.equal(html.dark, expected.endsWith('-dark'))
  }
})

test('light and dark palettes keep normal text at WCAG AA contrast', () => {
  const css = fs.readFileSync(path.join(root, 'app/globals.css'), 'utf8')
  const variables = block => Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/g)].map(match => [match[1], match[2]]))
  const light = variables(css.match(/:root\s*\{([^}]+)\}/)[1])
  const dark = variables(css.match(/\.dark\s*\{([^}]+)\}/)[1])
  function luminance(hex) {
    const rgb = hex.slice(1).match(/../g).map(value => parseInt(value, 16) / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
    return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722
  }
  const { THEMES } = load('lib/themes.ts')
  for (const theme of THEMES) {
    const override = css.match(new RegExp(`:root\\[data-theme="${theme.id}"\\]\\s*\\{([^}]+)\\}`))
    const colors = { ...light, ...(theme.mode === 'dark' ? dark : {}), ...(override ? variables(override[1]) : {}) }
    for (const [fg, bg] of [['foreground', 'background'], ['foreground', 'card'], ['muted-foreground', 'background'], ['muted-foreground', 'muted'], ['primary-foreground', 'primary'], ['secondary-foreground', 'secondary'], ['accent-foreground', 'accent']]) {
      const a = luminance(colors[fg]), b = luminance(colors[bg])
      const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
      assert.ok(ratio >= 4.5, `${theme.id}: ${fg}/${bg} has contrast ${ratio.toFixed(2)}`)
    }
  }
})

test('dashboard prefers custom signed image and survives image storage failures', async () => {
  for (const fail of [false, true]) {
    const user = { id: 'abc', email: 'user@example.com', user_metadata: { profile_photo_path: 'abc/def.jpg', avatar_url: 'https://lh3.googleusercontent.com/photo' } }
    const { default: HomePage } = load('app/page.tsx', {
      '@/lib/supabase/server': { createClient: async () => ({ auth: { getUser: async () => ({ data: { user } }) }, storage: { from: () => ({ createSignedUrl: async path => { assert.equal(path, 'abc/def.jpg'); if (fail) throw new Error('unavailable'); return { data: { signedUrl: 'https://storage.example/signed' }, error: null } } }) } }) },
      '@/app/actions': { signOut() {} }, '@/lib/tickets': load('lib/tickets.ts'), '@/lib/profile-photo': load('lib/profile-photo.ts'),
      'next/navigation': { redirect: () => { throw new Error('LOGIN') } },
    })
    const tree = await HomePage()
    const profile = find(tree, node => node.type === 'ProfilePhoto')
    assert.equal(profile.props.photo, fail ? 'https://lh3.googleusercontent.com/photo' : 'https://storage.example/signed')
    assert.equal(profile.props.custom, true)
    assert.equal(profile.props.hasGooglePhoto, true)
  }
})

test('profile photo button supports upload and image failure falls back to initials', async () => {
  const runtime = hooks()
  let refreshed = 0, saved = null
  const { ProfilePhoto } = load('components/profile-photo.tsx', {
    react: runtime.react, 'next/image': 'Image', 'next/navigation': { useRouter: () => ({ refresh: () => refreshed++ }) },
    '@/lib/supabase/client': { createClient: () => ({}) },
    '@/lib/profile-photo': { validateAvatar: () => null, saveProfilePhoto: async (_, file) => { saved = file; return { error: null } } },
  })
  let tree = runtime.render(ProfilePhoto, { name: 'Will Santos', photo: 'https://lh3.googleusercontent.com/photo', custom: true, hasGooglePhoto: true })
  find(tree, node => node.type === 'Image').props.onError()
  tree = runtime.render()
  assert.equal(elements(tree, node => node.type === 'Image').length, 0)
  find(tree, node => node.type === 'span' && node.props.children === 'WS')
  const file = { size: 100, type: 'image/png' }
  find(tree, node => node.props.type === 'file').props.onChange({ target: { files: [file] } })
  tree = runtime.render()
  await find(tree, node => node.type === 'Button' && node.props.children === 'Salvar foto').props.onClick()
  tree = await runtime.flush()
  assert.equal(saved, file)
  assert.equal(refreshed, 1)
  assert.equal(find(tree, node => node.type === 'Dialog').props.open, false)
})

test('profile photos accept safe Google URLs and only the current users custom path', () => {
  const { googlePhoto, avatarPath, validateAvatar } = load('lib/profile-photo.ts')
  assert.equal(googlePhoto({ id: 'a', user_metadata: { picture: 'https://lh3.googleusercontent.com/photo' } }), 'https://lh3.googleusercontent.com/photo')
  for (const url of ['javascript:alert(1)', 'https://googleusercontent.com.evil.test/a', 'http://lh3.googleusercontent.com/a', 'https://x@lh3.googleusercontent.com/a']) assert.equal(googlePhoto({ id: 'a', user_metadata: { avatar_url: url } }), null)
  assert.equal(avatarPath({ id: 'abc', user_metadata: { profile_photo_path: 'abc/def.jpg' } }), 'abc/def.jpg')
  for (const path of ['def/abc.jpg', 'abc/../def.jpg', 'abc/def.svg']) assert.equal(avatarPath({ id: 'abc', user_metadata: { profile_photo_path: path } }), null)
  assert.equal(validateAvatar({ type: 'image/png', size: 100 }), null)
  assert.ok(validateAvatar({ type: 'image/svg+xml', size: 100 }))
  assert.ok(validateAvatar({ type: 'image/png', size: 0 }))
  assert.ok(validateAvatar({ type: 'image/png', size: 2097153 }))
})

test('profile photo upload persists preference, preserves Google data, and cleans old file only after success', async () => {
  const calls = []
  const user = { id: 'abc', user_metadata: { profile_photo_path: 'abc/def.jpg', avatar_url: 'https://lh3.googleusercontent.com/photo' } }
  const client = {
    auth: { getUser: async () => ({ data: { user }, error: null }), updateUser: async data => { calls.push(['update', data]); return { error: null } } },
    storage: { from: () => ({ upload: async path => { calls.push(['upload', path]); return { error: null } }, remove: async paths => { calls.push(['remove', paths[0]]); return { error: null } } }) },
  }
  const { saveProfilePhoto } = load('lib/profile-photo.ts', {}, { crypto: { randomUUID: () => '123' } })
  assert.equal((await saveProfilePhoto(client, { type: 'image/png', size: 100 })).error, null)
  assert.equal(calls[0][1], 'abc/123.png')
  assert.equal(calls[1][1].data.profile_photo_path, 'abc/123.png')
  assert.equal(calls[1][1].data.avatar_url, undefined)
  assert.equal(calls[2][1], 'abc/def.jpg')
  calls.length = 0
  assert.equal((await saveProfilePhoto(client, null)).error, null)
  assert.equal(calls[0][1].data.profile_photo_path, null)
  assert.equal(calls[1][1], 'abc/def.jpg')
})

test('profile photo failures reject anonymous upload and retain the old preference', async () => {
  const { saveProfilePhoto } = load('lib/profile-photo.ts', {}, { crypto: { randomUUID: () => '123' } })
  let uploaded = 0, updated = 0, removed = null
  const client = {
    auth: { getUser: async () => ({ data: { user: null }, error: null }), updateUser: async () => { updated++; return { error: {} } } },
    storage: { from: () => ({ upload: async () => { uploaded++; return { error: null } }, remove: async paths => { removed = paths[0]; return { error: null } } }) },
  }
  assert.ok((await saveProfilePhoto(client, { type: 'image/png', size: 100 })).error)
  assert.equal(uploaded, 0)
  client.auth.getUser = async () => ({ data: { user: { id: 'abc', user_metadata: { profile_photo_path: 'abc/def.jpg' } } }, error: null })
  assert.ok((await saveProfilePhoto(client, { type: 'image/png', size: 100 })).error)
  assert.equal(removed, 'abc/123.png')
  assert.equal(updated, 1)
  assert.ok((await saveProfilePhoto(client, { type: 'image/svg+xml', size: 100 })).error)
  assert.equal(uploaded, 1)
})

test('paying and undoing a row persists status and refreshes related views', async () => {
  for (const status of ['Pendente', 'Pago']) {
    const runtime = hooks(), row = { ...expense, status }, db = database({ expenses: [success([row]), success([{ id: row.id }]), success([row])] })
    let changed = 0
    const { ExpenseTable } = load('components/expense-table.tsx', { react: runtime.react, '@/lib/supabase/client': { createClient: () => db.client } })
    runtime.render(ExpenseTable, { boardId: null, title: 'Principal', selected, onChanged: () => changed++ })
    const tree = await runtime.flush()
    await find(tree, node => node.props.title === (status === 'Pago' ? 'Marcar como pendente' : 'Marcar como pago')).props.onClick()
    await runtime.flush()
    const update = db.requests.find(request => request.calls.some(([method]) => method === 'update'))
    assert.equal(update.calls.find(([method]) => method === 'update')[1].status, status === 'Pago' ? 'Pendente' : 'Pago')
    assert.ok(update.calls.some(([method, column, value]) => method === 'eq' && column === 'id' && value === row.id))
    assert.equal(changed, 1)
  }
})

test('failed or unauthorized payment displays an error without refreshing as success', async () => {
  for (const response of [failure, success([])]) {
    const runtime = hooks(), db = database({ expenses: [success([expense]), response] })
    let changed = 0
    const { ExpenseTable } = load('components/expense-table.tsx', { react: runtime.react, '@/lib/supabase/client': { createClient: () => db.client } })
    runtime.render(ExpenseTable, { boardId: null, title: 'Principal', selected, onChanged: () => changed++ })
    let tree = await runtime.flush()
    await find(tree, node => node.props.title === 'Marcar como pago').props.onClick()
    tree = await runtime.flush()
    find(tree, node => node.props.role === 'alert')
    assert.equal(changed, 0)
    assert.equal(find(tree, node => node.props.title === 'Marcar como pago').props.disabled, false)
  }
})

test('main panel changes invalidate secondary board tables too', async () => {
  const runtime = hooks(), board = { id: 'board-1', name: 'Cartão', month: new Date().getMonth(), year: new Date().getFullYear() }
  const db = database({ boards: [success([board]), success([board])], expenses: [success([]), success([])] })
  const { ExpensesDashboard } = load('components/expenses-dashboard.tsx', { react: runtime.react, '@/lib/supabase/client': { createClient: () => db.client } })
  runtime.render(ExpensesDashboard, {})
  let tree = await runtime.flush()
  const secondary = find(tree, node => node.type === 'ExpenseTable' && node.props.boardId === board.id)
  const before = secondary.props.refreshKey
  find(tree, node => node.type === 'ExpenseTable' && node.props.boardId === null).props.onChanged()
  tree = await runtime.flush()
  assert.equal(find(tree, node => node.type === 'ExpenseTable' && node.props.boardId === board.id).props.refreshKey, before + 1)
})

test('collapsing expense rows keeps title, total and unpaid balance visible', async () => {
  for (const boardId of [null, 'board-1']) {
    const runtime = hooks(), db = database({ expenses: [success([expense, { ...expense, id: 2, valor: 20, status: 'Pago' }])] })
    const { ExpenseTable } = load('components/expense-table.tsx', { react: runtime.react, '@/lib/supabase/client': { createClient: () => db.client } })
    runtime.render(ExpenseTable, { boardId, title: 'Despesas do mês', selected })
    let tree = await runtime.flush()
    find(tree, node => node.props['aria-label'] === 'Alternar exibição do quadro').props.onClick()
    tree = runtime.render()
    assert.equal(elements(tree, node => node.type === 'Table').length, 0)
    find(tree, node => node.type === 'h2' && node.props.children === 'Despesas do mês')
    find(tree, node => node.type === 'MaskedValue' && node.props.value === 100)
    find(tree, node => node.type === 'MaskedValue' && node.props.value === 80)
    find(tree, node => node.props['aria-label'] === 'Alternar exibição do quadro').props.onClick()
    tree = runtime.render()
    assert.equal(elements(tree, node => node.type === 'Table').length, 1)
    assert.equal(db.requests.length, 1)
  }
})

test('salary privacy masks only opted-in salary while expense and remaining values stay readable', () => {
  for (const hidden of [true, false]) {
    const { MaskedValue } = load('components/masked-value.tsx', {
      '@/context/visibility-context': { useValuesVisibility: () => ({ hidden }) },
    })
    assert.equal(MaskedValue({ value: 100, mask: true }).props.children, hidden ? 'R$ ••••' : (100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }))
    assert.equal(MaskedValue({ value: 80 }).props.children, (80).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }))
  }
  const runtime = hooks(), db = database({ salaries: [success({ valor: 100 })] })
  const { SalaryCard } = load('components/salary-card.tsx', { react: runtime.react, '@/lib/supabase/client': { createClient: () => db.client } })
  runtime.render(SalaryCard, { selected, totalExpenses: 80 })
  return runtime.flush().then(tree => {
    assert.equal(find(tree, node => node.type === 'MaskedValue' && node.props.value === 100).props.mask, true)
    assert.equal(find(tree, node => node.type === 'MaskedValue' && node.props.value === 20).props.mask, undefined)
  })
})

test('expense loading retries twice, keeps month/board filters and displays totals', async () => {
  const runtime = hooks(), db = database({ expenses: [failure, failure, success([expense])] })
  const delays = []
  const { ExpenseTable } = load('components/expense-table.tsx', { react: runtime.react, '@/lib/supabase/client': { createClient: () => db.client } }, {
    setTimeout(callback, duration) { delays.push(duration); callback(); return 0 },
  })
  runtime.render(ExpenseTable, { boardId: 'board-1', title: 'Cartão', selected })
  const tree = await runtime.flush()
  assert.equal(db.requests.length, 3)
  assert.deepEqual(delays, [1000, 2000])
  for (const request of db.requests) {
    assert.ok(request.calls.some(([method, column, value]) => method === 'eq' && column === 'board_id' && value === 'board-1'))
    assert.ok(request.calls.some(([method, column, value]) => method === 'gte' && column === 'data_pagamento' && value === '2026-10-01'))
  }
  assert.ok(elements(tree, (node) => node.type === 'MaskedValue' && node.props.value === 80).length >= 3)
})

test('expense loading stops after three failures and can be retried manually', async () => {
  const runtime = hooks(), db = database({ expenses: [failure, failure, failure, success([expense])] })
  const { ExpenseTable } = load('components/expense-table.tsx', { react: runtime.react, '@/lib/supabase/client': { createClient: () => db.client } })
  runtime.render(ExpenseTable, { boardId: null, title: 'Principal', selected })
  let tree = await runtime.flush()
  assert.equal(db.requests.length, 3)
  find(tree, (node) => node.props.children === 'Tentar novamente').props.onClick()
  tree = await runtime.flush()
  assert.equal(db.requests.length, 4)
  assert.ok(db.requests[3].calls.some(([method, column, value]) => method === 'is' && column === 'board_id' && value === null))
  assert.ok(elements(tree, (node) => node.type === 'MaskedValue').length > 0)
})

test('board draft uses the current title when editing and preserves cancellation', async () => {
  const runtime = hooks(), db = database({ expenses: [success([])] })
  const { ExpenseTable } = load('components/expense-table.tsx', { react: runtime.react, '@/lib/supabase/client': { createClient: () => db.client } })
  runtime.render(ExpenseTable, { boardId: 'board-1', title: 'Antigo', selected })
  await runtime.flush()
  let tree = runtime.render(ExpenseTable, { boardId: 'board-1', title: 'Atualizado', selected })
  find(tree, (node) => node.props['aria-label'] === 'Renomear quadro').props.onClick()
  tree = await runtime.flush()
  assert.equal(find(tree, (node) => node.props.placeholder === 'Nome do quadro').props.value, 'Atualizado')
  find(tree, (node) => node.props['aria-label'] === 'Cancelar').props.onClick()
  tree = await runtime.flush()
  assert.equal(elements(tree, (node) => node.props.placeholder === 'Nome do quadro').length, 0)
})

test('dashboard loads boards after retry and stops after three failures', async () => {
  for (const responses of [[failure, failure, success([{ id: 'board-1', name: 'Cartão', ...selected }])], [failure, failure, failure]]) {
    const runtime = hooks(), db = database({ boards: [...responses], expenses: [success([{ valor: 80 }])] })
    const { ExpensesDashboard } = load('components/expenses-dashboard.tsx', { react: runtime.react, '@/lib/supabase/client': { createClient: () => db.client } })
    runtime.render(ExpensesDashboard, {})
    const tree = await runtime.flush()
    assert.equal(db.requests.filter((request) => request.table === 'boards').length, 3)
    assert.equal(find(tree, (node) => node.type === 'SalaryCard').props.totalExpenses, 80)
    if (responses[2].error) find(tree, (node) => node.props.children === 'Tentar novamente')
    else find(tree, (node) => node.type === 'ExpenseTable' && node.props.boardId === 'board-1')
  }
})

test('salary loads, calculates remaining balance, rejects invalid edits and saves valid edits', async () => {
  const runtime = hooks(), db = database({ salaries: [success({ valor: 1000 }), success(null)] })
  const { SalaryCard } = load('components/salary-card.tsx', { react: runtime.react, '@/lib/supabase/client': { createClient: () => db.client } })
  runtime.render(SalaryCard, { selected, totalExpenses: 80 })
  let tree = await runtime.flush()
  find(tree, (node) => node.type === 'MaskedValue' && node.props.value === 920)
  find(tree, (node) => node.props['aria-label'] === 'Editar salário').props.onClick()
  tree = await runtime.flush()
  find(tree, (node) => node.props.id === 'salary-input').props.onChange({ target: { value: '-1' } })
  tree = await runtime.flush()
  await find(tree, (node) => node.props['aria-label'] === 'Salvar').props.onClick()
  tree = await runtime.flush()
  find(tree, (node) => node.props.children === 'Informe um valor válido.')
  assert.equal(db.requests.length, 1)
  find(tree, (node) => node.props.id === 'salary-input').props.onChange({ target: { value: '1200,50' } })
  tree = await runtime.flush()
  await find(tree, (node) => node.props['aria-label'] === 'Salvar').props.onClick()
  tree = await runtime.flush()
  find(tree, (node) => node.type === 'MaskedValue' && node.props.value === 1120.5)
  assert.equal(db.requests[1].calls.find(([method]) => method === 'upsert')[1].valor, 1200.5)
})

test('expense dialog opens populated, switches editing target, closes and opens through FAB', async () => {
  const runtime = hooks(), db = database({})
  const { AddExpenseDialog } = load('components/add-expense-dialog.tsx', {
    react: runtime.react, '@/lib/supabase/client': { createClient: () => db.client },
    '@/lib/supabase/safe-get-user': { safeGetUser: async () => ({ id: 'test-user' }) },
  })
  const props = { onAdded() {}, expenseToEdit: expense }
  let tree = runtime.render(AddExpenseDialog, props)
  assert.equal(tree.props.open, true)
  assert.equal(find(tree, (node) => node.props.id === 'nome').props.value, 'Mercado')
  assert.equal(find(tree, (node) => node.props.id === 'valor').props.value, '80')
  tree = runtime.render(AddExpenseDialog, { ...props, expenseToEdit: { ...expense, id: 2, nome: 'Aluguel', valor: 900 } })
  assert.equal(find(tree, (node) => node.props.id === 'nome').props.value, 'Aluguel')
  tree.props.onOpenChange(false)
  tree = await runtime.flush()
  assert.equal(tree.props.open, false)
  tree = runtime.render(AddExpenseDialog, { ...props, expenseToEdit: null, forceOpen: false })
  tree = runtime.render(AddExpenseDialog, { ...props, expenseToEdit: null, forceOpen: true })
  assert.equal(tree.props.open, true)
  assert.equal(find(tree, (node) => node.props.id === 'nome').props.value, '')
})

test('visibility restores storage, toggles, notifies, synchronizes tabs and unsubscribes', () => {
  const target = new EventTarget(), data = new Map([['expense-tracker:values-hidden', 'true']])
  const window = Object.assign(target, { localStorage: { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) } })
  const store = load('lib/values-visibility-store.ts', {}, { window, Event })
  assert.equal(store.getServerVisibilitySnapshot(), false)
  assert.equal(store.getVisibilitySnapshot(), true)
  let notifications = 0
  const unsubscribe = store.subscribeVisibility(() => notifications++)
  store.toggleVisibility()
  assert.equal(store.getVisibilitySnapshot(), false)
  assert.equal(data.get('expense-tracker:values-hidden'), 'false')
  assert.equal(notifications, 1)
  const event = new Event('storage'); event.key = 'expense-tracker:values-hidden'
  data.set(event.key, 'true'); window.dispatchEvent(event)
  assert.equal(store.getVisibilitySnapshot(), true)
  assert.equal(notifications, 2)
  unsubscribe(); store.toggleVisibility()
  assert.equal(notifications, 2)
})

test('visibility remains usable when localStorage is blocked', () => {
  const window = Object.assign(new EventTarget(), { localStorage: { getItem() { throw new Error('blocked') }, setItem() { throw new Error('blocked') } } })
  const store = load('lib/values-visibility-store.ts', {}, { window, Event })
  assert.equal(store.getVisibilitySnapshot(), false)
  store.toggleVisibility(); assert.equal(store.getVisibilitySnapshot(), true)
  store.toggleVisibility(); assert.equal(store.getVisibilitySnapshot(), false)
})

test('PDF extraction groups lines, handles multiple pages and skips non-text markers', async () => {
  const text = (str, y) => ({ str, transform: [1, 0, 0, 1, 0, y] })
  const pdf = { numPages: 2, getPage: async (number) => ({ getTextContent: async () => ({ items: number === 1 ? [{ type: 'beginMarkedContent' }, text('Mercado', 10), text('80,00', 10), text('Outra linha', 20)] : [text('Segunda página', 10)] }) }) }
  const pdfjs = { version: 'test', GlobalWorkerOptions: {}, getDocument: () => ({ promise: Promise.resolve(pdf) }) }
  const { extractPdfText } = load('lib/pdf-text-extract.ts', { 'pdfjs-dist': pdfjs })
  assert.equal(await extractPdfText({ arrayBuffer: async () => new ArrayBuffer(0) }), 'Mercado 80,00\nOutra linha\nSegunda página\n')
})

test('PDF extraction identifies passwords and preserves unrelated failures', async () => {
  for (const error of [{ name: 'PasswordException' }, new Error('invalid PDF'), null]) {
    const pdfjs = { version: 'test', GlobalWorkerOptions: {}, getDocument: () => ({ promise: Promise.reject(error) }) }
    const { extractPdfText, PdfPasswordRequiredError } = load('lib/pdf-text-extract.ts', { 'pdfjs-dist': pdfjs })
    await assert.rejects(extractPdfText({ arrayBuffer: async () => new ArrayBuffer(0) }), (received) => error?.name === 'PasswordException' ? received instanceof PdfPasswordRequiredError : received === error)
  }
})

test('invoice parsing preserves Brazilian currency, dates and split-line amounts', () => {
  const { parseInvoiceText } = load('lib/invoice-parser.ts')
  const result = parseInvoiceText('03/10 Mercado 1.234,56\n04 OUT Restaurante\n80,00\nVALOR TOTAL 1.314,56', 2026)
  assert.equal(JSON.stringify(result), JSON.stringify([{ nome: 'Mercado', valor: 1234.56, data: '2026-10-03' }, { nome: 'Restaurante', valor: 80, data: '2026-10-04' }]))
})

test('report PDF positions totals after the table and provides a safe fallback', async () => {
  for (const tableEnd of [100, undefined]) {
    const runtime = hooks(), db = database({ expenses: [success([expense])] }), calls = []
    class Pdf {
      setFontSize() {} setTextColor() {}
      text(...args) { calls.push(args) }
      save(name) { calls.push(['save', name]) }
    }
    const { ReportsView } = load('components/reports-view.tsx', {
      react: runtime.react, '@/lib/supabase/client': { createClient: () => db.client },
      jspdf: Pdf, 'jspdf-autotable': (doc) => { if (tableEnd !== undefined) doc.lastAutoTable = { finalY: tableEnd } },
    })
    let tree = runtime.render(ReportsView, {})
    await find(tree, (node) => node.props.children === 'Buscar').props.onClick()
    tree = await runtime.flush()
    find(tree, (node) => node.props.onClick?.name === 'handleExportPdf').props.onClick()
    const total = calls.find(([text]) => text.startsWith('Total do período'))
    assert.equal(total[2], (tableEnd ?? 32) + 10)
    assert.ok(total[0].includes('80,00'))
    assert.ok(calls.some(([type]) => type === 'save'))
  }
})

test('fifth business day excludes weekends for every possible starting weekday', () => {
  const { fifthBusinessDayISO } = load('lib/payment-date.ts')
  for (const [year, month, expected] of [
    [2026, 5, '2026-06-05'], // Monday
    [2026, 8, '2026-09-07'], // Tuesday
    [2026, 3, '2026-04-07'], // Wednesday
    [2026, 9, '2026-10-07'], // Thursday
    [2026, 4, '2026-05-07'], // Friday
    [2026, 7, '2026-08-07'], // Saturday
    [2026, 10, '2026-11-06'], // Sunday; November 2 is counted
    [2028, 1, '2028-02-07'], // Leap year
    [1, 0, '0001-01-05'],
  ]) assert.equal(fifthBusinessDayISO(year, month), expected)
  for (const [year, month] of [[2026, -1], [2026, 12], [2026, 1.5], [0, 0], [10000, 0], [NaN, 0]]) {
    assert.throws(() => fifthBusinessDayISO(year, month), (error) => error.name === 'RangeError')
  }
})

function invoiceRuntime({ responses = {}, extract, selectedMonth = { month: 10, year: 2026 } } = {}) {
  const runtime = hooks(), db = database(responses), imported = []
  const pdf = load('lib/pdf-text-extract.ts', { 'pdfjs-dist': { version: 'test', GlobalWorkerOptions: {} } })
  const { ImportInvoiceDialog } = load('components/import-invoice-dialog.tsx', {
    react: runtime.react,
    '@/lib/supabase/client': { createClient: () => db.client },
    '@/lib/invoice-parser': load('lib/invoice-parser.ts'),
    '@/lib/payment-date': load('lib/payment-date.ts'),
    '@/lib/pdf-text-extract': {
      PdfPasswordRequiredError: pdf.PdfPasswordRequiredError,
      extractPdfText: extract ?? (async () => '03/10 Mercado 80,00\n20/09 Restaurante 50,00'),
    },
  })
  const props = { selected: selectedMonth, boards: [{ id: 'existing-board', name: 'Cartão' }], onImported: (period) => imported.push(period) }
  let tree = runtime.render(ImportInvoiceDialog, props)
  tree.props.onOpenChange(true)
  async function upload() {
    tree = await runtime.flush()
    await find(tree, (node) => node.props.id === 'invoice-pdf').props.onChange({ target: { files: [{}] } })
    return runtime.flush()
  }
  return { runtime, db, imported, upload, ImportInvoiceDialog, props, PdfPasswordRequiredError: pdf.PdfPasswordRequiredError }
}

test('invoice review is spacious and imports all rows on the selected fifth business day', async () => {
  const invoice = invoiceRuntime()
  let tree = await invoice.upload()
  find(tree, (node) => node.type === 'DialogContent' && node.props.className === 'invoice-review-dialog')
  assert.equal(elements(tree, (node) => node.props.type === 'date').length, 0)
  assert.equal(find(tree, (node) => node.props.id === 'invoice-payment-month').props.value, '2026-11')
  assert.equal(elements(tree, (node) => node.type === 'time' && node.props.dateTime === '2026-11-06').length, 3)
  await find(tree, (node) => node.props.children === 'Importar 2 despesa(s)').props.onClick()
  tree = await invoice.runtime.flush()
  const payload = invoice.db.requests[0].calls.find(([method]) => method === 'insert')[1]
  assert.equal(payload.length, 2)
  assert.ok(payload.every((row) => row.data_pagamento === '2026-11-06' && row.board_id === null))
  assert.equal(payload[0].nome, 'Mercado')
  assert.equal(payload[0].valor, 80)
  assert.equal(JSON.stringify(invoice.imported), '[{"month":10,"year":2026}]')
  assert.equal(tree.props.open, false)
})

test('changing payment month updates every row and creates the board in the correct year', async () => {
  const invoice = invoiceRuntime({ responses: { boards: [success({ id: 'new-board' })] } })
  let tree = await invoice.upload()
  find(tree, (node) => node.props.id === 'invoice-payment-month').props.onChange({ target: { value: '2027-01' } })
  tree = await invoice.runtime.flush()
  assert.equal(elements(tree, (node) => node.type === 'time' && node.props.dateTime === '2027-01-07').length, 3)
  assert.equal(elements(tree, (node) => node.type === 'SelectItem' && node.props.value === 'existing-board').length, 0)
  find(tree, (node) => node.type === 'Select' && node.props.value === '__main__').props.onValueChange('__new__')
  tree = await invoice.runtime.flush()
  find(tree, (node) => node.props.placeholder === 'Nome do novo quadro').props.onChange({ target: { value: ' Fatura janeiro ' } })
  tree = await invoice.runtime.flush()
  await find(tree, (node) => node.props.children === 'Importar 2 despesa(s)').props.onClick()
  await invoice.runtime.flush()
  const board = invoice.db.requests.find((request) => request.table === 'boards').calls.find(([method]) => method === 'insert')[1]
  assert.equal(board.month, 0)
  assert.equal(board.year, 2027)
  assert.equal(board.name, 'Fatura janeiro')
  const rows = invoice.db.requests.find((request) => request.table === 'expenses').calls.find(([method]) => method === 'insert')[1]
  assert.ok(rows.every((row) => row.data_pagamento === '2027-01-07' && row.board_id === 'new-board'))
})

test('existing board destinations reset when the payment month changes', async () => {
  const invoice = invoiceRuntime()
  let tree = await invoice.upload()
  find(tree, (node) => node.type === 'Select').props.onValueChange('existing-board')
  tree = await invoice.runtime.flush()
  find(tree, (node) => node.props.id === 'invoice-payment-month').props.onChange({ target: { value: '2026-12' } })
  tree = await invoice.runtime.flush()
  find(tree, (node) => node.type === 'Select' && node.props.value === '__main__')
  await find(tree, (node) => node.props.children === 'Importar 2 despesa(s)').props.onClick()
  const payload = invoice.db.requests[0].calls.find(([method]) => method === 'insert')[1]
  assert.ok(payload.every((row) => row.board_id === null && row.data_pagamento === '2026-12-07'))
})

test('manual invoice rows support edits and removal and cannot import empty expenses', async () => {
  const invoice = invoiceRuntime({ extract: async () => '' })
  let tree = await invoice.upload()
  find(tree, (node) => node.props.children === 'Adicionar linha manualmente').props.onClick()
  tree = await invoice.runtime.flush()
  await find(tree, (node) => node.props.children === 'Importar 1 despesa(s)').props.onClick()
  tree = await invoice.runtime.flush()
  assert.equal(invoice.db.requests.length, 0)
  find(tree, (node) => node.props['aria-label'] === 'Nome da despesa 1').props.onChange({ target: { value: ' Compra manual ' } })
  tree = await invoice.runtime.flush()
  find(tree, (node) => node.props['aria-label'] === 'Valor da despesa 1').props.onChange({ target: { value: '12,50' } })
  tree = await invoice.runtime.flush()
  find(tree, (node) => node.props.children === 'Adicionar linha manualmente').props.onClick()
  tree = await invoice.runtime.flush()
  find(tree, (node) => node.props['aria-label'] === 'Remover despesa 2').props.onClick()
  tree = await invoice.runtime.flush()
  await find(tree, (node) => node.props.children === 'Importar 1 despesa(s)').props.onClick()
  const payload = invoice.db.requests[0].calls.find(([method]) => method === 'insert')[1]
  assert.equal(payload[0].nome, 'Compra manual')
  assert.equal(payload[0].valor, 12.5)
  assert.equal(payload[0].data_pagamento, '2026-11-06')
})

test('invoice reset uses the new dashboard month on reopening', async () => {
  const invoice = invoiceRuntime()
  let tree = await invoice.upload()
  find(tree, (node) => node.props.id === 'invoice-payment-month').props.onChange({ target: { value: '2027-01' } })
  tree = await invoice.runtime.flush()
  tree.props.onOpenChange(false)
  tree = await invoice.runtime.flush()
  tree = invoice.runtime.render(invoice.ImportInvoiceDialog, { ...invoice.props, selected: { month: 11, year: 2026 } })
  tree.props.onOpenChange(true)
  tree = await invoice.runtime.flush()
  await find(tree, (node) => node.props.id === 'invoice-pdf').props.onChange({ target: { files: [{}] } })
  tree = await invoice.runtime.flush()
  assert.equal(find(tree, (node) => node.props.id === 'invoice-payment-month').props.value, '2026-12')
})

test('invoice review keeps rows available when saving fails', async () => {
  const invoice = invoiceRuntime({ responses: { expenses: [failure] } })
  let tree = await invoice.upload()
  await find(tree, (node) => node.props.children === 'Importar 2 despesa(s)').props.onClick()
  tree = await invoice.runtime.flush()
  assert.equal(tree.props.open, true)
  find(tree, (node) => node.props.children === 'Não foi possível salvar as despesas. Tente novamente.')
  assert.equal(invoice.imported.length, 0)
  find(tree, (node) => node.props['aria-label'] === 'Nome da despesa 1' && node.props.value === 'Mercado')
})

test('password-protected invoices use the payment date and clear the password on close', async () => {
  let invoice
  invoice = invoiceRuntime({ extract: async (_file, password) => {
    if (password !== 'correct') throw new invoice.PdfPasswordRequiredError('Password required')
    return '03/10 Mercado 80,00'
  } })
  let tree = await invoice.upload()
  find(tree, (node) => node.props.id === 'pdf-password').props.onChange({ target: { value: 'correct' } })
  tree = await invoice.runtime.flush()
  await find(tree, (node) => node.props.children === 'Confirmar').props.onClick()
  tree = await invoice.runtime.flush()
  find(tree, (node) => node.type === 'time' && node.props.dateTime === '2026-11-06')
  tree.props.onOpenChange(false)
  tree = await invoice.runtime.flush()
  tree.props.onOpenChange(true)
  tree = await invoice.runtime.flush()
  assert.equal(elements(tree, (node) => node.props.id === 'pdf-password').length, 0)
  await find(tree, (node) => node.props.id === 'invoice-pdf').props.onChange({ target: { files: [{}] } })
  tree = await invoice.runtime.flush()
  assert.equal(find(tree, (node) => node.props.id === 'pdf-password').props.value, '')
})

const testAuthEnv = { NEXT_PUBLIC_SUPABASE_URL: 'https://testproject.supabase.co', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-public-key' }
const sessionConfig = () => load('lib/supabase/session-config.ts', {}, { URL })

test('session policy enforces 45 days while preserving deletions and cookie attributes', () => {
  const config = sessionConfig()
  assert.equal(config.SESSION_MAX_AGE, 3888000)
  const options = config.sessionCookieOptions('token', { maxAge: 34560000, secure: true, sameSite: 'lax' })
  assert.equal(options.maxAge, 3888000)
  assert.equal(options.secure, true)
  assert.ok(Math.abs(options.expires.getTime() - Date.now() - 3888000000) < 1000)
  assert.equal(config.sessionCookieOptions('', { maxAge: 0 }).maxAge, 0)
  assert.equal(config.isSessionCookie('sb-testproject-auth-token.1', testAuthEnv.NEXT_PUBLIC_SUPABASE_URL), true)
  assert.equal(config.isSessionCookie('sb-other-auth-token', testAuthEnv.NEXT_PUBLIC_SUPABASE_URL), false)
  assert.equal(config.isSessionCookie('sb-testproject-auth-token-code-verifier', testAuthEnv.NEXT_PUBLIC_SUPABASE_URL), false)
})

async function sessionResponse(initialCookies, authenticate) {
  const { NextRequest } = nodeRequire('next/server')
  const request = new NextRequest('https://expense.test/', { headers: { cookie: initialCookies } })
  const { updateSession } = load('lib/supabase/middleware.ts', {
    './session-config': sessionConfig(),
    '@supabase/ssr': { createServerClient: (_url, _key, options) => ({ auth: { getUser: () => authenticate(options.cookies) } }) },
  }, { process: { env: testAuthEnv }, URL })
  return { response: await updateSession(request), request }
}

test('valid sessions extend cookies by 45 days on every visit, including token chunks', async () => {
  const { response } = await sessionResponse('sb-testproject-auth-token.0=part0; sb-testproject-auth-token.1=part1; unrelated=value', async () => ({ data: { user: { id: 'user' } }, error: null }))
  for (const name of ['sb-testproject-auth-token.0', 'sb-testproject-auth-token.1']) {
    assert.equal(response.cookies.get(name).maxAge, 3888000)
  }
  assert.equal(response.cookies.get('unrelated'), undefined)
  assert.ok(response.headers.get('cache-control').includes('no-store'))
})

test('refreshed tokens reach both server requests and browser responses without reviving old chunks', async () => {
  const { response, request } = await sessionResponse('sb-testproject-auth-token.0=old; sb-testproject-auth-token.1=obsolete', async (cookies) => {
    cookies.setAll([
      { name: 'sb-testproject-auth-token.0', value: '', options: { path: '/', maxAge: 0 } },
      { name: 'sb-testproject-auth-token.1', value: '', options: { path: '/', maxAge: 0 } },
      { name: 'sb-testproject-auth-token', value: 'new-token', options: { path: '/', maxAge: 34560000 } },
    ], { 'Cache-Control': 'private, no-store' })
    return { data: { user: { id: 'user' } }, error: null }
  })
  assert.equal(request.cookies.get('sb-testproject-auth-token').value, 'new-token')
  assert.equal(request.cookies.get('sb-testproject-auth-token.1'), undefined)
  assert.equal(response.cookies.get('sb-testproject-auth-token').value, 'new-token')
  assert.equal(response.cookies.get('sb-testproject-auth-token').maxAge, 3888000)
  assert.equal(response.cookies.get('sb-testproject-auth-token.1').maxAge, 0)
})

test('transient auth failures preserve cookies, and invalid sessions clear only this project', async () => {
  for (const shouldThrow of [false, true]) {
    const { response, request } = await sessionResponse('sb-testproject-auth-token=token', async () => {
      const error = new Error('temporary outage')
      if (shouldThrow) throw error
      return { data: { user: null }, error }
    })
    assert.equal(response.cookies.getAll().length, 0)
    assert.equal(request.cookies.get('sb-testproject-auth-token').value, 'token')
  }
  const { response } = await sessionResponse('sb-testproject-auth-token=invalid; sb-other-auth-token=other', async () => ({ data: { user: null }, error: { code: 'refresh_token_not_found' } }))
  assert.equal(response.cookies.get('sb-testproject-auth-token').maxAge, 0)
  assert.equal(response.cookies.get('sb-other-auth-token'), undefined)
})

test('anonymous access does not create a session', async () => {
  const { response } = await sessionResponse('', async () => ({ data: { user: null }, error: null }))
  assert.equal(response.cookies.getAll().length, 0)
})

test('browser and server writes enforce lifetime even when the SDK supplies 400 days', async () => {
  const sdk = nodeRequire('@supabase/ssr')
  let browserOptions, serverOptions
  const writes = []
  const document = { cookie: '' }
  const { createClient: browserClient } = load('lib/supabase/client.ts', {
    './session-config': sessionConfig(),
    '@supabase/ssr': { ...sdk, createBrowserClient: (_url, _key, options) => { browserOptions = options; return {} } },
  }, { document, process: { env: testAuthEnv } })
  browserClient()
  browserOptions.cookies.setAll([{ name: 'sb-testproject-auth-token', value: 'token', options: { path: '/', maxAge: 34560000 } }])
  assert.ok(document.cookie.includes('Max-Age=3888000'))
  browserOptions.cookies.setAll([{ name: 'sb-testproject-auth-token', value: '', options: { path: '/', maxAge: 0 } }])
  assert.ok(document.cookie.includes('Max-Age=0'))
  const { createClient: serverClient } = load('lib/supabase/server.ts', {
    './session-config': sessionConfig(),
    '@supabase/ssr': { createServerClient: (_url, _key, options) => { serverOptions = options; return {} } },
    'next/headers': { cookies: async () => ({ getAll: () => [], set: (...args) => writes.push(args) }) },
  }, { process: { env: testAuthEnv } })
  await serverClient()
  serverOptions.cookies.setAll([{ name: 'sb-testproject-auth-token', value: 'token', options: { maxAge: 34560000 } }])
  assert.equal(writes[0][2].maxAge, 3888000)
})

test('login skips the form for authenticated visitors and keeps password recovery available', async () => {
  let checks = 0
  const { default: LoginPage } = load('app/login/page.tsx', {
    './actions': { login() {}, recoverPassword() {} },
    'next/image': 'Image',
    'next/navigation': { redirect: (destination) => { throw { destination } } },
    '@/lib/supabase/server': { createClient: async () => ({ auth: { getUser: async () => { checks++; return { data: { user: { id: 'user' } }, error: null } } } }) },
  })
  await assert.rejects(LoginPage({ searchParams: Promise.resolve({}) }), (result) => result.destination === '/')
  const recovery = await LoginPage({ searchParams: Promise.resolve({ mode: 'recover' }) })
  find(recovery, (node) => node.props.children === 'Recuperar senha')
  assert.equal(checks, 1)
})

test('Material login and recovery preserve field names, submission actions and account access', async () => {
  const login = () => {}, recoverPassword = () => {}
  const { default: LoginPage } = load('app/login/page.tsx', {
    './actions': { login, recoverPassword }, 'next/image': 'Image',
    'next/navigation': { redirect: () => { throw new Error('unexpected redirect') } },
    '@/lib/supabase/server': { createClient: async () => ({ auth: { getUser: async () => ({ data: { user: null }, error: null }) } }) },
  })
  for (const mode of [undefined, 'recover']) {
    const tree = await LoginPage({ searchParams: Promise.resolve({ mode, message: 'Mensagem de autenticação' }) })
    find(tree, node => node.type === 'ThemeSelector')
    find(tree, node => node.type === 'Input' && node.props.name === 'email' && node.props.required)
    assert.equal(find(tree, node => node.type === 'Button' && node.props.type === 'submit').props.formAction, mode ? recoverPassword : login)
    assert.equal(elements(tree, node => node.type === 'Input' && node.props.name === 'password').length, mode ? 0 : 1)
    assert.equal(elements(tree, node => node.type === 'GoogleSignInButton').length, mode ? 0 : 1)
    assert.equal(elements(tree, node => node.type === 'SignupDialog').length, mode ? 0 : 1)
    find(tree, node => node.props.role === 'alert' && node.props.children === 'Mensagem de autenticação')
  }
})

test('ticket master identity requires a verified matching email, never user metadata', () => {
  const { isMasterIdentity, validateTicketReply } = load('lib/tickets.ts')
  assert.equal(isMasterIdentity(null), false)
  assert.equal(isMasterIdentity({ email: 'williansantos38@gmail.com' }), false)
  assert.equal(isMasterIdentity({ email: 'other@example.com', email_confirmed_at: '2026-10-04', user_metadata: { role: 'master' } }), false)
  assert.equal(isMasterIdentity({ email: 'WillianSantos38@gmail.com', email_confirmed_at: '2026-10-04' }), true)
  assert.equal(validateTicketReply(1, 'Resposta'), null)
  assert.ok(validateTicketReply(-1, 'Resposta'))
  assert.ok(validateTicketReply(1, '   '))
  assert.ok(validateTicketReply(1, 'a'.repeat(10001)))
})

test('server ticket access checks the database role even for the verified master email', async () => {
  for (const allowed of [true, false]) {
    let rolesChecked = 0
    const { getTicketAccess } = load('lib/tickets-server.ts', {
      'server-only': {}, '@/lib/tickets': load('lib/tickets.ts'),
      '@/lib/supabase/server': { createClient: async () => ({
        auth: { getUser: async () => ({ data: { user: { id: 'master', email: 'williansantos38@gmail.com', email_confirmed_at: '2026-10-04' } }, error: null }) },
        rpc: async (name) => { assert.equal(name, 'is_ticket_master'); rolesChecked++; return { data: allowed, error: null } },
      }) },
    })
    assert.equal((await getTicketAccess()).master, allowed)
    assert.equal(rolesChecked, 1)
  }
})

test('ticket actions reject unauthorized callers without touching the database', async () => {
  let writes = 0
  const { answerTicket, changeTicketStatus } = load('app/tickets/actions.ts', {
    '@/lib/tickets': load('lib/tickets.ts'),
    '@/lib/tickets-server': { getTicketAccess: async () => ({ master: false, supabase: { rpc: async () => { writes++ } } }) },
    'next/cache': { revalidatePath() {} },
  })
  assert.ok((await answerTicket(1, 'Resposta', true)).error)
  assert.ok((await changeTicketStatus(1, 'finalizado')).error)
  assert.equal(writes, 0)
})

test('master reply trims input, can finish atomically and validates status changes', async () => {
  const writes = [], invalidated = []
  const { answerTicket, changeTicketStatus } = load('app/tickets/actions.ts', {
    '@/lib/tickets': load('lib/tickets.ts'),
    '@/lib/tickets-server': { getTicketAccess: async () => ({ master: true, supabase: { rpc: async (...args) => { writes.push(args); return { error: null } } } }) },
    'next/cache': { revalidatePath: (path) => invalidated.push(path) },
  })
  assert.equal((await answerTicket(42, ' Solução aplicada ', true)).error, null)
  assert.equal(writes[0][0], 'answer_support_ticket')
  assert.equal(writes[0][1].reply_message, 'Solução aplicada')
  assert.equal(writes[0][1].finish_ticket, true)
  assert.ok((await answerTicket(42, '', false)).error)
  assert.ok((await changeTicketStatus(42, 'hacked')).error)
  assert.equal(writes.length, 1)
  assert.equal((await changeTicketStatus(42, 'finalizado')).error, null)
  assert.equal((await changeTicketStatus(42, 'aberto')).error, null)
  assert.equal(writes[2][1].new_status, 'aberto')
  assert.ok(invalidated.includes('/tickets'))
})

test('ticket detail enforces ownership and returns 404 for another users ticket', async () => {
  for (const master of [false, true]) {
    const db = database({ reports: [success(master ? { protocol_number: 42, user_id: 'someone-else' } : null)], report_replies: [success([])] })
    const { GET } = load('app/tickets/[protocol]/route.ts', {
      '@/lib/tickets-server': { getTicketAccess: async () => ({ supabase: db.client, user: { id: 'viewer' }, master }) },
    }, { Response })
    const response = await GET({}, { params: Promise.resolve({ protocol: '42' }) })
    assert.equal(response.status, master ? 200 : 404)
    assert.equal(db.requests[0].calls.some(([method, column, value]) => method === 'eq' && column === 'user_id' && value === 'viewer'), !master)
    assert.ok(response.headers.get('cache-control').includes('no-store'))
    if (!master) assert.equal(db.requests.length, 1)
  }
})

test('ticket listing rejects admin mode for regular accounts and scopes personal results', async () => {
  const db = database({ reports: [success([])] })
  const { GET } = load('app/api/tickets/route.ts', {
    '@/lib/tickets-server': { getTicketAccess: async () => ({ supabase: db.client, user: { id: 'viewer' }, master: false }) },
  }, { Response, URL })
  assert.equal((await GET(new Request('https://expense.test/api/tickets?admin=true'))).status, 403)
  assert.equal(db.requests.length, 0)
  assert.equal((await GET(new Request('https://expense.test/api/tickets?offset=100'))).status, 200)
  assert.ok(db.requests[0].calls.some(([method, column, value]) => method === 'eq' && column === 'user_id' && value === 'viewer'))
  assert.ok(db.requests[0].calls.some(([method, from, to]) => method === 'range' && from === 100 && to === 199))
  assert.equal((await GET(new Request('https://expense.test/api/tickets?offset=-1'))).status, 400)
})

test('anonymous ticket requests are rejected before any database queries', async () => {
  const mocks = { '@/lib/tickets-server': { getTicketAccess: async () => ({ user: null, master: false }) } }
  const { GET: details } = load('app/tickets/[protocol]/route.ts', mocks, { Response })
  const { GET: list } = load('app/api/tickets/route.ts', mocks, { Response, URL })
  assert.equal((await details({}, { params: Promise.resolve({ protocol: '1' }) })).status, 401)
  assert.equal((await list(new Request('https://expense.test/api/tickets'))).status, 401)
})

test('admin ticket page denies direct navigation for ordinary users', async () => {
  const { default: AdminPage } = load('app/admin/tickets/page.tsx', {
    '@/lib/tickets-server': { getTicketAccess: async () => ({ user: { id: 'viewer' }, master: false }) },
    'next/navigation': { notFound: () => { throw new Error('NOT_FOUND') }, redirect: () => { throw new Error('LOGIN') } },
  })
  await assert.rejects(AdminPage(), /NOT_FOUND/)
})

test('dashboard uses database ticket role and reserves administrator management for owner', async () => {
  for (const user of [
    { id: 'master', email: 'williansantos38@gmail.com', email_confirmed_at: '2026-10-04' },
    { id: 'other', email: 'other@example.com', email_confirmed_at: '2026-10-04', user_metadata: { role: 'master' } },
    { id: 'admin', email: 'admin@example.com', email_confirmed_at: '2026-10-04' },
  ]) {
    const { default: HomePage } = load('app/page.tsx', {
      '@/lib/supabase/server': { createClient: async () => ({ auth: { getUser: async () => ({ data: { user } }) }, rpc: async () => ({ data: user.id !== 'other', error: null }) }) },
      '@/app/actions': { signOut() {} },
      '@/lib/tickets': load('lib/tickets.ts'),
      '@/lib/profile-photo': load('lib/profile-photo.ts'),
      'next/navigation': { redirect: () => { throw new Error('LOGIN') } },
    })
    const tree = await HomePage()
    assert.equal(elements(tree, (node) => node.props.href === '/admin/tickets').length, user.id !== 'other' ? 1 : 0)
    assert.equal(elements(tree, (node) => node.props.href === '/admin/administrators').length, user.id === 'master' ? 1 : 0)
    find(tree, (node) => node.props.href === '/tickets')
  }
})

test('administrator mutations reject non-owners and missing database ownership', async () => {
  for (const email of ['admin@example.com', 'williansantos38@gmail.com']) {
    const calls = []
    const { updateAdministrator } = load('app/admin/administrators/actions.ts', {
      '@/lib/supabase/server': { createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { email, email_confirmed_at: 'confirmed' } }, error: null }) }, rpc: async name => { calls.push(name); return { data: false, error: null } } }) },
      '@/lib/tickets': load('lib/tickets.ts'), 'next/cache': { revalidatePath() {} },
    })
    assert.ok((await updateAdministrator('add', 'target@example.com')).error)
    assert.ok((await updateAdministrator('remove', '11111111-1111-1111-1111-111111111111')).error)
    assert.equal(calls.some(name => name !== 'is_support_owner'), false)
  }
})

test('owner administrator mutations validate, normalize, and handle database failures', async () => {
  const calls = [], paths = []
  let fail = false
  const { updateAdministrator } = load('app/admin/administrators/actions.ts', {
    '@/lib/supabase/server': { createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { email: 'williansantos38@gmail.com', email_confirmed_at: 'confirmed' } }, error: null }) }, rpc: async (name, args) => { calls.push([name, args]); return { data: true, error: name !== 'is_support_owner' && fail ? {} : null } } }) },
    '@/lib/tickets': load('lib/tickets.ts'), 'next/cache': { revalidatePath: path => paths.push(path) },
  })
  assert.ok((await updateAdministrator('add', 'invalid')).error)
  assert.ok((await updateAdministrator('remove', 'invalid')).error)
  assert.ok((await updateAdministrator('other', 'target@example.com')).error)
  assert.equal(calls.every(([name]) => name === 'is_support_owner'), true)
  assert.equal((await updateAdministrator('add', ' Target@Example.com ')).error, null)
  assert.equal(calls.at(-1)[0], 'add_ticket_administrator')
  assert.equal(calls.at(-1)[1].account_email, 'target@example.com')
  assert.equal((await updateAdministrator('remove', '11111111-1111-1111-1111-111111111111')).error, null)
  assert.equal(calls.at(-1)[0], 'remove_ticket_administrator')
  assert.ok(paths.includes('/'))
  fail = true
  assert.ok((await updateAdministrator('add', 'target@example.com')).error)
})

test('confirmed delegated administrator can access tickets through database membership', async () => {
  const { getTicketAccess } = load('lib/tickets-server.ts', {
    'server-only': {}, '@/lib/supabase/server': { createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { email: 'admin@example.com', email_confirmed_at: 'confirmed' } }, error: null }) }, rpc: async () => ({ data: true, error: null }) }) },
  })
  assert.equal((await getTicketAccess()).master, true)
})
