$file = "src\pages\WhiteboardPage.tsx"
$content = Get-Content $file -Raw

# Replace 'response' with 'res' (since the variable is named 'res', not 'response')
$content = $content -replace '\bresponse\.ok\b', 'res.ok'
$content = $content -replace '\bresponse\.json\(\)', 'res.json()'

Set-Content $file -Value $content -NoNewline
Write-Host "✅ Fixed WhiteboardPage.tsx - replaced 'response' with 'res'" -ForegroundColor Green