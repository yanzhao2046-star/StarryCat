Add-Type -AssemblyName System.Drawing
$dir = 'f:\03-MINE\cc\ccmoo\codeBuddy\assets\cat'
Get-ChildItem $dir -Filter *.png | ForEach-Object {
  $img = [System.Drawing.Image]::FromFile($_.FullName)
  Write-Output ("{0}  {1}x{2}" -f $_.Name, $img.Width, $img.Height)
  $img.Dispose()
}