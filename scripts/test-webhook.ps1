# Testa o endpoint /api/webhook com um payload válido
$ErrorActionPreference = 'Stop'

$uri = 'https://whatpressaas.vercel.app/api/webhook'
$bodyObj = @{ 
  event = 'test';
  instance = 'demo-instance';
  data = @{ ping = $true };
}
$body = $bodyObj | ConvertTo-Json -Depth 5

# Tentar ler segredo do arquivo, se existir
$headers = @{}
$secretPath = Join-Path -Path (Get-Location) -ChildPath 'secret-webhook.txt'
if (Test-Path $secretPath) {
  $secret = Get-Content -Path $secretPath -Raw
  if ($secret -and $secret.Trim().Length -gt 0) {
    $headers['X-Webhook-Secret'] = $secret.Trim()
    Write-Host "Usando X-Webhook-Secret do arquivo secret-webhook.txt" -ForegroundColor Yellow
  }
}

Write-Host "Enviando POST para $uri com body:" -ForegroundColor Cyan
Write-Host $body

$response = Invoke-WebRequest -Uri $uri -Method POST -Body $body -ContentType 'application/json' -Headers $headers -UseBasicParsing

Write-Host "StatusCode:" $response.StatusCode
Write-Host "Headers:" ($response.Headers | Out-String)
Write-Host "Body:" $response.Content