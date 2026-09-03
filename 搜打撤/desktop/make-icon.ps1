# Generate the desktop icon and a matching web PNG from one deterministic brand mark.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$size = 256
$bmp = New-Object System.Drawing.Bitmap($size, $size)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g.Clear([System.Drawing.Color]::Transparent)

$plate = New-Object System.Drawing.Drawing2D.GraphicsPath
$plate.AddPolygon([System.Drawing.Point[]]@(
  [System.Drawing.Point]::new(28, 16), [System.Drawing.Point]::new(196, 16),
  [System.Drawing.Point]::new(228, 48), [System.Drawing.Point]::new(228, 228),
  [System.Drawing.Point]::new(28, 228)
))
$plate.CloseFigure()
$rect = New-Object System.Drawing.Rectangle(0, 0, $size, $size)
$bg = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect,
  [System.Drawing.Color]::FromArgb(255, 32, 40, 46),
  [System.Drawing.Color]::FromArgb(255, 8, 11, 14), 45)
$g.FillPath($bg, $plate)
$edge = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 70, 84, 91), 6)
$g.DrawPath($edge, $plate)

$cyanPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 92, 185, 188), 6)
$g.DrawLine($cyanPen, 196, 17, 196, 48)
$g.DrawLine($cyanPen, 196, 48, 227, 48)

$seven = New-Object System.Drawing.Drawing2D.GraphicsPath
$seven.AddPolygon([System.Drawing.Point[]]@(
  [System.Drawing.Point]::new(62, 67), [System.Drawing.Point]::new(194, 67),
  [System.Drawing.Point]::new(194, 94), [System.Drawing.Point]::new(128, 204),
  [System.Drawing.Point]::new(89, 204), [System.Drawing.Point]::new(153, 98),
  [System.Drawing.Point]::new(62, 98)
))
$offWhite = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 220, 227, 230))
$g.FillPath($offWhite, $seven)
$cyan = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 92, 185, 188))
$g.FillPolygon($cyan, [System.Drawing.Point[]]@(
  [System.Drawing.Point]::new(123, 112), [System.Drawing.Point]::new(155, 112),
  [System.Drawing.Point]::new(143, 132), [System.Drawing.Point]::new(111, 132)
))
$amber = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 229, 180, 73))
$g.FillRectangle($amber, 49, 190, 19, 19)
$rule = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 101, 116, 123), 4)
$g.DrawLine($rule, 49, 178, 101, 178)

$g.Dispose()
$pngStream = New-Object System.IO.MemoryStream
$bmp.Save($pngStream, [System.Drawing.Imaging.ImageFormat]::Png)
$png = $pngStream.ToArray()
$bmp.Dispose()

$webAsset = Join-Path $PSScriptRoot '..\prototypes\map-system\assets\brand-mark-codename7.png'
[System.IO.File]::WriteAllBytes($webAsset, $png)

$ico = New-Object System.IO.MemoryStream
$bw = New-Object System.IO.BinaryWriter($ico)
$bw.Write([uint16]0)
$bw.Write([uint16]1)
$bw.Write([uint16]1)
$bw.Write([byte]0)
$bw.Write([byte]0)
$bw.Write([byte]0)
$bw.Write([byte]0)
$bw.Write([uint16]1)
$bw.Write([uint16]32)
$bw.Write([uint32]$png.Length)
$bw.Write([uint32]22)
$bw.Write($png)
$bw.Flush()

$out = Join-Path $PSScriptRoot 'app\icon.ico'
[System.IO.File]::WriteAllBytes($out, $ico.ToArray())
Write-Host "OK -> $out"
Write-Host "OK -> $webAsset"
