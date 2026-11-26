cd $PSScriptRoot

$stamp = Get-Date -Format 'yyyy-MM-dd HH:mm'
Write-Host "== Подготовка изменений ==" -ForegroundColor Cyan
git add -A

# если нечего коммитить — всё равно пробуем пуш (на случай незапушенного коммита)
$hasChanges = (git status --porcelain)
if ($hasChanges) {
    git commit -m "Обновление $stamp"
} else {
    Write-Host "Новых изменений нет, пробую отправить на GitHub..." -ForegroundColor Yellow
}

Write-Host "== Отправка на GitHub ==" -ForegroundColor Cyan
git push
if ($LASTEXITCODE -eq 0) {
    Write-Host "Готово! Render пересоберёт сайт через ~1-2 минуты." -ForegroundColor Green
} else {
    Write-Host "Ошибка отправки. Проверь, что репозиторий подключён (git remote -v)." -ForegroundColor Red
}
Write-Host ""
Read-Host "Нажми Enter, чтобы закрыть"
