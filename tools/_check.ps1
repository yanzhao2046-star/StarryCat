$bytes = [System.IO.File]::ReadAllBytes('f:\03-MINE\cc\ccmoo\codeBuddy\tools\catRoomEditor.html')
$marker = [System.Text.Encoding]::UTF8.GetBytes('window.__CAT_IMG__')
$idx = [System.Text.Conversion]::ToInt32(0)
$count = 0
$pattern = [System.Text.Encoding]::UTF8.GetString($marker)
$content = [System.Text.Encoding]::UTF8.GetString($bytes)
$count = ($content.ToCharArray() | Where-Object { $_ -eq 'a' } | Measure-Object).Count  # placeholder
# Just count occurrences of marker
$regexMatches = [regex]::Matches($content, 'window\.__CAT_IMG__')
Write-Host ('window.__CAT_IMG__ occurrences: ' + $regexMatches.Count)
$base64Matches = [regex]::Matches($content, 'data:image/png;base64,')
Write-Host ('data:image/png;base64, occurrences: ' + $base64Matches.Count)
$firstBase64 = [regex]::Match($content, 'data:image/png;base64,[A-Za-z0-9+/]{20}')
if ($firstBase64.Success) { Write-Host ('first base64 sample: ' + $firstBase64.Value.Substring(0, [Math]::Min(80, $firstBase64.Value.Length))) }