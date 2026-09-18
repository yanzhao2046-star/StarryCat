Add-Type -AssemblyName System.Drawing

$dir = 'f:\03-MINE\cc\ccmoo\codeBuddy\assets\CodeBuddyAssets\catRoom'
$room = [System.Drawing.Image]::FromFile((Join-Path $dir 'room_01.png'))
$W = $room.Width
$H = $room.Height
Write-Host ('room: ' + $W + 'x' + $H)

$bmp = New-Object System.Drawing.Bitmap $W, $H
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.Clear([System.Drawing.Color]::Transparent)
$g.DrawImage($room, 0, 0, $W, $H)

# 6 只猫：left/top/size 都是相对 room 图 (0-1)
$cats = @(
  @{ name='act08_沙发上(设计稿黑猫位置)'; file='act08.png'; left=0.44; top=0.59; size=0.14 }
  @{ name='act01_床上';                    file='act01.png'; left=0.58; top=0.22; size=0.13 }
  @{ name='act02_楼梯台阶';                file='act02.png'; left=0.62; top=0.62; size=0.11 }
  @{ name='act03_地毯中央';                file='act03.png'; left=0.36; top=0.80; size=0.13 }
  @{ name='act06_楼梯底层';                file='act06.png'; left=0.72; top=0.78; size=0.11 }
  @{ name='act07_窗台/沙发靠背';           file='act07.png'; left=0.20; top=0.48; size=0.11 }
)

foreach ($c in $cats) {
  $cat = [System.Drawing.Image]::FromFile((Join-Path $dir $c.file))
  $side = [int]([math]::Round($W * $c.size))
  $x = [int]([math]::Round($W * $c.left))
  $y = [int]([math]::Round($H * $c.top))
  $g.DrawImage($cat, $x, $y, $side, $side)
  $cat.Dispose()
  Write-Host ('placed ' + $c.name + ' at x=' + $x + ' y=' + $y + ' size=' + $side)
}

$outPath = Join-Path $dir 'preview-6cats.png'
$bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
Write-Host ('saved: ' + $outPath)

$room.Dispose()
$bmp.Dispose()
$g.Dispose()