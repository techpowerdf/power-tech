try {
    Start-Process "whatsapp://send?phone=5511999999999"
    Write-Output "SUCCESS"
} catch {
    Write-Output "ERROR: $($_.Exception.Message)"
}
