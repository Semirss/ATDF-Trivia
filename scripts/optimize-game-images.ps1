$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$projectRoot = Split-Path -Parent $PSScriptRoot
$visualRoot = Join-Path $projectRoot "public\visuals"
$sourceRoot = Join-Path $projectRoot "public\generated\atdf-2026-v2"
$cardSourceRoot = Join-Path $projectRoot "public\generated\atdf-2026\cards"
$optimizedRoot = Join-Path $sourceRoot "optimized"

function Resize-GameImage {
  param(
    [Parameter(Mandatory = $true)][string]$Source,
    [Parameter(Mandatory = $true)][string]$Destination,
    [Parameter(Mandatory = $true)][int]$MaxWidth,
    [int]$MaxHeight = 0,
    [ValidateSet("Jpeg", "Png")][string]$Format = "Jpeg",
    [int]$Quality = 82
  )

  $sourceImage = [System.Drawing.Image]::FromFile($Source)
  try {
    $widthScale = $MaxWidth / $sourceImage.Width
    $heightScale = if ($MaxHeight -gt 0) { $MaxHeight / $sourceImage.Height } else { 1.0 }
    $scale = [Math]::Min(1.0, [Math]::Min($widthScale, $heightScale))
    $targetWidth = [Math]::Max(1, [int][Math]::Round($sourceImage.Width * $scale))
    $targetHeight = [Math]::Max(1, [int][Math]::Round($sourceImage.Height * $scale))
    $pixelFormat = if ($Format -eq "Jpeg") {
      [System.Drawing.Imaging.PixelFormat]::Format24bppRgb
    } else {
      [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
    }
    $bitmap = [System.Drawing.Bitmap]::new($targetWidth, $targetHeight, $pixelFormat)

    try {
      $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
      try {
        $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        if ($Format -eq "Jpeg") {
          $graphics.Clear([System.Drawing.Color]::FromArgb(0, 43, 69))
        } else {
          $graphics.Clear([System.Drawing.Color]::Transparent)
        }
        $graphics.DrawImage($sourceImage, 0, 0, $targetWidth, $targetHeight)
      } finally {
        $graphics.Dispose()
      }

      $destinationDirectory = Split-Path -Parent $Destination
      New-Item -ItemType Directory -Path $destinationDirectory -Force | Out-Null

      if ($Format -eq "Jpeg") {
        $codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
          Where-Object { $_.MimeType -eq "image/jpeg" } |
          Select-Object -First 1
        $encoderParameters = [System.Drawing.Imaging.EncoderParameters]::new(1)
        $encoderParameters.Param[0] = [System.Drawing.Imaging.EncoderParameter]::new(
          [System.Drawing.Imaging.Encoder]::Quality,
          [long]$Quality
        )
        try {
          $bitmap.Save($Destination, $codec, $encoderParameters)
        } finally {
          $encoderParameters.Dispose()
        }
      } else {
        $bitmap.Save($Destination, [System.Drawing.Imaging.ImageFormat]::Png)
      }
    } finally {
      $bitmap.Dispose()
    }
  } finally {
    $sourceImage.Dispose()
  }
}

Resize-GameImage `
  -Source (Join-Path $visualRoot "atdf-event-poster.png") `
  -Destination (Join-Path $visualRoot "atdf-event-poster-optimized.jpg") `
  -MaxWidth 720 -Format Jpeg -Quality 84
Resize-GameImage `
  -Source (Join-Path $visualRoot "atdf-trivia-splash.png") `
  -Destination (Join-Path $visualRoot "atdf-trivia-splash-optimized.jpg") `
  -MaxWidth 720 -Format Jpeg -Quality 84
Resize-GameImage `
  -Source (Join-Path $visualRoot "leaderboard-podium-frames-v1-mobile.png") `
  -Destination (Join-Path $visualRoot "leaderboard-podium-frames-v1-mobile-optimized.png") `
  -MaxWidth 860 -MaxHeight 500 -Format Png
Resize-GameImage `
  -Source (Join-Path $visualRoot "atdf-2026-seal.png") `
  -Destination (Join-Path $visualRoot "atdf-2026-seal-optimized.png") `
  -MaxWidth 300 -MaxHeight 300 -Format Png

$slugs = @(
  "pharmaceuticals",
  "automotive",
  "textile-and-apparel",
  "logistics",
  "agro-processing"
)

foreach ($slug in $slugs) {
  Resize-GameImage `
    -Source (Join-Path $sourceRoot "icons\$slug.png") `
    -Destination (Join-Path $optimizedRoot "icons\$slug.png") `
    -MaxWidth 220 -MaxHeight 220 -Format Png
  Resize-GameImage `
    -Source (Join-Path $sourceRoot "maps\$slug.png") `
    -Destination (Join-Path $optimizedRoot "maps\$slug.jpg") `
    -MaxWidth 720 -Format Jpeg -Quality 80
  Resize-GameImage `
    -Source (Join-Path $sourceRoot "podiums\$slug.png") `
    -Destination (Join-Path $optimizedRoot "podiums\$slug.png") `
    -MaxWidth 400 -MaxHeight 300 -Format Png
  Resize-GameImage `
    -Source (Join-Path $cardSourceRoot "$slug.png") `
    -Destination (Join-Path $optimizedRoot "cards\$slug.jpg") `
    -MaxWidth 720 -Format Jpeg -Quality 80
}

Write-Host "Optimized game images created in $optimizedRoot"
