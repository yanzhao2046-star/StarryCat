Add-Type -AssemblyName System.Drawing

$dir = 'f:\03-MINE\cc\ccmoo\codeBuddy\assets\CodeBuddyAssets\catRoom'
$room = [System.Drawing.Image]::FromFile((Join-Path $dir 'room_01.png'))
$W = $room.Width; $H = $room.Height
Write-Host ('room: ' + $W + 'x' + $H)

$bmp = New-Object System.Drawing.Bitmap $W,$H
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.Clear([System.Drawing.Color]::Transparent)
$g.DrawImage($room, 0, 0, $W, $H)

# act01: left=37.125% top=54.156% w=15.958% h=17.469% (相对 room)
$cw = [int]([math]::Round($W * 0.15958))
$ch = [int]([math]::Round($H * 0.17469))
$cx = [int]([math]::Round($W * 0.37125))
$cy = [int]([math]::Round($H * 0.54156))
$cat = [System.Drawing.Image]::FromFile((Join-Path $dir 'act01.png'))
$g.DrawImage($cat, $cx, $cy, $cw, $ch)
$cat.Dispose()
Write-Host ('act01 at x=' + $cx + ' y=' + $cy + ' size=' + $cw + 'x' + $ch)

$out = Join-Path $dir 'preview-act01.png'
$bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
Write-Host ('saved: ' + $out)
$room.Dispose(); $bmp.Dispose(); $g.Dispose()