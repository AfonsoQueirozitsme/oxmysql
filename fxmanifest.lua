fx_version 'cerulean'
game 'gta5'
lua54 'yes'
author 'Afonso Queiroz'

name 'oxmysql'
description 'Shim do oxmysql a usar Supabase (Postgres)'

server_scripts {
  'server/bridge.lua',
  'server/supabase.js',
  'server/router.js'
}
