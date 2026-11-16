<script lang="ts">
  // Abstract COMP03 reference diagram only; never a Save target, eligibility proof,
  // coordinate calculator, plan or operation command.
  export let locale = 'en';
  const COPY = {
  "en": {
    "title": "3 × 3 road reference pattern",
    "note": "Illustration only. The current save, eligibility and placement are not checked here.",
    "seed": "1 existing tile",
    "added": "8 proposed tiles",
    "summary": "Three by three reference pattern: one existing tile at the top left and eight proposed tiles."
  },
  "fr": {
    "title": "Motif de route de référence 3 × 3",
    "note": "Illustration uniquement. La sauvegarde actuelle, son admissibilité et le placement ne sont pas vérifiés ici.",
    "seed": "1 case existante",
    "added": "8 cases proposées",
    "summary": "Motif trois par trois : une case existante en haut à gauche et huit cases proposées."
  },
  "it": {
    "title": "Schema stradale di riferimento 3 × 3",
    "note": "Solo illustrazione. Il salvataggio attuale, l’idoneità e il posizionamento non sono verificati qui.",
    "seed": "1 casella esistente",
    "added": "8 caselle proposte",
    "summary": "Schema tre per tre: una casella esistente in alto a sinistra e otto caselle proposte."
  },
  "de": {
    "title": "3 × 3 Straßen-Referenzmuster",
    "note": "Nur eine Illustration. Aktueller Spielstand, Eignung und Platzierung werden hier nicht geprüft.",
    "seed": "1 vorhandene Kachel",
    "added": "8 vorgeschlagene Kacheln",
    "summary": "Drei-mal-drei-Muster: eine vorhandene Kachel oben links und acht vorgeschlagene Kacheln."
  },
  "es-ES": {
    "title": "Patrón de camino de referencia 3 × 3",
    "note": "Solo una ilustración. No se comprueban aquí la partida actual, la elegibilidad ni la colocación.",
    "seed": "1 casilla existente",
    "added": "8 casillas propuestas",
    "summary": "Patrón tres por tres: una casilla existente arriba a la izquierda y ocho casillas propuestas."
  },
  "ja": {
    "title": "道路の参考配置 3 × 3",
    "note": "参考図です。現在のセーブ、対象の適格性、配置の可否はここでは確認していません。",
    "seed": "既存の1マス",
    "added": "追加予定の8マス",
    "summary": "3 × 3の参考配置。左上の既存1マスを保持し、残りの8マスを追加する図。"
  },
  "zh-CN": {
    "title": "3 × 3 道路参考布局",
    "note": "仅供示意。此处不检查当前存档、适用条件或放置是否合法。",
    "seed": "1 个已有格子",
    "added": "8 个拟新增格子",
    "summary": "三乘三参考布局：左上角一个已有格子，其余八个为拟新增格子。"
  },
  "pt-BR": {
    "title": "Padrão de referência de caminho 3 × 3",
    "note": "Apenas uma ilustração. O save atual, a elegibilidade e a colocação não são verificados aqui.",
    "seed": "1 bloco existente",
    "added": "8 blocos propostos",
    "summary": "Padrão três por três: um bloco existente no canto superior esquerdo e oito blocos propostos."
  }
} as const;
  $: copy = Object.hasOwn(COPY, locale) ? COPY[locale as keyof typeof COPY] : COPY.en;
  const cells = ['seed', 'addition', 'addition', 'addition', 'addition', 'addition', 'addition', 'addition', 'addition'] as const;
</script>

<figure class="reference" data-comp03-reference-pattern>
  <figcaption>
    <strong>{copy.title}</strong>
    <p>{copy.note}</p>
  </figcaption>
  <div class="pattern" role="img" aria-label={copy.summary}>
    {#each cells as cell}
      <span class="cell" class:seed={cell === 'seed'} data-comp03-reference-cell={cell} aria-hidden="true">
        {cell === 'seed' ? '1' : '+'}
      </span>
    {/each}
  </div>
  <div class="legend">
    <span><span class="swatch existing" aria-hidden="true">1</span>{copy.seed}</span>
    <span><span class="swatch proposed" aria-hidden="true">+</span>{copy.added}</span>
  </div>
</figure>

<style>
  .reference { margin: 0; min-width: 0; display: grid; gap: .75rem; }
  figcaption { min-width: 0; overflow-wrap: anywhere; }
  figcaption p { margin: .25rem 0 0; font-size: .875rem; }
  .pattern { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: .25rem; width: min(100%, 12rem); }
  .cell { min-width: 0; aspect-ratio: 1; display: grid; place-items: center; box-sizing: border-box; border: 1px dashed currentColor; border-radius: .25rem; font-weight: 600; }
  .cell.seed { border: 2px solid currentColor; }
  .legend { display: flex; flex-wrap: wrap; gap: .5rem 1rem; font-size: .875rem; }
  .legend > span { display: inline-flex; align-items: center; gap: .35rem; min-width: 0; overflow-wrap: anywhere; }
  .swatch { box-sizing: border-box; flex: none; width: 1.25rem; height: 1.25rem; display: inline-grid; place-items: center; border-radius: .2rem; }
  .swatch.existing { border: 2px solid currentColor; }
  .swatch.proposed { border: 1px dashed currentColor; }
</style>
