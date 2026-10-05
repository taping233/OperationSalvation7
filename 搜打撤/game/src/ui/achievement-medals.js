// 26 bespoke vector engravings. Each silhouette and central scene belongs to one achievement.
const MEDALS = {
  firstExtract: {
    colors: ['#eee1ae', '#a29861', '#4f5d4c'],
    frame: 'M60 8 99 28v53c0 21-20 36-39 48C41 117 21 102 21 81V28Z',
    scene: '<path d="M43 38h33v52H43zM48 42h23v44H48M66 43v42l-12 6V47z"/><path d="M21 66h27m-9-9 9 9-9 9M30 95h59M37 101h45"/><circle cx="66" cy="64" r="1.5" fill="currentColor"/>',
    ornament: '<path d="m28 28 32-15 32 15M28 33v36m64-36v36M46 114l14 9 14-9"/>',
  },
  extract3: {
    colors: ['#dee2bd', '#9fa678', '#546653'],
    frame: 'M60 7 109 55 92 111 60 132 28 111 11 55Z',
    scene: '<path d="M26 55h26l4 32H22zM32 55v-9h14v9M50 40h26l4 32H46zM56 40v-9h14v9M72 58h23l4 30H68zM78 58v-9h12v9M28 66h21M52 51h21M76 68h17M37 94h47"/>',
    ornament: '<path d="m24 39 36-25 36 25M20 67l14 38 26 17 26-17 14-38M50 111h20"/>',
  },
  kill10: {
    colors: ['#f0c4aa', '#be826b', '#644e4b'],
    frame: 'M18 16h84l-5 76-37 37-37-37Z',
    scene: '<path d="m32 38 19 6 9-8 9 8 19-6-8 28-20 29-20-29zM38 47l15 9-8 6M82 47l-15 9 8 6M50 70l10-6 10 6-10 13zM53 86l7 8 7-8M28 102l19-17m45 17L73 85"/><path d="m40 61 8 3m32-3-8 3" stroke-width="3.5"/>',
    ornament: '<path d="M24 22h72M28 27h64M26 36l4 52 30 30 30-30 4-52"/>',
  },
  firstBoss: {
    colors: ['#eed0ba', '#b97d63', '#724e43'],
    frame: 'M17 17h37l8-7 10 7h31v93l-43 22-43-22Z',
    scene: '<path d="M30 38h60v52H30zM30 52h60M30 67h60M30 81h60M45 38v14m29-14v14M39 52v15m24-15v15m20-15v15M47 67v14m28-14v14M38 81v9m25-9v9" stroke-width="1.5"/><path d="m59 25-8 24 15 6-14 20 11 7-11 23" stroke-width="5"/><path d="m59 25-8 24 15 6-14 20 11 7-11 23" stroke="#27312a" stroke-width="2"/>',
    ornament: '<path d="M23 26v79l37 20 37-20V26M32 108l28 15 28-15"/>',
  },
  allBoss: {
    colors: ['#ffe4b3', '#cdab67', '#696050'],
    frame: 'M60 10 71 20 87 14 94 31 110 38 105 57 116 70 105 85 110 101 92 108 86 124 69 119 60 133 49 120 32 124 26 108 10 101 15 85 5 70 15 57 10 38 27 31 33 14 49 20Z',
    scene: '<path d="m60 31 15 20-15 36-15-36zM45 51h30M60 31v56M30 46l13 17-7 25-15-26zM84 46l15 16-15 26-7-25zM24 101h72l-5 10H29zM32 96l4-8m24 12V87m24 9-4-8"/>',
    ornament: '<circle cx="60" cy="70" r="48"/><circle cx="60" cy="70" r="44" stroke-dasharray="2 4"/>',
  },
  rich30: {
    colors: ['#fff0b0', '#d9ac4f', '#786335'],
    frame: 'M60 9a52 52 0 1 1-1 0Z',
    scene: '<ellipse cx="48" cy="77" rx="25" ry="9"/><path d="M23 77v9c0 13 50 13 50 0v-9M24 86c10 12 38 12 48 0"/><ellipse cx="73" cy="60" rx="22" ry="8"/><path d="M51 60v17m44-17v17c0 8-12 11-23 10"/><circle cx="45" cy="44" r="18"/><path d="M50 33H40v11h10v10H39M45 29v29"/>',
    ornament: '<circle cx="60" cy="61" r="47"/><circle cx="60" cy="61" r="42" stroke-dasharray="1 4"/><path d="M37 116h46l-9 12H46Z"/>',
  },
  stash20: {
    colors: ['#dfcabb', '#ac8f72', '#6b6654'],
    frame: 'M23 10h74l13 13v94l-13 13H23l-13-13V23Z',
    scene: '<path d="M32 32h56v66H32zM37 37h46v56H37zM37 65h46M50 40v53m20-53v53"/><path d="M42 46h4v13h-4m13-13h10v13H55m21-13h3v13h-3M42 73h20v13H42m24-13h12v13H66"/><path d="M27 104h66"/>',
    ornament: '<path d="M19 28v84l9 9h64l9-9V28l-9-9H28Z"/><circle cx="25" cy="26" r="2"/><circle cx="95" cy="26" r="2"/><circle cx="25" cy="114" r="2"/><circle cx="95" cy="114" r="2"/>',
  },
  bagMax: {
    colors: ['#eee0b7', '#bba27a', '#67664e'],
    frame: 'M31 16h58l14 20v56l-22 36H39L17 92V36Z',
    scene: '<path d="M40 43V29h40v14M45 43V34h30v9M28 43h64v55H28zM28 56h64M32 79h56M45 56v23m30-23v23M55 57h10v11H55zM31 97l-9 10m67-10 9 10M20 63H9m0 0 5-5m-5 5 5 5M100 63h11m0 0-5-5m5 5-5 5"/>',
    ornament: '<path d="M34 23h52l10 16v49l-19 33H43L24 88V39Z" stroke-dasharray="3 4"/>',
  },
  safeMax: {
    colors: ['#e0ece0', '#9db6a4', '#566c5a'],
    frame: 'M60 25C28-6 5 21 14 49l11 36 35 47 35-47 11-36C115 21 92-6 60 25Z',
    scene: '<path d="m32 50 8-14 12 9h16l12-9 8 14-9 39-19 15-19-15zM44 61l9 7m23-7-9 7M52 80h16l-8 9zM47 94l13 9 13-9M40 39l4 13m32-13-4 13"/><path d="M38 113h44"/>',
    ornament: '<path d="M60 34C29 4 12 26 22 51l11 33 27 35 27-35 11-33c10-25-7-47-38-17Z"/>',
  },
  class3: {
    colors: ['#e8f0d6', '#b1c094', '#607552'],
    frame: 'M60 12C25 12 9 31 9 65c0 26 16 44 32 49l-3 18 22-12 22 12-3-18c16-5 32-23 32-49 0-34-16-53-51-53Z',
    scene: '<circle cx="60" cy="63" r="30"/><path d="m60 37 7 16 18 2-14 12 4 18-15-9-15 9 4-18-14-12 18-2zM29 41l-9 13 9 7-9 12 12 7-4 10 16 9M91 41l9 13-9 7 9 12-12 7 4 10-16 9"/>',
    ornament: '<path d="M40 110l20 9 20-9M26 42c-16 38 5 65 34 68 29-3 50-30 34-68"/>',
  },
  collectGold: {
    colors: ['#fff1b1', '#d2b46c', '#806b3e'],
    frame: 'M60 7 109 42 90 106 60 128 30 106 11 42Z',
    scene: '<circle cx="60" cy="61" r="31"/><circle cx="60" cy="61" r="24"/><path d="m60 39 5 14 15 2-12 9 4 15-12-8-12 8 4-15-12-9 15-2zM34 92l-4 14 16-3 14 13 14-13 16 3-4-14"/>',
    ornament: '<path d="m60 14 41 31-17 56-24 19-24-19-17-56Z"/><path d="M27 32l8 6m58-6-8 6M49 22h22"/>',
  },
  collectLegend: {
    colors: ['#e9d4fb', '#b18dc9', '#64536f'],
    frame: 'M60 6 74 25 100 19 95 46 115 62 94 78 99 108 73 105 60 132 47 105 21 108 26 78 5 62 25 46 20 19 46 25Z',
    scene: '<path d="M28 53c18-9 23-5 32 1 9-6 14-10 32-1v37c-18-8-25-6-32 0-7-6-14-8-32 0zM60 54v36M34 61l18 2M34 71l18 2M68 63l17-3M68 73l17-3"/><path d="m60 24 4 11 12 4-12 4-4 11-4-11-12-4 12-4zM41 103h38"/>',
    ornament: '<path d="m60 18 12 16 19-4-4 19 17 13-18 13 5 24-22-2-9 21-9-21-22 2 5-24-18-13 17-13-4-19 19 4Z"/>',
  },
  collect5: {
    colors: ['#e7ecd0', '#abc098', '#596d55'],
    frame: 'M60 9 104 34 104 99 60 130 16 99V34Z',
    scene: '<path d="M34 38h52v56H34zM60 53v28M51 55l-9-12m27 12 9-12M47 67H37m36 0h10M48 76l-9 10m33-10 9 10M60 58c-24-17-23 29 0 25 23 4 24-42 0-25Z"/><circle cx="60" cy="51" r="7"/><path d="M41 103h38M47 109h26"/>',
    ornament: '<path d="m60 16 37 22v57l-37 27-37-27V38Z"/><path d="M27 43v47m66-47v47" stroke-dasharray="2 4"/>',
  },
  petHatch1: {
    colors: ['#fff0cf', '#c4b382', '#767552'],
    frame: 'M60 7C32 7 13 53 13 84c0 24 21 46 47 46s47-22 47-46C107 53 88 7 60 7Z',
    scene: '<path d="M60 29C42 29 29 60 29 82c0 18 14 29 31 29s31-11 31-29C91 60 78 29 60 29Z"/><path d="m36 66 14 7 9-15 9 13 17-6M59 58l-5-11 8-6M40 92l9 7m18-1 7-7"/>',
    ornament: '<path d="M60 15C36 15 21 54 21 84c0 20 17 38 39 38s39-18 39-38C99 54 84 15 60 15Z" stroke-dasharray="2 4"/>',
  },
  petHatch3: {
    colors: ['#f2ddb6', '#bb9e76', '#745f4b'],
    frame: 'M15 32 32 17 60 25 88 17 105 32v59c0 22-28 33-45 40-17-7-45-18-45-40Z',
    scene: '<path d="M47 70C42 62 45 39 55 37c11-2 17 20 12 32M29 75c-10-5-9-23-2-31 9-11 20 11 19 28M72 75c-5-14 0-32 9-31 12 0 16 25 7 33M25 74q35 14 70 0l-9 24H35Z"/><path d="m24 83 71 1M30 92h59M36 104h48m-50-26 13 17m8-15 11 15m9-16 8 13"/>',
    ornament: '<path d="m22 35 12-11 26 9 26-9 12 11v55c0 18-22 27-38 33-16-6-38-15-38-33Z"/>',
  },
  petMax: {
    colors: ['#eaf0cd', '#adc187', '#5c774d'],
    frame: 'M60 9 108 43 90 121H30L12 43Z',
    scene: '<path d="M43 68q17-14 34 0c14 15 0 28-17 20-17 8-31-5-17-20Z"/><ellipse cx="37" cy="54" rx="5" ry="8"/><ellipse cx="50" cy="43" rx="5" ry="8"/><ellipse cx="69" cy="43" rx="5" ry="8"/><ellipse cx="82" cy="54" rx="5" ry="8"/><path d="m40 104 4-4 4 4-4 4zm12 0 4-4 4 4-4 4zm12 0 4-4 4 4-4 4zm12 0 4-4 4 4-4 4zM56 24l4-4 4 4-4 4z"/>',
    ornament: '<path d="m60 18 40 29-16 66H36L20 47ZM39 117l21 15 21-15"/>',
  },
  petAll: {
    colors: ['#f4dccc', '#c49487', '#795c59'],
    frame: 'M60 11c27 0 48 21 48 48v15c0 28-23 52-48 52S12 102 12 74V59c0-27 21-48 48-48Z',
    scene: '<path d="M43 84c-12-8-6-17-1-20l7-12h22l7 12c5 3 11 12-1 20l-17 12Z"/><path d="m46 57-5-13 13 8m20 5 5-13-13 8M47 70h3m20 0h3M55 81h10l-5 6zM26 39l4 6 7-1-4 6 2 7-7-3-6 4 1-7-5-5 7-1M92 39l4 6 7-1-4 6 2 7-7-3-6 4 1-7-5-5 7-1"/><path d="M34 111h52"/>',
    ornament: '<path d="M23 51c-9 34 4 56 24 63m50-63c9 34-4 56-24 63M18 69l9 2m-8 12 10-3m-6 16 9-6m2 17 8-8m60-30-9 2m8 12-10-3m6 16-9-6m-2 17-8-8M45 24h30"/>',
  },
  unlimitedEnergy: {
    colors: ['#fff2a2', '#dcc462', '#776b32'],
    frame: 'M60 6 116 118H4Z',
    scene: '<path d="m68 35-35 42h21l-3 30 36-44H65z" fill="currentColor" stroke-width="1"/><path d="m31 55-12 21 5 13m67-34 13 24-6 13M43 44l-5 8m45 43-7 9"/>',
    ornament: '<path d="m60 21 44 90H16ZM28 118l32 14 32-14"/>',
  },
  weaponMaster: {
    colors: ['#dce6e9', '#97b0b9', '#526b77'],
    frame: 'M60 7 72 29 102 19 93 51 115 69 92 84 98 119 70 109 60 133 50 109 22 119 28 84 5 69 27 51 18 19 48 29Z',
    scene: '<path d="M57 27h6v61h-6zM48 84h24M60 88v18M27 43l44 49m-48-53 12-6 4 13-6 6-10-3zM93 39 46 91m40-45 7-7 6 13-13 3zM25 88l54-54m-56 62 6-12m48-53 8-2-1 8M33 27l51 74m-47-68-4-6-8 5 9 7m44 62 10-6"/>',
    ornament: '<path d="m60 19 10 19 20-9-7 24 18 16-18 13 7 24-23-9-7 23-7-23-23 9 7-24-18-13 18-16-7-24 20 9Z"/>',
  },
  runeFan: {
    colors: ['#e3d5f4', '#b29bc9', '#68617d'],
    frame: 'M60 7 111 44 92 114H28L9 44Z',
    scene: '<path d="m60 31 11 16-11 16-11-16zM28 51l11 16-11 16-11-16zm64 0 11 16-11 16-11-16zM40 83l11 16-11 16-11-16zm40 0 11 16-11 16-11-16zM60 39v16m-6-8h12M28 59l-4 8 7 8m58-16 7 8-7 8M40 91l-4 8 4 8 4-8zM80 92l-5 7h10l-5 8"/>',
    ornament: '<path d="m60 17 42 30-16 60H34L18 47ZM44 125h32"/>',
  },
  savior: {
    colors: ['#e9f0d0', '#b1c090', '#536c58'],
    frame: 'M17 15h29l14-9 14 9h29v68c0 26-25 41-43 49-18-8-43-23-43-49Z',
    scene: '<path d="M51 46h18l6 53H45zM48 37h24v9H48zM54 27h12v10H54zM56 56h8v13h-8M23 59h15v40H23zM82 59h15v40H82zM19 99h82M27 53h7v6m52-6h7v6M26 67h9m50 0h9M25 80h9m52 0h9M51 36 27 24m42 12 24-12"/><path d="M41 109h38"/>',
    ornament: '<path d="M24 23h24l12-7 12 7h24v57c0 24-23 36-36 43-13-7-36-19-36-43Z"/>',
  },
  beautifulVase: {
    colors: ['#f2e0ef', '#b0b8d7', '#866f93'],
    frame: 'M60 8c30 0 47 18 47 42v43c0 21-25 37-47 40-22-3-47-19-47-40V50c0-24 17-42 47-42Z',
    scene: '<path d="M44 29h32l-6 19c-1 9 20 24 15 41-3 12-15 18-25 18s-22-6-25-18c-5-17 16-32 15-41zM43 35h34M47 46h26M38 94h44M45 102h30"/><path d="m60 49 13 20-13 24-13-24zM47 69h26M60 49v44"/><path d="M40 76q20-12 40 0" stroke="#d8b48e"/><path d="M40 83q20-10 40 0" stroke="#9cc4b6"/>',
    ornament: '<path d="M60 16c25 0 39 15 39 35v39c0 19-23 32-39 35-16-3-39-16-39-35V51c0-20 14-35 39-35Z"/><path d="m32 27 6 6m50-6-6 6M55 116h10"/>',
  },
  excuseMe: {
    colors: ['#cfe8de', '#8dbab0', '#4e7270'],
    frame: 'M66 7 109 32 102 88 77 132 36 118 10 77 21 27Z',
    scene: '<path d="m56 29 19 9-10 28 9 8 21 3-2 13H45l-8-12 15-17zM55 40l15 6M52 49l15 6M48 58l15 6M40 81h51M28 39l14-6M19 55h21M18 69h17M49 103h42M39 111h43"/><path d="M82 30c17 17 21 41 10 58M30 91c13 16 32 20 50 13"/>',
    ornament: '<path d="m65 15 36 22-7 48-21 38-32-12-22-35 9-43Z"/>',
  },
  labScore1: {
    colors: ['#eec6a8', '#bd8c64', '#75563f'],
    frame: 'M60 10 110 109H10Z',
    scene: '<path d="M47 37h26M52 37v25L37 88q-4 9 6 9h34q10 0 6-9L68 62V37M44 77h32"/><circle cx="54" cy="85" r="3"/><circle cx="65" cy="73" r="2"/><path d="M21 111l39 21 39-21"/>',
    ornament: '<path d="m60 24 38 77H22ZM41 118h38"/>',
  },
  labScore2: {
    colors: ['#f2f3ed', '#a7becb', '#5e7588'],
    frame: 'M60 7 109 36v67l-49 29-49-29V36Z',
    scene: '<path d="M42 31c36 0 0 67 36 67M78 31c-36 0 0 67-36 67M44 36h32M47 45h25M53 54h13M53 64h13M47 75h25M44 87h32M45 98h30"/><path d="M31 41v47m58-47v47M39 108h42"/>',
    ornament: '<path d="m60 15 42 25v59l-42 25-42-25V40Z"/><path d="M23 47v43m74-43v43" stroke-dasharray="2 4"/>',
  },
  labScore3: {
    colors: ['#fff4bd', '#d7b96a', '#897047'],
    frame: 'M38 10h44l27 28v66l-27 26H38l-27-26V38Z',
    scene: '<ellipse cx="60" cy="63" rx="36" ry="14"/><ellipse cx="60" cy="63" rx="36" ry="14" transform="rotate(60 60 63)"/><ellipse cx="60" cy="63" rx="36" ry="14" transform="rotate(120 60 63)"/><path d="m60 48 10 15-10 15-10-15z" fill="currentColor"/><path d="M38 110h44M45 117h30M42 24l8 5 10-8 10 8 8-5"/>',
    ornament: '<path d="M41 17h38l23 24v60l-23 22H41l-23-22V41Z"/><path d="M23 42v56m74-56v56M38 20l-12 13m56-13 12 13" stroke-dasharray="3 3"/>',
  },
};

export const ACHIEVEMENT_MEDAL_IDS = Object.freeze(Object.keys(MEDALS));

export function achievementMedalHTML(id, instance = 'tile') {
  const medal = MEDALS[id] || MEDALS.firstExtract;
  const number = String(ACHIEVEMENT_MEDAL_IDS.indexOf(id) + 1).padStart(2, '0');
  // Fixed catalogue keys only; no save values become SVG attributes or paint ids.
  const key = `medal-${ACHIEVEMENT_MEDAL_IDS.indexOf(id)}-${instance === 'detail' ? 'detail' : instance === 'watermark' ? 'watermark' : 'tile'}`;
  const [light, mid, dark] = medal.colors;
  return `<svg class="ag-badge" viewBox="0 0 120 140" aria-hidden="true" data-medal="${ACHIEVEMENT_MEDAL_IDS.includes(id) ? id : 'firstExtract'}">
    <defs><linearGradient id="${key}" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${light}"/><stop offset=".45" stop-color="${mid}"/><stop offset=".7" stop-color="${dark}"/><stop offset="1" stop-color="${light}"/></linearGradient><linearGradient id="${key}-plate" x2=".7" y2="1"><stop stop-color="#3f4b47"/><stop offset="1" stop-color="#222c29"/></linearGradient></defs>
    <path d="${medal.frame}" fill="url(#${key}-plate)" stroke="url(#${key})" stroke-width="4"/>
    <g fill="none" stroke="url(#${key})" stroke-width="1.1" opacity=".8">${medal.ornament}</g>
    <g fill="none" stroke="url(#${key})" color="${mid}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round">${medal.scene}</g>
    <text x="60" y="115" text-anchor="middle" fill="${light}" style="font-size:5.7px">WINTER · ${number}</text>
  </svg>`;
}
