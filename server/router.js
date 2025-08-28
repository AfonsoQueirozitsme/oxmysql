import { supa, upsertPlayer, getPlayerByCitizenId, getBan, replaceGroups } from './supabase.js'

/**
 * Normaliza SQL: retira espaços repetidos, lowercase para match simples.
 */
function norm(sql) {
  return sql.replace(/\s+/g, ' ').trim().toLowerCase()
}

/**
 * Handlers por padrão de SQL.
 * Cada handler recebe (sql, params) e devolve { rows } | escalar | número de afetados.
 */
const handlers = [
  // === PLAYERS ===
  {
    test: /select \* from players where citizenid = \?/,
    run: async (sql, params) => {
      const [citizenid] = params
      const row = await getPlayerByCitizenId(citizenid)
      return [row].filter(Boolean)
    }
  },
  {
    // UPDATE players SET ... WHERE citizenid = ?
    test: /update players set .* where citizenid = \?/,
    run: async (sql, params) => {
      // assumimos que a tua layer monta os dados; aqui só garantimos citizenid no fim
      const citizenid = params.at(-1)
      // Constrói objeto a partir de params se precisares — mais robusto: muda os teus scripts para chamar 'insert' com objeto
      // Aqui ficamos minimalistas: só tocamos 'last_updated'
      const { error } = await supa
        .from('players').update({ last_updated: new Date().toISOString() })
        .eq('citizenid', citizenid)
      if (error) throw new Error(error.message)
      return { affectedRows: 1 }
    }
  },
  {
    // INSERT INTO players (...) VALUES (...)  => usa upsert
    test: /insert into players /,
    run: async (sql, params) => {
      // Este caso é difícil de mapear genericamente sem parser.
      // Melhor: usar uma Edge Function no Supabase, ou migrar o teu save para usar exports dedicados.
      // Para o shim, vamos falhar com mensagem explícita:
      throw new Error('[oxmysql shim] INSERT players genérico não suportado. Usa export upsert (qbx_core) ou adiciona um handler específico.')
    }
  },

  // === BANS ===
  {
    // SELECT * FROM bans WHERE license = ? OR discord = ? OR ip = ? LIMIT 1
    test: /select \* from bans where .*limit 1/,
    run: async (sql, params) => {
      const [license, discord, ip] = params
      const row = await getBan({ license, discord, ip })
      return [row].filter(Boolean)
    }
  },

  // === PLAYER_GROUPS ===
  {
    // DELETE FROM player_groups WHERE citizenid = ?
    test: /delete from player_groups where citizenid = \?/,
    run: async (sql, params) => {
      const [citizenid] = params
      const { error } = await supa.from('player_groups').delete().eq('citizenid', citizenid)
      if (error) throw new Error(error.message)
      return { affectedRows: 1 }
    }
  },
  {
    // INSERT INTO player_groups (...) VALUES (...),(...),...
    test: /insert into player_groups /,
    run: async (sql, params) => {
      // oxmysql normalmente passa array de arrays; aqui esperamos um array de objetos já preparado no teu script.
      // Se vier como VALUES planas, é chato mapear. Recomendação: ao inserir groups, chama export dedicado.
      throw new Error('[oxmysql shim] INSERT player_groups genérico não suportado. Usa export replaceGroups(citizenid, groups).')
    }
  },
]

/**
 * Executores públicos usados pelo bridge.lua
 */
export async function runFetch(sql, params = []) {
  const n = norm(sql)
  const h = handlers.find(h => h.test.test(n))
  if (!h) {
    console.warn('[oxmysql shim] fetch sem handler para SQL:', sql)
    return []
  }
  const res = await h.run(n, params)
  return Array.isArray(res) ? res : []
}

export async function runSingle(sql, params = []) {
  const rows = await runFetch(sql, params)
  return rows[0] || null
}

export async function runScalar(sql, params = []) {
  const row = await runSingle(sql, params)
  if (!row) return null
  const firstKey = Object.keys(row)[0]
  return row[firstKey] ?? null
}

export async function runExecute(sql, params = []) {
  const n = norm(sql)
  const h = handlers.find(h => h.test.test(n))
  if (!h) {
    console.warn('[oxmysql shim] execute sem handler para SQL:', sql)
    return 0
  }
  const res = await h.run(n, params)
  if (typeof res === 'number') return res
  if (res?.affectedRows != null) return res.affectedRows
  return 0
}

export async function runInsert(sql, params = []) {
  // Para players, preferimos upsert explícito via export; aqui só alertamos
  throw new Error('[oxmysql shim] insert genérico não suportado. Usa upsert export.')
}
