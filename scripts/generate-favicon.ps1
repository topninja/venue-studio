Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = 'Stop'

$sizes = @(16, 24, 32, 48, 64, 128, 256)
$frames = @()

foreach ($size in $sizes) {
    $bitmap = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.ScaleTransform($size / 256, $size / 256)

    $tile = New-Object System.Drawing.Drawing2D.GraphicsPath
    $tile.AddArc(0, 0, 120, 120, 180, 90)
    $tile.AddArc(136, 0, 120, 120, 270, 90)
    $tile.AddArc(136, 136, 120, 120, 0, 90)
    $tile.AddArc(0, 136, 120, 120, 90, 90)
    $tile.CloseFigure()

    $gradient = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        (New-Object System.Drawing.PointF(24, 8)),
        (New-Object System.Drawing.PointF(232, 248)),
        ([System.Drawing.ColorTranslator]::FromHtml('#6158ed')),
        ([System.Drawing.ColorTranslator]::FromHtml('#4038c7'))
    )
    $graphics.FillPath($gradient, $tile)

    $white = [System.Drawing.Color]::White
    $pen = New-Object System.Drawing.Pen($white, 14)
    $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round

    $outer = New-Object System.Drawing.Drawing2D.GraphicsPath
    $outer.StartFigure()
    $outer.AddLine(56, 160, 56, 132)
    $outer.AddBezier(56, 132, 56, 74, 200, 74, 200, 132)
    $outer.AddLine(200, 132, 200, 160)
    $graphics.DrawPath($pen, $outer)

    $inner = New-Object System.Drawing.Drawing2D.GraphicsPath
    $inner.StartFigure()
    $inner.AddLine(84, 160, 84, 132)
    $inner.AddBezier(84, 132, 84, 94, 172, 94, 172, 132)
    $inner.AddLine(172, 132, 172, 160)
    $graphics.DrawPath($pen, $inner)
    $graphics.DrawLine($pen, 48, 184, 208, 184)

    $brush = New-Object System.Drawing.SolidBrush($white)
    $graphics.FillEllipse($brush, 60, 204, 24, 24)
    $graphics.FillEllipse($brush, 116, 204, 24, 24)
    $graphics.FillEllipse($brush, 172, 204, 24, 24)

    $stream = New-Object System.IO.MemoryStream
    $bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
    $frames += ,$stream.ToArray()

    $stream.Dispose()
    $brush.Dispose()
    $inner.Dispose()
    $outer.Dispose()
    $pen.Dispose()
    $gradient.Dispose()
    $tile.Dispose()
    $graphics.Dispose()
    $bitmap.Dispose()
}

$outputPath = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\favicon.ico'))
$file = [System.IO.File]::Create($outputPath)
$writer = New-Object System.IO.BinaryWriter($file)

$writer.Write([UInt16]0)
$writer.Write([UInt16]1)
$writer.Write([UInt16]$frames.Count)

$offset = 6 + (16 * $frames.Count)
for ($index = 0; $index -lt $frames.Count; $index++) {
    $size = $sizes[$index]
    $dimension = if ($size -eq 256) { 0 } else { $size }
    $writer.Write([Byte]$dimension)
    $writer.Write([Byte]$dimension)
    $writer.Write([Byte]0)
    $writer.Write([Byte]0)
    $writer.Write([UInt16]1)
    $writer.Write([UInt16]32)
    $writer.Write([UInt32]$frames[$index].Length)
    $writer.Write([UInt32]$offset)
    $offset += $frames[$index].Length
}

foreach ($frame in $frames) {
    $writer.Write($frame)
}

$writer.Dispose()
$file.Dispose()

Write-Output "Generated $outputPath with $($sizes.Count) sizes: $($sizes -join ', ') px"
