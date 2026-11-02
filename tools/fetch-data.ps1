param(
    [switch]$WithMaps
)

$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$raw = Join-Path $root 'tools\raw'
$dataBase = 'https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/main/data/'
$mapBase = 'https://raw.githubusercontent.com/5etools-mirror-3/5etools-img/main/adventure/CoS/'

New-Item -ItemType Directory -Force -Path (Join-Path $raw 'bestiary'), (Join-Path $raw 'spells'), (Join-Path $raw 'adventure') | Out-Null

$files = @(
    'items.json', 'items-base.json', 'conditionsdiseases.json', 'feats.json',
    'decks.json', 'actions.json', 'magicvariants.json',
    'adventure/adventure-cos.json',
    'bestiary/bestiary-mm.json', 'bestiary/bestiary-cos.json', 'bestiary/bestiary-mpmm.json',
    'bestiary/bestiary-mtf.json', 'bestiary/bestiary-vgm.json', 'bestiary/bestiary-vrgr.json',
    'spells/spells-aag.json', 'spells/spells-ai.json', 'spells/spells-aitfr-avt.json',
    'spells/spells-au.json', 'spells/spells-bmt.json', 'spells/spells-efa.json',
    'spells/spells-egw.json', 'spells/spells-frhof.json', 'spells/spells-ftd.json',
    'spells/spells-ggr.json', 'spells/spells-idrotf.json', 'spells/spells-llk.json',
    'spells/spells-phb.json', 'spells/spells-sato.json', 'spells/spells-scc.json',
    'spells/spells-tce.json', 'spells/spells-xge.json'
)

$ok = 0
foreach ($f in $files) {
    $out = Join-Path $raw ($f -replace '/', '\')
    $dir = Split-Path $out -Parent
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
    try {
        Invoke-WebRequest -Uri ($dataBase + $f) -OutFile $out -UseBasicParsing
        $ok++
        Write-Host "  $f"
    } catch {
        Write-Warning "Failed: $f ($($_.Exception.Message))"
    }
}
Write-Host "Downloaded $ok / $($files.Count) 5etools JSON files into tools\raw."

if ($WithMaps) {
    Write-Host 'Downloading adventure player maps (only use if you own the book)…'
    $maps = @{
        'barovia.webp'         = '008-cos201.webp'
        'castle-walls.webp'    = 'map-4.02-walls-player.webp'
        'castle-main-floor.webp' = 'map-4.03-main-floor-player.webp'
        'castle-court.webp'    = 'map-4.04-court-player-revised.webp'
        'castle-weeping.webp'  = 'map-4.05-weeping-player.webp'
        'castle-spires.webp'   = 'map-4.06-spires12-player.webp'
        'castle-larders.webp'  = 'map-4.08-larders-player.webp'
        'castle-dungeons.webp' = 'map-4.09-dungeons-and-catacombs-player.webp'
        'village-barovia.webp' = '014-cos301.webp'
        'vallaki.webp'         = '048-cos05-02-player.webp'
        'old-bonegrinder.webp' = '073-cos601.webp'
        'krezk.webp'           = '084-cos801.webp'
        'amber-temple.webp'    = '118-cos1301.webp'
        'yester-hill.webp'     = '125-cos1401.webp'
        'werewolf-den.webp'    = '128-cos1501.webp'
        'wizard-of-wines.webp' = '112-cos1201.webp'
    }
    $mapDir = Join-Path $root 'assets\maps'
    New-Item -ItemType Directory -Force -Path $mapDir | Out-Null
    foreach ($k in $maps.Keys) {
        try {
            Invoke-WebRequest -Uri ($mapBase + $maps[$k]) -OutFile (Join-Path $mapDir $k) -UseBasicParsing
            Write-Host "  $k"
        } catch {
            Write-Warning "Map failed: $k"
        }
    }
}

Write-Host ''
Write-Host 'Next: dotnet run --project tools\DataBuilder -c Release'
