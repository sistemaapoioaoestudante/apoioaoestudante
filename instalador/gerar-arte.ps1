# ---------------------------------------------------------------------------
# Gera as imagens do instalador com a identidade visual do aplicativo:
#   arte\icone.ico    - icone (instalador, atalhos e bandeja do Windows)
#   arte\lateral.bmp  - faixa lateral das telas de boas-vindas e conclusao
#   arte\topo.bmp     - selo pequeno no canto das outras telas
#
# Cores e fonte iguais as do sistema (public/css/tokens.css):
#   anil da barra lateral #3730a3, anil escuro #312e81, amarelo #ffc83d.
#
# Uso (PowerShell do Windows, sem instalar nada):
#   powershell -ExecutionPolicy Bypass -File instalador\gerar-arte.ps1
# ---------------------------------------------------------------------------
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$saida = Join-Path $PSScriptRoot "arte"
New-Item -ItemType Directory -Force -Path $saida | Out-Null

$anil = [System.Drawing.ColorTranslator]::FromHtml("#3730a3")
$anilEscuro = [System.Drawing.ColorTranslator]::FromHtml("#312e81")
$amarelo = [System.Drawing.ColorTranslator]::FromHtml("#ffc83d")
$branco = [System.Drawing.Color]::White
$linhaCaderno = [System.Drawing.Color]::FromArgb(28, 255, 255, 255)

# Retangulo com cantos arredondados
function Novo-Arredondado([single]$x, [single]$y, [single]$w, [single]$h, [single]$r) {
    $p = New-Object System.Drawing.Drawing2D.GraphicsPath
    $d = $r * 2
    $p.AddArc($x, $y, $d, $d, 180, 90)
    $p.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
    $p.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
    $p.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
    $p.CloseFigure()
    return $p
}

# Selo "AE" (amarelo com letras anil) desenhado em (x, y) com o tamanho dado
function Desenhar-Selo($g, [single]$x, [single]$y, [single]$tamanho) {
    $caminho = Novo-Arredondado $x $y $tamanho $tamanho ($tamanho * 0.25)
    $g.FillPath((New-Object System.Drawing.SolidBrush $amarelo), $caminho)
    $fonte = New-Object System.Drawing.Font("Segoe UI", ($tamanho * 0.40), [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $formato = New-Object System.Drawing.StringFormat
    $formato.Alignment = [System.Drawing.StringAlignment]::Center
    $formato.LineAlignment = [System.Drawing.StringAlignment]::Center
    $area = New-Object System.Drawing.RectangleF($x, ($y + $tamanho * 0.02), $tamanho, $tamanho)
    $g.DrawString("AE", $fonte, (New-Object System.Drawing.SolidBrush $anilEscuro), $area, $formato)
}

function Nova-Tela([int]$w, [int]$h) {
    $bmp = New-Object System.Drawing.Bitmap($w, $h, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    return @($bmp, $g)
}

# ---- faixa lateral (boas-vindas / conclusao) --------------------------------
# Tamanho padrao 164x314 e a versao 2x para telas de alta resolucao.
foreach ($escala in 1, 2) {
    $w = 164 * $escala; $h = 314 * $escala
    $bmp, $g = Nova-Tela $w $h
    $g.Clear($anil)
    # Linhas de caderno, como o fundo do sistema
    $caneta = New-Object System.Drawing.Pen($linhaCaderno, (1 * $escala))
    for ($yy = 18 * $escala; $yy -lt $h; $yy += 18 * $escala) { $g.DrawLine($caneta, 0, $yy, $w, $yy) }
    # Faixa amarela no rodape
    $g.FillRectangle((New-Object System.Drawing.SolidBrush $amarelo), 0, ($h - 10 * $escala), $w, (10 * $escala))

    Desenhar-Selo $g (24 * $escala) (34 * $escala) (64 * $escala)

    $titulo = New-Object System.Drawing.Font("Segoe UI", (19 * $escala), [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $sub = New-Object System.Drawing.Font("Segoe UI", (12 * $escala), [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
    $pincel = New-Object System.Drawing.SolidBrush $branco
    $g.DrawString("Apoio ao", $titulo, $pincel, (22 * $escala), (116 * $escala))
    $g.DrawString("Estudante", $titulo, $pincel, (22 * $escala), (140 * $escala))
    $g.DrawString("Planejamento", $sub, $pincel, (24 * $escala), (176 * $escala))
    $g.DrawString("inclusivo na", $sub, $pincel, (24 * $escala), (192 * $escala))
    $g.DrawString("educa$([char]0xE7)$([char]0xE3)o infantil", $sub, $pincel, (24 * $escala), (208 * $escala))
    $g.Dispose()
    $nome = if ($escala -eq 1) { "lateral.bmp" } else { "lateral@2x.bmp" }
    $bmp.Save((Join-Path $saida $nome), [System.Drawing.Imaging.ImageFormat]::Bmp)
    $bmp.Dispose()
}

# ---- selo pequeno do topo das telas ------------------------------------------
foreach ($escala in 1, 2) {
    $w = 55 * $escala; $h = 58 * $escala
    $bmp, $g = Nova-Tela $w $h
    $g.Clear($branco)
    Desenhar-Selo $g (3 * $escala) (4 * $escala) (50 * $escala)
    $g.Dispose()
    $nome = if ($escala -eq 1) { "topo.bmp" } else { "topo@2x.bmp" }
    $bmp.Save((Join-Path $saida $nome), [System.Drawing.Imaging.ImageFormat]::Bmp)
    $bmp.Dispose()
}

# ---- icone .ico com varios tamanhos -------------------------------------------
# 256 px vai como PNG; os menores como bitmap (DIB 32 bits), o formato que
# qualquer programa do Windows le.

# Bitmap 32 bits -> entrada DIB do ICO (cabecalho + pixels de baixo para
# cima + mascara AND vazia)
function Converter-Dib($bmp) {
    $t = $bmp.Width
    $ms = New-Object System.IO.MemoryStream
    $bw = New-Object System.IO.BinaryWriter($ms)
    $bw.Write([UInt32]40); $bw.Write([Int32]$t); $bw.Write([Int32]($t * 2))
    $bw.Write([UInt16]1); $bw.Write([UInt16]32); $bw.Write([UInt32]0)
    $bw.Write([UInt32]0); $bw.Write([Int32]0); $bw.Write([Int32]0)
    $bw.Write([UInt32]0); $bw.Write([UInt32]0)
    for ($y = $t - 1; $y -ge 0; $y--) {
        for ($x = 0; $x -lt $t; $x++) {
            $c = $bmp.GetPixel($x, $y)
            $bw.Write([byte]$c.B); $bw.Write([byte]$c.G); $bw.Write([byte]$c.R); $bw.Write([byte]$c.A)
        }
    }
    $linhaMascara = [Math]::Ceiling($t / 32) * 4
    $bw.Write((New-Object byte[] ($linhaMascara * $t)))
    $bw.Flush()
    return , $ms.ToArray()  # a virgula impede o PowerShell de desmontar o vetor
}

$tamanhos = 16, 24, 32, 48, 64, 256
$imagens = @()
foreach ($t in $tamanhos) {
    $bmp = New-Object System.Drawing.Bitmap($t, $t, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $g.Clear([System.Drawing.Color]::Transparent)
    Desenhar-Selo $g 0 0 $t
    $g.Dispose()
    if ($t -ge 256) {
        $ms = New-Object System.IO.MemoryStream
        $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
        $dados = $ms.ToArray()
    } else {
        $dados = Converter-Dib $bmp
    }
    $imagens += , @($t, $dados)
    $bmp.Dispose()
}
$arquivo = New-Object System.IO.FileStream((Join-Path $saida "icone.ico"), [System.IO.FileMode]::Create)
$w = New-Object System.IO.BinaryWriter($arquivo)
$w.Write([UInt16]0); $w.Write([UInt16]1); $w.Write([UInt16]$imagens.Count)
$posicao = 6 + 16 * $imagens.Count
foreach ($img in $imagens) {
    $t = $img[0]; $dados = $img[1]
    $lado = if ($t -ge 256) { 0 } else { $t }
    $w.Write([byte]$lado); $w.Write([byte]$lado); $w.Write([byte]0); $w.Write([byte]0)
    $w.Write([UInt16]1); $w.Write([UInt16]32)
    $w.Write([UInt32]$dados.Length); $w.Write([UInt32]$posicao)
    $posicao += $dados.Length
}
foreach ($img in $imagens) { $w.Write([byte[]]$img[1]) }
$w.Close()

Write-Host "Imagens geradas em $saida"
