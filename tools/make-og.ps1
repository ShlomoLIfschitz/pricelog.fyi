# Generates the Open Graph preview images into the site root.
#
# Build-time only — nothing here ships to visitors. Run it from anywhere:
#   powershell -NoProfile -ExecutionPolicy Bypass -File tools/make-og.ps1
#
# Text lives in tools/og.json rather than inline, so this script stays pure
# ASCII and Windows PowerShell cannot mis-decode the Hebrew.

$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Drawing

$root   = Split-Path $PSScriptRoot -Parent
$config = Get-Content (Join-Path $PSScriptRoot 'og.json') -Raw -Encoding UTF8 | ConvertFrom-Json

$W   = 1200
$H   = 630
$PAD = 84

$cBg     = [System.Drawing.ColorTranslator]::FromHtml('#16181A')
$cInk    = [System.Drawing.ColorTranslator]::FromHtml('#E8E9EA')
$cMuted  = [System.Drawing.ColorTranslator]::FromHtml('#9BA1A8')
$cRule   = [System.Drawing.ColorTranslator]::FromHtml('#2C2F33')
$cAccent = [System.Drawing.ColorTranslator]::FromHtml('#5FD0A0')

function New-OgImage {
    param([string]$OutPath, [string]$Claim, [string]$Sub, [bool]$Rtl)

    $bmp = New-Object System.Drawing.Bitmap $W, $H
    $g   = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode     = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $g.Clear($cBg)

    # Latin runs (wordmark, handle) always read left to right; only their
    # alignment follows the page direction.
    $fmtLtr = New-Object System.Drawing.StringFormat
    # Hebrew body text needs real RTL layout, not just alignment.
    $fmt = New-Object System.Drawing.StringFormat
    if ($Rtl) {
        $fmt.FormatFlags  = [System.Drawing.StringFormatFlags]::DirectionRightToLeft
        $fmt.Alignment    = [System.Drawing.StringAlignment]::Near
        $fmtLtr.Alignment = [System.Drawing.StringAlignment]::Far
    }

    # The step mark is a brand mark shared with the favicon: it keeps its shape
    # in both directions and only moves to the inline start.
    if ($Rtl) { $markX = $W - $PAD - 78 } else { $markX = $PAD }
    $markY = 96
    $pen = New-Object System.Drawing.Pen $cAccent, 7
    $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Square
    $pen.EndCap   = [System.Drawing.Drawing2D.LineCap]::Square
    $g.DrawLines($pen, @(
        (New-Object System.Drawing.Point($markX,       $markY)),
        (New-Object System.Drawing.Point(($markX + 26), $markY)),
        (New-Object System.Drawing.Point(($markX + 26), ($markY + 26))),
        (New-Object System.Drawing.Point(($markX + 52), ($markY + 26))),
        (New-Object System.Drawing.Point(($markX + 52), ($markY + 52))),
        (New-Object System.Drawing.Point(($markX + 78), ($markY + 52)))
    ))
    $pen.Dispose()

    $fMark   = New-Object System.Drawing.Font 'Consolas', 44, ([System.Drawing.FontStyle]::Bold)
    $fClaim  = New-Object System.Drawing.Font 'Segoe UI', 34, ([System.Drawing.FontStyle]::Bold)
    $fSub    = New-Object System.Drawing.Font 'Segoe UI', 18, ([System.Drawing.FontStyle]::Regular)
    $fHandle = New-Object System.Drawing.Font 'Consolas', 18, ([System.Drawing.FontStyle]::Regular)

    $bInk    = New-Object System.Drawing.SolidBrush $cInk
    $bMuted  = New-Object System.Drawing.SolidBrush $cMuted
    $bRule   = New-Object System.Drawing.SolidBrush $cRule
    $bAccent = New-Object System.Drawing.SolidBrush $cAccent

    $inner = $W - 2 * $PAD

    $g.DrawString('pricelog.fyi', $fMark, $bInk,
        (New-Object System.Drawing.RectangleF($PAD, 212, $inner, 80)), $fmtLtr)

    $g.FillRectangle($bRule, $PAD, 306, $inner, 1)

    $g.DrawString($Claim, $fClaim, $bInk,
        (New-Object System.Drawing.RectangleF($PAD, 342, $inner, 150)), $fmt)

    $g.DrawString($Sub, $fSub, $bMuted,
        (New-Object System.Drawing.RectangleF($PAD, 500, $inner, 40)), $fmt)

    $g.DrawString('@pricelog_deals', $fHandle, $bAccent,
        (New-Object System.Drawing.RectangleF($PAD, 548, $inner, 40)), $fmtLtr)

    $bmp.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Png)

    foreach ($d in @($fMark, $fClaim, $fSub, $fHandle, $bInk, $bMuted, $bRule,
                     $bAccent, $fmt, $fmtLtr, $g, $bmp)) { $d.Dispose() }

    Write-Output ("wrote {0}" -f (Split-Path $OutPath -Leaf))
}

foreach ($img in $config.images) {
    New-OgImage -OutPath (Join-Path $root $img.out) `
                -Claim $img.claim -Sub $img.sub -Rtl ([bool]$img.rtl)
}
