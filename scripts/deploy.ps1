# Dispara un rebuild manual de producción en Vercel via su Deploy Hook.
#
# El hook es un secreto: cualquiera que lo tenga puede disparar un rebuild
# de producción sin más autenticación. Antes vivía escrito aquí mismo, en un
# fichero versionado en git — se rotó y ahora se lee de una variable de
# entorno que NUNCA debe commitearse.
#
# Configúrala una vez en tu perfil de PowerShell, o antes de ejecutar:
#   $env:VERCEL_DEPLOY_HOOK_URL = "https://api.vercel.com/v1/integrations/deploy/..."

if (-not $env:VERCEL_DEPLOY_HOOK_URL) {
    Write-Error "Falta la variable de entorno VERCEL_DEPLOY_HOOK_URL (el Deploy Hook de Vercel). No se commitea: configúrala en tu entorno local antes de ejecutar este script."
    exit 1
}

$r = Invoke-WebRequest -Uri $env:VERCEL_DEPLOY_HOOK_URL -UseBasicParsing
Write-Host $r.Content
