[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
[Net.ServicePointManager]::ServerCertificateValidationCallback = {$true}
$r = Invoke-WebRequest -Uri 'https://lead-qualifier-eta.vercel.app/sign-in' -UseBasicParsing -MaximumRedirection 5
Write-Host "Status:" $r.StatusCode
$snippet = $r.Content.Substring(0, [Math]::Min(800, $r.Content.Length))
Write-Host "Content:" $snippet
