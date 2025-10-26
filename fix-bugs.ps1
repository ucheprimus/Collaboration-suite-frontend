# Find and fix ALL files with this broken pattern
Get-ChildItem -Path src -Recurse -Include *.ts,*.tsx | ForEach-Object {
    $content = Get-Content $_.FullName -Raw
    $original = $content
    
    # Fix the broken template literal pattern
    $content = $content -replace '\$\{import\.meta\.env\.VITE_API_URL \|\| import\.meta\.env\.VITE_SOCKET_URL \|\| "https://collaboration-suite-backend\.onrender\.com"\}', 'https://collaboration-suite-backend.onrender.com'
    
    # Fix standalone localhost
    $content = $content -replace 'http://localhost:4000', 'https://collaboration-suite-backend.onrender.com'
    
    if ($content -ne $original) {
        Set-Content $_.FullName -Value $content -NoNewline
        Write-Host "✅ Fixed $($_.Name)" -ForegroundColor Green
    }
}

Write-Host "`n✅ All files fixed!" -ForegroundColor Green