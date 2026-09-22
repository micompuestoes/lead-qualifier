[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
# (Antes desactivaba aquí la validación de certificados TLS globalmente para
# todo el proceso — un mal hábito: si algún día este script se reutiliza
# contra un endpoint con secretos, quedaría expuesto a un MITM en redes no
# confiables. vercel.app tiene un certificado válido, no hace falta.)
$r = Invoke-WebRequest -Uri 'https://lead-qualifier-eta.vercel.app/sign-in' -UseBasicParsing -MaximumRedirection 5
Write-Host "Status:" $r.StatusCode
$snippet = $r.Content.Substring(0, [Math]::Min(800, $r.Content.Length))
Write-Host "Content:" $snippet
